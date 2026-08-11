import { FilePlus2, FolderOpen, History, Settings } from "lucide-react";

export function WorkbenchWelcome({
  hasRecents,
  onOpenRecent,
  onOpenFile,
  onOpenWorkspace,
  onNewFile,
  onOpenSettings,
}: {
  hasRecents: boolean;
  onOpenRecent: () => void;
  onOpenFile: () => void;
  onOpenWorkspace: () => void;
  onNewFile: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="ideanote-workbench-welcome">
      <div className="ideanote-workbench-welcome__mark" aria-hidden="true">IN</div>
      <h1>Welcome</h1>
      <p>Open a local file or Workspace to begin.</p>
      <div className="ideanote-workbench-welcome__actions">
        {hasRecents && (
          <button type="button" onClick={onOpenRecent}>
            <History aria-hidden size={15} />
            <span>Open most recent</span>
            <kbd>↵</kbd>
          </button>
        )}
        <button type="button" onClick={onOpenFile}>
          <FolderOpen aria-hidden size={15} />
          <span>Open File</span>
        </button>
        <button type="button" onClick={onNewFile}>
          <FilePlus2 aria-hidden size={15} />
          <span>New File</span>
        </button>
        <button type="button" onClick={onOpenWorkspace}>
          <FolderOpen aria-hidden size={15} />
          <span>Open Workspace</span>
        </button>
      </div>
      <button className="ideanote-workbench-welcome__settings" type="button" onClick={onOpenSettings}>
        <Settings aria-hidden size={14} /> Settings
      </button>
    </div>
  );
}
