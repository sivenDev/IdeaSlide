import "./styles.css";

const files = {
  "launch-plan.is": {
    type: "IdeaSketch",
    extension: "IS",
    path: "Product Studio/launch-plan.is",
    tone: "blue",
  },
  "field-notes.md": {
    type: "Markdown",
    extension: "MD",
    path: "Research Library/field-notes.md",
    tone: "slate",
  },
  "customers.table": {
    type: "Table",
    extension: "TB",
    path: "Product Studio/customers.table",
    tone: "rust",
  },
  "onboarding.workflow": {
    type: "Workflow",
    extension: "WF",
    path: "Operations Hub/onboarding.workflow",
    tone: "olive",
  },
};

const icon = (name, size = 16) => {
  const paths = {
    chevron: '<path d="m9 18 6-6-6-6"/>',
    folder: '<path d="M3 7.5h7l2 2h9v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9.5V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1.5"/>',
    file: '<path d="M6 2.8h8l4 4V21H6z"/><path d="M14 2.8V7h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    command: '<path d="M9 7.5V5.8a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12.4a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.38.36.72.6 1 .3.35.7.55 1.1.6h.1v4h-.1a1.7 1.7 0 0 0-1.7.4z"/>',
    panelLeft: '<path d="M4 4h16v16H4z"/><path d="M9 4v16"/>',
    panelRight: '<path d="M4 4h16v16H4z"/><path d="M15 4v16"/>',
    bot: '<rect x="5" y="7" width="14" height="11" rx="3"/><path d="M9 11h.01M15 11h.01M9 15h6M12 7V4M10 4h4"/>',
    sparkle: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2z"/><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z"/>',
    thread: '<path d="M5 5h14v10H9l-4 4z"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    send: '<path d="m3 11 18-8-8 18-2.5-7.5z"/><path d="M10.5 13.5 21 3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    branch: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M8 7c7 0 8 2 8 7"/>',
    sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z"/>',
    monitor: '<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8M12 17v4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.file}</svg>`;
};

const treeFile = (name) => {
  const item = files[name];
  return `
    <button class="tree-file" data-file="${name}" type="button">
      <span class="file-glyph file-glyph--${item.tone}">${item.extension}</span>
      <span class="tree-file__name">${name}</span>
    </button>`;
};

document.querySelector("#app").innerHTML = `
  <main class="app-shell" data-workspace="open" data-agent="closed" data-document="welcome">
    <div class="window-controls" aria-label="Window and Workspace controls">
      <div class="traffic-lights" aria-hidden="true"><span></span><span></span><span></span></div>
      <button class="panel-toggle panel-toggle--workspace" id="workspace-toggle" type="button" aria-label="Hide Workspace" aria-pressed="true" data-tooltip="Hide Workspace">${icon("panelLeft", 16)}</button>
    </div>

    <button class="panel-toggle panel-toggle--agent" id="agent-toggle" type="button" aria-label="Show Agent" aria-pressed="false" data-tooltip="Show Agent" hidden>${icon("bot", 16)}</button>

    <aside class="workspace-region" aria-label="Workspace">
      <div class="workspace-crown" data-tauri-drag-region></div>

      <div class="workspace-toolbar">
        <span>Workspaces</span>
        <div class="inline-actions">
          <button class="icon-button" id="add-workspace" type="button" aria-label="Add Workspace">${icon("plus", 15)}</button>
        </div>
      </div>

      <nav class="workspace-tree" aria-label="Workspaces and recent files">
        <div class="tree-group">
          <button class="tree-folder workspace-root is-open" type="button" aria-expanded="true"><span class="folder-caret">${icon("chevron", 12)}</span>${icon("folder", 15)}<span>Product Studio</span></button>
          <div class="tree-children">${treeFile("launch-plan.is")}${treeFile("customers.table")}</div>
        </div>
        <div class="tree-group">
          <button class="tree-folder workspace-root" type="button" aria-expanded="false"><span class="folder-caret">${icon("chevron", 12)}</span>${icon("folder", 15)}<span>Research Library</span></button>
          <div class="tree-children">${treeFile("field-notes.md")}</div>
        </div>
        <div class="tree-group">
          <button class="tree-folder workspace-root" type="button" aria-expanded="false"><span class="folder-caret">${icon("chevron", 12)}</span>${icon("folder", 15)}<span>Operations Hub</span></button>
          <div class="tree-children">${treeFile("onboarding.workflow")}</div>
        </div>

        <section class="recents-section" aria-labelledby="recents-title">
          <div class="recents-heading" id="recents-title">Recents</div>
          <div class="recent-list">
            ${treeFile("launch-plan.is")}
            ${treeFile("field-notes.md")}
            ${treeFile("customers.table")}
            ${treeFile("onboarding.workflow")}
          </div>
        </section>

        <p class="workspace-notice" id="workspace-notice" role="status" hidden>Workspace picker is not connected in this review.</p>
      </nav>

      <div class="workspace-foot">
        <button class="foot-action" id="settings-trigger" type="button">${icon("settings", 15)}<span>Settings</span><kbd>⌘,</kbd></button>
      </div>
    </aside>

    <section class="editor-region" aria-label="Editor Host">
      <header class="editor-crown" data-tauri-drag-region>
        <div class="document-identity">
          <span class="document-icon file-glyph file-glyph--blue" id="document-icon" hidden></span>
          <span class="document-copy"><strong id="document-name">Welcome</strong><small id="document-path">Choose a file to begin</small></span>
        </div>
        <div class="editor-shell-actions">
          <span class="editor-owner"><span></span><span id="editor-owner-label">Workspace shell</span></span>
          <button class="icon-button" id="document-actions" type="button" aria-label="Document actions" hidden>${icon("more", 16)}</button>
        </div>
      </header>

      <div class="editor-aperture">
        <div class="aperture-corner aperture-corner--tl"></div>
        <div class="aperture-corner aperture-corner--tr"></div>
        <div class="aperture-corner aperture-corner--bl"></div>
        <div class="aperture-corner aperture-corner--br"></div>
        <div class="welcome-panel" id="welcome-panel">
          <span class="welcome-eyebrow">Workspace ready</span>
          <h1>Welcome</h1>
          <p>Open a recent file or choose one from a workspace.</p>
          <div class="welcome-actions">
            <button type="button" id="welcome-recent">Open most recent <kbd>↵</kbd></button>
            <button type="button" id="welcome-workspaces">Browse Workspaces</button>
          </div>
        </div>
        <div class="editor-placeholder" id="editor-placeholder" hidden>
          <span class="placeholder-label">Editor Host</span>
          <strong id="editor-type">The active editor owns this surface</strong>
          <p>The application shell does not draw inside this boundary.</p>
        </div>
      </div>
    </section>

    <aside class="agent-region" aria-label="Agent">
      <header class="agent-crown" data-tauri-drag-region>
        <div class="agent-heading">
          <span class="agent-mark">${icon("sparkle", 15)}</span>
          <span><strong>Agent</strong><small>Workspace assistant</small></span>
        </div>
        <div class="inline-actions">
          <button class="icon-button" type="button" aria-label="New thread">${icon("thread", 15)}</button>
          <button class="icon-button" type="button" aria-label="Thread history">${icon("history", 15)}</button>
          <button class="icon-button" type="button" aria-label="Agent options">${icon("more", 15)}</button>
        </div>
      </header>

      <div class="agent-scope">
        <span>Attached document</span>
        <strong id="agent-document"></strong>
      </div>

      <div class="agent-thread" aria-live="polite">
        <article class="thread-note">
          <span class="thread-avatar">Y</span>
          <div><p>Check the active document and outline the next concrete step.</p><time>10:42</time></div>
        </article>
        <article class="activity-row">
          <span class="activity-icon">${icon("branch", 14)}</span>
          <div><strong>Read document structure</strong><p id="activity-copy"></p></div>
          <span class="activity-check">${icon("check", 13)}</span>
        </article>
        <article class="agent-answer">
          <p>The shell has attached the active file. Editor-specific reading and editing remain available only through that editor's registered tools.</p>
        </article>
        <article class="activity-row activity-row--muted">
          <span class="activity-icon">${icon("check", 14)}</span>
          <div><strong>Boundary confirmed</strong><p>No direct file write requested</p></div>
        </article>
      </div>

      <div class="agent-composer">
        <div class="composer-box">
          <textarea aria-label="Ask Agent" rows="3" placeholder="Ask about the active document…"></textarea>
          <div class="composer-foot"><span>Agent uses the active editor tools</span><button type="button" aria-label="Send message">${icon("send", 15)}</button></div>
        </div>
      </div>
    </aside>
  </main>

  <div class="settings-backdrop" id="settings-backdrop" hidden>
    <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header class="settings-header">
        <div><strong id="settings-title">Settings</strong><small>Application preferences</small></div>
        <button class="icon-button" id="settings-close" type="button" aria-label="Close Settings">${icon("close", 16)}</button>
      </header>
      <div class="settings-layout">
        <nav class="settings-nav" aria-label="Settings categories">
          <button class="is-selected" type="button" data-settings-section="general" aria-current="page">General</button>
          <button type="button" data-settings-section="agent">Agent</button>
        </nav>
        <div class="settings-content">
          <section class="settings-section" data-settings-panel="general">
            <span class="settings-kicker">General</span>
            <h2>Appearance</h2>
            <p>Choose how application-owned surfaces appear.</p>
            <div class="theme-options" role="group" aria-label="Theme">
              <button type="button" data-theme-choice="light" class="is-selected" aria-pressed="true">${icon("sun", 16)}<span><strong>Light</strong><small>Bright native surfaces</small></span></button>
              <button type="button" data-theme-choice="dark" aria-pressed="false">${icon("moon", 16)}<span><strong>Dark</strong><small>Low-light workspace</small></span></button>
              <button type="button" data-theme-choice="system" aria-pressed="false">${icon("monitor", 16)}<span><strong>System</strong><small>Follow this Mac</small></span></button>
            </div>
            <div class="settings-fact"><span>Workspace panel</span><strong>Open on desktop</strong></div>
          </section>
          <section class="settings-section" data-settings-panel="agent" hidden>
            <span class="settings-kicker">Agent</span>
            <h2>Availability</h2>
            <p>Agent becomes available only after a file is open.</p>
            <div class="settings-fact"><span>Context</span><strong>Active document only</strong></div>
            <div class="settings-fact"><span>Panel</span><strong>Open manually</strong></div>
          </section>
        </div>
      </div>
    </section>
  </div>

  <div class="command-backdrop" id="command-backdrop" hidden>
    <section class="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title">
      <header><span>${icon("search", 16)}</span><input id="command-input" aria-label="Search commands" placeholder="Type a command or file" autocomplete="off" /><kbd>esc</kbd></header>
      <div class="command-section"><span id="command-title">Quick actions</span></div>
      <button type="button" data-command-file="field-notes.md">${icon("file", 15)}<span><strong>Open field-notes.md</strong><small>Research</small></span><kbd>↵</kbd></button>
      <button type="button" data-command-file="customers.table">${icon("file", 15)}<span><strong>Open customers.table</strong><small>Operations</small></span></button>
      <button type="button" id="command-settings">${icon("settings", 15)}<span><strong>Open Settings</strong><small>Appearance and Agent</small></span></button>
    </section>
  </div>
`;

const shell = document.querySelector(".app-shell");
const root = document.documentElement;
const settingsBackdrop = document.querySelector("#settings-backdrop");
const settingsClose = document.querySelector("#settings-close");
const commandBackdrop = document.querySelector("#command-backdrop");
const commandInput = document.querySelector("#command-input");
let activeFile = null;
let settingsReturnFocus = null;

function setFile(name) {
  const file = files[name];
  if (!file) return;
  const firstFile = activeFile === null;
  activeFile = name;
  shell.dataset.document = "file";
  document.querySelectorAll("[data-file]").forEach((button) => button.classList.toggle("is-active", button.dataset.file === name));
  const iconNode = document.querySelector("#document-icon");
  iconNode.hidden = false;
  iconNode.textContent = file.extension;
  iconNode.className = `document-icon file-glyph file-glyph--${file.tone}`;
  document.querySelector("#document-name").textContent = name;
  document.querySelector("#document-path").textContent = file.path.replace("/", " / ");
  document.querySelector("#welcome-panel").hidden = true;
  document.querySelector("#editor-placeholder").hidden = false;
  document.querySelector("#document-actions").hidden = false;
  document.querySelector("#editor-owner-label").textContent = "Editor-owned surface";
  document.querySelector("#agent-document").textContent = name;
  document.querySelector("#activity-copy").textContent = `Attached to ${name}`;
  setPanelState("agent", firstFile ? false : shell.dataset.agent === "open");
}

function showWelcome() {
  activeFile = null;
  shell.dataset.document = "welcome";
  document.querySelectorAll("[data-file]").forEach((button) => button.classList.remove("is-active"));
  document.querySelector("#document-icon").hidden = true;
  document.querySelector("#document-name").textContent = "Welcome";
  document.querySelector("#document-path").textContent = "Choose a file to begin";
  document.querySelector("#welcome-panel").hidden = false;
  document.querySelector("#editor-placeholder").hidden = true;
  document.querySelector("#document-actions").hidden = true;
  document.querySelector("#editor-owner-label").textContent = "Workspace shell";
  document.querySelector("#agent-document").textContent = "";
  document.querySelector("#activity-copy").textContent = "";
  setPanelState("agent", false);
}

function setTheme(choice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.themePreference = choice;
  root.style.colorScheme = dark ? "dark" : "light";
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const selected = button.dataset.themeChoice === choice;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function openCommand() {
  commandBackdrop.hidden = false;
  requestAnimationFrame(() => commandInput.focus());
}

function closeCommand() {
  commandBackdrop.hidden = true;
}

function selectSettingsSection(section) {
  document.querySelectorAll("[data-settings-section]").forEach((button) => {
    const selected = button.dataset.settingsSection === section;
    button.classList.toggle("is-selected", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== section;
  });
}

function openSettings() {
  settingsReturnFocus = document.activeElement;
  selectSettingsSection("general");
  settingsBackdrop.hidden = false;
  requestAnimationFrame(() => settingsClose.focus());
}

function closeSettings() {
  settingsBackdrop.hidden = true;
  if (settingsReturnFocus instanceof HTMLElement && settingsReturnFocus.isConnected) settingsReturnFocus.focus();
}

function setPanelState(panel, open) {
  const label = panel === "workspace" ? "Workspace" : "Agent";
  const toggle = document.querySelector(`#${panel}-toggle`);
  if (panel === "agent") {
    open = Boolean(activeFile) && open;
    toggle.hidden = !activeFile;
    toggle.innerHTML = icon(open ? "panelRight" : "bot", 16);
  }
  const action = open ? "Hide" : "Show";
  shell.dataset[panel] = open ? "open" : "closed";
  toggle.setAttribute("aria-label", `${action} ${label}`);
  toggle.setAttribute("aria-pressed", String(open));
  toggle.dataset.tooltip = `${action} ${label}`;
}

function togglePanel(panel) {
  setPanelState(panel, shell.dataset[panel] === "closed");
}

let responsiveBucket;

function syncResponsivePanels() {
  const nextBucket = window.innerWidth < 960 ? "minimum" : window.innerWidth < 1180 ? "compact" : "desktop";
  if (nextBucket === responsiveBucket) return;
  responsiveBucket = nextBucket;
  setPanelState("workspace", nextBucket === "desktop");
  if (!activeFile || nextBucket === "minimum") setPanelState("agent", false);
}

document.querySelectorAll("[data-file]").forEach((button) => button.addEventListener("click", () => setFile(button.dataset.file)));
document.querySelectorAll(".tree-folder").forEach((button) => button.addEventListener("click", () => {
  const expanded = button.classList.toggle("is-open");
  button.setAttribute("aria-expanded", String(expanded));
}));

document.querySelector("#workspace-toggle").addEventListener("click", () => togglePanel("workspace"));
document.querySelector("#agent-toggle").addEventListener("click", () => togglePanel("agent"));

document.querySelector("#add-workspace").addEventListener("click", () => {
  const notice = document.querySelector("#workspace-notice");
  notice.hidden = false;
  window.setTimeout(() => { notice.hidden = true; }, 2400);
});

document.querySelector("#welcome-recent").addEventListener("click", () => setFile("launch-plan.is"));
document.querySelector("#welcome-workspaces").addEventListener("click", () => {
  setPanelState("workspace", true);
  document.querySelector(".workspace-root").focus();
});

document.querySelector("#settings-trigger").addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("mousedown", (event) => {
  if (event.target === settingsBackdrop) closeSettings();
});
document.querySelectorAll("[data-settings-section]").forEach((button) => button.addEventListener("click", () => selectSettingsSection(button.dataset.settingsSection)));
document.querySelectorAll("[data-theme-choice]").forEach((button) => button.addEventListener("click", () => setTheme(button.dataset.themeChoice)));

document.querySelectorAll("[data-command-file]").forEach((button) => button.addEventListener("click", () => {
  setFile(button.dataset.commandFile);
  closeCommand();
}));
document.querySelector("#command-settings").addEventListener("click", () => {
  closeCommand();
  openSettings();
});

commandBackdrop.addEventListener("mousedown", (event) => {
  if (event.target === commandBackdrop) closeCommand();
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommand();
  }
  if ((event.metaKey || event.ctrlKey) && event.key === ",") {
    event.preventDefault();
    openSettings();
  }
  if (event.key === "Escape") {
    closeCommand();
    if (!settingsBackdrop.hidden) closeSettings();
  }
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (root.dataset.themePreference === "system") setTheme("system");
});

window.addEventListener("resize", syncResponsivePanels);
setTheme("light");
showWelcome();
syncResponsivePanels();
