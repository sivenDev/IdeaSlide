# Recent Files List & Preview Panel Toggle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the recent files list so it actually populates and displays modification time, and add a toggle button to hide/show the slide preview panel.

**Architecture:** Fix the frontend-backend type mismatch for RecentFile (`lastOpened: number` vs `modified: String`), wire up `add_recent_file` Tauri command on file open/save, format the timestamp in the LaunchScreen UI. For the preview panel, add a `showPreviewPanel` state in EditorLayout with a toggle button in the Toolbar.

**Tech Stack:** React 19, Tauri v2 IPC, TypeScript, Tailwind CSS v4

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types.ts` | Modify | Fix `RecentFile` type to match Rust backend |
| `src/lib/tauriCommands.ts` | Modify | Add `addRecentFile()` wrapper |
| `src/components/LaunchScreen.tsx` | Modify | Display modification time in recent files list |
| `src/components/EditorLayout.tsx` | Modify | Call `addRecentFile` on open/save, add preview panel toggle state |
| `src/components/Toolbar.tsx` | Modify | Add preview panel toggle button |
| `src/components/SlidePreviewPanel.tsx` | No change | Already works, just conditionally rendered |

## Design Decisions

- **Type alignment**: Rust returns `modified: String` (ISO 8601). Frontend should match with `modified: string` and format it for display.
- **When to call `add_recent_file`**: On successful file open and on first save of a new presentation (when filePath is first set). Not on auto-save since the path doesn't change.
- **Preview panel toggle**: Simple boolean state in EditorLayout. Toolbar gets a toggle button. Panel is hidden with conditional rendering (not CSS display:none), so it doesn't consume resources when hidden.

---

## Chunk 1: Fix Recent Files

### Task 1: Fix RecentFile type and wire up add_recent_file

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src/components/LaunchScreen.tsx`
- Modify: `src/components/EditorLayout.tsx`

- [ ] **Step 1: Fix RecentFile type in types.ts**

Align with the Rust struct which returns `{ path, name, modified }`:

```typescript
// src/types.ts — replace the RecentFile interface
export interface RecentFile {
  path: string;
  name: string;
  modified: string;  // ISO 8601 timestamp from Rust backend
}
```

- [ ] **Step 2: Add addRecentFile to tauriCommands.ts**

```typescript
// Add to src/lib/tauriCommands.ts
export async function addRecentFile(path: string): Promise<void> {
  await invoke("add_recent_file", { path });
}
```

- [ ] **Step 3: Update LaunchScreen to display modification time**

In `src/components/LaunchScreen.tsx`, replace the recent file item rendering (lines 99-107) to show formatted time instead of raw path:

```tsx
{recentFiles.map((file) => (
  <button
    key={file.path}
    onClick={() => handleOpenRecent(file.path)}
    className="w-full text-left p-3 rounded hover:bg-gray-50 transition-colors"
  >
    <div className="flex items-center justify-between">
      <div className="font-medium text-gray-900">{file.name}</div>
      <div className="text-xs text-gray-400">
        {file.modified
          ? new Date(file.modified).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : ""}
      </div>
    </div>
    <div className="text-sm text-gray-500 truncate">{file.path}</div>
  </button>
))}
```

- [ ] **Step 4: Call addRecentFile on file open and save-as in EditorLayout**

In `src/components/EditorLayout.tsx`, import `addRecentFile` and call it in the right places:

```typescript
// Update import
import { createNewPresentation, openFile, saveFile, addRecentFile } from "../lib/tauriCommands";
```

In `handleOpenFile`, after successful dispatch:
```typescript
async function handleOpenFile() {
  try {
    const { path, slides } = await openFile();
    dispatch({
      type: "LOAD_PRESENTATION",
      payload: { slides, filePath: path },
    });
    addRecentFile(path).catch(console.error);
  } catch (err) {
    console.error("Failed to open file:", err);
  }
}
```

In `handleSaveAs`, after successful save:
```typescript
async function handleSaveAs() {
  try {
    const filePath = await save({
      filters: [{ name: "IdeaSlide", extensions: ["is"] }],
      defaultPath: fileName || "Untitled.is",
    });

    if (!filePath) return;

    await saveFile(filePath, state.slides);
    dispatch({
      type: "LOAD_PRESENTATION",
      payload: { slides: state.slides, filePath },
    });
    addRecentFile(filePath).catch(console.error);
  } catch (err) {
    console.error("Failed to save file:", err);
  }
}
```

Also call it in `handleSave` after successful direct save (so modification time updates):
```typescript
async function handleSave() {
  if (state.filePath) {
    try {
      setIsSaving(true);
      await saveFile(state.filePath, state.slides);
      dispatch({ type: "MARK_SAVED" });
      addRecentFile(state.filePath).catch(console.error);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  } else {
    await handleSaveAs();
  }
}
```

- [ ] **Step 5: Also call addRecentFile in LaunchScreen when opening recent files**

In `src/components/LaunchScreen.tsx`, update `handleOpenFile` and `handleOpenRecent`:

```typescript
// Add import
import { getRecentFiles, createNewPresentation, openFile, openRecentFile, addRecentFile } from "../lib/tauriCommands";

// In handleOpenFile, after successful open:
async function handleOpenFile() {
  try {
    setError(null);
    const { path, slides } = await openFile();
    addRecentFile(path).catch(console.error);
    onFileOpened(path, slides);
  } catch (err) {
    if (err instanceof Error && err.message !== "File selection cancelled") {
      setError(err.message);
    }
  }
}
```

- [ ] **Step 6: Verify TypeScript compiles and recent files work**

Run: `npx tsc --noEmit`
Expected: No errors

Run: `npm run dev`
Test: Open a file → close and reopen app → recent files list should show the file with modification time.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/lib/tauriCommands.ts src/components/LaunchScreen.tsx src/components/EditorLayout.tsx
git commit -m "feat: fix recent files list - wire up addRecentFile and display modification time"
```

---

## Chunk 2: Preview Panel Toggle

### Task 2: Add toggle button to hide/show the slide preview panel

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/EditorLayout.tsx`

- [ ] **Step 1: Add toggle prop to Toolbar**

In `src/components/Toolbar.tsx`, add `showPreview` and `onTogglePreview` props:

```typescript
interface ToolbarProps {
  fileName?: string;
  isDirty: boolean;
  isSaving: boolean;
  showPreview: boolean;
  onNewIdea: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onTogglePreview: () => void;
}

export function Toolbar({
  fileName,
  isDirty,
  isSaving,
  showPreview,
  onNewIdea,
  onOpenFile,
  onSave,
  onSaveAs,
  onTogglePreview,
}: ToolbarProps) {
  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onTogglePreview}
          className={`px-2 py-1.5 text-sm rounded transition-colors ${
            showPreview
              ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
              : "text-gray-500 hover:bg-gray-100"
          }`}
          title={showPreview ? "Hide slides panel" : "Show slides panel"}
        >
          ☰
        </button>
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

- [ ] **Step 2: Add showPreview state and conditional rendering in EditorLayout**

In `src/components/EditorLayout.tsx`:

Add state:
```typescript
const [showPreview, setShowPreview] = useState(true);
```

Update Toolbar usage:
```tsx
<Toolbar
  fileName={fileName}
  isDirty={state.isDirty}
  isSaving={isSaving}
  showPreview={showPreview}
  onNewIdea={handleNewIdea}
  onOpenFile={handleOpenFile}
  onSave={handleSave}
  onSaveAs={handleSaveAs}
  onTogglePreview={() => setShowPreview((prev) => !prev)}
/>
```

Conditionally render SlidePreviewPanel:
```tsx
<div className="flex-1 flex overflow-hidden">
  {showPreview && (
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
  )}

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

- [ ] **Step 3: Verify toggle works**

Run: `npm run dev`
Test:
1. Editor opens with preview panel visible (default)
2. Click ☰ button in toolbar → panel hides, canvas expands to full width
3. Click ☰ again → panel reappears
4. Toggle button changes color when panel is visible vs hidden

- [ ] **Step 4: Commit**

```bash
git add src/components/Toolbar.tsx src/components/EditorLayout.tsx
git commit -m "feat: add toggle button to hide/show slide preview panel"
```
