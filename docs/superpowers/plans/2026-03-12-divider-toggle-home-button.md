# Divider Toggle & Home Button Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the preview panel toggle to a divider between panel and editor, and replace the toolbar toggle with a home button.

**Architecture:** New `ResizableDivider` flex child sits between `SlidePreviewPanel` and `SlideCanvas` in the existing flex row. Toolbar loses toggle props, gains `onGoHome`. EditorLayout handles unsaved-changes confirmation via Tauri `ask()` dialog. App passes `onGoHome` callback.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Tauri v2 dialog plugin

**Spec:** `docs/superpowers/specs/2026-03-12-divider-toggle-home-button-design.md`

---

## Chunk 1: ResizableDivider + Layout Integration

### Task 1: Create ResizableDivider component

**Files:**
- Create: `src/components/ResizableDivider.tsx`

- [ ] **Step 1: Create ResizableDivider.tsx**

```tsx
interface ResizableDividerProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function ResizableDivider({ isVisible, onToggle }: ResizableDividerProps) {
  return (
    <div className="relative w-1 bg-gray-200 hover:w-1.5 hover:bg-gray-300 transition-all cursor-col-resize flex-shrink-0 group">
      <button
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-6 h-6 rounded-full bg-white border border-gray-300 hover:bg-gray-100 hover:border-gray-400 flex items-center justify-center text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title={isVisible ? "Hide slides panel" : "Show slides panel"}
      >
        {isVisible ? "◀" : "▶"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: No errors related to ResizableDivider

- [ ] **Step 3: Commit**

```bash
git add src/components/ResizableDivider.tsx
git commit -m "feat: add ResizableDivider component with toggle button"
```

---

### Task 2: Integrate ResizableDivider into EditorLayout

**Files:**
- Modify: `src/components/EditorLayout.tsx:6,159-199`

- [ ] **Step 1: Add import for ResizableDivider**

In `src/components/EditorLayout.tsx`, add after line 7 (`import { SlideCanvas }...`):

```tsx
import { ResizableDivider } from "./ResizableDivider";
```

- [ ] **Step 2: Add ResizableDivider between preview panel and canvas**

Replace lines 173-198 (the flex-1 flex overflow-hidden div) with:

```tsx
      <div className="flex-1 flex overflow-hidden">
        <div className={`transition-all duration-300 overflow-hidden flex-shrink-0 ${showPreview ? "w-64" : "w-0"}`}>
          <SlidePreviewPanel
            slides={state.slides}
            currentSlideIndex={state.currentSlideIndex}
            thumbnails={thumbnails}
            onSlideSelect={(index) =>
              dispatch({ type: "SET_CURRENT_SLIDE", payload: { index } })
            }
            onAddSlide={() => dispatch({ type: "ADD_SLIDE" })}
            onDeleteSlide={(index) =>
              dispatch({ type: "DELETE_SLIDE", payload: { index } })
            }
          />
        </div>

        <ResizableDivider
          isVisible={showPreview}
          onToggle={() => setShowPreview((prev) => !prev)}
        />

        <div className="flex-1 relative">
          <div className="absolute inset-0">
            <ErrorBoundary>
              <SlideCanvas
                slideId={currentSlide.id}
                elements={currentSlide.elements}
                appState={currentSlide.appState}
                onChange={handleSlideChange}
              />
            </ErrorBoundary>
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Remove `onTogglePreview` prop from Toolbar usage**

In `src/components/EditorLayout.tsx`, remove these two props from the `<Toolbar>` JSX (lines 165 and 170):

```diff
-        showPreview={showPreview}
...
-        onTogglePreview={() => setShowPreview((prev) => !prev)}
```

(Don't add `onGoHome` yet — that's Task 4.)

- [ ] **Step 4: Update SlidePreviewPanel to remove w-64**

In `src/components/SlidePreviewPanel.tsx`, line 22, the panel has its own `w-64`. Since the wrapper div now controls width, change:

```diff
-    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
+    <div className="w-64 min-w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
```

The `min-w-64` ensures the panel content doesn't shrink below 256px inside the transitioning wrapper.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: Errors about Toolbar props mismatch (expected — Toolbar still expects old props). This is fine; Task 3 fixes it.

- [ ] **Step 6: Commit**

```bash
git add src/components/EditorLayout.tsx src/components/SlidePreviewPanel.tsx
git commit -m "feat: integrate ResizableDivider into editor layout"
```

---

### Task 3: Update Toolbar — replace toggle with home button

**Files:**
- Modify: `src/components/Toolbar.tsx:2-39`

- [ ] **Step 1: Update ToolbarProps interface**

Replace the ToolbarProps interface (lines 3-13) with:

```tsx
interface ToolbarProps {
  fileName?: string;
  isDirty: boolean;
  isSaving: boolean;
  onNewIdea: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onGoHome: () => void;
}
```

- [ ] **Step 2: Update destructured props**

Replace lines 15-25 with:

```tsx
export function Toolbar({
  fileName,
  isDirty,
  isSaving,
  onNewIdea,
  onOpenFile,
  onSave,
  onSaveAs,
  onGoHome,
}: ToolbarProps) {
```

- [ ] **Step 3: Replace ☰ toggle button with 🏠 home button**

Replace lines 29-39 (the toggle button) with:

```tsx
        <button
          onClick={onGoHome}
          className="px-2 py-1.5 text-sm rounded transition-colors text-gray-500 hover:bg-gray-100"
          title="Back to home"
        >
          🏠
        </button>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: Error about missing `onGoHome` prop in EditorLayout (expected — Task 4 fixes it).

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.tsx
git commit -m "feat: replace toggle button with home button in toolbar"
```

---

## Chunk 2: Navigation Logic + App Integration

### Task 4: Add navigation logic to EditorLayout

**Files:**
- Modify: `src/components/EditorLayout.tsx:10-12,161-171`

- [ ] **Step 1: Add `ask` to dialog import and add `onGoHome` prop**

Replace line 10:
```tsx
import { save, message } from "@tauri-apps/plugin-dialog";
```
with:
```tsx
import { save, message, ask } from "@tauri-apps/plugin-dialog";
```

Replace line 12:
```tsx
export function EditorLayout() {
```
with:
```tsx
interface EditorLayoutProps {
  onGoHome: () => void;
}

export function EditorLayout({ onGoHome }: EditorLayoutProps) {
```

- [ ] **Step 2: Add handleGoHome function**

Add after the `handleSaveAs` function (after line 121), before the `buildFingerprint` function:

```tsx
  const handleGoHome = useCallback(async () => {
    if (state.isDirty) {
      try {
        const shouldLeave = await ask(
          "You have unsaved changes. Leave without saving?",
          {
            title: "Unsaved Changes",
            kind: "warning",
            okLabel: "Leave",
            cancelLabel: "Stay",
          }
        );
        if (!shouldLeave) return;
      } catch (err) {
        console.error("Dialog error:", err);
        return;
      }
    }
    onGoHome();
  }, [state.isDirty, onGoHome]);
```

- [ ] **Step 3: Pass onGoHome to Toolbar**

In the `<Toolbar>` JSX, add the `onGoHome` prop:

```tsx
      <Toolbar
        fileName={fileName}
        isDirty={state.isDirty}
        isSaving={isSaving}
        onNewIdea={handleNewIdea}
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onGoHome={handleGoHome}
      />
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: Error about EditorLayout now requiring `onGoHome` prop in App.tsx (expected — Task 5 fixes it).

- [ ] **Step 5: Commit**

```bash
git add src/components/EditorLayout.tsx
git commit -m "feat: add home navigation with unsaved changes confirmation"
```

---

### Task 5: Wire up App.tsx

**Files:**
- Modify: `src/App.tsx:23-26`

- [ ] **Step 1: Add onGoHome callback to EditorLayout**

Replace lines 23-26:
```tsx
    <ErrorBoundary>
      <EditorLayout />
    </ErrorBoundary>
```
with:
```tsx
    <ErrorBoundary>
      <EditorLayout onGoHome={() => setShowEditor(false)} />
    </ErrorBoundary>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 3: Visual verification**

Run: `npm run tauri dev`

Verify:
1. ☰ button is gone, 🏠 button appears in toolbar
2. Divider with toggle button appears between preview panel and canvas
3. Hovering divider shows ◀ button
4. Clicking ◀ hides preview panel, button changes to ▶
5. Clicking ▶ shows preview panel again
6. Clicking 🏠 with no changes → goes to launch screen
7. Make an edit, click 🏠 → confirmation dialog appears
8. Click "Stay" → stays in editor
9. Click "Leave" → goes to launch screen

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up home navigation in App"
```
