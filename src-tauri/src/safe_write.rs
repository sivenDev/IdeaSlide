use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteMode {
    CreateNew,
    Replace,
}

fn staging_path(target: &Path, staging_directory: &Path) -> Result<PathBuf, String> {
    let file_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Target file name is invalid".to_string())?;
    Ok(staging_directory.join(format!(".{file_name}.{}.tmp", uuid::Uuid::new_v4())))
}

fn sync_directory(path: &Path) {
    if let Ok(directory) = File::open(path) {
        let _ = directory.sync_all();
    }
}

pub fn write_bytes(
    target: &Path,
    staging_directory: &Path,
    bytes: &[u8],
    mode: WriteMode,
) -> Result<(), String> {
    let target_parent = target
        .parent()
        .ok_or_else(|| "Target path has no parent".to_string())?;
    fs::create_dir_all(target_parent)
        .map_err(|error| format!("Failed to create target directory: {error}"))?;
    fs::create_dir_all(staging_directory)
        .map_err(|error| format!("Failed to create staging directory: {error}"))?;

    let temp_path = staging_path(target, staging_directory)?;
    let result = (|| -> Result<(), String> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .map_err(|error| format!("Failed to create temporary file: {error}"))?;
        file.write_all(bytes)
            .map_err(|error| format!("Failed to write temporary file: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Failed to sync temporary file: {error}"))?;
        drop(file);

        match mode {
            WriteMode::Replace => fs::rename(&temp_path, target)
                .map_err(|error| format!("Failed to atomically replace file: {error}"))?,
            WriteMode::CreateNew => {
                fs::hard_link(&temp_path, target)
                    .map_err(|error| format!("Failed to atomically create new file: {error}"))?;
                fs::remove_file(&temp_path).map_err(|error| {
                    format!("Failed to remove committed temporary file: {error}")
                })?;
            }
        }

        sync_directory(target_parent);
        if staging_directory != target_parent {
            sync_directory(staging_directory);
        }
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn stages_outside_target_directory_and_cleans_after_replace() {
        let root = TempDir::new().unwrap();
        let target_directory = root.path().join("documents");
        let staging_directory = root.path().join(".ideanote/tmp");
        fs::create_dir_all(&target_directory).unwrap();
        let target = target_directory.join("drawing.is");
        fs::write(&target, b"before").unwrap();

        write_bytes(&target, &staging_directory, b"after", WriteMode::Replace).unwrap();

        assert_eq!(fs::read(&target).unwrap(), b"after");
        assert_eq!(fs::read_dir(&target_directory).unwrap().count(), 1);
        assert_eq!(fs::read_dir(&staging_directory).unwrap().count(), 0);
    }

    #[test]
    fn create_new_never_clobbers_and_failed_replace_preserves_target() {
        let root = TempDir::new().unwrap();
        let staging_directory = root.path().join("tmp");
        let target = root.path().join("existing.is");
        fs::write(&target, b"original").unwrap();

        assert!(write_bytes(&target, &staging_directory, b"new", WriteMode::CreateNew).is_err());
        assert_eq!(fs::read(&target).unwrap(), b"original");

        let directory_target = root.path().join("directory.is");
        fs::create_dir(&directory_target).unwrap();
        assert!(write_bytes(
            &directory_target,
            &staging_directory,
            b"replacement",
            WriteMode::Replace,
        )
        .is_err());
        assert!(directory_target.is_dir());
        assert_eq!(fs::read_dir(&staging_directory).unwrap().count(), 0);
    }
}
