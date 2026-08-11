import * as Dialog from "@radix-ui/react-dialog";
import { Command, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface WorkbenchCommand {
  id: string;
  label: string;
  detail?: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: WorkbenchCommand[];
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? commands.filter((item) => `${item.label} ${item.detail ?? ""}`.toLowerCase().includes(needle))
      : commands;
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);
  useEffect(() => setActiveIndex(0), [query]);

  const run = (command: WorkbenchCommand | undefined) => {
    if (!command || command.disabled) return;
    onOpenChange(false);
    command.run();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ideanote-command-overlay" />
        <Dialog.Content className="ideanote-command-dialog" aria-describedby={undefined}>
          <Dialog.Title className="ideanote-command-title"><Command aria-hidden size={15} /> Commands</Dialog.Title>
          <label className="ideanote-command-search">
            <Search aria-hidden size={15} />
            <input
              ref={inputRef}
              value={query}
              aria-label="Search commands"
              placeholder="Type a command…"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((value) => Math.min(Math.max(visible.length - 1, 0), value + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((value) => Math.max(0, value - 1));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  run(visible[activeIndex]);
                }
              }}
            />
          </label>
          <div className="ideanote-command-list" role="listbox" aria-label="Available commands">
            {visible.map((command, index) => (
              <button
                key={command.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? "is-active" : ""}
                disabled={command.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => run(command)}
              >
                <span><strong>{command.label}</strong>{command.detail && <small>{command.detail}</small>}</span>
                {command.shortcut && <kbd>{command.shortcut}</kbd>}
              </button>
            ))}
            {visible.length === 0 && <p>No matching commands.</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
