import { exportToBlob } from "@excalidraw/excalidraw";
import type { IdeaSketchPage } from "../types";
import { extractPreviewAppState } from "./previewKeys";

export const PAGE_THUMBNAIL_MAX_DIMENSION = 440;
export const PAGE_THUMBNAIL_EXPORT_PADDING = 16;

export interface PageThumbnailExportResult {
  blob: Blob | null;
  durationMs: number;
}

export async function exportPageThumbnail(
  page: Pick<IdeaSketchPage, "elements" | "appState" | "files">,
): Promise<PageThumbnailExportResult> {
  const elements = page.elements.filter((element: any) => !element.isDeleted);
  if (elements.length === 0) return { blob: null, durationMs: 0 };

  const startedAt = performance.now();
  const blob = await exportToBlob({
    elements: elements as any,
    appState: {
      ...extractPreviewAppState(page.appState),
      exportBackground: true,
    },
    files: page.files as any,
    mimeType: "image/png",
    maxWidthOrHeight: PAGE_THUMBNAIL_MAX_DIMENSION,
    exportPadding: PAGE_THUMBNAIL_EXPORT_PADDING,
  });
  return { blob, durationMs: performance.now() - startedAt };
}
