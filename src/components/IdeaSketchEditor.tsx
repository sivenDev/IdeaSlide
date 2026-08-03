import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentModel, DocumentSession, IdeaSketchDocument, IdeaSketchPage } from "../types";
import { useEditorSession } from "../hooks/useEditorSession";
import { useAutoSave } from "../hooks/useAutoSave";
import {
  createEmptyIdeaSketchPage,
  createIdeaSketchEditorState,
  ideaSketchReducer,
  type IdeaSketchAction,
  type IdeaSketchEditorState,
} from "../lib/ideaSketchReducer";
import { extractCameras, reorderCameras, type Camera } from "../lib/cameraUtils";
import { SlideCanvas } from "./SlideCanvas";
import { CameraList } from "./CameraList";
import { ResizableDivider } from "./ResizableDivider";
import { PageOrganizer } from "./PageOrganizer";

const CAMERA_PANEL_WIDTH = 244;

interface IdeaSketchEditorProps {
  document: DocumentSession<IdeaSketchDocument>;
  readOnly?: boolean;
  editorRefreshToken: number;
  onModelChange: (sessionId: string, model: IdeaSketchDocument) => void;
  onDirty: (sessionId: string) => void;
  onEditorStateChange: (sessionId: string, activePageId: string) => void;
  onRegisterSnapshot: (sessionId: string, provider?: () => IdeaSketchDocument) => void;
  onAutoSave: (sessionId: string, model: DocumentModel) => Promise<void>;
  onAutoSaveComplete: (sessionId: string) => void;
  onStartPresentation: (sessionId: string, page: IdeaSketchPage, mode: "preview" | "fullscreen") => void;
}

export function IdeaSketchEditor({
  document,
  readOnly = false,
  editorRefreshToken,
  onModelChange,
  onDirty,
  onEditorStateChange,
  onRegisterSnapshot,
  onAutoSave,
  onAutoSaveComplete,
  onStartPresentation,
}: IdeaSketchEditorProps) {
  if (!document.model) throw new Error("IdeaSketch document model is missing");
  const [editorState, setEditorState] = useState<IdeaSketchEditorState>(() =>
    createIdeaSketchEditorState(document.model!, document.editorState?.activePageId),
  );
  const editorStateRef = useRef(editorState);
  const emittedModelRef = useRef<IdeaSketchDocument | undefined>(undefined);
  const [showCameras, setShowCameras] = useState(false);
  const [cameraDrawingRequestToken, setCameraDrawingRequestToken] = useState(0);
  const [selectedCameraId, setSelectedCameraId] = useState<string>();
  const excalidrawApiRef = useRef<any>(null);

  useEffect(() => {
    if (!document.model || document.model === emittedModelRef.current) return;
    const next = createIdeaSketchEditorState(document.model, document.editorState?.activePageId);
    editorStateRef.current = next;
    setEditorState(next);
  }, [document.editorState?.activePageId, document.model]);

  const applyAction = useCallback((action: IdeaSketchAction, persistModel = true) => {
    const previous = editorStateRef.current;
    const next = ideaSketchReducer(previous, action);
    if (next === previous) return next;
    editorStateRef.current = next;
    setEditorState(next);
    if (next.activePageId !== previous.activePageId) {
      onEditorStateChange(document.id, next.activePageId);
      setSelectedCameraId(undefined);
    }
    if (persistModel && next.document !== previous.document) {
      emittedModelRef.current = next.document;
      onModelChange(document.id, next.document);
    }
    return next;
  }, [document.id, onEditorStateChange, onModelChange]);

  const activePage = editorState.document.pages.find((page) => page.id === editorState.activePageId)
    ?? editorState.document.pages[0]!;

  const handleCommit = useCallback((sessionId: string, pageId: string, payload: { slide: any }) => {
    if (sessionId !== document.id || payload.slide.id !== pageId) return;
    applyAction({ type: "UPDATE_PAGE_SCENE", pageId, page: payload.slide as IdeaSketchPage });
  }, [applyAction, document.id]);
  const handleDirty = useCallback(() => {
    if (!readOnly) onDirty(document.id);
  }, [document.id, onDirty, readOnly]);
  const { autoSaveVersion, draft, flushDraft, getEditVersion, hasPendingCommit, updateDraft } = useEditorSession({
    documentSessionId: document.id,
    page: activePage,
    onCommit: handleCommit,
    onDirty: handleDirty,
  });

  const flushAndGetDocument = useCallback(() => {
    flushDraft();
    return editorStateRef.current.document;
  }, [flushDraft]);

  useEffect(() => {
    onRegisterSnapshot(document.id, flushAndGetDocument);
    return () => onRegisterSnapshot(document.id, undefined);
  }, [document.id, flushAndGetDocument, onRegisterSnapshot]);

  useAutoSave({
    enabled: document.mode === "workspace" && !readOnly && document.status === "editable",
    sessionId: document.id,
    filePath: document.filePath,
    revision: autoSaveVersion,
    isDirty: document.isDirty || hasPendingCommit,
    getModel: flushAndGetDocument,
    getEditVersion,
    onSave: (model) => onAutoSave(document.id, model),
    onSaveComplete: () => onAutoSaveComplete(document.id),
    onSaveError: (error) => console.error(`Auto-save failed for ${document.displayName ?? document.filePath}:`, error),
  });

  const cameras = useMemo(() => extractCameras(draft.elements), [draft.elements]);
  const activeCameraId = selectedCameraId && cameras.some((camera) => camera.id === selectedCameraId)
    ? selectedCameraId
    : undefined;

  const selectPage = useCallback((pageId: string) => {
    flushDraft();
    applyAction({ type: "SELECT_PAGE", pageId }, false);
  }, [applyAction, flushDraft]);
  const addPage = useCallback(() => {
    flushDraft();
    applyAction({ type: "ADD_PAGE", page: createEmptyIdeaSketchPage(editorStateRef.current.document.pages.length) });
  }, [applyAction, flushDraft]);
  const renamePage = useCallback((pageId: string, title: string) => {
    applyAction({ type: "RENAME_PAGE", pageId, title });
  }, [applyAction]);
  const reorderPage = useCallback((pageId: string, toIndex: number) => {
    flushDraft();
    applyAction({ type: "REORDER_PAGE", pageId, toIndex });
  }, [applyAction, flushDraft]);
  const deletePage = useCallback((pageId: string) => {
    flushDraft();
    applyAction({ type: "DELETE_PAGE", pageId });
  }, [applyAction, flushDraft]);

  const selectCamera = useCallback((camera: Camera) => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    setSelectedCameraId(camera.id);
    const element = api.getSceneElements().find((item: any) => item.id === camera.id);
    if (!element) return;
    api.setActiveTool({ type: "selection" });
    api.updateScene({ appState: { selectedElementIds: { [camera.id]: true } } });
    api.scrollToContent([element], { fitToContent: true, animate: true, duration: 300 });
  }, []);
  const deleteCamera = useCallback((cameraId: string) => {
    const api = excalidrawApiRef.current;
    if (!api || readOnly) return;
    api.updateScene({
      elements: draft.elements.filter((element: any) => element.id !== cameraId),
      ...(activeCameraId === cameraId ? { appState: { selectedElementIds: {} } } : {}),
    });
    if (activeCameraId === cameraId) setSelectedCameraId(undefined);
  }, [activeCameraId, draft.elements, readOnly]);
  const reorderCameraList = useCallback((orderedCameraIds: string[]) => {
    if (!readOnly) excalidrawApiRef.current?.updateScene({ elements: reorderCameras(draft.elements, orderedCameraIds) });
  }, [draft.elements, readOnly]);
  const startPresentation = useCallback((mode: "preview" | "fullscreen") => {
    const model = flushAndGetDocument();
    const page = model.pages.find((candidate) => candidate.id === editorStateRef.current.activePageId);
    if (page) onStartPresentation(document.id, page, mode);
  }, [document.id, flushAndGetDocument, onStartPresentation]);
  const handleApiReady = useCallback((api: any) => {
    excalidrawApiRef.current = api;
  }, []);
  const toggleCameras = useCallback(() => setShowCameras((visible) => !visible), []);

  return (
    <div className="ideanote-ideasketch-editor">
      <div className="ideanote-ideasketch-editor__chrome">
        <PageOrganizer
          pages={editorState.document.pages}
          activePageId={editorState.activePageId}
          readOnly={readOnly}
          onSelect={selectPage}
          onAdd={addPage}
          onRename={renamePage}
          onReorder={reorderPage}
          onDelete={deletePage}
        />
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <SlideCanvas
            slideId={activePage.id}
            elements={draft.elements}
            appState={draft.appState}
            files={draft.files}
            onChange={updateDraft}
            onApiReady={handleApiReady}
            viewMode={readOnly}
            editorRefreshToken={editorRefreshToken}
            cameraCount={cameras.length}
            isCameraListOpen={showCameras}
            onToggleCameras={toggleCameras}
            cameraDrawingRequestToken={cameraDrawingRequestToken}
          />
        </main>
        <ResizableDivider side="right" isVisible={showCameras} onToggle={toggleCameras} />
        <div className="h-full flex-shrink-0 overflow-hidden transition-[width] duration-200" style={{ width: showCameras ? CAMERA_PANEL_WIDTH : 0 }}>
          <div className="h-full" style={{ width: CAMERA_PANEL_WIDTH }}>
            <CameraList
              cameras={cameras}
              activeCameraId={activeCameraId}
              onCameraSelect={selectCamera}
              onCameraDelete={deleteCamera}
              onReorder={reorderCameraList}
              onAddCamera={readOnly ? undefined : () => {
                setShowCameras(true);
                setCameraDrawingRequestToken((token) => token + 1);
              }}
              onStartPreview={() => startPresentation("preview")}
              onStartFullscreen={() => startPresentation("fullscreen")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
