# Slide Organizer and Laser Pointer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-surface slide organizer with inline rename and drag reorder, and add a presentation-only laser pointer toggled by `k`.

**Architecture:** Keep the existing `Slide` toolbar entry point, but swap its slide dropdown for a large anchored popover rendered by a dedicated `SlideOrganizer` component. Push persistent title/order behavior into pure slide helpers plus `useSlideStore`, then layer the presentation laser pointer entirely inside `PresentationMode` using Excalidraw collaborator-pointer state so slide content remains untouched.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Radix UI Popover primitives, `@dnd-kit` sortable primitives, Excalidraw 0.18, Node `node:test`

**Spec:** `docs/superpowers/specs/2026-04-21-slide-organizer-laser-pointer-design.md`

**Execution Skills:** Use `@test-driven-development` for every behavior change and `@verification-before-completion` before claiming the work is done.

---

## Scope Note

This spec spans two UI surfaces, but it still fits one execution track because slide titles/order must be solved before the organizer UI can be correct, and the laser pointer is isolated enough to land as the final chunk without blocking organizer work.

## File Structure

### New Files

- `src/lib/slideTitles.ts` — pure helpers for default slide titles, blank-title fallback, and manifest-title hydration
- `src/lib/slideStoreReducer.ts` — pure slide-store reducer/state helpers for importable tests
- `src/lib/presentationLaser.ts` — pure helpers for laser-mode collaborator state and reset behavior
- `src/components/SlideOrganizer.tsx` — organizer popover content for select/add/delete/rename/reorder
- `src/components/ui/Popover.tsx` — shared Radix popover wrapper matching existing UI helper style
- `src/components/ui/Input.tsx` — shared input primitive for inline rename rows
- `tests/slideTitles.test.mjs` — pure tests for title fallback and manifest hydration
- `tests/slideStoreReducer.test.mjs` — reducer tests for rename/reorder/current-slide stability
- `tests/slideOrganizerWiring.test.mjs` — source-level tests for organizer wiring in toolbar and component structure
- `tests/presentationLaser.test.mjs` — pure tests for laser-mode state helpers

### Modified Files

- `package.json` — add direct dependencies for `@radix-ui/react-popover` and `@dnd-kit` packages
- `package-lock.json` — npm lockfile update for the new direct dependencies
- `src/types.ts` — add `title` to `Slide`
- `src/lib/tauriCommands.ts` — preserve slide titles when converting to/from `.is` data
- `src/hooks/useSlideStore.tsx` — consume the extracted pure reducer/state helpers inside the React context wrapper and expose the new actions through the context
- `src/components/Toolbar.tsx` — replace the slide dropdown content with popover-triggered organizer wiring
- `src/components/EditorLayout.tsx` — pass rename/reorder callbacks to the toolbar
- `src/components/PresentationMode.tsx` — toggle laser mode on `k`, update collaborator pointer state, render status indicator, clear trail on cleanup
- `tests/editorChromeNavigation.test.mjs` — update toolbar expectations away from the old slide dropdown behavior if the existing assertions become stale

### Dependency Commands

- `npm install @radix-ui/react-popover @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

---

## Chunk 1: Titles and State Foundation

### Task 1: Add pure slide-title helpers first

**Files:**
- Create: `src/lib/slideTitles.ts`
- Test: `tests/slideTitles.test.mjs`

- [ ] **Step 1: Write the failing title-helper tests**

Create `tests/slideTitles.test.mjs` with focused pure tests:

```javascript
import test from "node:test";
import assert from "node:assert/strict";

const helpers = () => import("../src/lib/slideTitles.ts");

test("createDefaultSlideTitle uses one-based numbering", async () => {
  const { createDefaultSlideTitle } = await helpers();
  assert.equal(createDefaultSlideTitle(0), "Slide 1");
  assert.equal(createDefaultSlideTitle(3), "Slide 4");
});

test("normalizeSlideTitle falls back when the submitted value is blank", async () => {
  const { normalizeSlideTitle } = await helpers();
  assert.equal(normalizeSlideTitle("   ", 2, "Agenda"), "Agenda");
  assert.equal(normalizeSlideTitle("", 1), "Slide 2");
});

test("applyManifestTitles hydrates titles by slide id and falls back for missing entries", async () => {
  const { applyManifestTitles } = await helpers();
  const slides = applyManifestTitles(
    [
      { id: "slide-b", elements: [], appState: {}, files: {} },
      { id: "slide-a", elements: [], appState: {}, files: {} },
    ],
    [
      { id: "slide-a", title: "Intro" },
      { id: "slide-b", title: "" },
    ],
  );

  assert.equal(slides[0].title, "Slide 1");
  assert.equal(slides[1].title, "Intro");
});
```

- [ ] **Step 2: Run the test and confirm it fails for the right reason**

Run: `node --test tests/slideTitles.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/slideTitles.ts` or missing exported helpers.

- [ ] **Step 3: Write the minimal helper implementation**

Create `src/lib/slideTitles.ts` with concrete helpers:

```typescript
interface SlideContent {
  id: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
}

interface SlideWithTitle extends SlideContent {
  title: string;
}

export function createDefaultSlideTitle(index: number) {
  return `Slide ${index + 1}`;
}

export function normalizeSlideTitle(
  rawTitle: string | undefined,
  index: number,
  previousTitle?: string,
) {
  const trimmed = rawTitle?.trim() ?? "";
  return trimmed || previousTitle || createDefaultSlideTitle(index);
}

export function applyManifestTitles(
  slideContents: SlideContent[],
  manifestSlides: Array<{ id: string; title: string }>,
): SlideWithTitle[] {
  const manifestTitleById = new Map(
    manifestSlides.map((slide) => [slide.id, slide.title]),
  );

  return slideContents.map((slide, index) => ({
    ...slide,
    title: normalizeSlideTitle(manifestTitleById.get(slide.id), index),
  }));
}
```

- [ ] **Step 4: Run the helper test again**

Run: `node --test tests/slideTitles.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit the helper baseline**

```bash
git add tests/slideTitles.test.mjs src/lib/slideTitles.ts
git commit -m "feat: add slide title helper utilities"
```

---

### Task 2: Extend the reducer for titled slides, rename, and reorder

**Files:**
- Create: `src/lib/slideStoreReducer.ts`
- Modify: `src/types.ts`
- Modify: `src/hooks/useSlideStore.tsx`
- Test: `tests/slideStoreReducer.test.mjs`

- [ ] **Step 1: Write the failing reducer tests**

Create `tests/slideStoreReducer.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";

const storeModule = () => import("../src/lib/slideStoreReducer.ts");

test("slideStoreReducer renames a slide and marks the deck dirty", async () => {
  const { slideStoreReducer } = await storeModule();
  const initial = {
    slides: [
      { id: "slide-1", title: "Slide 1", elements: [], appState: {}, files: {} },
    ],
    currentSlideIndex: 0,
    isDirty: false,
    presentationMode: "none",
    currentCameraIndex: 0,
    transitionSpeed: "slow",
    activeSessions: new Map(),
  };

  const next = slideStoreReducer(initial, {
    type: "RENAME_SLIDE",
    payload: { index: 0, title: "Intro" },
  });

  assert.equal(next.slides[0].title, "Intro");
  assert.equal(next.isDirty, true);
});

test("slideStoreReducer keeps the active slide selected after reorder", async () => {
  const { slideStoreReducer } = await storeModule();
  const initial = {
    slides: [
      { id: "slide-1", title: "Intro", elements: [], appState: {}, files: {} },
      { id: "slide-2", title: "Agenda", elements: [], appState: {}, files: {} },
      { id: "slide-3", title: "Wrap", elements: [], appState: {}, files: {} },
    ],
    currentSlideIndex: 1,
    isDirty: false,
    presentationMode: "none",
    currentCameraIndex: 0,
    transitionSpeed: "slow",
    activeSessions: new Map(),
  };

  const next = slideStoreReducer(initial, {
    type: "REORDER_SLIDES",
    payload: { slides: [initial.slides[2], initial.slides[0], initial.slides[1]] },
  });

  assert.equal(next.currentSlideIndex, 2);
  assert.equal(next.slides[2].id, "slide-2");
  assert.equal(next.isDirty, true);
});
```

- [ ] **Step 2: Run the reducer test and verify the failure**

Run: `node --test tests/slideStoreReducer.test.mjs`
Expected: FAIL because `slideStoreReducer` is not exported yet and/or the new actions do not exist.

- [ ] **Step 3: Implement the minimal reducer/type changes**

Make the following changes:

- add `title: string` to `Slide` in `src/types.ts`
- create `src/lib/slideStoreReducer.ts` and move the reducer, action union, and initial state factory there
- import `createDefaultSlideTitle` / `normalizeSlideTitle` from `src/lib/slideTitles.ts`
- give the initial slide and `ADD_SLIDE` slides a default title
- add action variants:

```typescript
| { type: "RENAME_SLIDE"; payload: { index: number; title: string } }
| { type: "REORDER_SLIDES"; payload: { slides: Slide[] } }
```

- implement the reducer cases:

```typescript
case "RENAME_SLIDE": {
  const updatedSlides = [...state.slides];
  updatedSlides[action.payload.index] = {
    ...updatedSlides[action.payload.index],
    title: normalizeSlideTitle(
      action.payload.title,
      action.payload.index,
      updatedSlides[action.payload.index]?.title,
    ),
  };
  return { ...state, slides: updatedSlides, isDirty: true };
}

case "REORDER_SLIDES": {
  const activeSlideId = state.slides[state.currentSlideIndex]?.id;
  const nextSlides = action.payload.slides;
  const nextIndex = Math.max(
    0,
    nextSlides.findIndex((slide) => slide.id === activeSlideId),
  );
  return {
    ...state,
    slides: nextSlides,
    currentSlideIndex: nextIndex,
    isDirty: true,
  };
}
```

- update `src/hooks/useSlideStore.tsx` so the React provider imports the pure reducer/state helper instead of owning reducer logic inline

- [ ] **Step 4: Re-run the reducer test**

Run: `node --test tests/slideStoreReducer.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit the store changes**

```bash
git add src/types.ts src/lib/slideStoreReducer.ts src/hooks/useSlideStore.tsx tests/slideStoreReducer.test.mjs
git commit -m "feat: add slide title and reorder store actions"
```

---

### Task 3: Wire title persistence through `.is` conversion

**Files:**
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src/lib/slideTitles.ts`
- Test: `tests/slideTitles.test.mjs`

- [ ] **Step 1: Extend the existing helper test with round-trip expectations**

Append one more test to `tests/slideTitles.test.mjs`:

```javascript
test("buildSlideManifestEntries preserves the current slide titles", async () => {
  const { buildSlideManifestEntries } = await helpers();
  assert.deepEqual(
    buildSlideManifestEntries([
      { id: "slide-1", title: "Intro", elements: [], appState: {}, files: {} },
      { id: "slide-2", title: "Agenda", elements: [], appState: {}, files: {} },
    ]),
    [
      { id: "slide-1", title: "Intro" },
      { id: "slide-2", title: "Agenda" },
    ],
  );
});
```

- [ ] **Step 2: Run the helper suite and confirm the new assertion fails**

Run: `node --test tests/slideTitles.test.mjs`
Expected: FAIL because `buildSlideManifestEntries` is not exported yet.

- [ ] **Step 3: Implement the minimal persistence wiring**

Make these changes:

- export `buildSlideManifestEntries(slides: Slide[])` from `src/lib/slideTitles.ts`
- in `src/lib/tauriCommands.ts`, remove the local index-based manifest builder and import the helper instead
- update `convertFromIsFileData()` to use `applyManifestTitles()` after reconstructing slide contents
- update `createNewPresentation()` and any load path that fabricates slides in memory to include `title: createDefaultSlideTitle(index)`

The target shape inside `convertFromIsFileData()` should become:

```typescript
const slideContents = data.slides.map((slide) => ({
  id: slide.id,
  elements: slide.content.elements || [],
  appState: slide.content.appState || {},
  files: reconstructedFiles,
}));

return applyManifestTitles(slideContents, data.manifest.slides ?? []);
```

- [ ] **Step 4: Run the focused tests and a full type/build check**

Run:
- `node --test tests/slideTitles.test.mjs`
- `npm run build`

Expected:
- helper tests PASS
- build completes without TypeScript errors

- [ ] **Step 5: Commit the persistence wiring**

```bash
git add src/lib/slideTitles.ts src/lib/tauriCommands.ts tests/slideTitles.test.mjs
git commit -m "feat: persist slide titles in is file conversions"
```

---

## Chunk 2: Organizer UI Shell

### Task 4: Add shared Popover and Input UI primitives

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/ui/Popover.tsx`
- Create: `src/components/ui/Input.tsx`
- Test: `tests/slideOrganizerWiring.test.mjs`

- [ ] **Step 1: Write the failing source-level UI test**

Create `tests/slideOrganizerWiring.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("shared popover and input primitives exist for the slide organizer flow", async () => {
  const popoverSource = await readSource("src/components/ui/Popover.tsx");
  const inputSource = await readSource("src/components/ui/Input.tsx");

  assert.match(popoverSource, /@radix-ui\/react-popover/);
  assert.match(popoverSource, /export const PopoverTrigger/);
  assert.match(inputSource, /forwardRef/);
  assert.match(inputSource, /type = \"text\"/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/slideOrganizerWiring.test.mjs`
Expected: FAIL because the new UI files do not exist yet.

- [ ] **Step 3: Install the dependencies and add the shared primitives**

Run:

```bash
npm install @radix-ui/react-popover @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Then add:

- `src/components/ui/Popover.tsx` matching the existing `DropdownMenu` wrapper style:

```typescript
import * as PopoverPrimitive from "@radix-ui/react-popover";
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverContent = forwardRef(/* shared classes */);
```

- `src/components/ui/Input.tsx`:

```typescript
export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(
  function Input({ className, type = "text", ...props }, ref) {
    return <input ref={ref} type={type} className={cn(/* shared input classes */, className)} {...props} />;
  },
);
```

- [ ] **Step 4: Re-run the source test**

Run: `node --test tests/slideOrganizerWiring.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit the primitive layer**

```bash
git add package.json package-lock.json src/components/ui/Popover.tsx src/components/ui/Input.tsx tests/slideOrganizerWiring.test.mjs
git commit -m "feat: add shared popover and input primitives"
```

---

### Task 5: Replace the toolbar slide dropdown with an organizer popover shell

**Files:**
- Create: `src/components/SlideOrganizer.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Test: `tests/slideOrganizerWiring.test.mjs`

- [ ] **Step 1: Extend the source test to describe the new shell**

Append tests that assert:

```javascript
test("Toolbar renders SlideOrganizer from a popover instead of the old slide dropdown rows", async () => {
  const toolbarSource = await readSource("src/components/Toolbar.tsx");

  assert.match(toolbarSource, /from \"\.\/SlideOrganizer\"/);
  assert.match(toolbarSource, /from \"\.\/ui\/Popover\"/);
  assert.match(toolbarSource, /<SlideOrganizer/);
  assert.doesNotMatch(toolbarSource, /Delete slide \$\{index \+ 1\}/);
});

test("SlideOrganizer exposes row selection plus add and delete callbacks", async () => {
  const organizerSource = await readSource("src/components/SlideOrganizer.tsx");

  assert.match(organizerSource, /onSelectSlide/);
  assert.match(organizerSource, /onAddSlide/);
  assert.match(organizerSource, /onDeleteSlide/);
});
```

- [ ] **Step 2: Run the source test and confirm failure**

Run: `node --test tests/slideOrganizerWiring.test.mjs`
Expected: FAIL because `SlideOrganizer.tsx` and the toolbar popover wiring do not exist yet.

- [ ] **Step 3: Implement the minimal organizer shell**

Create `src/components/SlideOrganizer.tsx` with:

- prop shape:

```typescript
interface SlideOrganizerProps {
  slides: Slide[];
  currentSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onAddSlide: () => void;
  onDeleteSlide: (index: number) => void;
  onRenameSlide: (index: number, title: string) => void;
  onReorderSlides: (slides: Slide[]) => void;
  onOpenChange?: (open: boolean) => void;
}
```

- a dense list of rows with:
  - placeholder drag handle button
  - slide number
  - title display span
  - delete button
  - add button in the footer

In `Toolbar.tsx`:

- keep the `Slide` trigger button
- replace the old slide-specific `DropdownMenu` content with `Popover`, `PopoverTrigger`, and `PopoverContent`
- render `SlideOrganizer` inside the popover

In `EditorLayout.tsx`:

- add stub callbacks for `onRenameSlide` and `onReorderSlides` that dispatch the new store actions

- [ ] **Step 4: Run the source test and build**

Run:
- `node --test tests/slideOrganizerWiring.test.mjs`
- `npm run build`

Expected:
- source test PASS
- build PASS

- [ ] **Step 5: Commit the organizer shell**

```bash
git add src/components/SlideOrganizer.tsx src/components/Toolbar.tsx src/components/EditorLayout.tsx tests/slideOrganizerWiring.test.mjs
git commit -m "feat: replace slide dropdown with organizer popover shell"
```

---

### Task 6: Add inline rename behavior to the organizer

**Files:**
- Modify: `src/components/SlideOrganizer.tsx`
- Test: `tests/slideOrganizerWiring.test.mjs`

- [ ] **Step 1: Describe rename behavior in the source test**

Append:

```javascript
test("SlideOrganizer supports inline rename with keyboard commit and cancel", async () => {
  const organizerSource = await readSource("src/components/SlideOrganizer.tsx");

  assert.match(organizerSource, /editingSlideId/);
  assert.match(organizerSource, /draftTitle/);
  assert.match(organizerSource, /case \"Enter\"/);
  assert.match(organizerSource, /case \"Escape\"/);
  assert.match(organizerSource, /onRenameSlide/);
  assert.match(organizerSource, /<Input/);
});
```

- [ ] **Step 2: Run the source test and verify the rename assertions fail**

Run: `node --test tests/slideOrganizerWiring.test.mjs`
Expected: FAIL because the shell component still renders titles as static text.

- [ ] **Step 3: Implement minimal inline edit mode**

Inside `src/components/SlideOrganizer.tsx`:

- add local state:

```typescript
const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
const [draftTitle, setDraftTitle] = useState("");
```

- click title:

```typescript
setEditingSlideId(slide.id);
setDraftTitle(slide.title);
```

- commit helper:

```typescript
function commitRename(index: number, previousTitle: string) {
  onRenameSlide(index, draftTitle || previousTitle);
  setEditingSlideId(null);
  setDraftTitle("");
}
```

- input keyboard handling:

```typescript
switch (event.key) {
  case "Enter":
    event.preventDefault();
    commitRename(index, slide.title);
    break;
  case "Escape":
    event.preventDefault();
    setEditingSlideId(null);
    setDraftTitle("");
    break;
}
```

- blur commits non-destructively and stops the popover from closing

- [ ] **Step 4: Re-run the source test and build**

Run:
- `node --test tests/slideOrganizerWiring.test.mjs`
- `npm run build`

Expected: PASS

- [ ] **Step 5: Commit rename behavior**

```bash
git add src/components/SlideOrganizer.tsx tests/slideOrganizerWiring.test.mjs
git commit -m "feat: add inline slide rename to organizer"
```

---

## Chunk 3: Drag Reorder

### Task 7: Add sortable reorder behavior through the organizer handle

**Files:**
- Modify: `src/components/SlideOrganizer.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Test: `tests/slideOrganizerWiring.test.mjs`

- [ ] **Step 1: Add failing source assertions for sortable behavior**

Append:

```javascript
test("SlideOrganizer scopes drag reorder to the handle using dnd-kit sortable primitives", async () => {
  const organizerSource = await readSource("src/components/SlideOrganizer.tsx");

  assert.match(organizerSource, /from \"@dnd-kit\/core\"/);
  assert.match(organizerSource, /from \"@dnd-kit\/sortable\"/);
  assert.match(organizerSource, /SortableContext/);
  assert.match(organizerSource, /useSortable/);
  assert.match(organizerSource, /attributes/);
  assert.match(organizerSource, /listeners/);
  assert.match(organizerSource, /onReorderSlides/);
});
```

- [ ] **Step 2: Run the source test and confirm failure**

Run: `node --test tests/slideOrganizerWiring.test.mjs`
Expected: FAIL because sortable wiring is not present yet.

- [ ] **Step 3: Implement minimal handle-based reorder**

Inside `src/components/SlideOrganizer.tsx`:

- wrap rows in:

```typescript
<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={slides.map((slide) => slide.id)} strategy={verticalListSortingStrategy}>
```

- create a row component using `useSortable({ id: slide.id })`
- attach `attributes` and `listeners` only to the handle button
- on drag end:

```typescript
if (!event.over || event.active.id === event.over.id) return;
const oldIndex = slides.findIndex((slide) => slide.id === event.active.id);
const newIndex = slides.findIndex((slide) => slide.id === event.over.id);
onReorderSlides(arrayMove(slides, oldIndex, newIndex));
```

In `EditorLayout.tsx`, wire `onReorderSlides` to:

```typescript
dispatch({ type: "REORDER_SLIDES", payload: { slides } });
```

- [ ] **Step 4: Run focused tests plus reducer coverage**

Run:
- `node --test tests/slideOrganizerWiring.test.mjs`
- `node --test tests/slideStoreReducer.test.mjs`
- `npm run build`

Expected: PASS

- [ ] **Step 5: Commit drag reorder**

```bash
git add src/components/SlideOrganizer.tsx src/components/EditorLayout.tsx tests/slideOrganizerWiring.test.mjs tests/slideStoreReducer.test.mjs
git commit -m "feat: add slide drag reorder in organizer"
```

---

## Chunk 4: Presentation Laser Pointer

### Task 8: Add pure laser helper logic first

**Files:**
- Create: `src/lib/presentationLaser.ts`
- Test: `tests/presentationLaser.test.mjs`

- [ ] **Step 1: Write the failing pure laser tests**

Create `tests/presentationLaser.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";

const helpers = () => import("../src/lib/presentationLaser.ts");

test("toggleLaserEnabled flips the presentation laser mode", async () => {
  const { toggleLaserEnabled } = await helpers();
  assert.equal(toggleLaserEnabled(false), true);
  assert.equal(toggleLaserEnabled(true), false);
});

test("buildLaserCollaborators emits a single laser collaborator when enabled", async () => {
  const { buildLaserCollaborators } = await helpers();
  const collaborators = buildLaserCollaborators({
    enabled: true,
    point: { x: 120, y: 80 },
  });

  assert.equal(collaborators.size, 1);
  const pointer = collaborators.get("presentation-laser")?.pointer;
  assert.equal(pointer?.tool, "laser");
  assert.equal(pointer?.x, 120);
  assert.equal(pointer?.y, 80);
});

test("buildLaserCollaborators clears the trail when disabled or missing a point", async () => {
  const { buildLaserCollaborators } = await helpers();
  assert.equal(buildLaserCollaborators({ enabled: false, point: { x: 1, y: 2 } }).size, 0);
  assert.equal(buildLaserCollaborators({ enabled: true, point: null }).size, 0);
});
```

- [ ] **Step 2: Run the laser test and verify it fails**

Run: `node --test tests/presentationLaser.test.mjs`
Expected: FAIL because `src/lib/presentationLaser.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal laser helper**

Create `src/lib/presentationLaser.ts`:

```typescript
const PRESENTATION_LASER_ID = "presentation-laser";

export function toggleLaserEnabled(current: boolean) {
  return !current;
}

export function buildLaserCollaborators({
  enabled,
  point,
}: {
  enabled: boolean;
  point: { x: number; y: number } | null;
}) {
  if (!enabled || !point) {
    return new Map();
  }

  return new Map([
    [
      PRESENTATION_LASER_ID,
      {
        pointer: {
          x: point.x,
          y: point.y,
          tool: "laser",
          renderCursor: false,
        },
      },
    ],
  ]);
}
```

- [ ] **Step 4: Re-run the pure test**

Run: `node --test tests/presentationLaser.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit the helper**

```bash
git add src/lib/presentationLaser.ts tests/presentationLaser.test.mjs
git commit -m "feat: add presentation laser helper"
```

---

### Task 9: Wire `k` toggle and collaborator updates into presentation mode

**Files:**
- Modify: `src/components/PresentationMode.tsx`
- Test: `tests/presentationLaser.test.mjs`

- [ ] **Step 1: Extend the test file with source-level presentation assertions**

Append to `tests/presentationLaser.test.mjs`:

```javascript
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("PresentationMode toggles laser mode on k and renders a laser status label", async () => {
  const source = await readSource("src/components/PresentationMode.tsx");
  assert.match(source, /case 'k'/);
  assert.match(source, /laserEnabled/);
  assert.match(source, /buildLaserCollaborators/);
  assert.match(source, /Laser/);
});
```

- [ ] **Step 2: Run the laser suite and confirm the new assertion fails**

Run: `node --test tests/presentationLaser.test.mjs`
Expected: FAIL because `PresentationMode.tsx` has no laser-mode wiring yet.

- [ ] **Step 3: Implement the minimal presentation wiring**

Inside `src/components/PresentationMode.tsx`:

- add local state:

```typescript
const [laserEnabled, setLaserEnabled] = useState(false);
const [laserPoint, setLaserPoint] = useState<{ x: number; y: number } | null>(null);
```

- import `buildLaserCollaborators` / `toggleLaserEnabled`
- on `k` in the key handler:

```typescript
case "k":
  e.preventDefault();
  e.stopPropagation();
  setLaserEnabled((value) => {
    const next = toggleLaserEnabled(value);
    if (!next) {
      setLaserPoint(null);
    }
    return next;
  });
  break;
```

- add a pointer-move effect that, when `laserEnabled` and `excalidrawApiRef.current` are available, converts the viewport event into scene coordinates and updates:

```typescript
api.updateScene({
  collaborators: buildLaserCollaborators({
    enabled: laserEnabled,
    point: nextPoint,
  }),
});
```

- add cleanup effects that clear collaborators and `laserPoint` when:
  - `laserEnabled` becomes false
  - `currentSlide.id` changes
  - the component unmounts
  - `onExit` path runs

- render a status pill near the page indicator:

```tsx
{laserEnabled && (
  <div className="absolute bottom-6 right-28 ...">Laser</div>
)}
```

- [ ] **Step 4: Re-run the laser suite and build**

Run:
- `node --test tests/presentationLaser.test.mjs`
- `npm run build`

Expected: PASS

- [ ] **Step 5: Commit the laser-mode wiring**

```bash
git add src/components/PresentationMode.tsx tests/presentationLaser.test.mjs
git commit -m "feat: add presentation laser pointer toggle"
```

---

## Chunk 5: Final Verification

### Task 10: Run the full focused verification set and do a manual smoke pass

**Files:**
- Verify only

- [ ] **Step 1: Run the pure/state tests**

Run:

```bash
node --test tests/slideTitles.test.mjs tests/slideStoreReducer.test.mjs tests/presentationLaser.test.mjs
```

Expected: PASS

- [ ] **Step 2: Run the source-structure tests**

Run:

```bash
node --test tests/slideOrganizerWiring.test.mjs tests/editorChromeNavigation.test.mjs tests/tooltipWiring.test.mjs
```

Expected: PASS

- [ ] **Step 3: Run the full frontend build**

Run: `npm run build`
Expected: PASS with no TypeScript errors

- [ ] **Step 4: Do the manual smoke checklist**

Manual checks:

- rename a slide, press `Enter`, save, reopen, confirm title persisted
- drag reorder slides, save, reopen, confirm order persisted and current slide stayed selected
- verify organizer row click still switches slides quickly
- verify delete still cannot remove the last remaining slide
- start presentation, press `k`, move the mouse, confirm the laser appears
- press `k` again, switch slides, and exit presentation, confirming the laser clears each time

- [ ] **Step 5: Commit the final verified state**

```bash
git status --short
git add package.json package-lock.json src/types.ts src/lib/slideTitles.ts src/lib/presentationLaser.ts src/lib/tauriCommands.ts src/hooks/useSlideStore.tsx src/components/SlideOrganizer.tsx src/components/ui/Popover.tsx src/components/ui/Input.tsx src/components/Toolbar.tsx src/components/EditorLayout.tsx src/components/PresentationMode.tsx tests/slideTitles.test.mjs tests/slideStoreReducer.test.mjs tests/slideOrganizerWiring.test.mjs tests/presentationLaser.test.mjs tests/editorChromeNavigation.test.mjs tests/tooltipWiring.test.mjs
git commit -m "feat: add slide organizer and presentation laser pointer"
```

---

## Notes for the Implementer

- Do not reintroduce slide thumbnails anywhere in this flow.
- Keep the organizer responsible only for UI-local state; persistent slide data belongs in `useSlideStore`.
- Do not let drag listeners sit on the whole row; they must stay on the handle or selection/edit will feel broken.
- Do not mutate slide titles from reorder logic.
- Do not persist laser state into slide content or store state.
