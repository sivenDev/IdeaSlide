const state = {
  file: "Campaign Planner.table",
  folder: "Launch 2026",
  view: "Delivery board",
  row: "4",
  rowName: "Partner launch kit",
};

const fileModels = {
  "Campaign Planner.table": {
    folder: "Launch 2026",
    views: ["Delivery board", "All work", "Owner load"],
    records: "28 records",
    prompt: "Find launch risks and propose the next three owner actions.",
  },
  "Research Notes.md": {
    folder: "Launch 2026",
    views: ["Outline", "Sources", "Open questions"],
    records: "16 notes",
    prompt: "Turn the open questions into a focused research plan.",
  },
  "Customer Signals.table": {
    folder: "Market evidence",
    views: ["Signal inbox", "Themes", "High confidence"],
    records: "64 records",
    prompt: "Cluster the selected signals and name the strongest pattern.",
  },
};

const rowNames = {
  "1": "Release messaging",
  "2": "Early access cohort",
  "3": "Pricing review",
  "4": "Partner launch kit",
  "5": "Lifecycle emails",
  "6": "Onboarding checklist",
  "7": "Analytics baseline",
  "8": "Support readiness",
};

function all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function updateScope() {
  all("[data-current-file]").forEach((node) => { node.textContent = state.file; });
  all("[data-current-folder]").forEach((node) => { node.textContent = state.folder; });
  all("[data-current-view]").forEach((node) => { node.textContent = state.view; });
  all("[data-current-row]").forEach((node) => { node.textContent = `Record ${state.row} · ${state.rowName}`; });
  all("[data-scope-path]").forEach((node) => { node.textContent = `${state.folder} / ${state.file}`; });
  const model = fileModels[state.file];
  all("[data-record-count]").forEach((node) => { node.textContent = model.records; });
  const textarea = document.querySelector("[data-agent-input]");
  if (textarea) textarea.placeholder = model.prompt;
}

function selectFile(button) {
  state.file = button.dataset.file;
  state.folder = fileModels[state.file].folder;
  state.view = fileModels[state.file].views[0];
  all("[data-file]").forEach((item) => item.classList.toggle("is-active", item === button));
  const viewStrip = document.querySelector("[data-view-strip]");
  if (viewStrip) {
    viewStrip.innerHTML = fileModels[state.file].views.map((view, index) => (
      `<button class="view-button${index === 0 ? " is-active" : ""}" type="button" data-view="${view}">${view}</button>`
    )).join("");
  }
  updateScope();
}

function selectView(button) {
  state.view = button.dataset.view;
  all("[data-view]").forEach((item) => item.classList.toggle("is-active", item === button));
  updateScope();
}

function selectRow(row) {
  state.row = row.dataset.row;
  state.rowName = rowNames[state.row] || "Selected record";
  all("[data-row]").forEach((item) => {
    const selected = item === row;
    item.classList.toggle("is-selected", selected);
    item.setAttribute("aria-selected", String(selected));
  });
  updateScope();
}

function runAgent() {
  const activity = document.querySelector("[data-activity]");
  const result = document.querySelector("[data-result]");
  const input = document.querySelector("[data-agent-input]");
  if (!activity || !result) return;
  const request = input?.value.trim() || fileModels[state.file].prompt;
  const taskCopy = document.querySelector("[data-request-copy]");
  if (taskCopy) taskCopy.textContent = request;
  activity.hidden = false;
  result.hidden = true;
  const steps = all(".activity-item", activity);
  steps.forEach((step, index) => {
    step.classList.toggle("is-running", index === 0);
    const label = step.querySelector(".activity-state");
    if (label) label.textContent = index === 0 ? "running" : "queued";
  });

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finish = () => {
    steps.forEach((step) => {
      step.classList.remove("is-running");
      const label = step.querySelector(".activity-state");
      if (label) label.textContent = "done";
    });
    result.hidden = false;
    result.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  };

  if (reduce) finish();
  else window.setTimeout(finish, 650);
}

function togglePanel(side, forceOpen = false) {
  const shell = document.querySelector(".app-shell");
  if (!shell) return;
  const className = side === "left" ? "is-left-collapsed" : "is-right-collapsed";
  if (forceOpen) shell.classList.remove(className);
  else shell.classList.toggle(className);
}

document.addEventListener("click", (event) => {
  const file = event.target.closest("[data-file]");
  const view = event.target.closest("[data-view]");
  const row = event.target.closest("[data-row]");
  const collapse = event.target.closest("[data-collapse]");
  const restore = event.target.closest("[data-restore]");
  const run = event.target.closest("[data-run-agent]");
  if (file) selectFile(file);
  else if (view) selectView(view);
  else if (row) selectRow(row);
  else if (collapse) togglePanel(collapse.dataset.collapse);
  else if (restore) togglePanel(restore.dataset.restore, true);
  else if (run) runAgent();
});

document.addEventListener("keydown", (event) => {
  const row = event.target.closest?.("[data-row]");
  if (row && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    selectRow(row);
  }
});

updateScope();
