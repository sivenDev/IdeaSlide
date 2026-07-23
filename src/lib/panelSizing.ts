export const WORKSPACE_PANEL_DEFAULT_WIDTH = 240;
export const WORKSPACE_PANEL_MIN_WIDTH = 180;
export const WORKSPACE_PANEL_MAX_WIDTH = 420;

export function clampWorkspacePanelWidth(width: number): number {
  if (!Number.isFinite(width)) return WORKSPACE_PANEL_DEFAULT_WIDTH;
  return Math.min(
    WORKSPACE_PANEL_MAX_WIDTH,
    Math.max(WORKSPACE_PANEL_MIN_WIDTH, width),
  );
}
