# Divider Toggle & Home Button Design

> **Goal:** Move the preview panel toggle button to the divider between preview panel and editor area, and replace the original toggle button with a home button that navigates back to the launch screen.

## Component Architecture

### Modified Components
- **Toolbar.tsx** — Replace ☰ toggle with 🏠 home button, update props
- **EditorLayout.tsx** — Retain existing `showPreview` state (already at line 15), add `onGoHome` prop and confirmation logic, add `ask` to dialog import
- **App.tsx** — Provide `handleGoHome` callback to EditorLayout

### New Component
- **ResizableDivider.tsx** — Divider with embedded toggle button

## ResizableDivider Component

**Props:**
```typescript
interface ResizableDividerProps {
  isVisible: boolean;
  onToggle: () => void;
}
```

**Visual Design:**
- 4px wide divider, `bg-gray-200`, expands to 6px on hover
- Centered toggle button: 24×24px, rounded-full, `bg-white` with `border border-gray-300`
- Icons: `◀` when panel visible, `▶` when hidden
- Hover: `bg-gray-100`, `border-gray-400`

**Layout:**
- Flex child in the existing `flex` row layout (between SlidePreviewPanel and SlideCanvas)
- When panel hidden, the divider remains in flow at the left edge (panel has `w-0` or is removed from DOM)
- When panel visible, divider sits naturally after the `w-64` panel
- Panel show/hide uses CSS transition: `width 300ms ease-in-out` on the preview panel wrapper

## Home Button (Toolbar)

**Changes to Toolbar:**
- Remove `showPreview` and `onTogglePreview` from ToolbarProps
- Add `onGoHome: () => void` to ToolbarProps
- Replace ☰ button with 🏠 button, matching existing styling (px-2 py-1.5, hover:bg-gray-100)

## Navigation Logic

**Flow:**
```
🏠 click → Toolbar.onGoHome() → EditorLayout.handleGoHome()
  ├─ isDirty === false → App.onGoHome() → showEditor = false → LaunchScreen
  └─ isDirty === true → ask() confirmation dialog
      ├─ User confirms → App.onGoHome()
      └─ User cancels → stay in editor
```

**Confirmation Dialog (requires adding `ask` to existing dialog import):**
```typescript
const shouldLeave = await ask(
  "You have unsaved changes. Leave without saving?",
  {
    title: "Unsaved Changes",
    kind: "warning",
    okLabel: "Leave",
    cancelLabel: "Stay",
  }
);
```

## State Management

```
App.tsx
├─ showEditor: boolean
└─ handleGoHome: () => void → sets showEditor(false)

EditorLayout.tsx
├─ showPreview: boolean (local state, default true)
├─ onGoHome: prop from App
└─ handleGoHome: checks isDirty, shows dialog if needed

Toolbar.tsx
└─ onGoHome: prop from EditorLayout

ResizableDivider.tsx
├─ isVisible: prop (showPreview from EditorLayout)
└─ onToggle: prop (toggles showPreview)
```

**No global state changes.** No modifications to useSlideStore.

## Edge Cases

- Double-click on 🏠: `ask()` is modal, blocks second click
- 🏠 during auto-save: `isDirty` check is safe after auto-save completes
- Toggle during animation: CSS transition handles naturally
- New unsaved file: `isDirty` is true from first edit, dialog shows correctly

## Error Handling

- `ask()` failure: log to console, stay in editor (safe default)
- Dialog cancellation: normal flow, no error handling needed

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/ResizableDivider.tsx` | Create |
| `src/components/Toolbar.tsx` | Modify props, replace button |
| `src/components/EditorLayout.tsx` | Modify layout, add navigation logic |
| `src/App.tsx` | Add onGoHome callback |
