import { Bot, FileQuestion, X } from "lucide-react";
import { IdeaSketchEditor } from "../../editors/ideasketch/IdeaSketchEditor.jsx";
import { MarkdownEditor } from "../../editors/markdown/MarkdownEditor.jsx";
import { fileTypeRegistry } from "../../lib/fileTypeRegistry.js";
import { documentCondition } from "../../lib/documentSessions.js";
import { RecoveryPrompt } from "../dialogs/RecoveryPrompt.jsx";
import { DocumentProblemNotice } from "../notices/DocumentProblemNotice.jsx";
import { ExternalChangeNotice } from "../notices/ExternalChangeNotice.jsx";

function Welcome({ onOpenRecent, onOpenFile, onNewFile }) {
  return (
    <div className="welcome-panel">
      <span className="welcome-eyebrow">Workspace ready</span>
      <h1>Welcome</h1>
      <p>Open a recent document, choose a mock file, or create a new editor surface.</p>
      <div className="welcome-actions">
        <button type="button" onClick={onOpenRecent}>Open most recent <kbd>↵</kbd></button>
        <button type="button" onClick={onOpenFile}>Open File</button>
        <button type="button" onClick={onNewFile}>New File</button>
      </div>
      <div className="welcome-footnote">Backend behavior is simulated inside this review build.</div>
    </div>
  );
}

function UnsupportedFileView({ document }) {
  return (
    <div className="unsupported-view">
      <FileQuestion size={24} />
      <h2>No editor is registered for this file</h2>
      <p><code>{document.name}</code> is visible because it was opened explicitly. Workspace Explorer only lists supported documents.</p>
      <span>Read-only mock preview</span>
      <pre>{String(document.content).slice(0, 500)}</pre>
    </div>
  );
}

function EditorSurface({ document, onChange, onRegisterAdapter, laserEnabled, markdownLineNumbers }) {
  if (document.type === "unsupported") return <UnsupportedFileView document={document} />;
  if (document.type === "markdown") return <MarkdownEditor document={document} onChange={onChange} onRegisterAdapter={onRegisterAdapter} showLineNumbers={markdownLineNumbers} />;
  return <IdeaSketchEditor document={document} onChange={onChange} onRegisterAdapter={onRegisterAdapter} laserEnabled={laserEnabled} />;
}

export function EditorHost({ document, onSaveAs, onClose, onChange, onOpenRecent, onOpenFile, onNewFile, agentOpen, onToggleAgent, onRegisterAdapter, laserEnabled = true, markdownLineNumbers = false, agentEnabled = true, onPatchDocument, onReloadDocument }) {
  const definition = document ? fileTypeRegistry[document.type] ?? fileTypeRegistry.unsupported : null;
  const condition = documentCondition(document);
  return (
    <section className="editor-region" aria-label="Editor Host">
      <header className="editor-crown" data-tauri-drag-region>
        <div className="document-identity">
          {document && (
            <button className={`document-status-close document-status-close--${condition.tone}`} type="button" aria-label={`${condition.label}. Close ${document.name}`} data-tooltip={`${condition.label} · Close document`} onClick={onClose}>
              <span className="document-status-close__state" aria-hidden="true" />
              <X className="document-status-close__close" size={13} aria-hidden="true" />
            </button>
          )}
          {document && <span className={`document-icon file-glyph file-glyph--${definition.tone}`}>{definition.badge}</span>}
          <span className="document-copy">
            <strong>{document?.name ?? "Welcome"}</strong>
            <small>{document ? (document.mode === "workspace" ? `${document.workspaceName} / ${document.path}` : document.path) : "Choose a file to begin"}</small>
          </span>
        </div>
      </header>
      {document && <span className="sr-only" role="status" aria-live="polite">{condition.label}</span>}
      <div className="editor-aperture">
        {!document ? <Welcome onOpenRecent={onOpenRecent} onOpenFile={onOpenFile} onNewFile={onNewFile} /> : <EditorSurface key={document.sessionId} document={document} onChange={onChange} onRegisterAdapter={onRegisterAdapter} laserEnabled={laserEnabled} markdownLineNumbers={markdownLineNumbers} />}
      </div>
      {document && agentEnabled && !agentOpen && (
        <button className="panel-toggle panel-toggle--agent" type="button" aria-label="Show Agent" aria-pressed="false" data-tooltip="Show Agent" onClick={onToggleAgent}>
          <Bot size={16} />
        </button>
      )}
      <div className="editor-problem-stack">
        <RecoveryPrompt document={document} onRestore={() => onPatchDocument({ content: document.recoveryContent, dirty: true, status: "dirty", recoveryAvailable: false, recoveryError: null, revision: document.revision + 1 })} onDiscard={() => onPatchDocument({ recoveryAvailable: false, recoveryError: null, recoveryContent: null })} />
        <ExternalChangeNotice document={document} onReload={onReloadDocument} onKeep={() => onPatchDocument({ sourceModified: false, externalClean: false, renamedFrom: null })} onSaveAs={onSaveAs} onCancel={() => onPatchDocument({ problemDismissed: true })} />
        <DocumentProblemNotice document={document} onClose={onClose} onSaveAs={onSaveAs} onDismiss={() => onPatchDocument({ metadataWarning: null })} />
      </div>
    </section>
  );
}
