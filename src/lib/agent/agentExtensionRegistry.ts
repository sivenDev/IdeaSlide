import type { AgentExtension } from "./types.ts";

const extensions = new Map<string, AgentExtension>();

export function registerAgentExtension(extension: AgentExtension): () => void {
  if (extensions.has(extension.id)) throw new Error(`Agent extension is already registered: ${extension.id}`);
  extensions.set(extension.id, extension);
  return () => extensions.delete(extension.id);
}

export function getAgentExtension(id: string | undefined): AgentExtension | undefined {
  return id ? extensions.get(id) : undefined;
}

export function getAgentExtensionForFileType(fileType: string): AgentExtension | undefined {
  return Array.from(extensions.values()).find((extension) => extension.fileType === fileType);
}

export function getRegisteredAgentExtensions(): AgentExtension[] {
  return Array.from(extensions.values());
}
