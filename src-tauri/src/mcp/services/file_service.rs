use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::Utc;

use crate::file_format::{self, IsFileData};
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
        locks.entry(canonical).or_insert_with(|| Arc::new(Mutex::new(()))).clone()
    }

    pub fn create(&self, path: &Path) -> Result<IsFileData, ToolError> {
        let lock = self.get_lock(path);
        let _guard = lock.lock().unwrap();
        if path.exists() {
            return Err(ToolError::FileAlreadyExists(path.display().to_string()));
        }
        file_format::create_is_file(path).map_err(|e| ToolError::InvalidFile(e))
    }

    pub fn read(&self, path: &Path) -> Result<IsFileData, ToolError> {
        if !path.exists() {
            return Err(ToolError::FileNotFound(path.display().to_string()));
        }
        file_format::read_is_file(path).map_err(|e| ToolError::InvalidFile(e))
    }

    pub fn write(&self, path: &Path, data: &IsFileData) -> Result<(), ToolError> {
        file_format::write_is_file(path, data).map_err(|e| ToolError::IoError(e))
    }

    pub fn read_and_modify<F>(&self, path: &Path, f: F) -> Result<(), ToolError>
    where
        F: FnOnce(&mut IsFileData) -> Result<(), ToolError>,
    {
        let lock = self.get_lock(path);
        let _guard = lock.lock().unwrap();
        let mut data = self.read(path)?;
        f(&mut data)?;
        data.manifest.modified = Utc::now().to_rfc3339();
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
            assert_eq!(data.slides.len(), 1);
            Ok(())
        }).unwrap();
    }

    #[test]
    fn test_read_and_modify_updates_timestamp() {
        let svc = FileService::new();
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.is");
        let created = svc.create(&path).unwrap();
        let original_modified = created.manifest.modified.clone();

        std::thread::sleep(std::time::Duration::from_millis(10));

        svc.read_and_modify(&path, |_data| Ok(())).unwrap();

        let updated = svc.read(&path).unwrap();
        assert_ne!(updated.manifest.modified, original_modified);
    }
}
