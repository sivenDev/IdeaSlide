import type { IdeaSketchPage } from "../types";
import type { Camera } from "../lib/cameraUtils";
import { CameraList } from "./CameraList";
import { PageOrganizer } from "./PageOrganizer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/Tabs";

export type IdeaSketchNavigatorTab = "pages" | "cameras";

interface IdeaSketchNavigatorProps {
  activeTab: IdeaSketchNavigatorTab;
  pages: IdeaSketchPage[];
  activePageId: string;
  cameras: Camera[];
  activeCameraId?: string;
  readOnly?: boolean;
  onTabChange: (tab: IdeaSketchNavigatorTab) => void;
  onPageSelect: (pageId: string) => void;
  onPageAdd: () => void;
  onPageRename: (pageId: string, title: string) => void;
  onPageReorder: (pageId: string, toIndex: number) => void;
  onPageDelete: (pageId: string) => void;
  onCameraSelect: (camera: Camera) => void;
  onCameraDelete: (cameraId: string) => void;
  onCameraReorder: (orderedCameraIds: string[]) => void;
  onAddCamera?: () => void;
  onStartPreview: () => void;
  onStartFullscreen: () => void;
}

export function IdeaSketchNavigator({
  activeTab,
  pages,
  activePageId,
  cameras,
  activeCameraId,
  readOnly = false,
  onTabChange,
  onPageSelect,
  onPageAdd,
  onPageRename,
  onPageReorder,
  onPageDelete,
  onCameraSelect,
  onCameraDelete,
  onCameraReorder,
  onAddCamera,
  onStartPreview,
  onStartFullscreen,
}: IdeaSketchNavigatorProps) {
  return (
    <aside className="idea-slide-side-panel idea-slide-ideasketch-navigator" aria-label="IdeaSketch navigator">
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as IdeaSketchNavigatorTab)}
        className="idea-slide-ideasketch-navigator__tabs"
      >
        <div className="idea-slide-ideasketch-navigator__tab-bar">
          <TabsList className="idea-slide-ideasketch-navigator__tab-list" aria-label="Pages and cameras">
            <TabsTrigger value="pages" className="idea-slide-ideasketch-navigator__tab">
              <span>Pages</span>
              <span className="idea-slide-ideasketch-navigator__tab-count">{pages.length}</span>
            </TabsTrigger>
            <TabsTrigger value="cameras" className="idea-slide-ideasketch-navigator__tab">
              <span>Cameras</span>
              <span className="idea-slide-ideasketch-navigator__tab-count">{cameras.length}</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="pages" className="idea-slide-ideasketch-navigator__content">
          <PageOrganizer
            pages={pages}
            activePageId={activePageId}
            readOnly={readOnly}
            onSelect={onPageSelect}
            onAdd={onPageAdd}
            onRename={onPageRename}
            onReorder={onPageReorder}
            onDelete={onPageDelete}
          />
        </TabsContent>
        <TabsContent value="cameras" className="idea-slide-ideasketch-navigator__content">
          <CameraList
            cameras={cameras}
            activeCameraId={activeCameraId}
            readOnly={readOnly}
            onCameraSelect={onCameraSelect}
            onCameraDelete={onCameraDelete}
            onReorder={onCameraReorder}
            onAddCamera={onAddCamera}
            onStartPreview={onStartPreview}
            onStartFullscreen={onStartFullscreen}
          />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
