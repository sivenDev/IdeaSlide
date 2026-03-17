# Recent Files List English Localization

**Date:** 2026-03-18
**Status:** Approved

## Overview

Convert all Chinese text in the recent files list interface to English to maintain consistency with the application's English UI.

## Scope

All user-facing text in the recent files section of `LaunchScreen.tsx` needs translation from Chinese to English.

## Changes

### 1. Relative Time Strings

The `formatRelativeTime` function (lines 6-34 in `LaunchScreen.tsx`) contains Chinese time format strings that need translation:

| Chinese | English |
|---------|---------|
| `"刚刚"` | `"just now"` |
| `"分钟前"` | `"minute ago"` / `"minutes ago"` (singular/plural) |
| `"小时前"` | `"hour ago"` / `"hours ago"` (singular/plural) |
| `"天前"` | `"day ago"` / `"days ago"` (singular/plural) |
| `"昨天"` | `"yesterday"` |
| `"未知时间"` | `"unknown"` |

**Pluralization logic:**
```typescript
if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
```

### 2. Empty State Messages

Lines 213-214 contain the empty state text:

| Chinese | English |
|---------|---------|
| `"暂无最近文件"` | `"No recent files"` |
| `"打开或创建文件后会显示在这里"` | `"Open or create a file to get started"` |

### 3. Locale Setting

Line 30: Update `toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })` to `toLocaleDateString('en-US', { month: 'long', day: 'numeric' })`

This will produce English date formats like "January 15" instead of "1月15日".

## Implementation Notes

- Direct string replacement in `LaunchScreen.tsx`
- Maintain existing logic, formatting, and UI behavior
- No changes to component structure or styling
- Use proper singular/plural forms for time units

## Documentation Update

Add a new "Localization" section to `CLAUDE.md` after the "Tech Stack" section:

```markdown
## Localization

The application UI is in English. All user-facing text should be in English.
```

## Files Modified

- `src/components/LaunchScreen.tsx` - translate strings and update locale
- `CLAUDE.md` - add localization guidance
