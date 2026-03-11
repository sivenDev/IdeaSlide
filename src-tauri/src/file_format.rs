use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Cursor, Read, Write};
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
pub struct IsFileData {
    pub manifest: Manifest,
    pub slides: Vec<SlideData>,
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

    Ok(IsFileData { manifest, slides })
}

/// Write an IsFileData to a .is file (zip) with atomic replacement
pub fn write_is_file(path: &Path, data: &IsFileData) -> Result<(), String> {
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

        // Create empty dirs for media/ and thumbnails/
        zip.add_directory("media/", options)
            .map_err(|e| format!("Failed to create media dir: {e}"))?;
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
        let dir = std::env::temp_dir().join(format!("ideaslide_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("test.is");

        let created = create_is_file(&path).unwrap();
        assert_eq!(created.slides.len(), 1);
        assert_eq!(created.manifest.slides[0].id, "slide-1");

        let read = read_is_file(&path).unwrap();
        assert_eq!(read.slides.len(), 1);
        assert_eq!(read.manifest.version, "1.0");
        assert_eq!(read.slides[0].content["type"], "excalidraw");

        let _ = fs::remove_dir_all(&dir);
    }
}
