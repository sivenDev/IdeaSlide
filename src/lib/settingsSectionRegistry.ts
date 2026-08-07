export type SettingsSectionId = "general" | "ai-provider" | "agent" | "ideasketch" | (string & {});

export interface SettingsSectionDefinition {
  id: SettingsSectionId;
  label: string;
  description: string;
  order: number;
  owner: "application" | "editor";
}

const sections = new Map<SettingsSectionId, SettingsSectionDefinition>();

export function registerSettingsSection(definition: SettingsSectionDefinition): () => void {
  if (sections.has(definition.id)) throw new Error(`Settings section is already registered: ${definition.id}`);
  sections.set(definition.id, definition);
  return () => sections.delete(definition.id);
}

export function getSettingsSections(): SettingsSectionDefinition[] {
  return Array.from(sections.values()).sort((left, right) => left.order - right.order);
}

[
  { id: "general", label: "General", description: "Application appearance and behavior", order: 10, owner: "application" },
  { id: "ai-provider", label: "AI Provider", description: "Model endpoint and secure credential", order: 20, owner: "application" },
  { id: "agent", label: "Agent", description: "Agent availability and runtime limits", order: 30, owner: "application" },
  { id: "ideasketch", label: "IdeaSketch", description: "Visual editor preferences", order: 100, owner: "editor" },
].forEach((definition) => registerSettingsSection(definition as SettingsSectionDefinition));
