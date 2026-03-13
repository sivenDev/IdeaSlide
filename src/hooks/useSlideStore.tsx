import { createContext, useContext, useReducer, ReactNode } from "react";
import type { Presentation, Slide } from "../types";

interface SlideStoreState extends Presentation {
  presentationMode: 'none' | 'preview' | 'fullscreen';
}

type SlideStoreAction =
  | { type: "LOAD_PRESENTATION"; payload: { slides: Slide[]; filePath?: string } }
  | { type: "ADD_SLIDE"; payload?: { index?: number } }
  | { type: "DELETE_SLIDE"; payload: { index: number } }
  | { type: "SET_CURRENT_SLIDE"; payload: { index: number } }
  | {
      type: "UPDATE_SLIDE";
      payload: {
        index: number;
        elements: readonly any[];
        appState: Partial<any>;
        files: Record<string, any>;
        contentChanged: boolean;
      };
    }
  | { type: "MARK_SAVED" }
  | { type: "MARK_DIRTY" }
  | { type: "START_PRESENTATION"; payload: { mode: 'preview' | 'fullscreen' } }
  | { type: "EXIT_PRESENTATION" };

const initialState: SlideStoreState = {
  slides: [{ id: crypto.randomUUID(), elements: [], appState: {}, files: {} }],
  currentSlideIndex: 0,
  isDirty: false,
  presentationMode: 'none',
};

function slideStoreReducer(
  state: SlideStoreState,
  action: SlideStoreAction
): SlideStoreState {
  switch (action.type) {
    case "LOAD_PRESENTATION":
      return {
        ...state,
        slides: action.payload.slides,
        filePath: action.payload.filePath,
        currentSlideIndex: 0,
        isDirty: false,
      };

    case "ADD_SLIDE": {
      const newSlide: Slide = {
        id: crypto.randomUUID(),
        elements: [],
        appState: {},
        files: {},
      };
      const insertIndex = action.payload?.index ?? state.currentSlideIndex + 1;
      const newSlides = [...state.slides];
      newSlides.splice(insertIndex, 0, newSlide);
      return {
        ...state,
        slides: newSlides,
        currentSlideIndex: insertIndex,
        isDirty: true,
      };
    }

    case "DELETE_SLIDE": {
      if (state.slides.length === 1) return state;
      const newSlides = state.slides.filter((_, i) => i !== action.payload.index);
      const newIndex =
        action.payload.index === state.currentSlideIndex
          ? Math.max(0, state.currentSlideIndex - 1)
          : state.currentSlideIndex > action.payload.index
          ? state.currentSlideIndex - 1
          : state.currentSlideIndex;
      return {
        ...state,
        slides: newSlides,
        currentSlideIndex: newIndex,
        isDirty: true,
      };
    }

    case "SET_CURRENT_SLIDE":
      return {
        ...state,
        currentSlideIndex: action.payload.index,
      };

    case "UPDATE_SLIDE": {
      const newSlides = [...state.slides];
      newSlides[action.payload.index] = {
        ...newSlides[action.payload.index],
        elements: action.payload.elements,
        appState: action.payload.appState,
        files: action.payload.files,
      };
      return {
        ...state,
        slides: newSlides,
        isDirty: state.isDirty || action.payload.contentChanged,
      };
    }

    case "MARK_SAVED":
      return {
        ...state,
        isDirty: false,
      };

    case "MARK_DIRTY":
      return {
        ...state,
        isDirty: true,
      };

    case "START_PRESENTATION":
      return {
        ...state,
        presentationMode: action.payload.mode,
      };

    case "EXIT_PRESENTATION":
      return {
        ...state,
        presentationMode: 'none',
      };

    default:
      return state;
  }
}

const SlideStoreContext = createContext<{
  state: SlideStoreState;
  dispatch: React.Dispatch<SlideStoreAction>;
} | undefined>(undefined);

export function SlideStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(slideStoreReducer, initialState);

  return (
    <SlideStoreContext.Provider value={{ state, dispatch }}>
      {children}
    </SlideStoreContext.Provider>
  );
}

export function useSlideStore() {
  const context = useContext(SlideStoreContext);
  if (!context) {
    throw new Error("useSlideStore must be used within SlideStoreProvider");
  }
  return context;
}
