# IdeaSlide `.is` File Format

An `.is` file is a ZIP archive representing one IdeaSlide workspace. The format version is stored in `manifest.json` under the required `version` key.

## Version policy

Versions use `MAJOR.MINOR` decimal notation.

- Increment `MAJOR` for incompatible manifest, payload, or semantic changes.
- Increment `MINOR` for compatible additions within a major version.
- Readers accept only versions or version ranges explicitly implemented by that build. A syntactically valid future version is not opened speculatively.
- The manifest header and version are validated before any resource payload is read.

The current writer emits `2.0`.

| Version | Read | Write | Behavior |
| --- | --- | --- | --- |
| `1.0` | Yes | No | Legacy flat slides are adapted to root-level Canvas resources in memory. The file is not modified until saved. |
| `2.0` | Yes | Yes | Workspace resources and type-specific content references. |
| Other | No | No | Rejected with the encountered and supported versions. |

Missing versions, malformed versions, unsupported older versions, and future versions are rejected before payload loading. Saving a successfully opened `1.0` file upgrades it to `2.0`. Before replacing an existing file, IdeaSlide copies the previous archive to `<name>.is.bak`, writes the new archive to `<name>.is.tmp`, then atomically renames it.

## Format 2.0 archive

```text
manifest.json
canvases/{resource-id}.json
media/index.json
media/{media-id}.{extension}
```

Other registered or unknown resource types may use their own safe relative JSON content references, such as `datasets/{resource-id}.json`.

### Manifest

```json
{
  "version": "2.0",
  "created": "2026-07-22T10:00:00Z",
  "modified": "2026-07-22T10:05:00Z",
  "activeResourceId": "canvas-1",
  "resources": [
    {
      "id": "folder-1",
      "type": "folder",
      "name": "Research",
      "parentId": null,
      "order": 0,
      "contentRef": null
    },
    {
      "id": "canvas-1",
      "type": "canvas",
      "name": "Concept map",
      "parentId": "folder-1",
      "order": 0,
      "contentRef": "canvases/canvas-1.json"
    }
  ]
}
```

Resource requirements:

- `id` is stable and unique within the workspace.
- `type` is a persisted string identifier. `folder` and `canvas` are currently registered.
- `name` is user-editable display text.
- `parentId` is `null` for a root resource or the id of a Folder.
- `order` is unique among siblings and determines display order.
- `activeResourceId` records the resource selected when the workspace was last saved; readers fall back to the first Canvas if it is absent or invalid.
- Folders have no content reference.
- Canvases use exactly `canvases/{id}.json`.
- Parent cycles, missing parents, duplicate ids/orders, unsafe paths, missing content, and orphan content are rejected.

Unknown resource types and unknown manifest/resource fields are preserved during load and save. Unsupported resources appear in the UI without an active editor; Canvas operations do not rewrite their payloads.

Canvas order for presentation and the slide-named MCP compatibility API is a deterministic depth-first traversal of the resource tree, with siblings ordered by `order` and then id.

## Format 1.0 migration

Format `1.0` contains a required flat `slides` array in `manifest.json` and payloads at `slides/{id}.json`. On open, each slide becomes a root Canvas with the same id, title, order, and Excalidraw content. Empty titles receive `Canvas N` display names.

Format `2.0` intentionally omits the required v1 `slides` field. Older pre-version-gate readers therefore fail manifest deserialization instead of opening a v2 workspace and silently flattening its hierarchy.
