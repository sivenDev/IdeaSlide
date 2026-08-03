use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::document_formats::{self, DocumentFileData};
use crate::mcp::error::ToolError;

pub struct FileService {
    locks: Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>,
}

impl FileService {
    pub fn new() -> Self {
        Self {
            locks: Mutex::new(HashMap::new()),
        }
    }

    fn get_lock(&self, path: &Path) -> Arc<Mutex<()>> {
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        let mut locks = self.locks.lock().unwrap();
        locks
            .entry(canonical)
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    pub fn create(&self, path: &Path) -> Result<DocumentFileData, ToolError> {
        let lock = self.get_lock(path);
        let _guard = lock.lock().unwrap();
        if path.exists() {
            return Err(ToolError::FileAlreadyExists(path.display().to_string()));
        }
        document_formats::create_file(path).map_err(ToolError::InvalidFile)
    }

    pub fn read(&self, path: &Path) -> Result<DocumentFileData, ToolError> {
        if !path.exists() {
            return Err(ToolError::FileNotFound(path.display().to_string()));
        }
        document_formats::read_file(path).map_err(ToolError::InvalidFile)
    }

    pub fn write(&self, path: &Path, data: &DocumentFileData) -> Result<(), ToolError> {
        document_formats::write_file(path, data).map_err(ToolError::IoError)
    }

    pub fn read_and_modify<F>(&self, path: &Path, f: F) -> Result<(), ToolError>
    where
        F: FnOnce(&mut DocumentFileData) -> Result<(), ToolError>,
    {
        let lock = self.get_lock(path);
        let _guard = lock.lock().unwrap();
        let mut data = self.read(path)?;
        f(&mut data)?;
        self.write(path, &data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_create_new_file() {
        let svc = FileService::new();
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.is");
        let result = svc.create(&path);
        assert!(result.is_ok());
        assert!(path.exists());
    }

    #[test]
    fn test_create_file_already_exists() {
        let svc = FileService::new();
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.is");
        svc.create(&path).unwrap();
        let result = svc.create(&path);
        assert!(matches!(result, Err(ToolError::FileAlreadyExists(_))));
    }

    #[test]
    fn test_read_nonexistent_file() {
        let svc = FileService::new();
        let result = svc.read(Path::new("/tmp/nonexistent_abc123.is"));
        assert!(matches!(result, Err(ToolError::FileNotFound(_))));
    }

    #[test]
    fn test_read_and_modify() {
        let svc = FileService::new();
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.is");
        svc.create(&path).unwrap();

        svc.read_and_modify(&path, |data| {
            let data = data.as_idea_sketch().map_err(ToolError::InvalidContent)?;
            assert_eq!(data.slides.len(), 1);
            assert_eq!(data.manifest.slides.len(), 1);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn test_read_and_modify_updates_timestamp() {
        let svc = FileService::new();
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.is");
        let created = svc.create(&path).unwrap();
        let original_modified = created.as_idea_sketch().unwrap().manifest.modified.clone();

        std::thread::sleep(std::time::Duration::from_millis(10));

        svc.read_and_modify(&path, |_data| Ok(())).unwrap();

        let updated = svc.read(&path).unwrap();
        assert_ne!(
            updated.as_idea_sketch().unwrap().manifest.modified,
            original_modified
        );
    }
}
