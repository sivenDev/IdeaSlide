import { FilePlus2, FolderOpen, History } from "lucide-react";

export function WorkbenchWelcome({
  hasRecents,
  onOpenRecent,
  onOpenFile,
  onNewFile,
}: {
  hasRecents: boolean;
  onOpenRecent: () => void;
  onOpenFile: () => void;
  onNewFile: () => void;
}) {
  return (
    <div className="ideanote-workbench-welcome">
      <div className="ideanote-workbench-welcome__mark" aria-hidden="true">Workspace ready</div>
      <h1>Welcome</h1>
      <p>Open a recent document, choose a file, or create a new editor surface.</p>
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
      </div>
    </div>
  );
}
