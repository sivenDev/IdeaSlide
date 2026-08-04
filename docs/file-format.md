# IdeaNote `.is` File Format

An `.is` file is a ZIP archive containing one IdeaSketch document. It is a document format, not a directory Workspace package. Workspace state belongs in the selected directory's `.ideanote/` metadata folder.

## Module boundary

IdeaNote resolves document types symmetrically on both sides of the Tauri boundary:

- The frontend File Type Registry selects a document model, parser, serializer, and editor key.
- The backend Document Format Registry selects an independent format module for recognition, validation, reading, writing, and save safety.
- Generic Tauri commands exchange a typed document envelope and do not inspect IdeaSketch manifest or Page fields.

The current registry contains only IdeaSketch (`.is`). Future Markdown, IdeaTable, and IdeaWorkflow modules can be registered without duplicating Workspace/Standalone persistence logic.

## Version policy

Versions use `MAJOR.MINOR` decimal notation. The manifest header and `version` value are read before any Page payload.

| Version | Read | Write | Behavior |
| --- | --- | --- | --- |
| `1.0` | Yes | Yes | Canonical IdeaSketch format used for new files and all saves. |
| `2.0` | Header only | No | Protected legacy Workspace format. It is never hydrated, flattened, or overwritten by the v1 writer. |
| Other | No | No | Missing, malformed, old-unknown, and future versions fail safely. |

Opening `2.0` returns a structured `legacy-protected` result with a migration-deferred message. Workspace Import/Export and v2 migration are not part of the current MVP.

## Format 1.0 archive

```text
manifest.json
slides/{page-id}.json
media/index.json              # optional legacy compatibility
media/{media-id}.{extension}  # optional legacy compatibility
```

The writer always emits `manifest.json` and one `slides/{id}.json` entry per ordered manifest Page. It emits `media/` entries only when legacy media payloads are explicitly supplied. Current Excalidraw image data normally remains inline in the scene `files` object.

### Manifest

```json
{
  "version": "1.0",
  "created": "2026-08-03T10:00:00Z",
  "modified": "2026-08-03T10:05:00Z",
  "slides": [
    { "id": "page-1", "title": "Overview" },
    { "id": "page-2", "title": "Research" }
  ]
}
```

Requirements:

- `version` is exactly `1.0` for writable documents.
- `created` remains stable across saves; `modified` is refreshed by the IdeaSketch writer.
- `slides` contains at least one Page and defines presentation order.
- Every Page `id` is unique and contains only ASCII letters, digits, `_`, or `-`.
- Every Page has exactly one matching `slides/{id}.json` payload.
- Missing, duplicate, orphan, or non-object Page payloads are rejected.
- Page titles and order are preserved exactly.

### Page payload

```json
{
  "type": "excalidraw",
  "version": 2,
  "elements": [],
  "appState": {},
  "files": {}
}
```

The complete Excalidraw scene is preserved, including elements, application state, inline files, and Camera data stored by the editor. Presentation behavior is derived from the current IdeaSketch document and does not add a separate archive schema.

## Save safety

Saving validates the complete manifest, Page relationship, scene payloads, and optional media before replacing the target.

1. Build the new ZIP in memory.
2. In Workspace Mode, write it to a collision-free staging file under `<workspace>/.ideanote/tmp/`; in Single File Mode, use the target filesystem's safe local staging strategy without creating `.ideanote/`.
3. Atomically commit the staging file over the target on the same filesystem.
4. If replacement fails, retain the original target and remove the temporary file.

The writer does not create sibling `.is.tmp` or `.is.bak` files in Workspace Mode. A cross-filesystem commit fails safely instead of copying over or deleting the original target.

## Legacy media compatibility

Older v1 archives may store binary images under `media/` with an optional `media/index.json`. The reader reconstructs those bytes for the frontend adapter. A later save may keep images inline in Excalidraw `files` and omit `media/`; this does not change the v1 manifest or Page contract.
