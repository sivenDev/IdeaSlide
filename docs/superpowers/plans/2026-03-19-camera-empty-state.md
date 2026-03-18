# Camera Empty State Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the empty state in the `Cameras` panel so the no-camera message stays visually centered, resolves to two lines in normal window widths, and no longer reads too high in the panel without changing any existing camera-list behavior.

**Architecture:** Keep the implementation isolated to the `cameras.length === 0` render path in `src/components/CameraList.tsx`. Lock the intended structure with a source-level regression test that matches the repository's existing lightweight Node test style, then tune the text-container width so the title stays on line one and the helper sentence stays on line two at common editor widths, plus add a small inner-stack downward offset so the icon-plus-copy block feels optically centered.

**Tech Stack:** React 19, TypeScript/TSX, Tailwind CSS v4, Node test runner, Vite

---

## File Structure

**Create:**
- `tests/cameraListEmptyState.test.mjs` - source-level regression coverage for the empty-state icon, split copy, widened text container, and optical-centering offset

**Modify:**
- `src/components/CameraList.tsx` - keep the centered-stack layout, widen the text block so the helper sentence stays on one line at normal widths, and add a small downward offset to the stack

**Reference:**
- `docs/superpowers/specs/2026-03-19-camera-empty-state-design.md` - approved design and scope guardrails

---

### Task 1: Lock the approved empty-state structure with a failing regression test

**Files:**
- Create: `tests/cameraListEmptyState.test.mjs`
- Reference: `src/components/CameraList.tsx`

- [ ] **Step 1: Write the failing source-level test**

Create `tests/cameraListEmptyState.test.mjs` following the existing source-inspection pattern used by `tests/tooltipWiring.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('CameraList renders a centered empty-state stack with icon, title, and helper copy', async () => {
  const source = await readSource('src/components/CameraList.tsx');

  assert.match(source, /cameras\.length === 0/);
  assert.match(source, /flex-col/);
  assert.match(source, /No cameras yet/);
  assert.match(source, /create your first view/);
  assert.match(source, /max-w-\[(?:280|300|320)px\]/);
  assert.match(source, /translate-y-[123]/);
  assert.match(source, /<svg[\s\S]*viewBox="0 0 24 24"/);
});
```

- [ ] **Step 2: Run the new test to verify RED**

Run: `node --test tests/cameraListEmptyState.test.mjs`

Expected: FAIL because `src/components/CameraList.tsx` either still renders the old one-line message, uses a narrower text container that allows the helper sentence to spill onto a third line, or lacks the small downward offset needed for optical centering.

### Task 2: Implement the approved centered-stack empty state with a wider text block and optical-centering offset

**Files:**
- Modify: `src/components/CameraList.tsx`
- Test: `tests/cameraListEmptyState.test.mjs`

- [ ] **Step 1: Replace the empty-state branch with the centered wrapper**

Update the `if (cameras.length === 0)` branch so it returns a full-size centered layout instead of the current single text node:

```tsx
if (cameras.length === 0) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-white text-center">
      <div className="flex max-w-[300px] translate-y-2 flex-col items-center gap-2 px-4 text-gray-400">
        {/* icon + copy go here */}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the lightweight icon, split copy, wider text block, and slight downward offset**

Fill the inner stack with a small inline SVG, a darker title, and the approved helper text:

```tsx
<div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="h-4 w-4"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
</div>
<div className="space-y-1">
  <p className="text-sm font-medium text-gray-500">No cameras yet</p>
  <p className="text-xs leading-5 text-gray-400">
    Click "Add Camera" to create your first view.
  </p>
</div>
```

The wrapper width should be wide enough that in a typical editor window the helper sentence stays on one line, and the inner stack should include a subtle downward offset such as `translate-y-2` so the block feels visually centered. Do not add `whitespace-nowrap` or any overflow-prone styling. Keep the populated camera-list branch unchanged.

- [ ] **Step 3: Run the focused test to verify GREEN**

Run: `node --test tests/cameraListEmptyState.test.mjs`

Expected: PASS.

### Task 3: Verify the change against nearby regressions and the production build

**Files:**
- Verify only

- [ ] **Step 1: Re-run the focused UI wiring tests**

Run: `node --test tests/cameraListEmptyState.test.mjs tests/tooltipWiring.test.mjs`

Expected: PASS. The new empty-state test should pass, and the existing tooltip wiring coverage should still pass for `CameraList.tsx`.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: PASS with no TypeScript or Vite errors.

- [ ] **Step 3: Manually verify the camera panel behavior**

Check:
- open a slide with zero cameras and confirm the empty state is centered with icon, title, and helper copy
- confirm that in a normal editor window the title occupies line one and the helper sentence stays entirely on line two
- confirm the full stack no longer reads too high and instead sits closer to the visual center of the panel
- create one camera and confirm the empty state disappears immediately
- confirm the populated camera thumbnail strip still looks and behaves the same
- switch between `Cameras` and `Slides` and confirm the tab panel layout is unchanged

- [ ] **Step 4: Commit only the focused implementation files**

Run:

```bash
git add src/components/CameraList.tsx tests/cameraListEmptyState.test.mjs
git diff --staged -- src/components/CameraList.tsx tests/cameraListEmptyState.test.mjs
git commit -m "fix: polish camera empty state"
```

Expected: The staged diff contains only the empty-state UI change and its regression test, avoiding unrelated in-progress workspace edits.
