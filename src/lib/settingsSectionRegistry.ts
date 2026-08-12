export type SettingsSectionId = "general" | "ai-provider" | "agent" | "skills" | "ideasketch" | (string & {});
export type SettingsSectionIcon = "settings" | "bot" | "sparkles" | "blocks" | "shapes" | "file-text";

export interface SettingsSectionDefinition {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: SettingsSectionIcon;
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
  { id: "general", label: "General", description: "Appearance and application preferences", icon: "settings", order: 10, owner: "application", group: "Application" },
  { id: "ai-provider", label: "AI Provider", description: "Connection, credentials, and model selection", icon: "bot", order: 20, owner: "application", group: "AI" },
  { id: "agent", label: "Agent", description: "Availability, runtime, and conversation policy", icon: "sparkles", order: 30, owner: "application", group: "AI" },
  { id: "skills", label: "Skills", description: "Bundled and imported Agent Skills", icon: "blocks", order: 40, owner: "application", group: "AI" },
  { id: "ideasketch", label: "IdeaSketch", description: "Visual editor and presentation preferences", icon: "shapes", order: 100, owner: "editor", group: "Editors" },
  { id: "markdown", label: "Markdown", description: "Text editor preferences", icon: "file-text", order: 110, owner: "editor", group: "Editors" },
].forEach((definition) => registerSettingsSection(definition as SettingsSectionDefinition));
