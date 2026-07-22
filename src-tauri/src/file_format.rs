use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::io::{Cursor, Read, Seek, Write};
use std::path::{Component, Path};
use zip::write::SimpleFileOptions;

pub const LEGACY_FORMAT_VERSION: &str = "1.0";
pub const CURRENT_FORMAT_VERSION: &str = "2.0";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: String,
    pub created: String,
    pub modified: String,
    pub resources: Vec<ResourceEntry>,
    #[serde(default, flatten)]
    pub extra: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideEntry {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub resource_type: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub order: usize,
    pub content_ref: Option<String>,
    #[serde(default, flatten)]
    pub extra: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
struct ManifestHeader {
    version: String,
}

#[derive(Debug, Clone, Deserialize)]
struct LegacyManifest {
    #[serde(rename = "version")]
    _version: String,
    created: String,
    modified: String,
    slides: Vec<SlideEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaEntry {
    pub id: String,
    pub mime_type: String,
    pub ext: String,
    pub bytes_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaIndexItem {
    id: String,
    mime_type: String,
    ext: String,
    path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsFileData {
    pub manifest: Manifest,
    pub contents: Vec<ResourceData>,
    #[serde(default)]
    pub media: Vec<MediaEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceData {
    pub id: String,
    pub content: serde_json::Value,
}

impl Manifest {
    pub fn new() -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            version: CURRENT_FORMAT_VERSION.to_string(),
            created: now.clone(),
            modified: now,
            resources: vec![ResourceEntry {
                id: "canvas-1".to_string(),
                resource_type: "canvas".to_string(),
                name: "Untitled canvas".to_string(),
                parent_id: None,
                order: 0,
                content_ref: Some("canvases/canvas-1.json".to_string()),
                extra: BTreeMap::new(),
            }],
            extra: BTreeMap::new(),
        }
    }
}

pub fn new_canvas_resource(
    id: String,
    name: String,
    parent_id: Option<String>,
    order: usize,
) -> ResourceEntry {
    ResourceEntry {
        content_ref: Some(format!("canvases/{id}.json")),
        id,
        resource_type: "canvas".to_string(),
        name,
        parent_id,
        order,
        extra: BTreeMap::new(),
    }
}

fn validate_version_string(version: &str) -> Result<(), String> {
    let mut parts = version.split('.');
    let major = parts.next();
    let minor = parts.next();
    if parts.next().is_some()
        || major.is_none_or(|part| part.is_empty() || !part.chars().all(|c| c.is_ascii_digit()))
        || minor.is_none_or(|part| part.is_empty() || !part.chars().all(|c| c.is_ascii_digit()))
    {
        return Err(format!(
            "Invalid .is format version {version:?}; expected MAJOR.MINOR"
        ));
    }
    Ok(())
}

fn validate_content_ref(content_ref: &str) -> Result<(), String> {
    let path = Path::new(content_ref);
    if path.is_absolute() || content_ref.is_empty() {
        return Err(format!("Invalid resource contentRef: {content_ref}"));
    }
    for component in path.components() {
        if !matches!(component, Component::Normal(_)) {
            return Err(format!("Invalid resource contentRef: {content_ref}"));
        }
    }
    if path.extension().and_then(|value| value.to_str()) != Some("json") {
        return Err(format!(
            "Resource contentRef must point to JSON: {content_ref}"
        ));
    }
    Ok(())
}

pub fn validate_manifest(manifest: &Manifest) -> Result<(), String> {
    validate_version_string(&manifest.version)?;
    if manifest.version != CURRENT_FORMAT_VERSION {
        return Err(format!(
            "Cannot write .is format version {}; current writer supports {}",
            manifest.version, CURRENT_FORMAT_VERSION
        ));
    }

    let mut ids = HashSet::new();
    let mut sibling_orders = HashSet::new();
    let mut content_refs = HashSet::new();
    let mut by_id = HashMap::new();

    for resource in &manifest.resources {
        if resource.id.is_empty() {
            return Err("Workspace resource id cannot be empty".to_string());
        }
        if !ids.insert(resource.id.clone()) {
            return Err(format!("Duplicate workspace resource id: {}", resource.id));
        }
        if !sibling_orders.insert((resource.parent_id.clone(), resource.order)) {
            return Err(format!(
                "Duplicate sibling order {} under {:?}",
                resource.order, resource.parent_id
            ));
        }
        by_id.insert(resource.id.as_str(), resource);
        if let Some(content_ref) = &resource.content_ref {
            if !content_refs.insert(content_ref.as_str()) {
                return Err(format!("Duplicate resource contentRef: {content_ref}"));
            }
        }
    }

    let canvas_count = manifest
        .resources
        .iter()
        .filter(|resource| resource.resource_type == "canvas")
        .count();
    if canvas_count == 0 {
        return Err("A workspace must contain at least one canvas resource".to_string());
    }

    for resource in &manifest.resources {
        if resource.parent_id.as_deref() == Some(resource.id.as_str()) {
            return Err(format!("Resource {} cannot be its own parent", resource.id));
        }
        if let Some(parent_id) = &resource.parent_id {
            let parent = by_id.get(parent_id.as_str()).ok_or_else(|| {
                format!("Missing parent {parent_id} for resource {}", resource.id)
            })?;
            if parent.resource_type != "folder" {
                return Err(format!(
                    "Resource {} has non-folder parent {parent_id}",
                    resource.id
                ));
            }
        }

        match resource.resource_type.as_str() {
            "folder" => {
                if resource.content_ref.is_some() {
                    return Err(format!("Folder {} cannot have contentRef", resource.id));
                }
            }
            "canvas" => {
                let expected = format!("canvases/{}.json", resource.id);
                if resource.content_ref.as_deref() != Some(expected.as_str()) {
                    return Err(format!(
                        "Canvas {} must use contentRef {expected}",
                        resource.id
                    ));
                }
            }
            _ => {
                if let Some(content_ref) = &resource.content_ref {
                    validate_content_ref(content_ref)?;
                }
            }
        }
    }

    for resource in &manifest.resources {
        let mut cursor = resource.parent_id.as_deref();
        let mut visited = HashSet::new();
        while let Some(parent_id) = cursor {
            if !visited.insert(parent_id) {
                return Err(format!("Workspace resource cycle includes {parent_id}"));
            }
            cursor = by_id
                .get(parent_id)
                .and_then(|parent| parent.parent_id.as_deref());
        }
    }

    Ok(())
}

fn validate_contents(manifest: &Manifest, contents: &[ResourceData]) -> Result<(), String> {
    let mut content_ids = HashSet::new();
    for content in contents {
        if !content_ids.insert(content.id.as_str()) {
            return Err(format!("Duplicate resource content id: {}", content.id));
        }
        let resource = manifest
            .resources
            .iter()
            .find(|resource| resource.id == content.id)
            .ok_or_else(|| format!("Content references unknown resource: {}", content.id))?;
        if resource.content_ref.is_none() {
            return Err(format!("Resource {} does not accept content", content.id));
        }
    }

    for resource in &manifest.resources {
        if resource.content_ref.is_some() && !content_ids.contains(resource.id.as_str()) {
            return Err(format!("Missing content for resource {}", resource.id));
        }
    }
    Ok(())
}

pub fn ordered_canvas_ids(resources: &[ResourceEntry]) -> Result<Vec<String>, String> {
    let manifest = Manifest {
        version: CURRENT_FORMAT_VERSION.to_string(),
        created: String::new(),
        modified: String::new(),
        resources: resources.to_vec(),
        extra: BTreeMap::new(),
    };
    validate_manifest(&manifest)?;

    let mut children: HashMap<Option<&str>, Vec<&ResourceEntry>> = HashMap::new();
    for resource in resources {
        children
            .entry(resource.parent_id.as_deref())
            .or_default()
            .push(resource);
    }
    for siblings in children.values_mut() {
        siblings.sort_by(|left, right| {
            left.order
                .cmp(&right.order)
                .then_with(|| left.id.cmp(&right.id))
        });
    }

    fn visit(
        parent_id: Option<&str>,
        children: &HashMap<Option<&str>, Vec<&ResourceEntry>>,
        ordered: &mut Vec<String>,
    ) {
        if let Some(nodes) = children.get(&parent_id) {
            for resource in nodes {
                if resource.resource_type == "canvas" {
                    ordered.push(resource.id.clone());
                }
                visit(Some(resource.id.as_str()), children, ordered);
            }
        }
    }

    let mut ordered = Vec::new();
    visit(None, &children, &mut ordered);
    Ok(ordered)
}

fn is_valid_media_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn is_valid_media_ext(ext: &str) -> bool {
    matches!(ext, "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg")
}

fn mime_type_for_ext(ext: &str) -> Option<&'static str> {
    match ext {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "svg" => Some("image/svg+xml"),
        _ => None,
    }
}

fn decode_base64(bytes_base64: &str) -> Result<Vec<u8>, String> {
    BASE64_STANDARD
        .decode(bytes_base64)
        .map_err(|e| format!("Invalid media base64 payload: {e}"))
}

fn encode_base64(bytes: &[u8]) -> String {
    BASE64_STANDARD.encode(bytes)
}

fn validate_media_entry(media: &MediaEntry) -> Result<(), String> {
    if !is_valid_media_id(&media.id) {
        return Err(format!("Invalid media id: {}", media.id));
    }

    if !is_valid_media_ext(&media.ext) {
        return Err(format!("Invalid media ext: {}", media.ext));
    }

    let _ = decode_base64(&media.bytes_base64)?;
    Ok(())
}

fn read_zip_entry_string<R: Read + Seek>(
    archive: &mut zip::ZipArchive<R>,
    entry_path: &str,
) -> Result<String, String> {
    let mut entry = archive
        .by_name(entry_path)
        .map_err(|e| format!("Failed to open zip entry {entry_path}: {e}"))?;
    let mut buf = String::new();
    entry
        .read_to_string(&mut buf)
        .map_err(|e| format!("Failed to read zip entry {entry_path}: {e}"))?;
    Ok(buf)
}

fn read_zip_entry_bytes<R: Read + Seek>(
    archive: &mut zip::ZipArchive<R>,
    entry_path: &str,
) -> Result<Vec<u8>, String> {
    let mut entry = archive
        .by_name(entry_path)
        .map_err(|e| format!("Failed to open zip entry {entry_path}: {e}"))?;
    let mut buf = Vec::new();
    entry
        .read_to_end(&mut buf)
        .map_err(|e| format!("Failed to read zip entry {entry_path}: {e}"))?;
    Ok(buf)
}

fn read_media_from_index<R: Read + Seek>(
    archive: &mut zip::ZipArchive<R>,
    index_items: Vec<MediaIndexItem>,
) -> Vec<MediaEntry> {
    let mut media = Vec::new();

    for item in index_items {
        if !is_valid_media_id(&item.id) {
            eprintln!(
                "[IdeaSlide] Skip media with invalid id from index: {}",
                item.id
            );
            continue;
        }

        if !is_valid_media_ext(&item.ext) {
            eprintln!(
                "[IdeaSlide] Skip media with invalid ext from index: {}",
                item.ext
            );
            continue;
        }

        let expected_path = format!("media/{}.{}", item.id, item.ext);
        if item.path != expected_path {
            eprintln!(
                "[IdeaSlide] Skip media index item with invalid path: {} (expected {})",
                item.path, expected_path
            );
            continue;
        }

        let bytes = match read_zip_entry_bytes(archive, &item.path) {
            Ok(bytes) => bytes,
            Err(err) => {
                eprintln!(
                    "[IdeaSlide] Skip missing/unreadable media {}: {}",
                    item.path, err
                );
                continue;
            }
        };

        media.push(MediaEntry {
            id: item.id,
            mime_type: item.mime_type,
            ext: item.ext,
            bytes_base64: encode_base64(&bytes),
        });
    }

    media
}

fn read_media_from_fallback_scan<R: Read + Seek>(
    archive: &mut zip::ZipArchive<R>,
) -> Vec<MediaEntry> {
    let mut media_entry_paths = Vec::new();

    for index in 0..archive.len() {
        let name = match archive.by_index(index) {
            Ok(entry) => entry.name().to_string(),
            Err(_) => continue,
        };

        if !name.starts_with("media/") || name == "media/index.json" || name.ends_with('/') {
            continue;
        }

        let filename = &name["media/".len()..];
        if filename.contains('/') {
            continue;
        }

        media_entry_paths.push(name);
    }

    let mut media = Vec::new();

    for path in media_entry_paths {
        let filename = &path["media/".len()..];
        let Some(dot_index) = filename.rfind('.') else {
            continue;
        };

        if dot_index == 0 || dot_index == filename.len() - 1 {
            continue;
        }

        let id = &filename[..dot_index];
        let ext = filename[dot_index + 1..].to_ascii_lowercase();

        if !is_valid_media_id(id) || !is_valid_media_ext(&ext) {
            continue;
        }

        let bytes = match read_zip_entry_bytes(archive, &path) {
            Ok(bytes) => bytes,
            Err(err) => {
                eprintln!(
                    "[IdeaSlide] Skip unreadable fallback media {}: {}",
                    path, err
                );
                continue;
            }
        };

        let Some(mime_type) = mime_type_for_ext(&ext) else {
            continue;
        };

        media.push(MediaEntry {
            id: id.to_string(),
            mime_type: mime_type.to_string(),
            ext,
            bytes_base64: encode_base64(&bytes),
        });
    }

    media
}

fn read_media_entries<R: Read + Seek>(archive: &mut zip::ZipArchive<R>) -> Vec<MediaEntry> {
    let index_json = match read_zip_entry_string(archive, "media/index.json") {
        Ok(index_json) => Some(index_json),
        Err(err) => {
            eprintln!(
                "[IdeaSlide] media/index.json unavailable, fallback scan: {}",
                err
            );
            None
        }
    };

    if let Some(index_json) = index_json {
        match serde_json::from_str::<Vec<MediaIndexItem>>(&index_json) {
            Ok(index_items) => return read_media_from_index(archive, index_items),
            Err(err) => {
                eprintln!(
                    "[IdeaSlide] media/index.json is malformed, fallback scan: {}",
                    err
                );
            }
        }
    }

    read_media_from_fallback_scan(archive)
}

fn blank_canvas_content() -> serde_json::Value {
    serde_json::json!({
        "type": "excalidraw",
        "version": 2,
        "elements": [],
        "appState": {},
        "files": {}
    })
}

/// Create a new .is file at the given path with a single blank canvas.
pub fn create_is_file(path: &Path) -> Result<IsFileData, String> {
    let manifest = Manifest::new();

    let data = IsFileData {
        manifest: manifest.clone(),
        contents: vec![ResourceData {
            id: "canvas-1".to_string(),
            content: blank_canvas_content(),
        }],
        media: vec![],
    };

    write_is_file(path, &data)?;
    Ok(data)
}

/// Read an .is file and return its contents
pub fn read_is_file(path: &Path) -> Result<IsFileData, String> {
    let file_bytes = fs::read(path).map_err(|e| format!("Failed to read file: {e}"))?;
    let cursor = Cursor::new(file_bytes);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| format!("Failed to open zip: {e}"))?;

    let manifest_json = read_zip_entry_string(&mut archive, "manifest.json")
        .map_err(|e| format!("Missing or unreadable manifest.json: {e}"))?;
    let header: ManifestHeader = serde_json::from_str(&manifest_json)
        .map_err(|e| format!("Invalid manifest header: {e}"))?;
    validate_version_string(&header.version)?;

    let (manifest, contents) = match header.version.as_str() {
        LEGACY_FORMAT_VERSION => {
            let legacy: LegacyManifest = serde_json::from_str(&manifest_json)
                .map_err(|e| format!("Invalid format 1.0 manifest: {e}"))?;
            let mut resources = Vec::with_capacity(legacy.slides.len());
            let mut contents = Vec::with_capacity(legacy.slides.len());

            for (order, slide_entry) in legacy.slides.iter().enumerate() {
                let zip_path = format!("slides/{}.json", slide_entry.id);
                let content_json = read_zip_entry_string(&mut archive, &zip_path)
                    .map_err(|e| format!("Missing legacy slide {}: {e}", slide_entry.id))?;
                let content = serde_json::from_str(&content_json)
                    .map_err(|e| format!("Invalid legacy slide {} JSON: {e}", slide_entry.id))?;
                resources.push(new_canvas_resource(
                    slide_entry.id.clone(),
                    if slide_entry.title.trim().is_empty() {
                        format!("Canvas {}", order + 1)
                    } else {
                        slide_entry.title.clone()
                    },
                    None,
                    order,
                ));
                contents.push(ResourceData {
                    id: slide_entry.id.clone(),
                    content,
                });
            }

            let manifest = Manifest {
                version: CURRENT_FORMAT_VERSION.to_string(),
                created: legacy.created,
                modified: legacy.modified,
                resources,
                extra: BTreeMap::new(),
            };
            validate_manifest(&manifest)?;
            validate_contents(&manifest, &contents)?;
            (manifest, contents)
        }
        CURRENT_FORMAT_VERSION => {
            let manifest: Manifest = serde_json::from_str(&manifest_json)
                .map_err(|e| format!("Invalid format 2.0 manifest: {e}"))?;
            validate_manifest(&manifest)?;
            let mut contents = Vec::new();
            for resource in &manifest.resources {
                let Some(content_ref) = &resource.content_ref else {
                    continue;
                };
                validate_content_ref(content_ref)?;
                let content_json = read_zip_entry_string(&mut archive, content_ref)
                    .map_err(|e| format!("Missing content for resource {}: {e}", resource.id))?;
                let content = serde_json::from_str(&content_json)
                    .map_err(|e| format!("Invalid resource {} JSON: {e}", resource.id))?;
                contents.push(ResourceData {
                    id: resource.id.clone(),
                    content,
                });
            }
            validate_contents(&manifest, &contents)?;
            (manifest, contents)
        }
        version => {
            return Err(format!(
                "Unsupported .is format version {version}; this IdeaSlide build supports 1.0 and 2.0"
            ));
        }
    };

    let media = read_media_entries(&mut archive);

    Ok(IsFileData {
        manifest,
        contents,
        media,
    })
}

/// Write an IsFileData to a .is file (zip) with atomic replacement
pub fn write_is_file(path: &Path, data: &IsFileData) -> Result<(), String> {
    validate_manifest(&data.manifest)?;
    validate_contents(&data.manifest, &data.contents)?;

    let mut prepared_media = Vec::new();
    for media in &data.media {
        validate_media_entry(media)?;

        let media_path = format!("media/{}.{}", media.id, media.ext);
        let media_bytes = decode_base64(&media.bytes_base64)?;

        prepared_media.push((
            MediaIndexItem {
                id: media.id.clone(),
                mime_type: media.mime_type.clone(),
                ext: media.ext.clone(),
                path: media_path,
            },
            media_bytes,
        ));
    }

    let mut buf = Vec::new();
    {
        let cursor = Cursor::new(&mut buf);
        let mut zip = zip::ZipWriter::new(cursor);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        // Write manifest
        let manifest_json = serde_json::to_string_pretty(&data.manifest)
            .map_err(|e| format!("Failed to serialize manifest: {e}"))?;
        zip.start_file("manifest.json", options)
            .map_err(|e| format!("Failed to write manifest to zip: {e}"))?;
        zip.write_all(manifest_json.as_bytes())
            .map_err(|e| format!("Failed to write manifest bytes: {e}"))?;

        // Write type-specific resource content at its manifest contentRef.
        for content in &data.contents {
            let resource = data
                .manifest
                .resources
                .iter()
                .find(|resource| resource.id == content.id)
                .ok_or_else(|| format!("Missing resource metadata for content {}", content.id))?;
            let content_ref = resource
                .content_ref
                .as_deref()
                .ok_or_else(|| format!("Resource {} has no contentRef", content.id))?;
            let content_json = serde_json::to_string_pretty(&content.content)
                .map_err(|e| format!("Failed to serialize resource {}: {e}", content.id))?;
            zip.start_file(content_ref, options)
                .map_err(|e| format!("Failed to write resource {} to zip: {e}", content.id))?;
            zip.write_all(content_json.as_bytes())
                .map_err(|e| format!("Failed to write resource {} bytes: {e}", content.id))?;
        }

        zip.add_directory("media/", options)
            .map_err(|e| format!("Failed to create media dir: {e}"))?;

        let media_index: Vec<MediaIndexItem> = prepared_media
            .iter()
            .map(|(index_item, _)| index_item.clone())
            .collect();

        let media_index_json = serde_json::to_string_pretty(&media_index)
            .map_err(|e| format!("Failed to serialize media/index.json: {e}"))?;
        zip.start_file("media/index.json", options)
            .map_err(|e| format!("Failed to write media/index.json to zip: {e}"))?;
        zip.write_all(media_index_json.as_bytes())
            .map_err(|e| format!("Failed to write media/index.json bytes: {e}"))?;

        for (index_item, media_bytes) in prepared_media {
            zip.start_file(&index_item.path, options)
                .map_err(|e| format!("Failed to write media file to zip: {e}"))?;
            zip.write_all(&media_bytes)
                .map_err(|e| format!("Failed to write media bytes: {e}"))?;
        }

        zip.finish()
            .map_err(|e| format!("Failed to finalize zip: {e}"))?;
    }

    // Atomic write: write to temp file then rename
    let tmp_path = path.with_extension("is.tmp");
    fs::write(&tmp_path, &buf).map_err(|e| format!("Failed to write temp file: {e}"))?;
    if path.exists() {
        let backup_path = path.with_extension("is.bak");
        fs::copy(path, &backup_path)
            .map_err(|e| format!("Failed to create backup {}: {e}", backup_path.display()))?;
    }
    fs::rename(&tmp_path, path).map_err(|e| format!("Failed to rename temp file: {e}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_temp_path(file_name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "ideaslide_test_{}_{}_{}",
            std::process::id(),
            file_name,
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let _ = fs::create_dir_all(&dir);
        dir.join("test.is")
    }

    fn cleanup_temp_path(path: &std::path::Path) {
        if let Some(parent) = path.parent() {
            let _ = fs::remove_dir_all(parent);
        }
    }

    fn write_custom_zip(path: &Path, entries: Vec<(&str, Vec<u8>)>) {
        let mut bytes = Vec::new();
        {
            let cursor = Cursor::new(&mut bytes);
            let mut zip = zip::ZipWriter::new(cursor);
            let options =
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

            for (name, data) in entries {
                if name.ends_with('/') {
                    zip.add_directory(name, options).unwrap();
                } else {
                    zip.start_file(name, options).unwrap();
                    zip.write_all(&data).unwrap();
                }
            }

            zip.finish().unwrap();
        }

        fs::write(path, bytes).unwrap();
    }

    fn canvas_content(label: &str) -> serde_json::Value {
        serde_json::json!({
            "type": "excalidraw",
            "version": 2,
            "elements": [{"type": "text", "text": label}],
            "appState": {},
            "files": {}
        })
    }

    fn data_with_contents(contents: Vec<ResourceData>) -> IsFileData {
        let mut manifest = Manifest::new();
        manifest.resources = contents
            .iter()
            .enumerate()
            .map(|(order, content)| {
                new_canvas_resource(
                    content.id.clone(),
                    format!("Canvas {}", order + 1),
                    None,
                    order,
                )
            })
            .collect();
        IsFileData {
            manifest,
            contents,
            media: vec![],
        }
    }

    #[test]
    fn test_current_workspace_format_version_is_2() {
        assert_eq!(CURRENT_FORMAT_VERSION, "2.0");
    }

    #[test]
    fn test_rejects_future_format_before_reading_payloads() {
        let path = make_temp_path("future_format");
        let manifest_json = serde_json::to_vec_pretty(&serde_json::json!({
            "version": "9.0",
            "created": "2026-01-01T00:00:00Z",
            "modified": "2026-01-01T00:00:00Z",
            "resources": []
        }))
        .unwrap();

        write_custom_zip(&path, vec![("manifest.json", manifest_json)]);

        let error = read_is_file(&path).unwrap_err();
        assert!(error.contains("Unsupported .is format version 9.0"));
        assert!(error.contains("1.0 and 2.0"));

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_manifest_new_has_one_canvas() {
        let manifest = Manifest::new();
        assert_eq!(manifest.version, CURRENT_FORMAT_VERSION);
        assert_eq!(manifest.resources.len(), 1);
        assert_eq!(manifest.resources[0].id, "canvas-1");
        assert_eq!(manifest.resources[0].resource_type, "canvas");
        assert_eq!(
            manifest.resources[0].content_ref.as_deref(),
            Some("canvases/canvas-1.json")
        );
    }

    #[test]
    fn test_manifest_roundtrip_json() {
        let manifest = Manifest::new();
        let json = serde_json::to_string(&manifest).unwrap();
        let parsed: Manifest = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.resources.len(), 1);
        assert_eq!(parsed.version, CURRENT_FORMAT_VERSION);
    }

    #[test]
    fn test_create_and_read_is_file() {
        let path = make_temp_path("create_and_read");

        let created = create_is_file(&path).unwrap();
        assert_eq!(created.contents.len(), 1);
        assert_eq!(created.manifest.resources[0].id, "canvas-1");

        let read = read_is_file(&path).unwrap();
        assert_eq!(read.contents.len(), 1);
        assert_eq!(read.manifest.version, CURRENT_FORMAT_VERSION);
        assert_eq!(read.contents[0].content["type"], "excalidraw");
        assert!(read.media.is_empty());

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_migrates_legacy_slides_to_root_canvases_in_order() {
        let path = make_temp_path("legacy_migration");
        let manifest_json = serde_json::to_vec_pretty(&serde_json::json!({
            "version": LEGACY_FORMAT_VERSION,
            "created": "2026-01-01T00:00:00Z",
            "modified": "2026-01-02T00:00:00Z",
            "slides": [
                {"id": "slide-b", "title": "Research"},
                {"id": "slide-a", "title": ""}
            ]
        }))
        .unwrap();
        write_custom_zip(
            &path,
            vec![
                ("manifest.json", manifest_json),
                (
                    "slides/slide-b.json",
                    serde_json::to_vec(&canvas_content("B")).unwrap(),
                ),
                (
                    "slides/slide-a.json",
                    serde_json::to_vec(&canvas_content("A")).unwrap(),
                ),
            ],
        );

        let read = read_is_file(&path).unwrap();
        assert_eq!(read.manifest.version, CURRENT_FORMAT_VERSION);
        assert_eq!(
            ordered_canvas_ids(&read.manifest.resources).unwrap(),
            ["slide-b", "slide-a"]
        );
        assert_eq!(read.manifest.resources[0].name, "Research");
        assert_eq!(read.manifest.resources[1].name, "Canvas 2");
        assert!(read
            .manifest
            .resources
            .iter()
            .all(|resource| resource.parent_id.is_none()));
        assert_eq!(read.contents[0].content["elements"][0]["text"], "B");

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_rejects_missing_malformed_and_unsupported_versions() {
        for (case, manifest, expected) in [
            (
                "missing",
                serde_json::json!({"created": "now", "modified": "now", "resources": []}),
                "Invalid manifest header",
            ),
            (
                "malformed",
                serde_json::json!({"version": "2", "resources": []}),
                "expected MAJOR.MINOR",
            ),
            (
                "unsupported_old",
                serde_json::json!({"version": "0.9", "resources": []}),
                "Unsupported .is format version 0.9",
            ),
        ] {
            let path = make_temp_path(case);
            write_custom_zip(
                &path,
                vec![("manifest.json", serde_json::to_vec(&manifest).unwrap())],
            );
            let error = read_is_file(&path).unwrap_err();
            assert!(error.contains(expected), "unexpected error: {error}");
            cleanup_temp_path(&path);
        }
    }

    #[test]
    fn test_v2_manifest_is_not_deserializable_as_legacy_v1() {
        let manifest_json = serde_json::to_string(&Manifest::new()).unwrap();
        let legacy = serde_json::from_str::<LegacyManifest>(&manifest_json);
        assert!(legacy.is_err());
        assert!(legacy.unwrap_err().to_string().contains("slides"));
    }

    #[test]
    fn test_unknown_resource_and_metadata_roundtrip() {
        let path = make_temp_path("unknown_resource_roundtrip");
        let mut manifest = Manifest::new();
        manifest.extra.insert(
            "workspaceTheme".to_string(),
            serde_json::json!({"accent": "violet"}),
        );
        manifest.resources = vec![
            ResourceEntry {
                id: "folder-1".to_string(),
                resource_type: "folder".to_string(),
                name: "Notes".to_string(),
                parent_id: None,
                order: 0,
                content_ref: None,
                extra: BTreeMap::new(),
            },
            new_canvas_resource(
                "canvas-1".to_string(),
                "Sketch".to_string(),
                Some("folder-1".to_string()),
                0,
            ),
            ResourceEntry {
                id: "dataset-1".to_string(),
                resource_type: "dataset".to_string(),
                name: "Raw data".to_string(),
                parent_id: None,
                order: 1,
                content_ref: Some("datasets/dataset-1.json".to_string()),
                extra: BTreeMap::from([(
                    "pluginMetadata".to_string(),
                    serde_json::json!({"schema": 3}),
                )]),
            },
        ];
        let data = IsFileData {
            manifest,
            contents: vec![
                ResourceData {
                    id: "canvas-1".to_string(),
                    content: canvas_content("Sketch"),
                },
                ResourceData {
                    id: "dataset-1".to_string(),
                    content: serde_json::json!({"rows": [1, 2, 3]}),
                },
            ],
            media: vec![],
        };

        write_is_file(&path, &data).unwrap();
        let read = read_is_file(&path).unwrap();
        assert_eq!(read.manifest.extra, data.manifest.extra);
        assert_eq!(
            read.manifest.resources[2].extra,
            data.manifest.resources[2].extra
        );
        assert_eq!(
            read.contents[1].content,
            serde_json::json!({"rows": [1, 2, 3]})
        );

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_rejects_invalid_resource_hierarchy_and_content_refs() {
        let base = Manifest::new();

        let mut missing_parent = base.clone();
        missing_parent.resources[0].parent_id = Some("missing".to_string());
        assert!(validate_manifest(&missing_parent)
            .unwrap_err()
            .contains("Missing parent missing"));

        let mut non_folder_parent = base.clone();
        non_folder_parent.resources.push(new_canvas_resource(
            "canvas-2".to_string(),
            "Second".to_string(),
            Some("canvas-1".to_string()),
            0,
        ));
        assert!(validate_manifest(&non_folder_parent)
            .unwrap_err()
            .contains("non-folder parent"));

        let mut cycle = base.clone();
        cycle.resources.insert(
            0,
            ResourceEntry {
                id: "folder-a".to_string(),
                resource_type: "folder".to_string(),
                name: "A".to_string(),
                parent_id: Some("folder-b".to_string()),
                order: 0,
                content_ref: None,
                extra: BTreeMap::new(),
            },
        );
        cycle.resources.insert(
            1,
            ResourceEntry {
                id: "folder-b".to_string(),
                resource_type: "folder".to_string(),
                name: "B".to_string(),
                parent_id: Some("folder-a".to_string()),
                order: 0,
                content_ref: None,
                extra: BTreeMap::new(),
            },
        );
        assert!(validate_manifest(&cycle).unwrap_err().contains("cycle"));

        let mut bad_ref = base;
        bad_ref.resources[0].content_ref = Some("slides/canvas-1.json".to_string());
        assert!(validate_manifest(&bad_ref)
            .unwrap_err()
            .contains("must use contentRef canvases/canvas-1.json"));

        let mut duplicate_ref = Manifest::new();
        duplicate_ref.resources.push(ResourceEntry {
            id: "data-1".to_string(),
            resource_type: "dataset".to_string(),
            name: "Data".to_string(),
            parent_id: None,
            order: 1,
            content_ref: Some("canvases/canvas-1.json".to_string()),
            extra: BTreeMap::new(),
        });
        assert!(validate_manifest(&duplicate_ref)
            .unwrap_err()
            .contains("Duplicate resource contentRef"));
    }

    #[test]
    fn test_write_creates_backup_before_replacement() {
        let path = make_temp_path("backup");
        let initial = data_with_contents(vec![ResourceData {
            id: "canvas-1".to_string(),
            content: canvas_content("before"),
        }]);
        write_is_file(&path, &initial).unwrap();

        let updated = data_with_contents(vec![ResourceData {
            id: "canvas-1".to_string(),
            content: canvas_content("after"),
        }]);
        write_is_file(&path, &updated).unwrap();

        let backup_path = path.with_extension("is.bak");
        let backup = read_is_file(&backup_path).unwrap();
        let current = read_is_file(&path).unwrap();
        assert_eq!(backup.contents[0].content["elements"][0]["text"], "before");
        assert_eq!(current.contents[0].content["elements"][0]["text"], "after");

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_roundtrip_with_media() {
        let path = make_temp_path("roundtrip_media");

        let data = IsFileData {
            manifest: Manifest::new(),
            contents: vec![ResourceData {
                id: "canvas-1".to_string(),
                content: serde_json::json!({
                    "type": "excalidraw",
                    "version": 2,
                    "elements": [{"type": "image", "fileId": "img_1"}],
                    "appState": {},
                    "files": {
                        "img_1": {"id": "img_1", "mimeType": "image/png"}
                    }
                }),
            }],
            media: vec![MediaEntry {
                id: "img_1".to_string(),
                mime_type: "image/png".to_string(),
                ext: "png".to_string(),
                bytes_base64: encode_base64(b"png-binary"),
            }],
        };

        write_is_file(&path, &data).unwrap();
        let read = read_is_file(&path).unwrap();

        assert_eq!(read.media.len(), 1);
        assert_eq!(read.media[0].id, "img_1");
        assert_eq!(read.media[0].mime_type, "image/png");
        assert_eq!(read.media[0].ext, "png");
        assert_eq!(read.media[0].bytes_base64, encode_base64(b"png-binary"));

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_compat_without_media_dir() {
        let path = make_temp_path("compat_without_media");

        let manifest = Manifest::new();
        let manifest_json = serde_json::to_vec_pretty(&manifest).unwrap();
        let canvas_json = serde_json::to_vec_pretty(&blank_canvas_content()).unwrap();

        write_custom_zip(
            &path,
            vec![
                ("manifest.json", manifest_json),
                ("canvases/canvas-1.json", canvas_json),
            ],
        );

        let read = read_is_file(&path).unwrap();
        assert!(read.media.is_empty());

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_reject_illegal_media_id_or_ext() {
        let path = make_temp_path("reject_illegal_media");

        let mut data = IsFileData {
            manifest: Manifest::new(),
            contents: vec![ResourceData {
                id: "canvas-1".to_string(),
                content: blank_canvas_content(),
            }],
            media: vec![MediaEntry {
                id: "../bad".to_string(),
                mime_type: "image/png".to_string(),
                ext: "png".to_string(),
                bytes_base64: encode_base64(b"bad"),
            }],
        };

        assert!(write_is_file(&path, &data).is_err());

        data.media = vec![MediaEntry {
            id: "good_id".to_string(),
            mime_type: "image/png".to_string(),
            ext: "exe".to_string(),
            bytes_base64: encode_base64(b"bad"),
        }];

        assert!(write_is_file(&path, &data).is_err());

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_skip_missing_media_file_from_index() {
        let path = make_temp_path("skip_missing_media");

        let manifest = Manifest::new();
        let manifest_json = serde_json::to_vec_pretty(&manifest).unwrap();
        let canvas_json = serde_json::to_vec_pretty(&blank_canvas_content()).unwrap();
        let index_json = serde_json::to_vec_pretty(&vec![MediaIndexItem {
            id: "img_1".to_string(),
            mime_type: "image/png".to_string(),
            ext: "png".to_string(),
            path: "media/img_1.png".to_string(),
        }])
        .unwrap();

        write_custom_zip(
            &path,
            vec![
                ("manifest.json", manifest_json),
                ("canvases/canvas-1.json", canvas_json),
                ("media/", vec![]),
                ("media/index.json", index_json),
            ],
        );

        let read = read_is_file(&path).unwrap();
        assert!(read.media.is_empty());

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_handle_invalid_media_index_item() {
        let path = make_temp_path("invalid_media_index_item");

        let manifest = Manifest::new();
        let manifest_json = serde_json::to_vec_pretty(&manifest).unwrap();
        let canvas_json = serde_json::to_vec_pretty(&blank_canvas_content()).unwrap();
        let index_json = serde_json::to_vec_pretty(&vec![
            MediaIndexItem {
                id: "../bad".to_string(),
                mime_type: "image/png".to_string(),
                ext: "png".to_string(),
                path: "media/../bad.png".to_string(),
            },
            MediaIndexItem {
                id: "img_ok".to_string(),
                mime_type: "image/png".to_string(),
                ext: "png".to_string(),
                path: "media/img_ok.png".to_string(),
            },
        ])
        .unwrap();

        write_custom_zip(
            &path,
            vec![
                ("manifest.json", manifest_json),
                ("canvases/canvas-1.json", canvas_json),
                ("media/", vec![]),
                ("media/index.json", index_json),
                ("media/img_ok.png", b"ok".to_vec()),
            ],
        );

        let read = read_is_file(&path).unwrap();
        assert_eq!(read.media.len(), 1);
        assert_eq!(read.media[0].id, "img_ok");

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_fallback_when_media_index_json_malformed() {
        let path = make_temp_path("malformed_media_index");

        let manifest = Manifest::new();
        let manifest_json = serde_json::to_vec_pretty(&manifest).unwrap();
        let canvas_json = serde_json::to_vec_pretty(&blank_canvas_content()).unwrap();

        write_custom_zip(
            &path,
            vec![
                ("manifest.json", manifest_json),
                ("canvases/canvas-1.json", canvas_json),
                ("media/", vec![]),
                ("media/index.json", b"{this-is-not-json".to_vec()),
                ("media/fallback_1.png", b"fallback".to_vec()),
            ],
        );

        let read = read_is_file(&path).unwrap();
        assert_eq!(read.media.len(), 1);
        assert_eq!(read.media[0].id, "fallback_1");
        assert_eq!(read.media[0].ext, "png");

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_media_index_and_files_match_referenced_image_ids() {
        use std::collections::BTreeSet;

        let path = make_temp_path("media_index_integrity");

        let canvas_1 = ResourceData {
            id: "canvas-1".to_string(),
            content: serde_json::json!({
                "type": "excalidraw",
                "version": 2,
                "elements": [
                    {"type": "image", "fileId": "img_shared"},
                    {"type": "rectangle"}
                ],
                "appState": {},
                "files": {
                    "img_shared": {"id": "img_shared", "mimeType": "image/png"}
                }
            }),
        };

        let canvas_2 = ResourceData {
            id: "canvas-2".to_string(),
            content: serde_json::json!({
                "type": "excalidraw",
                "version": 2,
                "elements": [
                    {"type": "image", "fileId": "img_shared"},
                    {"type": "image", "fileId": "img_other"}
                ],
                "appState": {},
                "files": {
                    "img_shared": {"id": "img_shared", "mimeType": "image/png"},
                    "img_other": {"id": "img_other", "mimeType": "image/png"}
                }
            }),
        };

        let mut data = data_with_contents(vec![canvas_1, canvas_2]);
        data.media = vec![
            MediaEntry {
                id: "img_shared".to_string(),
                mime_type: "image/png".to_string(),
                ext: "png".to_string(),
                bytes_base64: encode_base64(b"shared"),
            },
            MediaEntry {
                id: "img_other".to_string(),
                mime_type: "image/png".to_string(),
                ext: "png".to_string(),
                bytes_base64: encode_base64(b"other"),
            },
        ];

        write_is_file(&path, &data).unwrap();

        let bytes = fs::read(&path).unwrap();
        let cursor = Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor).unwrap();

        let index_json = read_zip_entry_string(&mut archive, "media/index.json").unwrap();
        let index_items: Vec<MediaIndexItem> = serde_json::from_str(&index_json).unwrap();

        let index_ids: BTreeSet<String> = index_items.iter().map(|item| item.id.clone()).collect();
        let referenced_ids: BTreeSet<String> = data
            .contents
            .iter()
            .flat_map(|content| {
                content
                    .content
                    .get("elements")
                    .and_then(|v| v.as_array())
                    .into_iter()
                    .flatten()
                    .filter(|el| el.get("type").and_then(|v| v.as_str()) == Some("image"))
                    .filter_map(|el| el.get("fileId").and_then(|v| v.as_str()))
                    .map(|id| id.to_string())
                    .collect::<Vec<_>>()
            })
            .collect();

        assert_eq!(index_ids, referenced_ids);

        for item in &index_items {
            let mut media_entry = archive.by_name(&item.path).unwrap();
            let mut media_bytes = Vec::new();
            media_entry.read_to_end(&mut media_bytes).unwrap();
            assert!(!media_bytes.is_empty());
        }

        cleanup_temp_path(&path);
    }
}
