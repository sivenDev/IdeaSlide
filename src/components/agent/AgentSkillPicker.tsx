import { ChevronDown, Sparkles, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AgentSkillMetadata } from "../../lib/agent/types";

export function AgentSkillPicker({
  skills,
  editorSkillId,
  selectedIds,
  disabled,
  onChange,
}: {
  skills: AgentSkillMetadata[];
  editorSkillId?: string;
  selectedIds: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const editorSkill = skills.find((skill) => skill.id === editorSkillId);
  const eligible = useMemo(() => skills.filter((skill) => (
    skill.origin === "custom"
    && skill.enabled
    && skill.valid
    && (!editorSkillId || skill.editorScopes.length === 0 || skill.editorScopes.includes(editorSkillId))
  )), [editorSkillId, skills]);
  const selected = selectedIds.map((id) => eligible.find((skill) => skill.id === id)).filter(Boolean) as AgentSkillMetadata[];
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return eligible;
    return eligible.filter((skill) => (
      skill.name.toLocaleLowerCase().includes(normalized)
      || skill.description.toLocaleLowerCase().includes(normalized)
    ));
  }, [eligible, query]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled || eligible.length === 0) setOpen(false);
  }, [disabled, eligible.length]);

  return (
    <div ref={rootRef} className="ideanote-agent-skill-picker">
      <div className="ideanote-agent-skill-picker__summary">
        <span title={editorSkill?.description}><Sparkles aria-hidden size={11} /> {editorSkill?.name ?? "Editor"} mandatory</span>
        {selected.map((skill) => (
          <span key={skill.id} className="is-selected">
            {skill.name}
            <button type="button" aria-label={`Remove ${skill.name}`} onClick={() => onChange(selectedIds.filter((id) => id !== skill.id))} disabled={disabled}>
              <X aria-hidden size={9} />
            </button>
          </span>
        ))}
      </div>
      <button
        ref={triggerRef}
        type="button"
        className="ideanote-agent-skill-picker__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={disabled || eligible.length === 0}
        onClick={() => setOpen((value) => !value)}
      >
        $ Skills <ChevronDown aria-hidden size={11} />
      </button>
      {open && (
        <div className="ideanote-agent-skill-picker__menu">
          <input
            autoFocus
            type="search"
            value={query}
            aria-label="Search custom Skills"
            placeholder="Search Skills"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div id={listboxId} role="listbox" aria-label="Select custom Skills">
            {visible.map((skill) => {
              const active = selectedIds.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onChange(active ? selectedIds.filter((id) => id !== skill.id) : [...selectedIds, skill.id])}
                >
                  <strong>{skill.name}</strong>
                  <span>{skill.description}</span>
                  <small>{skill.implicitInvocation ? "Explicit or autonomous" : "Explicit only"}</small>
                </button>
              );
            })}
            {visible.length === 0 && <p>No matching Skills.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
