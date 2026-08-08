# IdeaNote Directory Workspace Format

An IdeaNote Workspace is a user-selected real directory. User files remain ordinary files in that directory and are the only source of truth for document content. IdeaNote does not copy those files into a Workspace archive or private database.

Global application settings are not Workspace metadata. Versioned non-secret settings and the Rust-owned AI credential repository live under the platform application configuration directory. The API key is stored only as an AES-256-GCM authenticated-encrypted envelope with separate application key material and current-user-only permissions where supported. Neither plaintext, ciphertext, nor key material is written to `.ideanote/`, document files, Recovery data, caches, logs, frontend settings, or conversation history. Existing Keychain data is not read, migrated, or deleted automatically. This protects against plaintext-at-rest disclosure, but not against a same-user process that can read both application-owned files. A future Workspace-specific override must use an explicit versioned contract and must never contain credentials.

## Read-only open

Opening or refreshing a Workspace performs a metadata-only directory scan:

- It does not parse document payloads.
- It does not create `.ideanote/`, sample files, or configuration.
- It preserves real directory nodes, including directories with no currently supported files.
- It includes regular files only when the backend Document Format Registry marks their type openable; the current visible file type is `.is`.
- It lists Symlinks as non-expandable entries and never follows them.
- It hides the entire `.ideanote/` subtree and unsupported regular files.

Every command receives a Workspace root and a normalized relative child path. Absolute paths, `..`, `.`, internal metadata targets, Symlink traversal, and paths that resolve outside the canonical root are rejected.

## Lazy `.ideanote/` creation

The metadata directory is created only after one of these successful, user-authorized operations:

- Create a supported document such as `Untitled.is`.
- Save an existing Workspace document.
- Explicitly persist Workspace state or settings.

The settings trigger above applies only to a future user-authorized Workspace override. Opening the global Settings Center or changing global AI configuration does not create `.ideanote/`.

Browsing, opening files, refreshing, and creating a Folder do not create metadata.

User-file persistence is the primary transaction. A first write may prepare hidden staging transactionally, but a failed operation removes the newly created staging tree so no `.ideanote/` remains:

```text
prepare .ideanote/tmp staging
  → write/create user file successfully
  → create or update .ideanote/
  → return content success plus any separate metadata error
```

If metadata creation fails, the successfully written user file is retained. A failed user-file operation never creates `.ideanote/`.

## Metadata schema v1

```text
.ideanote/
├── workspace.json
├── state.json
├── recovery/
├── tmp/
├── cache/
└── .gitignore
```

`tmp/` is the only Workspace staging location for document, metadata, and Recovery replacement writes. It is created when Workspace persistence first needs it and must contain no abandoned staging file after a completed operation. `recovery/` and `cache/` remain durable-recovery and regenerable-cache boundaries created only when their features need them.

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
- `settings` is reserved for explicitly persisted Workspace overrides; current global General, AI Provider, Agent, and editor settings are stored outside the Workspace.

### `state.json`

```json
{
  "schemaVersion": 3,
  "activePath": "drawing.is",
  "expandedPaths": ["notes"],
  "entryOrder": []
}
```

All paths are root-relative and pass the same traversal/internal-path validation as filesystem commands. Document contents are never stored here. `entryOrder` is retained as a schema-v3 compatibility field, but current clients ignore legacy custom order and write an empty array. Workspace Explorer uses the backend scan order: directories first, then case-insensitive name order.

State schema compatibility:

- v1 `openTabs` plus `activePath` is accepted only to restore one compatible active file.
- v2 `activePath` plus Explorer expansion is accepted without rewriting metadata during browse-only open.
- v3 adds optional `entryOrder`; current clients read the field safely, do not apply it, and clear it on the next normal state persistence.

### `.ideanote/.gitignore`

```gitignore
state.json
recovery/
tmp/
cache/
```

IdeaNote never modifies the Workspace root's `.gitignore`.

## Corruption and compatibility

Missing metadata is treated as a new in-memory Workspace. Invalid JSON or an unsupported `schemaVersion` is preserved on disk, ignored in favor of safe defaults, and returned as a diagnostic without blocking directory access.

Metadata JSON and Workspace Recovery writes flush a collision-free staging file under `.ideanote/tmp/` and atomically commit it to the durable target. Failed replacement retains the original target, removes the staging file, and reports the error. IdeaNote may add a missing `tmp/` rule to its internal `.ideanote/.gitignore`, but never modifies the Workspace root's `.gitignore`.

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
