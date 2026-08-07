import type { DocumentModel, DocumentSession } from "../../types";

export interface AgentToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AgentSkillMetadata {
  id: string;
  name: string;
  description: string;
}

export interface AgentRunRequest {
  runId: string;
  prompt: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  skillId?: string;
  context: Record<string, unknown>;
  tools: AgentToolDescriptor[];
  messages: Array<Pick<AgentMessage, "role" | "content">>;
}

export interface AgentRunResponse {
  runId: string;
  text: string;
  skillId?: string;
}

export type AgentRunEvent =
  | { type: "started"; runId: string }
  | { type: "textDelta"; runId: string; text: string }
  | { type: "completed"; runId: string; text: string; skillId?: string }
  | { type: "cancelled"; runId: string }
  | { type: "error"; runId: string; message: string };

export interface AgentChangeSet<TOperation = unknown> {
  id: string;
  extensionId: string;
  documentId: string;
  baseRevision: number;
  baseDocumentStatus?: DocumentSession["status"];
  baseSourceModified?: string;
  sourceFingerprint: string;
  summary: string;
  operations: TOperation[];
  status: "proposed" | "applied" | "rejected" | "stale";
}

export interface AgentExtension<TModel extends DocumentModel = DocumentModel, TOperation = unknown> {
  id: string;
  fileType: string;
  skillId: string;
  tools: AgentToolDescriptor[];
  buildContext(model: TModel, activePageId: string | undefined, revision: number): Record<string, unknown>;
  parseChangeSet(response: string, documentId: string, revision: number, model: TModel): AgentChangeSet<TOperation> | undefined;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}
