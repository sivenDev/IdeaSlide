import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ask, message, save } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "../hooks/useWorkspaceStore";
import { useAutoSave } from "../hooks/useAutoSave";
import { useEditorSession } from "../hooks/useEditorSession";
import {
  createNewPresentation,
  openFile,
  saveFile,
  addRecentFile,
} from "../lib/tauriCommands";
import {
  canvasContentToSlide,
  getOrderedCanvasResources,
  projectWorkspaceToSlides,
} from "../lib/workspaceResources";
import { extractCameras, reorderCameras, type Camera } from "../lib/cameraUtils";
import {
  WORKSPACE_PANEL_DEFAULT_WIDTH,
  clampWorkspacePanelWidth,
} from "../lib/panelSizing";
import type { WorkspaceDocument } from "../types";
import { Toolbar } from "./Toolbar";
import { WorkspaceExplorer } from "./WorkspaceExplorer";
import { ResourceEditorHost } from "./ResourceEditorHost";
import { CameraList } from "./CameraList";
import { ResizableDivider } from "./ResizableDivider";

interface EditorLayoutProps {
  onGoHome: () => void;
  readOnly?: boolean;
  editorRefreshToken: number;
}

export function EditorLayout({ onGoHome, readOnly = false, editorRefreshToken }: EditorLayoutProps) {
  const { state, dispatch } = useWorkspaceStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(true);
  const [workspacePanelWidth, setWorkspacePanelWidth] = useState(WORKSPACE_PANEL_DEFAULT_WIDTH);
  const [isResizingWorkspace, setIsResizingWorkspace] = useState(false);
  const [showCameras, setShowCameras] = useState(true);
  const [cameraDrawingRequestToken, setCameraDrawingRequestToken] = useState(0);
  const [selectedCameraId, setSelectedCameraId] = useState<string>();
  const excalidrawApiRef = useRef<any>(null);

  const workspace = useMemo<WorkspaceDocument>(() => ({
    resources: state.resources,
    contents: state.contents,
    activeResourceId: state.activeResourceId,
    manifestExtra: state.manifestExtra,
  }), [state.resources, state.contents, state.activeResourceId, state.manifestExtra]);
  const activeResource = state.resources.find((resource) => resource.id === state.activeResourceId)
    ?? state.resources[0];
  const canvasResources = useMemo(
    () => getOrderedCanvasResources(state.resources),
    [state.resources],
  );
  const sessionCanvasResource = activeResource?.type === "canvas"
    ? activeResource
    : canvasResources[0];
  const currentSlide = useMemo(
    () => canvasContentToSlide(workspace, sessionCanvasResource),
    [workspace, sessionCanvasResource],
  );

  const {
    autoSaveVersion,
    draft,
    flushDraft,
    getContentsForPersistence,
    hasPendingCommit,
    updateDraft,
  } = useEditorSession({
    slide: currentSlide,
    resourceId: sessionCanvasResource.id,
    contents: state.contents,
    onCommit: (resourceId, payload) => {
      dispatch({
        type: "COMMIT_CANVAS",
        payload: { resourceId, slide: payload.slide },
      });
    },
    onDirty: () => {
      if (!readOnly) dispatch({ type: "MARK_DIRTY" });
    },
  });
  const updateDraftRef = useRef(updateDraft);
  useEffect(() => {
    updateDraftRef.current = updateDraft;
  }, [updateDraft]);

  const getWorkspaceForPersistence = useCallback((): WorkspaceDocument => ({
    ...workspace,
    contents: getContentsForPersistence(),
  }), [getContentsForPersistence, workspace]);
  const workspaceForPersistence = useMemo(
    () => getWorkspaceForPersistence(),
    [autoSaveVersion, getWorkspaceForPersistence],
  );
  const slidesForPersistence = useMemo(
    () => projectWorkspaceToSlides(workspaceForPersistence),
    [workspaceForPersistence],
  );
  const effectiveIsDirty = !readOnly && (state.isDirty || hasPendingCommit);

  useAutoSave({
    filePath: state.filePath,
    workspace: workspaceForPersistence,
    slides: slidesForPersistence,
    isDirty: effectiveIsDirty,
    onSaveStart: () => {
      flushDraft();
      setIsSaving(true);
      return getWorkspaceForPersistence();
    },
    onSaveComplete: () => {
      setIsSaving(false);
      dispatch({ type: "MARK_SAVED" });
    },
    onSaveError: (error) => {
      setIsSaving(false);
      console.error("Auto-save failed:", error);
    },
  });

  const cameras = useMemo(
    () => activeResource?.type === "canvas" ? extractCameras(draft.elements) : [],
    [activeResource?.type, draft.elements],
  );
  const activeCameraId = selectedCameraId && cameras.some((camera) => camera.id === selectedCameraId)
    ? selectedCameraId
    : undefined;

  useEffect(() => setSelectedCameraId(undefined), [activeResource?.id]);
  useEffect(() => {
    setSelectedCameraId((previous) =>
      previous && cameras.some((camera) => camera.id === previous) ? previous : undefined,
    );
  }, [cameras]);

  const canvasInitialScene = useMemo(() => ({
    ...currentSlide,
    elements: currentSlide.elements,
    appState: currentSlide.appState,
    files: currentSlide.files,
  }), [currentSlide.id]);
  const fileName = state.filePath?.split("/").pop();

  function handleNewIdea() {
    const { workspace: nextWorkspace } = createNewPresentation();
    dispatch({ type: "LOAD_WORKSPACE", payload: { workspace: nextWorkspace } });
  }

  async function handleOpenFile() {
    try {
      const { path, workspace: nextWorkspace } = await openFile();
      dispatch({ type: "LOAD_WORKSPACE", payload: { workspace: nextWorkspace, filePath: path } });
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  }

  async function handleSave() {
    if (!state.filePath) {
      await handleSaveAs();
      return;
    }
    try {
      setIsSaving(true);
      flushDraft();
      await saveFile(state.filePath, getWorkspaceForPersistence());
      dispatch({ type: "MARK_SAVED" });
      addRecentFile(state.filePath).catch(console.error);
    } catch (error) {
      console.error("Failed to save:", error);
      await message(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`, {
        title: "Save Error",
        kind: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAs() {
    try {
      const filePath = await save({
        filters: [{ name: "IdeaSlide", extensions: ["is"] }],
        defaultPath: fileName || "Untitled.is",
      });
      if (!filePath) return;
      flushDraft();
      const nextWorkspace = getWorkspaceForPersistence();
      await saveFile(filePath, nextWorkspace);
      dispatch({ type: "LOAD_WORKSPACE", payload: { workspace: nextWorkspace, filePath } });
      addRecentFile(filePath).catch(console.error);
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  }

  const handleSaveCallback = useCallback(handleSave, [
    state.filePath,
    flushDraft,
    getWorkspaceForPersistence,
    dispatch,
  ]);
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const handleKeyDown = async (event: KeyboardEvent) => {
      if ((isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        await handleSaveCallback();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleSaveCallback]);

  const handleGoHome = useCallback(async () => {
    if (effectiveIsDirty) {
      try {
        const shouldLeave = await ask("You have unsaved changes. Leave without saving?", {
          title: "Unsaved Changes",
          kind: "warning",
          okLabel: "Leave",
          cancelLabel: "Stay",
        });
        if (!shouldLeave) return;
      } catch (error) {
        console.error("Dialog error:", error);
        return;
      }
    }
    flushDraft();
    onGoHome();
  }, [effectiveIsDirty, flushDraft, onGoHome]);

  const handleSelectResource = useCallback((resourceId: string) => {
    flushDraft();
    dispatch({ type: "SET_ACTIVE_RESOURCE", payload: { resourceId } });
  }, [dispatch, flushDraft]);
  const handleAddResource = useCallback((resourceType: string, parentId: string | null) => {
    const resourceId = crypto.randomUUID();
    flushDraft();
    dispatch({ type: "ADD_RESOURCE", payload: { resourceType, resourceId, parentId } });
    return resourceId;
  }, [dispatch, flushDraft]);
  const handleMoveResource = useCallback((resourceId: string, parentId: string | null, index: number) => {
    flushDraft();
    dispatch({ type: "MOVE_RESOURCE", payload: { resourceId, parentId, index } });
  }, [dispatch, flushDraft]);
  const handleDeleteResource = useCallback(async (resourceId: string) => {
    const resource = state.resources.find((item) => item.id === resourceId);
    if (!resource) return;
    const hasChildren = state.resources.some((item) => item.parentId === resourceId);
    if (resource.type === "folder" && hasChildren) {
      const confirmed = await ask("Delete this folder and all supported resources inside it?", {
        title: "Delete Folder",
        kind: "warning",
        okLabel: "Delete",
        cancelLabel: "Cancel",
      });
      if (!confirmed) return;
    }
    flushDraft();
    dispatch({ type: "DELETE_RESOURCE", payload: { resourceId } });
  }, [dispatch, flushDraft, state.resources]);

  const handleSelectCamera = useCallback((camera: Camera) => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    setSelectedCameraId(camera.id);
    const element = api.getSceneElements().find((item: any) => item.id === camera.id);
    if (!element) return;
    api.setActiveTool({ type: "selection" });
    api.updateScene({ appState: { selectedElementIds: { [camera.id]: true } } });
    api.scrollToContent([element], { fitToContent: true, animate: true, duration: 300 });
  }, []);
  const handleDeleteCamera = useCallback((cameraId: string) => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    if (activeCameraId === cameraId) setSelectedCameraId(undefined);
    const elements = draft.elements.filter((element: any) => element.id !== cameraId);
    api.updateScene({
      elements,
      ...(activeCameraId === cameraId ? { appState: { selectedElementIds: {} } } : {}),
    });
  }, [activeCameraId, draft.elements]);
  const handleReorderCameras = useCallback((orderedCameraIds: string[]) => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    api.updateScene({ elements: reorderCameras(draft.elements, orderedCameraIds) });
  }, [draft.elements]);
  const handleToggleCameras = useCallback(() => {
    setShowCameras((visible) => !visible);
  }, []);
  const handleRequestCameraDrawing = useCallback(() => {
    setShowCameras(true);
    setCameraDrawingRequestToken((token) => token + 1);
  }, []);
  const handleStartPresentation = useCallback((mode: "preview" | "fullscreen") => {
    flushDraft();
    dispatch({ type: "START_PRESENTATION", payload: { mode } });
  }, [dispatch, flushDraft]);
  const handleStartPreview = useCallback(
    () => handleStartPresentation("preview"),
    [handleStartPresentation],
  );
  const handleStartFullscreen = useCallback(
    () => handleStartPresentation("fullscreen"),
    [handleStartPresentation],
  );

  return (
    <div className="flex h-screen flex-col bg-[#f7f7f8]">
      <Toolbar
        fileName={fileName}
        isDirty={effectiveIsDirty}
        isSaving={isSaving}
        onNewIdea={handleNewIdea}
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onGoHome={handleGoHome}
      />

      {state.activeSessions.size > 0 && (
        <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          Streaming: {Array.from(state.activeSessions.values()).map((session) => `${session.elements.length} elements`).join(", ")}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`h-full flex-shrink-0 overflow-hidden ${isResizingWorkspace ? "" : "transition-[width] duration-200"}`}
          style={{ width: showWorkspace ? workspacePanelWidth : 0 }}
        >
          <div className="h-full" style={{ width: workspacePanelWidth }}>
            <WorkspaceExplorer
              resources={state.resources}
              activeResourceId={state.activeResourceId}
              readOnly={readOnly}
              onSelect={handleSelectResource}
              onAdd={handleAddResource}
              onRename={(resourceId, name) => dispatch({ type: "RENAME_RESOURCE", payload: { resourceId, name } })}
              onMove={handleMoveResource}
              onDelete={handleDeleteResource}
            />
          </div>
        </div>
        <ResizableDivider
          side="left"
          isVisible={showWorkspace}
          size={workspacePanelWidth}
          onResize={(nextWidth) => setWorkspacePanelWidth(clampWorkspacePanelWidth(nextWidth))}
          onResizeStart={() => setIsResizingWorkspace(true)}
          onResizeEnd={() => setIsResizingWorkspace(false)}
          onToggle={() => setShowWorkspace((visible) => !visible)}
        />

        <main className="relative min-w-0 flex-1 overflow-hidden">
          <div className="absolute inset-0">
            <ResourceEditorHost
              resource={activeResource}
              slide={canvasInitialScene}
              onChange={(elements, appState, files) => updateDraftRef.current(elements, appState, files)}
              onApiReady={(api) => { excalidrawApiRef.current = api; }}
              editorRefreshToken={editorRefreshToken}
              cameraCount={cameras.length}
              isCameraListOpen={showCameras}
              onToggleCameras={handleToggleCameras}
              onStartPreview={handleStartPreview}
              onStartFullscreen={handleStartFullscreen}
              cameraDrawingRequestToken={cameraDrawingRequestToken}
            />
          </div>
        </main>

        <ResizableDivider side="right" isVisible={showCameras} onToggle={() => setShowCameras((visible) => !visible)} />
        <div className={`h-full flex-shrink-0 overflow-hidden transition-[width] duration-200 ${showCameras ? "w-[230px]" : "w-0"}`}>
          <div className="h-full w-[230px]">
            <CameraList
              cameras={cameras}
              activeCameraId={activeCameraId}
              onCameraSelect={handleSelectCamera}
              onCameraDelete={handleDeleteCamera}
              onReorder={handleReorderCameras}
              onAddCamera={readOnly ? undefined : handleRequestCameraDrawing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
