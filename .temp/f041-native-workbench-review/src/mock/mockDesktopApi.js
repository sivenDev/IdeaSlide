import { cloneFixtures } from "./fixtures.js";
import { typeForName } from "../lib/fileTypeRegistry.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (value) => structuredClone(value);

function walk(entries, predicate, parent = null) {
  for (const entry of entries) {
    if (predicate(entry)) return { entry, parent };
    if (entry.kind === "directory") {
      const nested = walk(entry.children, predicate, entry);
      if (nested) return nested;
    }
  }
  return null;
}

function findDirectory(entries, path) {
  if (!path) return { children: entries, path: "" };
  const found = walk(entries, (entry) => entry.kind === "directory" && entry.path === path);
  return found?.entry ?? null;
}

function uniquePath(directory, name) {
  return directory ? `${directory}/${name}` : name;
}

function updateDescendantPaths(entry, oldPrefix, newPrefix) {
  if (entry.path === oldPrefix || entry.path.startsWith(`${oldPrefix}/`)) {
    entry.path = `${newPrefix}${entry.path.slice(oldPrefix.length)}`;
  }
  entry.children?.forEach((child) => updateDescendantPaths(child, oldPrefix, newPrefix));
}

export class MockDesktopApi {
  constructor({ latency = 90 } = {}) {
    this.latency = latency;
    this.listeners = new Set();
    this.failures = new Map();
    this.reset();
  }

  reset() {
    this.data = cloneFixtures();
    this.workspaceCatalog = clone(this.data.workspaces);
    this.sequence = 1;
    this.emit({ type: "reset" });
    return this.snapshot();
  }

  snapshot() {
    return clone(this.data);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event) {
    this.listeners?.forEach((listener) => listener(clone(event)));
  }

  injectFailure(operation, message = "The simulated operation failed.") {
    this.failures.set(operation, message);
  }

  clearFailure(operation) {
    this.failures.delete(operation);
  }

  async step(operation) {
    await wait(this.latency);
    if (this.failures.has(operation)) throw new Error(this.failures.get(operation));
  }

  async listHome() {
    await this.step("listHome");
    return this.snapshot();
  }

  async openWorkspace(workspaceId) {
    await this.step("openWorkspace");
    const workspace = this.data.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) throw new Error("The mock workspace is no longer available.");
    return clone(workspace);
  }

  async chooseWorkspace() {
    await this.step("chooseWorkspace");
    const workspace = this.workspaceCatalog.find((candidate) => !this.data.workspaces.some((item) => item.id === candidate.id));
    if (workspace) {
      this.data.workspaces.push(clone(workspace));
      this.emit({ type: "workspace-changed", workspaceId: workspace.id, operation: "add-workspace" });
      return clone(workspace);
    }
    return clone(this.data.workspaces[0]);
  }

  async chooseFile() {
    await this.step("chooseFile");
    return clone(this.data.standalone[0]);
  }

  async chooseSavePath(name) {
    await this.step("chooseSavePath");
    return `/Mock/Saved/${name.replace(/^Untitled-?/, "document-")}`;
  }

  async openWorkspaceFile(workspaceId, path) {
    await this.step("openDocument");
    const workspace = this.data.workspaces.find((item) => item.id === workspaceId);
    const found = workspace && walk(workspace.entries, (entry) => entry.kind === "file" && entry.path === path);
    if (!workspace || !found) throw new Error("The mock file could not be found.");
    return clone({ ...found.entry, workspaceId, workspaceName: workspace.name, mode: "workspace" });
  }

  async openStandalone(standaloneId) {
    await this.step("openDocument");
    const file = this.data.standalone.find((item) => item.id === standaloneId);
    if (!file) throw new Error("The mock standalone file could not be found.");
    this.touchRecent({ kind: "standalone", standaloneId, label: file.name, detail: "Single File · now" });
    return clone({ ...file, mode: "standalone" });
  }

  async createEntry(workspaceId, directoryPath, kind, requestedName) {
    await this.step("createEntry");
    const workspace = this.data.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) throw new Error("Choose a workspace first.");
    const directory = findDirectory(workspace.entries, directoryPath);
    const children = directory?.children ?? (directoryPath ? null : workspace.entries);
    if (!children) throw new Error("The destination folder is missing.");
    const type = kind === "directory" ? null : kind;
    const suffix = type === "ideasketch" ? ".is" : type === "markdown" ? ".md" : "";
    const name = requestedName.endsWith(suffix) ? requestedName : `${requestedName}${suffix}`;
    if (children.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) throw new Error("An item with this name already exists.");
    const path = uniquePath(directoryPath, name);
    const entry = kind === "directory"
      ? { id: `mock-${this.sequence++}`, kind: "directory", name, path, children: [] }
      : { id: `mock-${this.sequence++}`, kind: "file", name, path, type, content: type === "markdown" ? `# ${requestedName}\n\nStart writing here.\n` : { pages: [{ id: `page-${this.sequence++}`, name: "Page 1", elements: [] }], cameras: [], activePageId: null } };
    if (entry.type === "ideasketch") entry.content.activePageId = entry.content.pages[0].id;
    children.push(entry);
    this.emit({ type: "workspace-changed", workspaceId, operation: "create", path });
    return clone(entry);
  }

  async renameWorkspace(workspaceId, nextName) {
    await this.step("renameWorkspace");
    const workspace = this.data.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) throw new Error("The mock workspace is no longer available.");
    if (!nextName.trim()) throw new Error("Workspace name is required.");
    workspace.name = nextName.trim();
    this.emit({ type: "workspace-changed", workspaceId, operation: "rename-workspace" });
    return clone(workspace);
  }

  async removeWorkspace(workspaceId) {
    await this.step("removeWorkspace");
    const index = this.data.workspaces.findIndex((item) => item.id === workspaceId);
    if (index < 0) throw new Error("The mock workspace is no longer available.");
    const [workspace] = this.data.workspaces.splice(index, 1);
    this.emit({ type: "workspace-changed", workspaceId, operation: "remove-workspace" });
    return clone(workspace);
  }

  async revealInFinder(path) {
    await this.step("revealInFinder");
    return { path, simulated: true };
  }

  async renameEntry(workspaceId, path, nextName) {
    await this.step("renameEntry");
    const workspace = this.data.workspaces.find((item) => item.id === workspaceId);
    const found = workspace && walk(workspace.entries, (entry) => entry.path === path);
    if (!workspace || !found) throw new Error("The item is no longer available.");
    const siblings = found.parent?.children ?? workspace.entries;
    if (siblings.some((entry) => entry !== found.entry && entry.name.toLowerCase() === nextName.toLowerCase())) throw new Error("An item with this name already exists.");
    const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const nextPath = uniquePath(parentPath, nextName);
    const previousPath = found.entry.path;
    found.entry.name = nextName;
    updateDescendantPaths(found.entry, previousPath, nextPath);
    this.emit({ type: "workspace-changed", workspaceId, operation: "rename", path: previousPath, nextPath });
    return clone(found.entry);
  }

  async moveEntry(workspaceId, path, destinationPath) {
    await this.step("moveEntry");
    const workspace = this.data.workspaces.find((item) => item.id === workspaceId);
    const found = workspace && walk(workspace.entries, (entry) => entry.path === path);
    const destination = workspace && findDirectory(workspace.entries, destinationPath);
    if (!workspace || !found || !destination) throw new Error("The move destination is unavailable.");
    const sourceList = found.parent?.children ?? workspace.entries;
    if (destination.children.some((entry) => entry.name.toLowerCase() === found.entry.name.toLowerCase())) throw new Error("The destination already contains an item with this name.");
    sourceList.splice(sourceList.indexOf(found.entry), 1);
    const previousPath = found.entry.path;
    const nextPath = uniquePath(destinationPath, found.entry.name);
    updateDescendantPaths(found.entry, previousPath, nextPath);
    destination.children.push(found.entry);
    this.emit({ type: "workspace-changed", workspaceId, operation: "move", path: previousPath, nextPath });
    return clone(found.entry);
  }

  async trashEntry(workspaceId, path) {
    await this.step("trashEntry");
    const workspace = this.data.workspaces.find((item) => item.id === workspaceId);
    const found = workspace && walk(workspace.entries, (entry) => entry.path === path);
    if (!workspace || !found) throw new Error("The item is no longer available.");
    const sourceList = found.parent?.children ?? workspace.entries;
    sourceList.splice(sourceList.indexOf(found.entry), 1);
    this.emit({ type: "workspace-changed", workspaceId, operation: "trash", path });
    return true;
  }

  async saveDocument(document) {
    await this.step("saveDocument");
    if (document.readOnly) throw new Error("This mock document is read-only.");
    if (document.mode === "workspace") {
      const workspace = this.data.workspaces.find((item) => item.id === document.workspaceId);
      const found = workspace && walk(workspace.entries, (entry) => entry.path === document.path);
      if (!found) throw new Error("The mock file is missing.");
      found.entry.content = clone(document.content);
    } else if (document.id) {
      const file = this.data.standalone.find((item) => item.id === document.id);
      if (file) file.content = clone(document.content);
    }
    delete this.data.recovery[document.sessionId];
    this.emit({ type: "document-saved", sessionId: document.sessionId });
    return { savedAt: Date.now(), fingerprint: `mock-${Date.now()}` };
  }

  async writeRecovery(sessionId, content) {
    await this.step("writeRecovery");
    this.data.recovery[sessionId] = { content: clone(content), savedAt: Date.now() };
    return clone(this.data.recovery[sessionId]);
  }

  async removeRecent(recentId) {
    await this.step("removeRecent");
    this.data.recents = this.data.recents.filter((item) => item.id !== recentId);
    return this.data.recents.length;
  }

  touchRecent(recent) {
    if (recent.kind !== "standalone") return;
    this.data.recents = this.data.recents.filter((item) => !(
      item.kind === recent.kind && item.standaloneId === recent.standaloneId
    ));
    this.data.recents.unshift({ id: `recent-${this.sequence++}`, ...recent });
    this.data.recents = this.data.recents.slice(0, 7);
  }

  describeFile(name) {
    return typeForName(name);
  }
}

export const mockDesktopApi = new MockDesktopApi();
