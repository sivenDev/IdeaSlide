pub mod idea_sketch;
pub mod markdown;

use std::path::Path;

use serde::{Deserialize, Serialize};

pub use idea_sketch::IdeaSketchFileData;
pub use markdown::MarkdownFileData;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum DocumentFileData {
    #[serde(rename = "ideasketch")]
    IdeaSketch(IdeaSketchFileData),
    #[serde(rename = "markdown")]
    Markdown(MarkdownFileData),
}

impl DocumentFileData {
    pub fn as_idea_sketch(&self) -> Result<&IdeaSketchFileData, String> {
        match self {
            Self::IdeaSketch(data) => Ok(data),
            Self::Markdown(_) => Err("Document payload is not IdeaSketch".to_string()),
        }
    }

    pub fn as_markdown(&self) -> Result<&MarkdownFileData, String> {
        match self {
            Self::Markdown(data) => Ok(data),
            Self::IdeaSketch(_) => Err("Document payload is not Markdown".to_string()),
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
    Markdown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DocumentFormatDefinition {
    pub type_id: &'static str,
    pub display_name: &'static str,
    pub extensions: &'static [&'static str],
    pub openable: bool,
    pub kind: DocumentFormatKind,
}

pub const DOCUMENT_FORMATS: &[DocumentFormatDefinition] = &[
    DocumentFormatDefinition {
        type_id: "ideasketch",
        display_name: "IdeaSketch",
        extensions: &["is"],
        openable: true,
        kind: DocumentFormatKind::IdeaSketch,
    },
    DocumentFormatDefinition {
        type_id: "markdown",
        display_name: "Markdown",
        extensions: &["md"],
        openable: true,
        kind: DocumentFormatKind::Markdown,
    },
];

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
        DocumentFormatKind::Markdown => markdown::create_file_with_staging(path, staging_directory)
            .map(DocumentFileData::Markdown),
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
        DocumentFormatKind::Markdown => Ok(OpenDocumentResult::Editable {
            document: DocumentFileData::Markdown(markdown::open_file(path)?),
        }),
    }
}

#[cfg(test)]
pub fn read_file(path: &Path) -> Result<DocumentFileData, String> {
    match require_definition(path)?.kind {
        DocumentFormatKind::IdeaSketch => {
            idea_sketch::read_file(path).map(DocumentFileData::IdeaSketch)
        }
        DocumentFormatKind::Markdown => markdown::read_file(path).map(DocumentFileData::Markdown),
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
        DocumentFormatKind::Markdown => {
            markdown::write_file_with_staging(path, data.as_markdown()?, staging_directory)
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
        assert!(definition_for_path(Path::new("notes.txt")).is_none());
        assert!(read_file(Path::new("notes.txt"))
            .unwrap_err()
            .contains("Unsupported file type"));
    }

    #[test]
    fn registry_resolves_markdown_case_insensitively() {
        let definition = definition_for_path(Path::new("README.MD")).unwrap();
        assert_eq!(definition.type_id, "markdown");
        assert_eq!(definition.kind, DocumentFormatKind::Markdown);
    }

    #[test]
    fn registry_resolves_type_ids_for_workspace_creation() {
        let definition = definition_for_type("IDEASKETCH").unwrap();
        assert_eq!(definition.extensions, ["is"]);
        let markdown = definition_for_type("MARKDOWN").unwrap();
        assert_eq!(markdown.extensions, ["md"]);
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

        let markdown = DocumentFileData::Markdown(markdown::MarkdownFileData {
            text: "# Notes\n".to_string(),
            bom: false,
            line_ending: markdown::MarkdownLineEnding::Lf,
        });
        let value = serde_json::to_value(markdown).unwrap();
        assert_eq!(value["type"], "markdown");
        assert_eq!(value["data"]["text"], "# Notes\n");
    }
}
