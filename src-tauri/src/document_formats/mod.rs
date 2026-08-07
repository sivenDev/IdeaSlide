pub mod idea_sketch;

use std::path::Path;

use serde::{Deserialize, Serialize};

pub use idea_sketch::IdeaSketchFileData;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum DocumentFileData {
    #[serde(rename = "ideasketch")]
    IdeaSketch(IdeaSketchFileData),
}

impl DocumentFileData {
    pub fn as_idea_sketch(&self) -> Result<&IdeaSketchFileData, String> {
        match self {
            Self::IdeaSketch(data) => Ok(data),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum OpenDocumentResult {
    Editable {
        document: DocumentFileData,
    },
    LegacyProtected {
        #[serde(rename = "fileType")]
        file_type: &'static str,
        version: String,
        message: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocumentFormatKind {
    IdeaSketch,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DocumentFormatDefinition {
    pub type_id: &'static str,
    pub display_name: &'static str,
    pub extensions: &'static [&'static str],
    pub openable: bool,
    pub kind: DocumentFormatKind,
}

pub const DOCUMENT_FORMATS: &[DocumentFormatDefinition] = &[DocumentFormatDefinition {
    type_id: "ideasketch",
    display_name: "IdeaSketch",
    extensions: &["is"],
    openable: true,
    kind: DocumentFormatKind::IdeaSketch,
}];

pub fn definition_for_path(path: &Path) -> Option<&'static DocumentFormatDefinition> {
    let extension = path.extension()?.to_str()?;
    DOCUMENT_FORMATS.iter().find(|definition| {
        definition
            .extensions
            .iter()
            .any(|candidate| candidate.eq_ignore_ascii_case(extension))
    })
}

pub fn definition_for_type(type_id: &str) -> Option<&'static DocumentFormatDefinition> {
    DOCUMENT_FORMATS
        .iter()
        .find(|definition| definition.type_id.eq_ignore_ascii_case(type_id))
}

pub fn is_openable_path(path: &Path) -> bool {
    definition_for_path(path).is_some_and(|definition| definition.openable)
}

fn require_definition(path: &Path) -> Result<&'static DocumentFormatDefinition, String> {
    definition_for_path(path).ok_or_else(|| {
        format!(
            "Unsupported file type: {}",
            path.file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("(unknown)")
        )
    })
}

pub fn create_file(path: &Path) -> Result<DocumentFileData, String> {
    let staging_directory = path
        .parent()
        .ok_or_else(|| "Document path has no parent".to_string())?;
    create_file_with_staging(path, staging_directory)
}

pub fn create_file_with_staging(
    path: &Path,
    staging_directory: &Path,
) -> Result<DocumentFileData, String> {
    match require_definition(path)?.kind {
        DocumentFormatKind::IdeaSketch => {
            idea_sketch::create_file_with_staging(path, staging_directory)
                .map(DocumentFileData::IdeaSketch)
        }
    }
}

pub fn open_file(path: &Path) -> Result<OpenDocumentResult, String> {
    match require_definition(path)?.kind {
        DocumentFormatKind::IdeaSketch => match idea_sketch::open_file(path)? {
            idea_sketch::OpenResult::Editable(data) => Ok(OpenDocumentResult::Editable {
                document: DocumentFileData::IdeaSketch(data),
            }),
            idea_sketch::OpenResult::LegacyProtected { version, message } => {
                Ok(OpenDocumentResult::LegacyProtected {
                    file_type: "ideasketch",
                    version,
                    message,
                })
            }
        },
    }
}

#[cfg(test)]
pub fn read_file(path: &Path) -> Result<DocumentFileData, String> {
    match require_definition(path)?.kind {
        DocumentFormatKind::IdeaSketch => {
            idea_sketch::read_file(path).map(DocumentFileData::IdeaSketch)
        }
    }
}

pub fn write_file(path: &Path, data: &DocumentFileData) -> Result<(), String> {
    let staging_directory = path
        .parent()
        .ok_or_else(|| "Document path has no parent".to_string())?;
    write_file_with_staging(path, data, staging_directory)
}

pub fn write_file_with_staging(
    path: &Path,
    data: &DocumentFileData,
    staging_directory: &Path,
) -> Result<(), String> {
    match require_definition(path)?.kind {
        DocumentFormatKind::IdeaSketch => {
            idea_sketch::write_file_with_staging(path, data.as_idea_sketch()?, staging_directory)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_resolves_ideasketch_case_insensitively() {
        let definition = definition_for_path(Path::new("DRAWING.IS")).unwrap();
        assert_eq!(definition.type_id, "ideasketch");
        assert!(definition.openable);
        assert_eq!(definition.kind, DocumentFormatKind::IdeaSketch);
    }

    #[test]
    fn registry_rejects_unregistered_extensions() {
        assert!(definition_for_path(Path::new("notes.md")).is_none());
        assert!(read_file(Path::new("notes.md"))
            .unwrap_err()
            .contains("Unsupported file type"));
    }

    #[test]
    fn registry_resolves_type_ids_for_workspace_creation() {
        let definition = definition_for_type("IDEASKETCH").unwrap();
        assert_eq!(definition.extensions, ["is"]);
    }

    #[test]
    fn generic_document_envelope_keeps_format_details_tagged() {
        let document = DocumentFileData::IdeaSketch(idea_sketch::IdeaSketchFileData {
            manifest: idea_sketch::Manifest::new(),
            slides: vec![idea_sketch::SlideData {
                id: "page-1".to_string(),
                content: serde_json::json!({}),
            }],
            media: vec![],
        });
        let value = serde_json::to_value(document).unwrap();
        assert_eq!(value["type"], "ideasketch");
        assert_eq!(value["data"]["manifest"]["version"], "1.0");

        let protected = OpenDocumentResult::LegacyProtected {
            file_type: "ideasketch",
            version: "2.0".to_string(),
            message: "Legacy Workspace".to_string(),
        };
        let value = serde_json::to_value(protected).unwrap();
        assert_eq!(value["status"], "legacy-protected");
        assert_eq!(value["fileType"], "ideasketch");
    }
}
