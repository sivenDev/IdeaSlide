import * as Dialog from "@radix-ui/react-dialog";
import { Bot, BrainCircuit, FileText, MonitorCog, Palette, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { getSettingsSections, type SettingsSectionId } from "../lib/settingsSectionRegistry";
import { AgentSettings } from "./settings/AgentSettings";
import { AiProviderSettings } from "./settings/AiProviderSettings";
import { GeneralSettings } from "./settings/GeneralSettings";
import { IdeaSketchSettings } from "./settings/IdeaSketchSettings";
import { MarkdownSettings } from "./settings/MarkdownSettings";

const sectionIcons: Record<string, typeof Settings2> = {
  general: MonitorCog,
  "ai-provider": BrainCircuit,
  agent: Bot,
  ideasketch: Palette,
  markdown: FileText,
};

function SectionContent({ section }: { section: SettingsSectionId }) {
  if (section === "general") return <GeneralSettings />;
  if (section === "ai-provider") return <AiProviderSettings />;
  if (section === "agent") return <AgentSettings />;
  if (section === "ideasketch") return <IdeaSketchSettings />;
  if (section === "markdown") return <MarkdownSettings />;
  return <div className="text-sm text-gray-500">This settings section is not available.</div>;
}

export function SettingsCenter({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const sections = getSettingsSections();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(sections[0]?.id ?? "general");
  const { saving, error } = useSettings();

  useEffect(() => {
    if (open && !sections.some((section) => section.id === activeSection)) {
      setActiveSection(sections[0]?.id ?? "general");
    }
  }, [activeSection, open, sections]);

  const groups = ["Application", "AI", "Editors"] as const;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ideanote-settings-overlay" />
        <Dialog.Content className="ideanote-settings-dialog" aria-describedby="settings-description">
          <header className="ideanote-settings-header">
            <div>
              <Dialog.Title className="ideanote-settings-dialog__title">Settings</Dialog.Title>
              <Dialog.Description id="settings-description" className="sr-only">Application settings</Dialog.Description>
            </div>
            <div className="flex items-center gap-3">
              {saving && <span className="text-xs text-gray-400">Saving…</span>}
              <Dialog.Close className="ideanote-settings-close" aria-label="Close Settings"><X aria-hidden size={17} /></Dialog.Close>
            </div>
          </header>
          <div className="flex min-h-0 flex-1">
            <nav className="ideanote-settings-nav" aria-label="Settings sections">
              {groups.map((group) => (
                <div key={group} className="ideanote-settings-nav__group">
                  <div className="ideanote-settings-nav__group-label">{group}</div>
                  {sections.filter((section) => section.group === group).map((section) => {
                    const Icon = sectionIcons[section.id] ?? Settings2;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        className={`ideanote-settings-nav__item ${activeSection === section.id ? "is-active" : ""}`}
                        onClick={() => setActiveSection(section.id)}
                      >
                        <Icon aria-hidden size={15} />
                        <span>{section.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
            <main className="ideanote-settings-content">
              {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
              <SectionContent section={activeSection} />
            </main>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
