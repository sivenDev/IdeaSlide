import type { RecoveryDraft } from "../lib/recovery";

interface RecoveryPromptProps {
  draft: RecoveryDraft;
  sourceChanged: boolean;
  onRestore: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function RecoveryPrompt({ draft, sourceChanged, onRestore, onDiscard, onCancel }: RecoveryPromptProps) {
  return (
    <div className="ideanote-recovery-prompt" role="dialog" aria-label="Recovery draft available">
      <div>
        <strong>Unsaved recovery draft found</strong>
        <span>{sourceChanged ? "The source file changed after this draft. Restore it into memory and review before saving." : `Recovered from ${new Date(draft.timestamp).toLocaleString()}.`}</span>
      </div>
      <div>
        <button type="button" className="is-primary" onClick={onRestore}>Restore</button>
        <button type="button" onClick={onDiscard}>Discard</button>
        <button type="button" onClick={onCancel}>Not now</button>
      </div>
    </div>
  );
}
