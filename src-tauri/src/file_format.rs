use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Cursor, Read, Seek, Write};
use std::path::Path;
use zip::write::SimpleFileOptions;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: String,
    pub created: String,
    pub modified: String,
    pub slides: Vec<SlideEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideEntry {
    pub id: String,
    pub title: String,
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
    pub slides: Vec<SlideData>,
    #[serde(default)]
    pub media: Vec<MediaEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideData {
    pub id: String,
    pub content: serde_json::Value,
}

impl Manifest {
    pub fn new() -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            version: "1.0".to_string(),
            created: now.clone(),
            modified: now,
            slides: vec![SlideEntry {
                id: "slide-1".to_string(),
                title: "Untitled 1".to_string(),
            }],
        }
    }
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
            eprintln!("[IdeaSlide] Skip media with invalid id from index: {}", item.id);
            continue;
        }

        if !is_valid_media_ext(&item.ext) {
            eprintln!("[IdeaSlide] Skip media with invalid ext from index: {}", item.ext);
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
                eprintln!("[IdeaSlide] Skip missing/unreadable media {}: {}", item.path, err);
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

fn read_media_from_fallback_scan<R: Read + Seek>(archive: &mut zip::ZipArchive<R>) -> Vec<MediaEntry> {
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
                eprintln!("[IdeaSlide] Skip unreadable fallback media {}: {}", path, err);
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
            eprintln!("[IdeaSlide] media/index.json unavailable, fallback scan: {}", err);
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

/// Create a new .is file at the given path with a single blank slide
pub fn create_is_file(path: &Path) -> Result<IsFileData, String> {
    let manifest = Manifest::new();
    let blank_slide = serde_json::json!({
        "type": "excalidraw",
        "version": 2,
        "elements": [],
        "appState": {},
        "files": {}
    });

    let data = IsFileData {
        manifest: manifest.clone(),
        slides: vec![SlideData {
            id: "slide-1".to_string(),
            content: blank_slide,
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

    // Read manifest
    let manifest: Manifest = {
        let mut entry = archive
            .by_name("manifest.json")
            .map_err(|e| format!("Missing manifest.json: {e}"))?;
        let mut buf = String::new();
        entry
            .read_to_string(&mut buf)
            .map_err(|e| format!("Failed to read manifest: {e}"))?;
        serde_json::from_str(&buf).map_err(|e| format!("Invalid manifest JSON: {e}"))?
    };

    // Read slides
    let mut slides = Vec::new();
    for slide_entry in &manifest.slides {
        let zip_path = format!("slides/{}.json", slide_entry.id);
        let mut entry = archive
            .by_name(&zip_path)
            .map_err(|e| format!("Missing slide {}: {e}", slide_entry.id))?;
        let mut buf = String::new();
        entry
            .read_to_string(&mut buf)
            .map_err(|e| format!("Failed to read slide: {e}"))?;
        let content: serde_json::Value =
            serde_json::from_str(&buf).map_err(|e| format!("Invalid slide JSON: {e}"))?;
        slides.push(SlideData {
            id: slide_entry.id.clone(),
            content,
        });
    }

    let media = read_media_entries(&mut archive);

    Ok(IsFileData {
        manifest,
        slides,
        media,
    })
}

/// Write an IsFileData to a .is file (zip) with atomic replacement
pub fn write_is_file(path: &Path, data: &IsFileData) -> Result<(), String> {
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

        // Write slides
        for slide in &data.slides {
            let zip_path = format!("slides/{}.json", slide.id);
            let slide_json = serde_json::to_string_pretty(&slide.content)
                .map_err(|e| format!("Failed to serialize slide: {e}"))?;
            zip.start_file(&zip_path, options)
                .map_err(|e| format!("Failed to write slide to zip: {e}"))?;
            zip.write_all(slide_json.as_bytes())
                .map_err(|e| format!("Failed to write slide bytes: {e}"))?;
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

        // Keep placeholder directory for future thumbnail support.
        zip.add_directory("thumbnails/", options)
            .map_err(|e| format!("Failed to create thumbnails dir: {e}"))?;

        zip.finish()
            .map_err(|e| format!("Failed to finalize zip: {e}"))?;
    }

    // Atomic write: write to temp file then rename
    let tmp_path = path.with_extension("is.tmp");
    fs::write(&tmp_path, &buf).map_err(|e| format!("Failed to write temp file: {e}"))?;
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

    #[test]
    fn test_manifest_new_has_one_slide() {
        let manifest = Manifest::new();
        assert_eq!(manifest.version, "1.0");
        assert_eq!(manifest.slides.len(), 1);
        assert_eq!(manifest.slides[0].id, "slide-1");
    }

    #[test]
    fn test_manifest_roundtrip_json() {
        let manifest = Manifest::new();
        let json = serde_json::to_string(&manifest).unwrap();
        let parsed: Manifest = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.slides.len(), 1);
        assert_eq!(parsed.version, "1.0");
    }

    #[test]
    fn test_create_and_read_is_file() {
        let path = make_temp_path("create_and_read");

        let created = create_is_file(&path).unwrap();
        assert_eq!(created.slides.len(), 1);
        assert_eq!(created.manifest.slides[0].id, "slide-1");

        let read = read_is_file(&path).unwrap();
        assert_eq!(read.slides.len(), 1);
        assert_eq!(read.manifest.version, "1.0");
        assert_eq!(read.slides[0].content["type"], "excalidraw");
        assert!(read.media.is_empty());

        cleanup_temp_path(&path);
    }

    #[test]
    fn test_roundtrip_with_media() {
        let path = make_temp_path("roundtrip_media");

        let data = IsFileData {
            manifest: Manifest::new(),
            slides: vec![SlideData {
                id: "slide-1".to_string(),
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
        let slide_json = serde_json::to_vec_pretty(&serde_json::json!({
            "type": "excalidraw",
            "version": 2,
            "elements": [],
            "appState": {},
            "files": {}
        }))
        .unwrap();

        write_custom_zip(
            &path,
            vec![
                ("manifest.json", manifest_json),
                ("slides/", vec![]),
                ("slides/slide-1.json", slide_json),
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
            slides: vec![],
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
        let slide_json = serde_json::to_vec_pretty(&serde_json::json!({
            "type": "excalidraw",
            "version": 2,
            "elements": [],
            "appState": {},
            "files": {}
        }))
        .unwrap();
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
                ("slides/", vec![]),
                ("slides/slide-1.json", slide_json),
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
        let slide_json = serde_json::to_vec_pretty(&serde_json::json!({
            "type": "excalidraw",
            "version": 2,
            "elements": [],
            "appState": {},
            "files": {}
        }))
        .unwrap();
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
                ("slides/", vec![]),
                ("slides/slide-1.json", slide_json),
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
        let slide_json = serde_json::to_vec_pretty(&serde_json::json!({
            "type": "excalidraw",
            "version": 2,
            "elements": [],
            "appState": {},
            "files": {}
        }))
        .unwrap();

        write_custom_zip(
            &path,
            vec![
                ("manifest.json", manifest_json),
                ("slides/", vec![]),
                ("slides/slide-1.json", slide_json),
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

        let slide_1 = SlideData {
            id: "slide-1".to_string(),
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

        let slide_2 = SlideData {
            id: "slide-2".to_string(),
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

        let data = IsFileData {
            manifest: Manifest {
                version: "1.0".to_string(),
                created: chrono::Utc::now().to_rfc3339(),
                modified: chrono::Utc::now().to_rfc3339(),
                slides: vec![
                    SlideEntry {
                        id: "slide-1".to_string(),
                        title: "Slide 1".to_string(),
                    },
                    SlideEntry {
                        id: "slide-2".to_string(),
                        title: "Slide 2".to_string(),
                    },
                ],
            },
            slides: vec![slide_1, slide_2],
            media: vec![
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
            ],
        };

        write_is_file(&path, &data).unwrap();

        let bytes = fs::read(&path).unwrap();
        let cursor = Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor).unwrap();

        let index_json = read_zip_entry_string(&mut archive, "media/index.json").unwrap();
        let index_items: Vec<MediaIndexItem> = serde_json::from_str(&index_json).unwrap();

        let index_ids: BTreeSet<String> = index_items.iter().map(|item| item.id.clone()).collect();
        let referenced_ids: BTreeSet<String> = data
            .slides
            .iter()
            .flat_map(|slide| {
                slide
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
