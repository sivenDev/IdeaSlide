# Recent Files List: Delete and Time Display

**Date:** 2026-03-17
**Status:** Approved

## Overview

Add delete functionality to the launch screen's recent files list and improve time display by showing when files were last opened (relative time format). Refactor backend storage from `recent_files.json` to `user.json` for future extensibility.

## Goals

1. Allow users to remove files from the recent list
2. Display "last opened" time instead of file modification time
3. Use relative time format ("2 hours ago", "yesterday") for better readability
4. Refactor storage to support future user configuration expansion

## Data Model Changes

### Backend: `src-tauri/src/recent_files.rs`

**New top-level config structure:**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConfig {
    pub recent_files: Vec<RecentFile>,
    // Future expansion:
    // pub preferences: UserPreferences,
    // pub window_state: WindowState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub modified: String,      // Keep: file system modification time
    pub opened_at: String,     // New: user opened time (RFC3339)
}
```

**Storage location:**
- File: `~/Library/Application Support/ideaslide/user.json` (macOS)
- Structure: `{ "recent_files": [...] }`
- No migration from old `recent_files.json` needed

**Command changes:**
- `add_recent_file`: Set `opened_at` to current timestamp when adding
- New command: `remove_recent_file(path: String)` - removes entry from list

### Frontend: `src/types.ts`

```typescript
export interface RecentFile {
  path: string;
  name: string;
  modified: string;
  opened_at: string;  // New field
}
```

## UI Design

### Delete Interaction (A1 Pattern)

**Visual behavior:**
- Hover over file row → × button appears to the right of filename
- Click × → immediately removes file from list (no confirmation dialog)
- Button style: 18×18px red circle with white × symbol

**Layout:**
```
[Filename ················· ×]  ← First row: filename + delete button (on hover)
[Path ············· Time]        ← Second row: unchanged
```

**Implementation:**
- File name row uses `display: flex; justify-content: space-between`
- Delete button: `display: none` by default, `display: flex` on row hover
- Button positioned in layout flow (not absolute), so it doesn't overlap time

### Time Display Rules

Use `opened_at` field to calculate relative time (frontend computation):

| Time Range | Display |
|------------|---------|
| < 1 minute | "刚刚" |
| 1-59 minutes | "X 分钟前" |
| 1-23 hours | "X 小时前" |
| Yesterday (24-48h, previous day) | "昨天" |
| 2-6 days ago | "X 天前" |
| ≥ 7 days | "3月17日" (fixed date) |

**Implementation:**
- Pure frontend calculation using `Date` API
- No performance concerns (simple timestamp diff)
- Recalculate on component mount (no live updates needed)

### Empty State

When list is empty, display:

```
暂无最近文件
打开或创建文��后会显示在这里
```

Style: centered gray text, two lines, second line smaller and lighter.

## Component Changes

### `src/components/LaunchScreen.tsx`

**State:**
- Keep existing `recentFiles` state
- Add `handleRemoveRecent(path: string)` function

**Delete handler:**
```typescript
async function handleRemoveRecent(path: string) {
  try {
    await removeRecentFile(path);
    setRecentFiles(files => files.filter(f => f.path !== path));
  } catch (err) {
    console.error("Failed to remove recent file:", err);
  }
}
```

**Time formatting utility:**
```typescript
function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const opened = new Date(isoString);
  const diffMs = now.getTime() - opened.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (opened.toDateString() === yesterday.toDateString()) return "昨天";

  if (diffDays < 7) return `${diffDays} 天前`;

  return opened.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}
```

**JSX changes:**
- Wrap filename in flex container with delete button
- Replace `file.modified` with `formatRelativeTime(file.opened_at)`
- Add delete button with hover reveal
- Update empty state message

### `src/lib/tauriCommands.ts`

Add new command wrapper:

```typescript
export async function removeRecentFile(path: string): Promise<void> {
  await invoke("remove_recent_file", { path });
}
```

## Backend Implementation

### `src-tauri/src/recent_files.rs`

**File path function:**
```rust
fn user_config_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir().ok_or("Could not find config directory")?;
    let app_dir = config_dir.join("ideaslide");
    fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(app_dir.join("user.json"))
}
```

**Load/save functions:**
```rust
fn load_user_config() -> Result<UserConfig, String> {
    let path = user_config_path()?;
    if !path.exists() {
        return Ok(UserConfig { recent_files: vec![] });
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read user config: {e}"))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse user config: {e}"))
}

fn save_user_config(config: &UserConfig) -> Result<(), String> {
    let path = user_config_path()?;
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize user config: {e}"))?;
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write user config: {e}"))
}
```

**Updated commands:**
```rust
#[command]
pub fn get_recent_files() -> Result<Vec<RecentFile>, String> {
    let config = load_user_config()?;
    let mut files = config.recent_files;
    files.retain(|f| PathBuf::from(&f.path).exists());
    Ok(files)
}

#[command]
pub fn add_recent_file(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to read file metadata: {e}"))?;
    let modified = metadata
        .modified()
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.to_rfc3339()
        })
        .unwrap_or_default();

    let opened_at = chrono::Utc::now().to_rfc3339();

    let mut config = load_user_config().unwrap_or_else(|_| UserConfig { recent_files: vec![] });

    config.recent_files.retain(|f| f.path != path);

    config.recent_files.insert(0, RecentFile {
        path,
        name,
        modified,
        opened_at,
    });

    config.recent_files.truncate(20);

    save_user_config(&config)
}

#[command]
pub fn remove_recent_file(path: String) -> Result<(), String> {
    let mut config = load_user_config()?;
    config.recent_files.retain(|f| f.path != path);
    save_user_config(&config)
}
```

**Register new command in `src-tauri/src/lib.rs`:**
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    get_recent_files,
    add_recent_file,
    remove_recent_file,  // Add this
])
```

## Testing Considerations

**Manual testing checklist:**
1. Open several files → verify they appear in recent list with "刚刚" time
2. Wait and reopen app → verify times update correctly
3. Hover over items → verify × button appears
4. Click × → verify item removes immediately
5. Delete all items → verify empty state message appears
6. Check `~/Library/Application Support/ideaslide/user.json` → verify structure
7. Test time formatting at different intervals (minutes, hours, days, weeks)

**Edge cases:**
- Delete while hovering another item
- Rapid delete of multiple items
- Delete last item (empty state)
- Invalid `opened_at` timestamp (fallback to "unknown")

## Future Enhancements

With `user.json` structure in place, future additions could include:
- User preferences (theme, language, autosave interval)
- Window state (size, position)
- Recent search queries
- Custom keyboard shortcuts

## Summary

This design adds delete functionality to recent files with a clean hover-reveal pattern, improves time display with relative formatting based on actual open time, and refactors storage to a more extensible structure. All changes are backward-compatible (new installs start with empty `user.json`), and the implementation is straightforward with no complex state management needed.
