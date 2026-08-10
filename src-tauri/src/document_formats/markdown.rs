use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::safe_write::{self, WriteMode};

const UTF8_BOM: &[u8] = &[0xEF, 0xBB, 0xBF];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MarkdownLineEnding {
    None,
    Lf,
    Crlf,
    Mixed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownFileData {
    pub text: String,
    pub bom: bool,
    pub line_ending: MarkdownLineEnding,
}

fn detect_line_ending(text: &str) -> MarkdownLineEnding {
    let bytes = text.as_bytes();
    let mut lf = 0usize;
    let mut crlf = 0usize;
    for (index, byte) in bytes.iter().enumerate() {
        if *byte != b'\n' {
            continue;
        }
        if index > 0 && bytes[index - 1] == b'\r' {
            crlf += 1;
        } else {
            lf += 1;
        }
    }
    match (lf, crlf) {
        (0, 0) => MarkdownLineEnding::None,
        (0, _) => MarkdownLineEnding::Crlf,
        (_, 0) => MarkdownLineEnding::Lf,
        _ => MarkdownLineEnding::Mixed,
    }
}

fn decode(bytes: Vec<u8>) -> Result<MarkdownFileData, String> {
    let (bom, source) = if bytes.starts_with(UTF8_BOM) {
        (true, &bytes[UTF8_BOM.len()..])
    } else {
        (false, bytes.as_slice())
    };
    let text = String::from_utf8(source.to_vec()).map_err(|_| {
        "Markdown file is not valid UTF-8 and was not opened for editing".to_string()
    })?;
    Ok(MarkdownFileData {
        line_ending: detect_line_ending(&text),
        text,
        bom,
    })
}

fn encode(data: &MarkdownFileData) -> Result<Vec<u8>, String> {
    let detected = detect_line_ending(&data.text);
    if detected != data.line_ending {
        return Err("Markdown line-ending metadata does not match the source".to_string());
    }
    let mut bytes = Vec::with_capacity(data.text.len() + if data.bom { 3 } else { 0 });
    if data.bom {
        bytes.extend_from_slice(UTF8_BOM);
    }
    bytes.extend_from_slice(data.text.as_bytes());
    Ok(bytes)
}

pub fn create_file_with_staging(
    path: &Path,
    staging_directory: &Path,
) -> Result<MarkdownFileData, String> {
    let data = MarkdownFileData {
        text: String::new(),
        bom: false,
        line_ending: MarkdownLineEnding::None,
    };
    safe_write::write_bytes(path, staging_directory, &[], WriteMode::CreateNew)?;
    Ok(data)
}

pub fn open_file(path: &Path) -> Result<MarkdownFileData, String> {
    let bytes = fs::read(path).map_err(|error| format!("Failed to read Markdown file: {error}"))?;
    decode(bytes)
}

#[cfg(test)]
pub fn read_file(path: &Path) -> Result<MarkdownFileData, String> {
    open_file(path)
}

pub fn write_file_with_staging(
    path: &Path,
    data: &MarkdownFileData,
    staging_directory: &Path,
) -> Result<(), String> {
    let bytes = encode(data)?;
    safe_write::write_bytes(path, staging_directory, &bytes, WriteMode::Replace)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn reads_utf8_bom_and_line_endings_without_normalizing() {
        let directory = TempDir::new().unwrap();
        let path = directory.path().join("notes.md");
        fs::write(
            &path,
            [UTF8_BOM, "# Title\r\n\r\nBody\r\n".as_bytes()].concat(),
        )
        .unwrap();

        let data = open_file(&path).unwrap();
        assert!(data.bom);
        assert_eq!(data.line_ending, MarkdownLineEnding::Crlf);
        assert_eq!(data.text, "# Title\r\n\r\nBody\r\n");
    }

    #[test]
    fn invalid_utf8_fails_without_touching_the_source() {
        let directory = TempDir::new().unwrap();
        let path = directory.path().join("invalid.md");
        let bytes = vec![0xff, 0xfe, 0x00];
        fs::write(&path, &bytes).unwrap();

        assert!(open_file(&path).unwrap_err().contains("not valid UTF-8"));
        assert_eq!(fs::read(&path).unwrap(), bytes);
    }

    #[test]
    fn create_and_replace_use_the_supplied_staging_directory() {
        let directory = TempDir::new().unwrap();
        let documents = directory.path().join("documents");
        let staging = directory.path().join(".ideanote/tmp");
        fs::create_dir_all(&documents).unwrap();
        let path = documents.join("notes.md");

        create_file_with_staging(&path, &staging).unwrap();
        let data = MarkdownFileData {
            text: "# Notes\n".to_string(),
            bom: false,
            line_ending: MarkdownLineEnding::Lf,
        };
        write_file_with_staging(&path, &data, &staging).unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "# Notes\n");
        assert_eq!(fs::read_dir(&staging).unwrap().count(), 0);
    }

    #[test]
    fn rejects_inconsistent_line_ending_metadata() {
        let directory = TempDir::new().unwrap();
        let path = directory.path().join("notes.md");
        fs::write(&path, "before").unwrap();
        let data = MarkdownFileData {
            text: "after\r\n".to_string(),
            bom: false,
            line_ending: MarkdownLineEnding::Lf,
        };

        assert!(write_file_with_staging(&path, &data, directory.path()).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "before");
    }
}
