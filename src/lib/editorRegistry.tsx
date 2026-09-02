import type { ComponentType } from "react";
import type {
  DocumentModel,
  DocumentSession,
  IdeaSketchDocument,
  IdeaSketchPage,
  MarkdownDocument,
  MarkdownEditorState,
} from "../types";
import type { ActiveAgentEditorBinding } from "./agent/types";
import { IdeaSketchEditor } from "../components/IdeaSketchEditor";
import { MarkdownEditor } from "../components/MarkdownEditor";

export interface DocumentEditorContributionProps {
  document: DocumentSession;
  readOnly: boolean;
  editorRefreshToken: number;
  onModelChange: (sessionId: string, model: DocumentModel) => void;
  onDirty: (sessionId: string) => void;
  onEditorStateChange: (sessionId: string, editorState: DocumentSession["editorState"]) => void;
  onRegisterSnapshot: (sessionId: string, provider?: () => DocumentModel) => void;
  onAutoSave: (sessionId: string, model: DocumentModel) => Promise<void>;
  onAutoSaveComplete: (sessionId: string) => void;
  onWriteRecovery: (sessionId: string, model: DocumentModel) => Promise<void>;
  onStartPresentation: (sessionId: string, page: IdeaSketchPage, mode: "preview" | "fullscreen") => void;
  onAgentBindingChange: (binding: ActiveAgentEditorBinding | undefined, documentId: string) => void;
  onOpenDocumentLink?: (href: string) => void;
  documentFullPath?: string;
}

interface EditorContribution {
  id: string;
  component: ComponentType<DocumentEditorContributionProps>;
}

function IdeaSketchContribution(props: DocumentEditorContributionProps) {
  const document = props.document as DocumentSession<IdeaSketchDocument>;
  return (
    <IdeaSketchEditor
      key={document.id}
      document={document}
      readOnly={props.readOnly}
      editorRefreshToken={props.editorRefreshToken}
      onModelChange={props.onModelChange}
      onDirty={props.onDirty}
      onEditorStateChange={(sessionId, activePageId) => props.onEditorStateChange(sessionId, { activePageId })}
      onRegisterSnapshot={props.onRegisterSnapshot}
      onAutoSave={props.onAutoSave}
      onAutoSaveComplete={props.onAutoSaveComplete}
      onWriteRecovery={props.onWriteRecovery}
      onStartPresentation={props.onStartPresentation}
      onAgentBindingChange={props.onAgentBindingChange}
    />
  );
}

function MarkdownContribution(props: DocumentEditorContributionProps) {
  const document = props.document as DocumentSession<MarkdownDocument>;
  return (
    <MarkdownEditor
      document={document}
      readOnly={props.readOnly}
      onModelChange={props.onModelChange}
      onEditorStateChange={(sessionId, markdown: MarkdownEditorState) => props.onEditorStateChange(sessionId, { markdown })}
      onRegisterSnapshot={props.onRegisterSnapshot}
      onAutoSave={props.onAutoSave}
      onAutoSaveComplete={props.onAutoSaveComplete}
      onWriteRecovery={props.onWriteRecovery}
      onAgentBindingChange={props.onAgentBindingChange}
      onOpenDocumentLink={props.onOpenDocumentLink}
      documentFullPath={props.documentFullPath}
    />
  );
}

const EDITOR_REGISTRY = new Map<string, EditorContribution>([
  ["ideasketch", { id: "ideasketch", component: IdeaSketchContribution }],
  ["markdown", { id: "markdown", component: MarkdownContribution }],
]);

export function getEditorContribution(id: string): EditorContribution | undefined {
  return EDITOR_REGISTRY.get(id);
}
