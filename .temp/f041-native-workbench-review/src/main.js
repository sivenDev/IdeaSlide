import "./styles.css";

const files = {
  "launch-plan.is": {
    type: "IdeaSketch",
    extension: "IS",
    path: "Product/launch-plan.is",
    tone: "blue",
  },
  "field-notes.md": {
    type: "Markdown",
    extension: "MD",
    path: "Research/field-notes.md",
    tone: "slate",
  },
  "customers.table": {
    type: "Table",
    extension: "TB",
    path: "Operations/customers.table",
    tone: "rust",
  },
  "onboarding.workflow": {
    type: "Workflow",
    extension: "WF",
    path: "Operations/onboarding.workflow",
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
    <button class="tree-file${name === "launch-plan.is" ? " is-active" : ""}" data-file="${name}" type="button">
      <span class="file-glyph file-glyph--${item.tone}">${item.extension}</span>
      <span class="tree-file__name">${name}</span>
    </button>`;
};

document.querySelector("#app").innerHTML = `
  <main class="app-shell" data-workspace="open" data-agent="open">
    <aside class="workspace-region" aria-label="Workspace">
      <div class="workspace-crown" data-tauri-drag-region>
        <div class="traffic-lights" aria-hidden="true"><span></span><span></span><span></span></div>
        <button class="workspace-switcher" type="button" aria-label="Switch Workspace">
          <span class="workspace-mark">IN</span>
          <span class="workspace-switcher__copy"><strong>IdeaNote Lab</strong><small>Local Workspace</small></span>
          ${icon("chevron", 13)}
        </button>
      </div>

      <div class="workspace-toolbar">
        <span>Workspace</span>
        <div class="inline-actions">
          <button class="icon-button" type="button" aria-label="New item">${icon("plus", 15)}</button>
          <button class="icon-button" id="open-command" type="button" aria-label="Open commands">${icon("search", 15)}</button>
        </div>
      </div>

      <nav class="workspace-tree" aria-label="Workspace files">
        <div class="tree-group">
          <button class="tree-folder is-open" type="button"><span class="folder-caret">${icon("chevron", 12)}</span>${icon("folder", 15)}<span>Product</span></button>
          <div class="tree-children">${treeFile("launch-plan.is")}</div>
        </div>
        <div class="tree-group">
          <button class="tree-folder is-open" type="button"><span class="folder-caret">${icon("chevron", 12)}</span>${icon("folder", 15)}<span>Research</span></button>
          <div class="tree-children">${treeFile("field-notes.md")}</div>
        </div>
        <div class="tree-group">
          <button class="tree-folder is-open" type="button"><span class="folder-caret">${icon("chevron", 12)}</span>${icon("folder", 15)}<span>Operations</span></button>
          <div class="tree-children">
            ${treeFile("customers.table")}
            ${treeFile("onboarding.workflow")}
          </div>
        </div>
        <div class="tree-group tree-group--quiet">
          <button class="tree-folder" type="button"><span class="folder-caret">${icon("chevron", 12)}</span>${icon("folder", 15)}<span>Archive</span></button>
        </div>
      </nav>

      <div class="workspace-foot">
        <div class="sync-state"><span></span><span>Local files up to date</span></div>
        <button class="foot-action" id="theme-trigger" type="button">${icon("settings", 15)}<span>Preferences</span><kbd>⌘,</kbd></button>
      </div>

      <div class="workspace-rail" aria-hidden="true">
        <div class="traffic-lights traffic-lights--compact"><span></span><span></span><span></span></div>
        <span class="workspace-mark workspace-mark--rail">IN</span>
        <div class="rail-stack">${icon("folder", 17)}${icon("search", 17)}${icon("settings", 17)}</div>
      </div>
    </aside>

    <button class="seam seam--workspace" id="workspace-toggle" type="button" aria-label="Collapse Workspace">${icon("chevron", 13)}</button>

    <section class="editor-region" aria-label="Editor Host">
      <header class="editor-crown" data-tauri-drag-region>
        <div class="document-identity">
          <span class="document-icon file-glyph file-glyph--blue" id="document-icon">IS</span>
          <span class="document-copy"><strong id="document-name">launch-plan.is</strong><small id="document-path">Product / launch-plan.is</small></span>
        </div>
        <div class="editor-shell-actions">
          <span class="editor-owner"><span></span>Editor-owned surface</span>
          <button class="icon-button" type="button" aria-label="Document actions">${icon("more", 16)}</button>
        </div>
      </header>

      <div class="editor-aperture">
        <div class="aperture-corner aperture-corner--tl"></div>
        <div class="aperture-corner aperture-corner--tr"></div>
        <div class="aperture-corner aperture-corner--bl"></div>
        <div class="aperture-corner aperture-corner--br"></div>
        <div class="editor-placeholder">
          <span class="placeholder-label">Editor Host</span>
          <strong id="editor-type">The active editor owns this surface</strong>
          <p>The application shell does not draw inside this boundary.</p>
        </div>
      </div>
    </section>

    <button class="seam seam--agent" id="agent-toggle" type="button" aria-label="Collapse Agent">${icon("chevron", 13)}</button>

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
        <strong id="agent-document">launch-plan.is</strong>
      </div>

      <div class="agent-thread" aria-live="polite">
        <article class="thread-note">
          <span class="thread-avatar">Y</span>
          <div><p>Check the active document and outline the next concrete step.</p><time>10:42</time></div>
        </article>
        <article class="activity-row">
          <span class="activity-icon">${icon("branch", 14)}</span>
          <div><strong>Read document structure</strong><p id="activity-copy">Attached to launch-plan.is</p></div>
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

      <div class="agent-rail" aria-hidden="true">
        <span class="agent-mark agent-mark--rail">${icon("sparkle", 16)}</span>
        <span class="rail-label">AGENT</span>
      </div>
    </aside>
  </main>

  <div class="popover theme-popover" id="theme-popover" hidden>
    <div class="popover-label">Appearance</div>
    <button type="button" data-theme-choice="light" class="is-selected">${icon("sun", 15)}<span>Light</span><small>Bright native surfaces</small></button>
    <button type="button" data-theme-choice="dark">${icon("moon", 15)}<span>Dark</span><small>Low-light workspace</small></button>
    <button type="button" data-theme-choice="system">${icon("monitor", 15)}<span>System</span><small>Follow this Mac</small></button>
  </div>

  <div class="command-backdrop" id="command-backdrop" hidden>
    <section class="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title">
      <header><span>${icon("search", 16)}</span><input id="command-input" aria-label="Search commands" placeholder="Type a command or file" autocomplete="off" /><kbd>esc</kbd></header>
      <div class="command-section"><span id="command-title">Quick actions</span></div>
      <button type="button" data-command-file="field-notes.md">${icon("file", 15)}<span><strong>Open field-notes.md</strong><small>Research</small></span><kbd>↵</kbd></button>
      <button type="button" data-command-file="customers.table">${icon("file", 15)}<span><strong>Open customers.table</strong><small>Operations</small></span></button>
      <button type="button" id="command-theme">${icon("settings", 15)}<span><strong>Change appearance</strong><small>Light, Dark, or System</small></span></button>
    </section>
  </div>
`;

const shell = document.querySelector(".app-shell");
const root = document.documentElement;
const themePopover = document.querySelector("#theme-popover");
const commandBackdrop = document.querySelector("#command-backdrop");
const commandInput = document.querySelector("#command-input");

function setFile(name) {
  const file = files[name];
  if (!file) return;
  document.querySelectorAll(".tree-file").forEach((button) => button.classList.toggle("is-active", button.dataset.file === name));
  const iconNode = document.querySelector("#document-icon");
  iconNode.textContent = file.extension;
  iconNode.className = `document-icon file-glyph file-glyph--${file.tone}`;
  document.querySelector("#document-name").textContent = name;
  document.querySelector("#document-path").textContent = file.path.replace("/", " / ");
  document.querySelector("#agent-document").textContent = name;
  document.querySelector("#activity-copy").textContent = `Attached to ${name}`;
}

function setTheme(choice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.themePreference = choice;
  root.style.colorScheme = dark ? "dark" : "light";
  document.querySelectorAll("[data-theme-choice]").forEach((button) => button.classList.toggle("is-selected", button.dataset.themeChoice === choice));
}

function openCommand() {
  commandBackdrop.hidden = false;
  requestAnimationFrame(() => commandInput.focus());
}

function closeCommand() {
  commandBackdrop.hidden = true;
}

let responsiveBucket;

function syncResponsivePanels() {
  const nextBucket = window.innerWidth < 960 ? "minimum" : window.innerWidth < 1180 ? "compact" : "desktop";
  if (nextBucket === responsiveBucket) return;
  responsiveBucket = nextBucket;
  shell.dataset.workspace = nextBucket === "desktop" ? "open" : "closed";
  shell.dataset.agent = nextBucket === "minimum" ? "closed" : "open";
  document.querySelector("#workspace-toggle").setAttribute("aria-label", shell.dataset.workspace === "open" ? "Collapse Workspace" : "Restore Workspace");
  document.querySelector("#agent-toggle").setAttribute("aria-label", shell.dataset.agent === "open" ? "Collapse Agent" : "Restore Agent");
}

document.querySelectorAll(".tree-file").forEach((button) => button.addEventListener("click", () => setFile(button.dataset.file)));
document.querySelectorAll(".tree-folder").forEach((button) => button.addEventListener("click", () => button.classList.toggle("is-open")));

document.querySelector("#workspace-toggle").addEventListener("click", (event) => {
  const closed = shell.dataset.workspace === "closed";
  shell.dataset.workspace = closed ? "open" : "closed";
  event.currentTarget.setAttribute("aria-label", closed ? "Collapse Workspace" : "Restore Workspace");
});

document.querySelector("#agent-toggle").addEventListener("click", (event) => {
  const closed = shell.dataset.agent === "closed";
  shell.dataset.agent = closed ? "open" : "closed";
  event.currentTarget.setAttribute("aria-label", closed ? "Collapse Agent" : "Restore Agent");
});

document.querySelector("#theme-trigger").addEventListener("click", (event) => {
  const box = event.currentTarget.getBoundingClientRect();
  themePopover.style.left = `${Math.max(10, box.left)}px`;
  themePopover.style.bottom = `${window.innerHeight - box.top + 7}px`;
  themePopover.hidden = !themePopover.hidden;
});

document.querySelectorAll("[data-theme-choice]").forEach((button) => button.addEventListener("click", () => {
  setTheme(button.dataset.themeChoice);
  themePopover.hidden = true;
}));

document.querySelector("#open-command").addEventListener("click", openCommand);
document.querySelectorAll("[data-command-file]").forEach((button) => button.addEventListener("click", () => {
  setFile(button.dataset.commandFile);
  closeCommand();
}));
document.querySelector("#command-theme").addEventListener("click", () => {
  closeCommand();
  document.querySelector("#theme-trigger").click();
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
    document.querySelector("#theme-trigger").click();
  }
  if (event.key === "Escape") {
    closeCommand();
    themePopover.hidden = true;
  }
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (root.dataset.themePreference === "system") setTheme("system");
});

window.addEventListener("resize", syncResponsivePanels);
syncResponsivePanels();
setTheme("light");
