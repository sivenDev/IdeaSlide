# IdeaNote Directory Workspace Format

An IdeaNote Workspace is a user-selected real directory. User files remain ordinary files in that directory and are the only source of truth for document content. IdeaNote does not copy those files into a Workspace archive or private database.

## Read-only open

Opening or refreshing a Workspace performs a metadata-only directory scan:

- It does not parse document payloads.
- It does not create `.ideanote/`, sample files, or configuration.
- It includes unsupported files so the Explorer can show them safely.
- It reports supported file types using the backend Document Format Registry.
- It lists Symlinks as non-expandable entries and never follows them.
- It hides `.ideanote/` and IdeaSketch temporary files such as `drawing.is.tmp`.

Every command receives a Workspace root and a normalized relative child path. Absolute paths, `..`, `.`, internal metadata targets, Symlink traversal, and paths that resolve outside the canonical root are rejected.

## Lazy `.ideanote/` creation

The metadata directory is created only after one of these successful, user-authorized operations:

- Create a supported document such as `Untitled.is`.
- Save an existing Workspace document.
- Explicitly persist Workspace state or settings.

Browsing, opening files, refreshing, and creating a Folder do not create metadata.

User-file persistence is the primary transaction:

```text
write/create user file successfully
  → create or update .ideanote/
  → return content success plus any separate metadata error
```

If metadata creation fails, the successfully written user file is retained. A failed user-file operation never creates `.ideanote/`.

## Metadata schema v1

```text
.ideanote/
├── workspace.json
├── state.json
└── .gitignore
```

`recovery/` and `cache/` are reserved but created only when their features need them.

### `workspace.json`

```json
{
  "schemaVersion": 1,
  "workspaceId": "d6044879-87ce-4c93-a216-f40c13aabcdf",
  "created": "2026-08-03T10:00:00Z",
  "modified": "2026-08-03T10:05:00Z",
  "settings": {}
}
```

- `workspaceId` is generated once and remains stable.
- `schemaVersion` must be exactly `1` for this build.
- Unknown settings fields are retained by the JSON value map.

### `state.json`

```json
{
  "schemaVersion": 1,
  "openTabs": ["drawing.is", "notes/readme.md"],
  "activePath": "drawing.is",
  "expandedPaths": ["notes"]
}
```

All paths are root-relative and pass the same traversal/internal-path validation as filesystem commands. Document contents are never stored here.

### `.ideanote/.gitignore`

```gitignore
state.json
recovery/
cache/
```

IdeaNote never modifies the Workspace root's `.gitignore`.

## Corruption and compatibility

Missing metadata is treated as a new in-memory Workspace. Invalid JSON or an unsupported `schemaVersion` is preserved on disk, ignored in favor of safe defaults, and returned as a diagnostic without blocking directory access.

Metadata JSON writes use a same-directory temporary file, flush it, and atomically rename it over the target. Failed replacement removes the temporary file and reports the error.

## File operations

The native Workspace service exposes explicit root-confined operations:

- Scan and refresh directory metadata.
- Read one file on demand.
- Create Folder.
- Create a registry-supported document with collision-safe default naming.
- Rename and move without overwriting an existing destination.
- Move an entry to the operating system Trash.
- Save a typed document through its registered backend format module.
- Save versioned Workspace state.

Readable directories with no write permission open in read-only mode. Mutating operations return clear errors and do not attempt partial changes.
