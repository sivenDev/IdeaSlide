use std::fmt;

#[derive(Debug)]
pub enum ToolError {
    FileNotFound(String),
    FileAlreadyExists(String),
    SlideNotFound(String),
    InvalidContent(String),
    InvalidFile(String),
    IoError(String),
    PermissionDenied(String),
    RenderTimeout,
    RenderNotReady,
}

impl fmt::Display for ToolError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::FileNotFound(p) => write!(f, "File not found: {}", p),
            Self::FileAlreadyExists(p) => write!(f, "File already exists: {}", p),
            Self::SlideNotFound(id) => write!(f, "Slide not found: {}", id),
            Self::InvalidContent(msg) => write!(f, "Invalid content: {}", msg),
            Self::InvalidFile(msg) => write!(f, "Invalid .is file: {}", msg),
            Self::IoError(msg) => write!(f, "I/O error: {}", msg),
            Self::PermissionDenied(p) => write!(f, "Permission denied: {}", p),
            Self::RenderTimeout => write!(f, "Render timeout"),
            Self::RenderNotReady => write!(f, "Renderer not ready yet"),
        }
    }
}

impl std::error::Error for ToolError {}

impl From<std::io::Error> for ToolError {
    fn from(e: std::io::Error) -> Self {
        match e.kind() {
            std::io::ErrorKind::NotFound => Self::FileNotFound(e.to_string()),
            std::io::ErrorKind::PermissionDenied => Self::PermissionDenied(e.to_string()),
            _ => Self::IoError(e.to_string()),
        }
    }
}
