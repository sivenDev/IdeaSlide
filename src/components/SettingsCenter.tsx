import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SettingsDraftProvider, useSettingsDraft } from "../hooks/useSettings";
import { getSettingsSections, type SettingsSectionId } from "../lib/settingsSectionRegistry";
import { AgentSettings } from "./settings/AgentSettings";
import { AiProviderSettings } from "./settings/AiProviderSettings";
import { GeneralSettings } from "./settings/GeneralSettings";
import { IdeaSketchSettings } from "./settings/IdeaSketchSettings";
import { MarkdownSettings } from "./settings/MarkdownSettings";
import { SkillSettings } from "./settings/SkillSettings";

function SectionContent({ section }: { section: SettingsSectionId }) {
  if (section === "general") return <GeneralSettings />;
  if (section === "ai-provider") return <AiProviderSettings />;
  if (section === "agent") return <AgentSettings />;
  if (section === "skills") return <SkillSettings />;
  if (section === "ideasketch") return <IdeaSketchSettings />;
  if (section === "markdown") return <MarkdownSettings />;
  return <div className="text-sm text-gray-500">This settings section is not available.</div>;
}

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const sections = getSettingsSections();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(sections[0]?.id ?? "general");
  const { dirty, status, error, saveDraft, discardDraft } = useSettingsDraft();

  useEffect(() => {
    if (open && !sections.some((section) => section.id === activeSection)) {
      setActiveSection(sections[0]?.id ?? "general");
    }
  }, [activeSection, open, sections]);

  const groups = ["Application", "AI", "Editors"] as const;
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) discardDraft();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ideanote-settings-overlay" />
        <Dialog.Content className="ideanote-settings-dialog">
          <header className="ideanote-settings-header">
            <Dialog.Title className="ideanote-settings-dialog__title">Settings</Dialog.Title>
            <Dialog.Description className="sr-only">Application settings</Dialog.Description>
            <div className="ideanote-settings-header__actions">
              {status === "saved" && <span className="is-success"><Check aria-hidden size={12} /> Saved</span>}
              {status === "error" && <span className="is-error">Save failed</span>}
              <button
                type="button"
                className="ideanote-settings-save"
                disabled={status === "saving" || !dirty}
                onClick={() => { void saveDraft().catch(() => undefined); }}
              >
                {status === "saving" ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="ideanote-settings-close" aria-label="Close Settings" onClick={() => handleOpenChange(false)}>
                <X aria-hidden size={16} />
              </button>
            </div>
          </header>
          <div className="flex min-h-0 flex-1">
            <nav className="ideanote-settings-nav" aria-label="Settings sections">
              {groups.map((group) => (
                <div key={group} className="ideanote-settings-nav__group">
                  <div className="ideanote-settings-nav__group-label">{group}</div>
                  {sections.filter((section) => section.group === group).map((section) => {
                    return (
                      <button
                        key={section.id}
                        type="button"
                        className={`ideanote-settings-nav__item ${activeSection === section.id ? "is-active" : ""}`}
                        onClick={() => setActiveSection(section.id)}
                      >
                        <span>{section.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
            <main className="ideanote-settings-content">
              {error && <div className="ideanote-settings-error" role="alert">{error}</div>}
              <SectionContent section={activeSection} />
            </main>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SettingsCenter({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <SettingsDraftProvider open={open}>
      <SettingsDialog open={open} onOpenChange={onOpenChange} />
    </SettingsDraftProvider>
  );
}
