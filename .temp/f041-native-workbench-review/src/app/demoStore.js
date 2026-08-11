import { createDocumentSession, discardSession, savedSession, updateSessionContent } from "../lib/documentSessions.js";

export const initialState = {
  ready: false,
  workspaces: [],
  recents: [],
  standalone: [],
  activeWorkspaceId: "ws-product",
  expandedWorkspaces: new Set(["ws-product"]),
  expandedDirectories: new Set(["ws-product:Planning", "ws-product:Research"]),
  sessions: {},
  activeSessionId: null,
  selectedPath: null,
  workspaceOpen: true,
  agentOpen: false,
  theme: "light",
  modal: null,
  pendingOpen: null,
  notice: null,
  commandOpen: false,
  activeScenario: "normal",
};

export function demoReducer(state, action) {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.payload, ready: true };
    case "toggle-workspace":
      return { ...state, workspaceOpen: !state.workspaceOpen };
    case "toggle-agent":
      return state.activeSessionId ? { ...state, agentOpen: !state.agentOpen } : state;
    case "set-theme":
      return { ...state, theme: action.theme };
    case "set-notice":
      return { ...state, notice: action.notice };
    case "set-modal":
      return { ...state, modal: action.modal };
    case "set-command":
      return { ...state, commandOpen: action.open };
    case "set-scenario":
      return { ...state, activeScenario: action.id };
    case "reset-review":
      return {
        ...initialState,
        ...action.payload,
        ready: true,
        theme: action.theme ?? state.theme,
        activeScenario: "normal",
      };
    case "refresh-home":
      return { ...state, workspaces: action.payload.workspaces, recents: action.payload.recents, standalone: action.payload.standalone };
    case "toggle-workspace-root": {
      const next = new Set(state.expandedWorkspaces);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, expandedWorkspaces: next, activeWorkspaceId: action.id };
    }
    case "toggle-directory": {
      const next = new Set(state.expandedDirectories);
      next.has(action.key) ? next.delete(action.key) : next.add(action.key);
      return { ...state, expandedDirectories: next };
    }
    case "request-open":
      return { ...state, pendingOpen: action.target, modal: "unsaved" };
    case "open-document": {
      const session = createDocumentSession(action.file);
      return {
        ...state,
        sessions: { ...state.sessions, [session.sessionId]: action.replace ? session : state.sessions[session.sessionId] ?? session },
        activeSessionId: session.sessionId,
        selectedPath: action.file.mode === "workspace" ? `${action.file.workspaceId}:${action.file.path}` : null,
        activeWorkspaceId: action.file.workspaceId ?? state.activeWorkspaceId,
        agentOpen: action.keepAgent ? state.agentOpen : false,
        modal: null,
        pendingOpen: null,
        notice: null,
      };
    }
    case "patch-document": {
      const current = state.sessions[action.sessionId];
      if (!current) return state;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.sessionId]: { ...current, ...action.patch },
        },
      };
    }
    case "close-document":
      return { ...state, activeSessionId: null, selectedPath: null, agentOpen: false };
    case "update-document": {
      const current = state.sessions[action.sessionId];
      if (!current) return state;
      return { ...state, sessions: { ...state.sessions, [action.sessionId]: updateSessionContent(current, action.content) } };
    }
    case "document-saving": {
      const current = state.sessions[action.sessionId];
      return current ? { ...state, sessions: { ...state.sessions, [action.sessionId]: { ...current, status: "saving", error: null } } } : state;
    }
    case "document-saved": {
      const current = state.sessions[action.sessionId];
      return current ? { ...state, sessions: { ...state.sessions, [action.sessionId]: savedSession(current, action.result) } } : state;
    }
    case "document-save-error": {
      const current = state.sessions[action.sessionId];
      return current ? { ...state, sessions: { ...state.sessions, [action.sessionId]: { ...current, status: "error", error: action.error, dirty: true } } } : state;
    }
    case "discard-document": {
      const current = state.sessions[action.sessionId];
      return current ? { ...state, sessions: { ...state.sessions, [action.sessionId]: discardSession(current) }, modal: null } : state;
    }
    case "cancel-open":
      return { ...state, modal: null, pendingOpen: null };
    default:
      return state;
  }
}

export function activeDocument(state) {
  return state.activeSessionId ? state.sessions[state.activeSessionId] : null;
}
