use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Cursor, Read, Seek, Write};
use std::path::Path;
use zip::write::SimpleFileOptions;

pub const CURRENT_FORMAT_VERSION: &str = "1.0";
pub const LEGACY_WORKSPACE_FORMAT_VERSION: &str = "2.0";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SlideEntry {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: String,
    pub created: String,
    pub modified: String,
    pub slides: Vec<SlideEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideData {
    pub id: String,
    pub content: serde_json::Value,
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
pub struct IdeaSketchFileData {
    pub manifest: Manifest,
    pub slides: Vec<SlideData>,
    #[serde(default)]
    pub media: Vec<MediaEntry>,
}

#[derive(Debug, Clone)]
pub enum OpenResult {
    Editable(IdeaSketchFileData),
    LegacyProtected { version: String, message: String },
}

#[derive(Debug, Clone, Deserialize)]
struct ManifestHeader {
    version: String,
}

impl Manifest {
    pub fn new() -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            version: CURRENT_FORMAT_VERSION.to_string(),
            created: now.clone(),
            modified: now,
            slides: vec![SlideEntry {
                id: "page-1".to_string(),
                title: "Untitled page".to_string(),
            }],
        }
    }
}

fn blank_page_content() -> serde_json::Value {
    serde_json::json!({
        "type": "excalidraw",
        "version": 2,
        "elements": [],
        "appState": {},
        "files": {}
    })
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

fn is_valid_page_id(id: &str) -> bool {
    !id.is_empty()
        && id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '_' || character == '-'
        })
}

pub fn validate_manifest(manifest: &Manifest) -> Result<(), String> {
    validate_version_string(&manifest.version)?;
    if manifest.version != CURRENT_FORMAT_VERSION {
        return Err(format!(
            "Cannot write .is format version {}; the current writer supports {} only",
            manifest.version, CURRENT_FORMAT_VERSION
        ));
    }
    if manifest.slides.is_empty() {
        return Err("IdeaSketch must contain at least one Page".to_string());
    }

    let mut ids = HashSet::new();
    for slide in &manifest.slides {
        if !is_valid_page_id(&slide.id) {
            return Err(format!("Invalid IdeaSketch Page id: {}", slide.id));
        }
        if !ids.insert(slide.id.as_str()) {
            return Err(format!("Duplicate IdeaSketch Page id: {}", slide.id));
        }
    }
    Ok(())
}

fn validate_slide_data(manifest: &Manifest, slides: &[SlideData]) -> Result<(), String> {
    let manifest_ids: HashSet<&str> = manifest
        .slides
        .iter()
        .map(|slide| slide.id.as_str())
        .collect();
    let mut payload_ids = HashSet::new();

    for slide in slides {
        if !payload_ids.insert(slide.id.as_str()) {
            return Err(format!(
                "Duplicate IdeaSketch Page payload id: {}",
                slide.id
            ));
        }
        if !manifest_ids.contains(slide.id.as_str()) {
            return Err(format!("Orphan IdeaSketch Page payload: {}", slide.id));
        }
        if !slide.content.is_object() {
            return Err(format!(
                "IdeaSketch Page {} content must be an object",
                slide.id
            ));
        }
    }

    for slide in &manifest.slides {
        if !payload_ids.contains(slide.id.as_str()) {
            return Err(format!("Missing IdeaSketch Page payload: {}", slide.id));
        }
    }
    Ok(())
}

fn is_valid_media_id(id: &str) -> bool {
    !id.is_empty()
        && id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '_' || character == '-'
        })
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
        .map_err(|error| format!("Invalid media base64 payload: {error}"))
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
        .map_err(|error| format!("Failed to open zip entry {entry_path}: {error}"))?;
    let mut buffer = String::new();
    entry
        .read_to_string(&mut buffer)
        .map_err(|error| format!("Failed to read zip entry {entry_path}: {error}"))?;
    Ok(buffer)
}

fn read_zip_entry_bytes<R: Read + Seek>(
    archive: &mut zip::ZipArchive<R>,
    entry_path: &str,
) -> Result<Vec<u8>, String> {
    let mut entry = archive
        .by_name(entry_path)
        .map_err(|error| format!("Failed to open zip entry {entry_path}: {error}"))?;
    let mut buffer = Vec::new();
    entry
        .read_to_end(&mut buffer)
        .map_err(|error| format!("Failed to read zip entry {entry_path}: {error}"))?;
    Ok(buffer)
}

fn read_media_from_index<R: Read + Seek>(
    archive: &mut zip::ZipArchive<R>,
    items: Vec<MediaIndexItem>,
) -> Vec<MediaEntry> {
    let mut media = Vec::new();
    for item in items {
        if !is_valid_media_id(&item.id) || !is_valid_media_ext(&item.ext) {
            continue;
        }
        let expected_path = format!("media/{}.{}", item.id, item.ext);
        if item.path != expected_path {
            continue;
        }
        let Ok(bytes) = read_zip_entry_bytes(archive, &item.path) else {
            continue;
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
    let mut paths = Vec::new();
    for index in 0..archive.len() {
        let Ok(entry) = archive.by_index(index) else {
            continue;
        };
        let name = entry.name().to_string();
        if name.starts_with("media/")
            && name != "media/index.json"
            && !name.ends_with('/')
            && !name["media/".len()..].contains('/')
        {
            paths.push(name);
        }
    }

    let mut media = Vec::new();
    for path in paths {
        let filename = &path["media/".len()..];
        let Some((id, ext)) = filename.rsplit_once('.') else {
            continue;
        };
        let ext = ext.to_ascii_lowercase();
        if !is_valid_media_id(id) || !is_valid_media_ext(&ext) {
            continue;
        }
        let Some(mime_type) = mime_type_for_ext(&ext) else {
            continue;
        };
        let Ok(bytes) = read_zip_entry_bytes(archive, &path) else {
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
    if let Ok(index_json) = read_zip_entry_string(archive, "media/index.json") {
        if let Ok(items) = serde_json::from_str::<Vec<MediaIndexItem>>(&index_json) {
            return read_media_from_index(archive, items);
        }
    }
    read_media_from_fallback_scan(archive)
}

pub fn create_file(path: &Path) -> Result<IdeaSketchFileData, String> {
    let manifest = Manifest::new();
    let data = IdeaSketchFileData {
        manifest: manifest.clone(),
        slides: vec![SlideData {
            id: manifest.slides[0].id.clone(),
            content: blank_page_content(),
        }],
        media: Vec::new(),
    };
    write_file(path, &data)?;
    Ok(data)
}

pub fn open_file(path: &Path) -> Result<OpenResult, String> {
    let file_bytes = fs::read(path).map_err(|error| format!("Failed to read file: {error}"))?;
    let cursor = Cursor::new(file_bytes);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|error| format!("Failed to open zip: {error}"))?;

    let manifest_json = read_zip_entry_string(&mut archive, "manifest.json")
        .map_err(|error| format!("Missing or unreadable manifest.json: {error}"))?;
    let header: ManifestHeader = serde_json::from_str(&manifest_json)
        .map_err(|error| format!("Invalid manifest header: {error}"))?;
    validate_version_string(&header.version)?;

    if header.version == LEGACY_WORKSPACE_FORMAT_VERSION {
        let message = format!(
            "Legacy .is format version {} is not editable by this IdeaNote build. The file was not modified; migration will be provided by Workspace Import/Export.",
            header.version
        );
        return Ok(OpenResult::LegacyProtected {
            version: header.version,
            message,
        });
    }
    if header.version != CURRENT_FORMAT_VERSION {
        return Err(format!(
            "Unsupported .is format version {}; this IdeaNote build supports {} only",
            header.version, CURRENT_FORMAT_VERSION
        ));
    }

    let manifest: Manifest = serde_json::from_str(&manifest_json)
        .map_err(|error| format!("Invalid format 1.0 manifest: {error}"))?;
    validate_manifest(&manifest)?;

    let expected_paths: HashSet<String> = manifest
        .slides
        .iter()
        .map(|entry| format!("slides/{}.json", entry.id))
        .collect();
    let mut discovered_paths = HashSet::new();
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| format!("Failed to inspect zip entry: {error}"))?;
        let entry_path = entry.name().to_string();
        if !entry_path.starts_with("slides/") || entry_path.ends_with('/') {
            continue;
        }
        if !expected_paths.contains(&entry_path) {
            return Err(format!("Orphan IdeaSketch Page payload: {entry_path}"));
        }
        if !discovered_paths.insert(entry_path.clone()) {
            return Err(format!("Duplicate IdeaSketch Page payload: {entry_path}"));
        }
    }

    let mut slides = Vec::with_capacity(manifest.slides.len());
    for entry in &manifest.slides {
        let entry_path = format!("slides/{}.json", entry.id);
        let content_json = read_zip_entry_string(&mut archive, &entry_path)
            .map_err(|error| format!("Missing IdeaSketch Page {}: {error}", entry.id))?;
        let content = serde_json::from_str(&content_json)
            .map_err(|error| format!("Invalid IdeaSketch Page {} JSON: {error}", entry.id))?;
        slides.push(SlideData {
            id: entry.id.clone(),
            content,
        });
    }
    validate_slide_data(&manifest, &slides)?;
    let media = read_media_entries(&mut archive);

    Ok(OpenResult::Editable(IdeaSketchFileData {
        manifest,
        slides,
        media,
    }))
}

pub fn read_file(path: &Path) -> Result<IdeaSketchFileData, String> {
    match open_file(path)? {
        OpenResult::Editable(data) => Ok(data),
        OpenResult::LegacyProtected { message, .. } => Err(message),
    }
}

pub fn write_file(path: &Path, data: &IdeaSketchFileData) -> Result<(), String> {
    let mut manifest = data.manifest.clone();
    manifest.modified = chrono::Utc::now().to_rfc3339();
    validate_manifest(&manifest)?;
    validate_slide_data(&manifest, &data.slides)?;

    let mut prepared_media = Vec::new();
    for media in &data.media {
        validate_media_entry(media)?;
        let path = format!("media/{}.{}", media.id, media.ext);
        prepared_media.push((
            MediaIndexItem {
                id: media.id.clone(),
                mime_type: media.mime_type.clone(),
                ext: media.ext.clone(),
                path,
            },
            decode_base64(&media.bytes_base64)?,
        ));
    }

    let payload_by_id: HashMap<&str, &SlideData> = data
        .slides
        .iter()
        .map(|slide| (slide.id.as_str(), slide))
        .collect();
    let mut buffer = Vec::new();
    {
        let cursor = Cursor::new(&mut buffer);
        let mut archive = zip::ZipWriter::new(cursor);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        let manifest_json = serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("Failed to serialize manifest: {error}"))?;
        archive
            .start_file("manifest.json", options)
            .map_err(|error| format!("Failed to write manifest to zip: {error}"))?;
        archive
            .write_all(manifest_json.as_bytes())
            .map_err(|error| format!("Failed to write manifest bytes: {error}"))?;

        for entry in &manifest.slides {
            let slide = payload_by_id
                .get(entry.id.as_str())
                .expect("validated Page payload exists");
            let content_json = serde_json::to_string_pretty(&slide.content)
                .map_err(|error| format!("Failed to serialize Page {}: {error}", entry.id))?;
            let entry_path = format!("slides/{}.json", entry.id);
            archive
                .start_file(&entry_path, options)
                .map_err(|error| format!("Failed to write Page {} to zip: {error}", entry.id))?;
            archive
                .write_all(content_json.as_bytes())
                .map_err(|error| format!("Failed to write Page {} bytes: {error}", entry.id))?;
        }

        if !prepared_media.is_empty() {
            archive
                .add_directory("media/", options)
                .map_err(|error| format!("Failed to create media directory: {error}"))?;
            let index: Vec<MediaIndexItem> = prepared_media
                .iter()
                .map(|(item, _)| item.clone())
                .collect();
            let index_json = serde_json::to_string_pretty(&index)
                .map_err(|error| format!("Failed to serialize media index: {error}"))?;
            archive
                .start_file("media/index.json", options)
                .map_err(|error| format!("Failed to write media index: {error}"))?;
            archive
                .write_all(index_json.as_bytes())
                .map_err(|error| format!("Failed to write media index bytes: {error}"))?;
            for (item, bytes) in prepared_media {
                archive
                    .start_file(&item.path, options)
                    .map_err(|error| format!("Failed to write media file: {error}"))?;
                archive
                    .write_all(&bytes)
                    .map_err(|error| format!("Failed to write media bytes: {error}"))?;
            }
        }

        archive
            .finish()
            .map_err(|error| format!("Failed to finalize zip: {error}"))?;
    }

    let temp_path = path.with_extension("is.tmp");
    fs::write(&temp_path, &buffer)
        .map_err(|error| format!("Failed to write temp file: {error}"))?;
    if let Err(error) = fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("Failed to atomically replace file: {error}"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_temp_path(name: &str) -> std::path::PathBuf {
        let directory = std::env::temp_dir().join(format!(
            "ideanote_idea_sketch_{}_{}_{}",
            std::process::id(),
            name,
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        fs::create_dir_all(&directory).unwrap();
        directory.join("test.is")
    }

    fn cleanup(path: &Path) {
        if let Some(parent) = path.parent() {
            let _ = fs::remove_dir_all(parent);
        }
    }

    fn page_content(label: &str) -> serde_json::Value {
        serde_json::json!({
            "type": "excalidraw",
            "version": 2,
            "elements": [{"type": "text", "text": label}],
            "appState": {},
            "files": {}
        })
    }

    fn data_with_pages(labels: &[&str]) -> IdeaSketchFileData {
        let now = "2026-08-03T00:00:00Z".to_string();
        let entries: Vec<SlideEntry> = labels
            .iter()
            .enumerate()
            .map(|(index, _)| SlideEntry {
                id: format!("page-{}", index + 1),
                title: format!("Page {}", index + 1),
            })
            .collect();
        IdeaSketchFileData {
            manifest: Manifest {
                version: CURRENT_FORMAT_VERSION.to_string(),
                created: now.clone(),
                modified: now,
                slides: entries.clone(),
            },
            slides: entries
                .iter()
                .zip(labels)
                .map(|(entry, label)| SlideData {
                    id: entry.id.clone(),
                    content: page_content(label),
                })
                .collect(),
            media: Vec::new(),
        }
    }

    fn write_custom_zip(path: &Path, entries: Vec<(&str, Vec<u8>)>) {
        let mut bytes = Vec::new();
        {
            let cursor = Cursor::new(&mut bytes);
            let mut archive = zip::ZipWriter::new(cursor);
            let options =
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
            for (name, bytes) in entries {
                archive.start_file(name, options).unwrap();
                archive.write_all(&bytes).unwrap();
            }
            archive.finish().unwrap();
        }
        fs::write(path, bytes).unwrap();
    }

    #[test]
    fn current_writer_is_v1() {
        assert_eq!(CURRENT_FORMAT_VERSION, "1.0");
        assert_eq!(Manifest::new().slides.len(), 1);
    }

    #[test]
    fn create_and_read_roundtrip_uses_pages() {
        let path = make_temp_path("create");
        let created = create_file(&path).unwrap();
        assert_eq!(created.manifest.version, "1.0");
        assert_eq!(created.manifest.slides[0].title, "Untitled page");
        let read = read_file(&path).unwrap();
        assert_eq!(read.slides[0].content["type"], "excalidraw");
        cleanup(&path);
    }

    #[test]
    fn page_order_and_titles_roundtrip() {
        let path = make_temp_path("order");
        let mut data = data_with_pages(&["B", "A"]);
        data.manifest.slides[0].title = "Research".to_string();
        data.manifest.slides[1].title = "Overview".to_string();
        write_file(&path, &data).unwrap();
        let read = read_file(&path).unwrap();
        assert_eq!(read.manifest.slides, data.manifest.slides);
        assert_eq!(read.slides[0].content["elements"][0]["text"], "B");
        cleanup(&path);
    }

    #[test]
    fn v2_is_protected_before_payload_reads() {
        let path = make_temp_path("v2");
        let manifest = serde_json::to_vec(&serde_json::json!({
            "version": "2.0",
            "created": "c",
            "modified": "m",
            "resources": []
        }))
        .unwrap();
        write_custom_zip(&path, vec![("manifest.json", manifest)]);
        let result = open_file(&path).unwrap();
        let OpenResult::LegacyProtected { version, message } = result else {
            panic!("expected protected legacy result");
        };
        assert_eq!(version, "2.0");
        assert!(message.contains("Legacy .is format version 2.0"));
        assert!(message.contains("not modified"));
        cleanup(&path);
    }

    #[test]
    fn malformed_and_future_versions_fail_before_payload_reads() {
        for (name, manifest, expected) in [
            (
                "missing",
                serde_json::json!({"created": "c"}),
                "Invalid manifest header",
            ),
            (
                "malformed",
                serde_json::json!({"version": "1"}),
                "expected MAJOR.MINOR",
            ),
            (
                "future",
                serde_json::json!({"version": "9.0"}),
                "supports 1.0 only",
            ),
        ] {
            let path = make_temp_path(name);
            write_custom_zip(
                &path,
                vec![("manifest.json", serde_json::to_vec(&manifest).unwrap())],
            );
            assert!(read_file(&path).unwrap_err().contains(expected));
            cleanup(&path);
        }
    }

    #[test]
    fn archive_uses_v1_manifest_and_slide_paths() {
        let path = make_temp_path("shape");
        let data = data_with_pages(&["One", "Two"]);
        write_file(&path, &data).unwrap();
        let bytes = fs::read(&path).unwrap();
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        let manifest: serde_json::Value =
            serde_json::from_str(&read_zip_entry_string(&mut archive, "manifest.json").unwrap())
                .unwrap();
        assert_eq!(manifest["version"], "1.0");
        assert!(manifest.get("resources").is_none());
        assert!(archive.by_name("slides/page-1.json").is_ok());
        assert!(archive.by_name("slides/page-2.json").is_ok());
        assert!(archive.by_name("canvases/page-1.json").is_err());
        cleanup(&path);
    }

    #[test]
    fn replacement_creates_no_backup() {
        let path = make_temp_path("no_backup");
        write_file(&path, &data_with_pages(&["before"])).unwrap();
        write_file(&path, &data_with_pages(&["after"])).unwrap();
        assert!(!path.with_extension("is.bak").exists());
        assert!(!path.with_extension("is.tmp").exists());
        assert_eq!(
            read_file(&path).unwrap().slides[0].content["elements"][0]["text"],
            "after"
        );
        cleanup(&path);
    }

    #[test]
    fn failed_replacement_keeps_original_target_and_cleans_temp() {
        let path = make_temp_path("failed_replace");
        fs::create_dir(&path).unwrap();
        let error = write_file(&path, &data_with_pages(&["content"])).unwrap_err();
        assert!(error.contains("atomically replace"));
        assert!(path.is_dir());
        assert!(!path.with_extension("is.tmp").exists());
        cleanup(&path);
    }

    #[test]
    fn media_roundtrip_remains_compatible() {
        let path = make_temp_path("media");
        let mut data = data_with_pages(&["image"]);
        data.media = vec![MediaEntry {
            id: "img-1".to_string(),
            mime_type: "image/png".to_string(),
            ext: "png".to_string(),
            bytes_base64: encode_base64(b"png"),
        }];
        write_file(&path, &data).unwrap();
        let read = read_file(&path).unwrap();
        assert_eq!(read.media.len(), 1);
        assert_eq!(read.media[0].bytes_base64, encode_base64(b"png"));
        cleanup(&path);
    }

    #[test]
    fn rejects_duplicate_or_missing_page_payloads() {
        let mut data = data_with_pages(&["One"]);
        data.manifest.slides.push(SlideEntry {
            id: "page-1".to_string(),
            title: "Duplicate".to_string(),
        });
        assert!(validate_manifest(&data.manifest)
            .unwrap_err()
            .contains("Duplicate"));

        let mut missing = data_with_pages(&["One"]);
        missing.slides.clear();
        assert!(validate_slide_data(&missing.manifest, &missing.slides)
            .unwrap_err()
            .contains("Missing"));

        let mut unsafe_id = data_with_pages(&["One"]);
        unsafe_id.manifest.slides[0].id = "../page-1".to_string();
        assert!(validate_manifest(&unsafe_id.manifest)
            .unwrap_err()
            .contains("Invalid IdeaSketch Page id"));
    }

    #[test]
    fn reader_rejects_orphan_page_archive_entries() {
        let path = make_temp_path("orphan");
        let manifest = serde_json::to_vec(&data_with_pages(&["One"]).manifest).unwrap();
        write_custom_zip(
            &path,
            vec![
                ("manifest.json", manifest),
                (
                    "slides/page-1.json",
                    serde_json::to_vec(&page_content("One")).unwrap(),
                ),
                (
                    "slides/orphan.json",
                    serde_json::to_vec(&page_content("Orphan")).unwrap(),
                ),
            ],
        );
        assert!(read_file(&path)
            .unwrap_err()
            .contains("Orphan IdeaSketch Page payload"));
        cleanup(&path);
    }

    #[test]
    fn repository_fixtures_lock_v1_and_protected_v2_behavior() {
        let v1_path = make_temp_path("v1_fixture");
        write_custom_zip(
            &v1_path,
            vec![
                (
                    "manifest.json",
                    include_bytes!("../../../tests/fixtures/is-v1/manifest.json").to_vec(),
                ),
                (
                    "slides/page-1.json",
                    include_bytes!("../../../tests/fixtures/is-v1/slide.json").to_vec(),
                ),
            ],
        );
        let v1 = read_file(&v1_path).unwrap();
        assert_eq!(v1.manifest.slides[0].title, "Overview");
        assert_eq!(
            v1.slides[0].content["files"]["image-1"]["mimeType"],
            "image/png"
        );
        cleanup(&v1_path);

        let v2_path = make_temp_path("v2_fixture");
        write_custom_zip(
            &v2_path,
            vec![(
                "manifest.json",
                include_bytes!("../../../tests/fixtures/is-v2/manifest.json").to_vec(),
            )],
        );
        assert!(matches!(
            open_file(&v2_path).unwrap(),
            OpenResult::LegacyProtected { version, .. } if version == "2.0"
        ));
        cleanup(&v2_path);
    }
}
