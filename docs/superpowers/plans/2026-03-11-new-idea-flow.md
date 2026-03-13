# New Idea Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the launch and save flow so "New Idea" starts editing in memory without creating a file (like PowerPoint), and only writes to disk on explicit save.

**Architecture:** Remove "Quick Start" button, rename "New Presentation" to "New Idea". New Idea creates slides in memory with no `filePath`. The save button in the toolbar becomes context-aware: if `filePath` exists (opened file), save directly; if no `filePath` (new idea), prompt for file location first ("Save As" behavior). Auto-save only activates when `filePath` is set.

**Tech Stack:** React 19, Tauri v2 IPC, TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/LaunchScreen.tsx` | Modify | Remove Quick Start, rename New Presentation → New Idea, new idea creates in-memory slides |
| `src/lib/tauriCommands.ts` | Modify | Add `createNewPresentation()` that returns in-memory slides without disk I/O |
| `src/components/EditorLayout.tsx` | Modify | Add smart save: Save (Ctrl+S) does save-to-file or save-as depending on filePath |
| `src/components/Toolbar.tsx` | Modify | Replace Save As with Save button, show Save As separately |
| `src/hooks/useAutoSave.ts` | No change | Already guards on `!filePath`, so new presentations won't auto-save |

## Design Decisions

- **No Rust backend change needed for "new idea"**: We just create the default slide data in TypeScript. The Rust `create_file` command is only needed when writing to disk, which happens at save time.
- **Auto-save already correct**: `useAutoSave` checks `if (!filePath || !isDirty)` on line 28, so new unsaved presentations are already excluded.
- **Save vs Save As**: "Save" (Ctrl+S) does save-to-path if path exists, or prompts for path if new. "Save As" always prompts. This matches PowerPoint behavior.
- **No temporary file needed**: Keeping data in React state (useSlideStore) is sufficient for new presentations. Tauri desktop apps don't need temp files — the data lives in the process memory.

---

## Chunk 1: Launch Screen Changes

### Task 1: Remove Quick Start and rename New Presentation

**Files:**
- Modify: `src/components/LaunchScreen.tsx`
- Modify: `src/lib/tauriCommands.ts`

- [ ] **Step 1: Add `createNewPresentation()` to tauriCommands.ts**

Add a pure in-memory function that returns a default presentation without touching disk:

```typescript
// In src/lib/tauriCommands.ts — add this function (no Rust invoke needed)
export function createNewPresentation(): { slides: Slide[] } {
  return {
    slides: [
      {
        id: crypto.randomUUID(),
        elements: [],
        appState: {},
      },
    ],
  };
}
```

- [ ] **Step 2: Update LaunchScreen — remove Quick Start, rename button, change handler**

Replace the entire `LaunchScreen` button section. Key changes:
1. Remove the Quick Start button entirely (lines 98-113)
2. Rename "New Presentation" to "New Idea" and change subtitle
3. `handleNewFile` → `handleNewIdea`: calls `createNewPresentation()` instead of `createNewFile()`, passes no filePath

```typescript
// In src/components/LaunchScreen.tsx

// Change import: remove createNewFile, add createNewPresentation
import { getRecentFiles, openFile, openRecentFile, createNewPresentation } from "../lib/tauriCommands";

// Replace handleNewFile with:
function handleNewIdea() {
  const { slides } = createNewPresentation();
  onFileOpened("", slides);  // empty string = no file path
}
```

In the JSX, replace the grid + Quick Start section (lines 78-113) with just the two-button grid:

```tsx
<div className="bg-white rounded-lg shadow-sm p-8 mb-8">
  <div className="grid grid-cols-2 gap-4">
    <button
      onClick={handleNewIdea}
      className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
    >
      <div className="text-4xl mb-2">+</div>
      <div className="font-semibold text-gray-900">New Idea</div>
      <div className="text-sm text-gray-500 mt-1">Start from scratch</div>
    </button>

    <button
      onClick={handleOpenFile}
      className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
    >
      <div className="text-4xl mb-2">📁</div>
      <div className="font-semibold text-gray-900">Open File</div>
      <div className="text-sm text-gray-500 mt-1">Browse for .is files</div>
    </button>
  </div>
</div>
```

- [ ] **Step 3: Update App.tsx to handle empty filePath**

In `App.tsx`, the `handleFileOpened` function passes filePath to LOAD_PRESENTATION. When filePath is empty string, the store should treat it as `undefined` (no file):

```typescript
// In src/App.tsx — update handleFileOpened
function handleFileOpened(filePath: string, slides: any[]) {
  dispatch({
    type: "LOAD_PRESENTATION",
    payload: { slides, filePath: filePath || undefined },
  });
  setShowEditor(true);
}
```

- [ ] **Step 4: Verify launch screen renders correctly**

Run: `npm run dev`
Expected: Launch screen shows two buttons — "New Idea" and "Open File". No Quick Start button. Clicking "New Idea" goes directly to editor without any file dialog.

- [ ] **Step 5: Commit**

```bash
git add src/components/LaunchScreen.tsx src/lib/tauriCommands.ts src/App.tsx
git commit -m "feat: replace New Presentation with New Idea, remove Quick Start

New Idea starts editing in memory without creating a file on disk.
File is only created when user explicitly saves."
```

---

## Chunk 2: Smart Save in Editor

### Task 2: Add context-aware Save to Toolbar and EditorLayout

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/EditorLayout.tsx`

- [ ] **Step 1: Update Toolbar to show Save + Save As**

Replace the current toolbar buttons with Save and Save As. Save should be the primary action, Save As secondary. Also update `handleNewFile` → `handleNewIdea` naming:

```typescript
// src/components/Toolbar.tsx
import { SaveIndicator } from "./SaveIndicator";

interface ToolbarProps {
  fileName?: string;
  isDirty: boolean;
  isSaving: boolean;
  onNewIdea: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}

export function Toolbar({
  fileName,
  isDirty,
  isSaving,
  onNewIdea,
  onOpenFile,
  onSave,
  onSaveAs,
}: ToolbarProps) {
  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <div className="font-semibold text-gray-900">
          {fileName || "Untitled"}
        </div>
        <SaveIndicator isDirty={isDirty} isSaving={isSaving} />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onNewIdea}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          New
        </button>
        <button
          onClick={onOpenFile}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          Open
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          Save
        </button>
        <button
          onClick={onSaveAs}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          Save As
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update EditorLayout with smart save logic**

Add a `handleSave` function that checks `state.filePath`:
- If filePath exists → save directly to that path
- If no filePath → behave like Save As (prompt for location, then save and set filePath)

Also rename `handleNewFile` to `handleNewIdea` using `createNewPresentation`:

```typescript
// In src/components/EditorLayout.tsx

// Update imports: remove createNewFile, add createNewPresentation
import { openFile, saveFile, createNewPresentation } from "../lib/tauriCommands";
import { save } from "@tauri-apps/plugin-dialog";

// Replace handleNewFile with:
function handleNewIdea() {
  const { slides } = createNewPresentation();
  dispatch({
    type: "LOAD_PRESENTATION",
    payload: { slides },  // no filePath = new unsaved presentation
  });
}

// Add handleSave:
async function handleSave() {
  if (state.filePath) {
    // Opened file — save directly
    try {
      setIsSaving(true);
      await saveFile(state.filePath, state.slides);
      dispatch({ type: "MARK_SAVED" });
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  } else {
    // New presentation — prompt for location (same as Save As)
    await handleSaveAs();
  }
}
```

Update the `handleSaveAs` function to also set the filePath in state after saving (it already does via LOAD_PRESENTATION).

Update the Toolbar usage in JSX:

```tsx
<Toolbar
  fileName={fileName}
  isDirty={state.isDirty}
  isSaving={isSaving}
  onNewIdea={handleNewIdea}
  onOpenFile={handleOpenFile}
  onSave={handleSave}
  onSaveAs={handleSaveAs}
/>
```

- [ ] **Step 3: Verify save behavior for both scenarios**

Run: `npm run dev`

Test new presentation flow:
1. Click "New Idea" → editor opens, title shows "Untitled"
2. Draw something on canvas
3. Click "Save" → file dialog appears, choose location → file saved
4. Title updates to show filename
5. Further edits auto-save to that file

Test open file flow:
1. Click "Open File" → select existing .is file
2. Title shows filename
3. Draw something → click "Save" → saves directly (no dialog)
4. Auto-save also works

- [ ] **Step 4: Commit**

```bash
git add src/components/Toolbar.tsx src/components/EditorLayout.tsx
git commit -m "feat: add smart save - Save prompts for location on new ideas, saves directly on opened files"
```
