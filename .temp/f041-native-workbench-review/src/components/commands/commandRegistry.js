export function buildCommandCatalog({ document, recents = [], workspaceOpen, agentOpen, aiEnabled = true }) {
  return [
    { id: "open-recent", label: "Open most recent file", detail: recents[0]?.label ?? "No recent file", disabled: !recents.length },
    { id: "open-settings", label: "Open Settings", shortcut: "⌘," },
    { id: "new-ideasketch", label: "New IdeaSketch" },
    { id: "new-markdown", label: "New Markdown" },
    { id: "save", label: "Save document", shortcut: "⌘S", disabled: !document || !document.dirty || document.readOnly || document.conflict || document.missing },
    { id: "save-as", label: "Save As…", shortcut: "⇧⌘S", disabled: !document },
    { id: "toggle-workspaces", label: workspaceOpen ? "Hide Workspaces" : "Show Workspaces" },
    { id: "toggle-agent", label: agentOpen ? "Hide Agent" : "Show Agent", disabled: !document || !aiEnabled },
    { id: "reset-scenario", label: "Reset review scenario" },
    { id: "review-exit", label: "Review application exit" },
  ];
}

export function commandById(commands, id) {
  return commands.find((command) => command.id === id && !command.disabled) ?? null;
}
