export type SettingsSectionId = "general" | "ai-provider" | "agent" | "ideasketch" | (string & {});

export interface SettingsSectionDefinition {
  id: SettingsSectionId;
  label: string;
  description: string;
  order: number;
  owner: "application" | "editor";
  group: "Application" | "AI" | "Editors";
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
  { id: "general", label: "Appearance", description: "Application theme", order: 10, owner: "application", group: "Application" },
  { id: "ai-provider", label: "Provider", description: "Endpoint and model", order: 20, owner: "application", group: "AI" },
  { id: "agent", label: "Agent", description: "Availability and policy", order: 30, owner: "application", group: "AI" },
  { id: "ideasketch", label: "IdeaSketch", description: "Visual editor preferences", order: 100, owner: "editor", group: "Editors" },
  { id: "markdown", label: "Markdown", description: "Text editor preferences", order: 110, owner: "editor", group: "Editors" },
].forEach((definition) => registerSettingsSection(definition as SettingsSectionDefinition));
