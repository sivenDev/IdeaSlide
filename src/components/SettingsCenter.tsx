import * as Dialog from "@radix-ui/react-dialog";
import { Bot, BrainCircuit, MonitorCog, Palette, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { getSettingsSections, type SettingsSectionId } from "../lib/settingsSectionRegistry";
import { AgentSettings } from "./settings/AgentSettings";
import { AiProviderSettings } from "./settings/AiProviderSettings";
import { GeneralSettings } from "./settings/GeneralSettings";
import { IdeaSketchSettings } from "./settings/IdeaSketchSettings";

const sectionIcons: Record<string, typeof Settings2> = {
  general: MonitorCog,
  "ai-provider": BrainCircuit,
  agent: Bot,
  ideasketch: Palette,
};

function SectionContent({ section }: { section: SettingsSectionId }) {
  if (section === "general") return <GeneralSettings />;
  if (section === "ai-provider") return <AiProviderSettings />;
  if (section === "agent") return <AgentSettings />;
  if (section === "ideasketch") return <IdeaSketchSettings />;
  return <div className="ideanote-settings-lead">This settings section is not available.</div>;
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ideanote-settings-overlay" />
        <Dialog.Content className="ideanote-settings-dialog">
          <header className="ideanote-settings-header">
            <div className="flex items-center gap-3">
              <div className="ideanote-settings-logo"><Settings2 aria-hidden size={18} /></div>
              <div>
                <Dialog.Title className="ideanote-settings-dialog-title">Settings</Dialog.Title>
                <Dialog.Description className="ideanote-settings-dialog-description">
                  Configure IdeaNote, AI, and editor extensions.
                </Dialog.Description>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {saving && <span className="ideanote-settings-saving">Saving…</span>}
              <Dialog.Close className="ideanote-settings-close" aria-label="Close Settings"><X aria-hidden size={17} /></Dialog.Close>
            </div>
          </header>
          <div className="flex min-h-0 flex-1">
            <nav className="ideanote-settings-nav" aria-label="Settings sections">
              {sections.map((section) => {
                const Icon = sectionIcons[section.id] ?? Settings2;
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={`ideanote-settings-nav__item ${activeSection === section.id ? "is-active" : ""}`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <Icon aria-hidden size={16} />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </nav>
            <main className="ideanote-settings-content">
              {error && <div className="ideanote-settings-error">{error}</div>}
              <SectionContent section={activeSection} />
            </main>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
