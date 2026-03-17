# Recent Files List English Localization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate all Chinese text in the recent files list to English for UI consistency.

**Architecture:** Direct string replacement in LaunchScreen component's inline formatRelativeTime function and empty state messages. Add localization guidance to CLAUDE.md.

**Tech Stack:** React 19, TypeScript

---

## File Structure

**Modified:**
- `src/components/LaunchScreen.tsx` - translate time strings, empty state messages, update locale
- `CLAUDE.md` - add localization section

---

### Task 1: Translate Time Format Strings

**Files:**
- Modify: `src/components/LaunchScreen.tsx:6-34`

- [ ] **Step 1: Update "unknown" fallback strings**

Replace lines 12 and 32:

```typescript
if (isNaN(opened.getTime())) {
  return "unknown";
}

// ... later in the function ...

} catch {
  return "unknown";
}
```

- [ ] **Step 2: Update "just now" string**

Replace line 20:

```typescript
if (diffMins < 1) return "just now";
```

- [ ] **Step 3: Update minutes with pluralization**

Replace line 21:

```typescript
if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
```

- [ ] **Step 4: Update hours with pluralization**

Replace line 22:

```typescript
if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
```

- [ ] **Step 5: Update "yesterday" string**

Replace line 26:

```typescript
if (opened.toDateString() === yesterday.toDateString()) return "yesterday";
```

- [ ] **Step 6: Update days with pluralization**

Replace line 28:

```typescript
if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
```

- [ ] **Step 7: Update locale to en-US**

Replace line 30:

```typescript
return opened.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
```

- [ ] **Step 8: Verify changes in browser**

Run: `npm run tauri dev`

Test cases:
1. Open a file, close app, reopen - should show "just now"
2. Wait 2 minutes - should show "2 minutes ago"
3. Wait 1 hour - should show "1 hour ago"
4. Check file from yesterday - should show "yesterday"
5. Check file from 3 days ago - should show "3 days ago"
6. Check file from 2 weeks ago - should show "January 15" format

- [ ] **Step 9: Commit time format changes**

```bash
git add src/components/LaunchScreen.tsx
git commit -m "feat: translate time format strings to English

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Translate Empty State Messages

**Files:**
- Modify: `src/components/LaunchScreen.tsx:213-214`

- [ ] **Step 1: Update empty state heading**

Replace line 213:

```typescript
<div className="text-sm text-gray-400">No recent files</div>
```

- [ ] **Step 2: Update empty state description**

Replace line 214:

```typescript
<div className="text-xs text-gray-300 mt-1">Open or create a file to get started</div>
```

- [ ] **Step 3: Verify empty state in browser**

Run: `npm run tauri dev`

Test:
1. Clear recent files (delete all entries)
2. Verify empty state shows "No recent files" and "Open or create a file to get started"

- [ ] **Step 4: Commit empty state changes**

```bash
git add src/components/LaunchScreen.tsx
git commit -m "feat: translate empty state messages to English

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md:82` (after Tech Stack section)

- [ ] **Step 1: Add Localization section**

Add after line 81 (after the Tech Stack section):

```markdown

## Localization

The application UI is in English. All user-facing text should be in English.
```

- [ ] **Step 2: Commit documentation update**

```bash
git add CLAUDE.md
git commit -m "docs: add localization guidance to CLAUDE.md

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Verification

After all tasks complete:

1. Run `npm run tauri dev`
2. Verify all text in recent files list is in English
3. Test time formats with files of different ages
4. Verify empty state shows English messages
5. Check that date formats use English month names

Expected: All Chinese text replaced with English equivalents, proper pluralization, English date formats.
