import type { IdeaSketchDocument, IdeaSketchPage } from "../types.ts";

export interface IdeaSketchEditorState {
  document: IdeaSketchDocument;
  activePageId: string;
}

export type IdeaSketchAction =
  | { type: "SELECT_PAGE"; pageId: string }
  | { type: "ADD_PAGE"; page: IdeaSketchPage; index?: number }
  | { type: "DUPLICATE_PAGE"; sourcePageId: string; page: IdeaSketchPage }
  | { type: "RENAME_PAGE"; pageId: string; title: string }
  | { type: "REORDER_PAGE"; pageId: string; toIndex: number }
  | { type: "DELETE_PAGE"; pageId: string }
  | { type: "UPDATE_PAGE_SCENE"; pageId: string; page: IdeaSketchPage };

export function createIdeaSketchEditorState(
  document: IdeaSketchDocument,
  preferredPageId?: string,
): IdeaSketchEditorState {
  const activePageId = document.pages.some((page) => page.id === preferredPageId)
    ? preferredPageId as string
    : document.pages[0]?.id;
  if (!activePageId) throw new Error("IdeaSketch must contain at least one Page");
  return { document, activePageId };
}

function withPages(state: IdeaSketchEditorState, pages: IdeaSketchPage[], activePageId = state.activePageId) {
  return {
    document: { ...state.document, pages },
    activePageId,
  };
}

export function ideaSketchReducer(
  state: IdeaSketchEditorState,
  action: IdeaSketchAction,
): IdeaSketchEditorState {
  switch (action.type) {
    case "SELECT_PAGE":
      return state.document.pages.some((page) => page.id === action.pageId)
        ? { ...state, activePageId: action.pageId }
        : state;
    case "ADD_PAGE": {
      if (state.document.pages.some((page) => page.id === action.page.id)) return state;
      const index = Math.max(0, Math.min(action.index ?? state.document.pages.length, state.document.pages.length));
      const pages = [...state.document.pages];
      pages.splice(index, 0, action.page);
      return withPages(state, pages, action.page.id);
    }
    case "DUPLICATE_PAGE": {
      if (
        state.document.pages.some((page) => page.id === action.page.id)
        || !state.document.pages.some((page) => page.id === action.sourcePageId)
      ) return state;
      const sourceIndex = state.document.pages.findIndex((page) => page.id === action.sourcePageId);
      const pages = [...state.document.pages];
      pages.splice(sourceIndex + 1, 0, action.page);
      return withPages(state, pages, action.page.id);
    }
    case "RENAME_PAGE": {
      const title = action.title.trim();
      if (!title) return state;
      return withPages(state, state.document.pages.map((page) => page.id === action.pageId
        ? { ...page, title }
        : page));
    }
    case "REORDER_PAGE": {
      const fromIndex = state.document.pages.findIndex((page) => page.id === action.pageId);
      if (fromIndex < 0) return state;
      const toIndex = Math.max(0, Math.min(action.toIndex, state.document.pages.length - 1));
      if (fromIndex === toIndex) return state;
      const pages = [...state.document.pages];
      const [page] = pages.splice(fromIndex, 1);
      if (!page) return state;
      pages.splice(toIndex, 0, page);
      return withPages(state, pages);
    }
    case "DELETE_PAGE": {
      if (state.document.pages.length <= 1) return state;
      const index = state.document.pages.findIndex((page) => page.id === action.pageId);
      if (index < 0) return state;
      const pages = state.document.pages.filter((page) => page.id !== action.pageId);
      const activePageId = state.activePageId === action.pageId
        ? pages[Math.min(index, pages.length - 1)]!.id
        : state.activePageId;
      return withPages(state, pages, activePageId);
    }
    case "UPDATE_PAGE_SCENE":
      if (action.page.id !== action.pageId) return state;
      return withPages(state, state.document.pages.map((page) => page.id === action.pageId
        ? action.page.title === page.title ? action.page : { ...action.page, title: page.title }
        : page));
    default:
      return state;
  }
}

export function createEmptyIdeaSketchPage(index: number, id = crypto.randomUUID()): IdeaSketchPage {
  return {
    id,
    title: `Page ${index + 1}`,
    elements: [],
    appState: {},
    files: {},
  };
}
