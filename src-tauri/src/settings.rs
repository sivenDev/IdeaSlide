use std::fs;
use std::path::{Path, PathBuf};

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng, Payload};
use aes_gcm::Aes256Gcm;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use tauri::Manager;
use zeroize::{Zeroize, Zeroizing};

use crate::safe_write::{self, WriteMode};

const CREDENTIAL_SCHEMA_VERSION: u8 = 1;
const CREDENTIAL_ALGORITHM: &str = "AES-256-GCM";
const CREDENTIAL_AAD: &[u8] = b"ideanote-ai-provider-credential-v1";
const MAX_API_KEY_BYTES: usize = 32 * 1024;
const ENVELOPE_FILE_NAME: &str = "ai-provider.json";
const KEY_FILE_NAME: &str = "master.key";

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CredentialEnvelope {
    schema_version: u8,
    algorithm: String,
    nonce: String,
    ciphertext: String,
}

struct CredentialRepository {
    root: PathBuf,
}

impl CredentialRepository {
    fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn envelope_path(&self) -> PathBuf {
        self.root.join(ENVELOPE_FILE_NAME)
    }

    fn key_path(&self) -> PathBuf {
        self.root.join(KEY_FILE_NAME)
    }

    fn staging_dir(&self) -> PathBuf {
        self.root.join(".tmp")
    }

    fn load(&self) -> Result<Option<String>, String> {
        validate_private_directory_if_present(&self.root)?;
        let envelope_path = self.envelope_path();
        let key_path = self.key_path();
        let envelope_exists = validate_private_file_if_present(&envelope_path)?;
        let key_exists = validate_private_file_if_present(&key_path)?;
        if !envelope_exists && !key_exists {
            return Ok(None);
        }
        if !envelope_exists || !key_exists {
            return Err(
                "Encrypted AI credential is incomplete. Remove it and save the API key again."
                    .to_string(),
            );
        }

        let envelope_bytes = fs::read(&envelope_path)
            .map_err(|_| "Encrypted AI credential could not be read.".to_string())?;
        if envelope_bytes.len() > MAX_API_KEY_BYTES * 2 {
            return Err("Encrypted AI credential exceeds the supported size.".to_string());
        }
        let envelope = serde_json::from_slice::<CredentialEnvelope>(&envelope_bytes)
            .map_err(|_| "Encrypted AI credential is invalid.".to_string())?;
        if envelope.schema_version != CREDENTIAL_SCHEMA_VERSION
            || envelope.algorithm != CREDENTIAL_ALGORITHM
        {
            return Err("Encrypted AI credential uses an unsupported format.".to_string());
        }

        let key = Zeroizing::new(
            fs::read(&key_path)
                .map_err(|_| "Encrypted AI credential key could not be read.".to_string())?,
        );
        if key.len() != 32 {
            return Err("Encrypted AI credential key is invalid.".to_string());
        }
        let nonce = BASE64
            .decode(envelope.nonce)
            .map_err(|_| "Encrypted AI credential is invalid.".to_string())?;
        if nonce.len() != 12 {
            return Err("Encrypted AI credential nonce is invalid.".to_string());
        }
        let ciphertext = BASE64
            .decode(envelope.ciphertext)
            .map_err(|_| "Encrypted AI credential is invalid.".to_string())?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|_| "Encrypted AI credential key is invalid.".to_string())?;
        let plaintext = Zeroizing::new(
            cipher
                .decrypt(
                    nonce.as_slice().into(),
                    Payload {
                        msg: &ciphertext,
                        aad: CREDENTIAL_AAD,
                    },
                )
                .map_err(|_| "Encrypted AI credential could not be decrypted.".to_string())?,
        );
        let value = std::str::from_utf8(&plaintext)
            .map_err(|_| "Encrypted AI credential contains invalid text.".to_string())?
            .to_string();
        if value.trim().is_empty() || value.len() > MAX_API_KEY_BYTES {
            return Err("Encrypted AI credential contains an invalid API key.".to_string());
        }
        Ok(Some(value))
    }

    fn save(&self, api_key: &str) -> Result<(), String> {
        let value = api_key.trim();
        if value.is_empty() {
            return Err("API key cannot be empty".to_string());
        }
        if value.len() > MAX_API_KEY_BYTES {
            return Err("API key exceeds the supported size".to_string());
        }
        ensure_private_directory(&self.root)?;
        ensure_private_directory(&self.staging_dir())?;

        let key_path = self.key_path();
        let key = if validate_private_file_if_present(&key_path)? {
            let existing = Zeroizing::new(
                fs::read(&key_path)
                    .map_err(|_| "Encrypted AI credential key could not be read.".to_string())?,
            );
            if existing.len() != 32 {
                return Err(
                    "Encrypted AI credential key is invalid. Remove the credential and save it again."
                        .to_string(),
                );
            }
            existing
        } else {
            let generated = Aes256Gcm::generate_key(&mut OsRng);
            let generated = Zeroizing::new(generated.to_vec());
            safe_write::write_bytes(
                &key_path,
                &self.staging_dir(),
                &generated,
                WriteMode::CreateNew,
            )?;
            set_private_file(&key_path)?;
            generated
        };

        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|_| "Encrypted AI credential key is invalid.".to_string())?;
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = cipher
            .encrypt(
                &nonce,
                Payload {
                    msg: value.as_bytes(),
                    aad: CREDENTIAL_AAD,
                },
            )
            .map_err(|_| "AI credential could not be encrypted.".to_string())?;
        let envelope = CredentialEnvelope {
            schema_version: CREDENTIAL_SCHEMA_VERSION,
            algorithm: CREDENTIAL_ALGORITHM.to_string(),
            nonce: BASE64.encode(nonce),
            ciphertext: BASE64.encode(ciphertext),
        };
        let bytes = serde_json::to_vec_pretty(&envelope)
            .map_err(|_| "Encrypted AI credential could not be encoded.".to_string())?;
        let envelope_path = self.envelope_path();
        safe_write::write_bytes(
            &envelope_path,
            &self.staging_dir(),
            &bytes,
            WriteMode::Replace,
        )?;
        set_private_file(&envelope_path)?;
        Ok(())
    }

    fn delete(&self) -> Result<(), String> {
        remove_if_exists(&self.envelope_path())?;
        remove_if_exists(&self.key_path())?;
        Ok(())
    }
}

fn credential_repository(app_handle: &tauri::AppHandle) -> Result<CredentialRepository, String> {
    let root = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| format!("Application configuration directory is unavailable: {error}"))?
        .join("credentials");
    Ok(CredentialRepository::new(root))
}

fn remove_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("Encrypted AI credential could not be removed.".to_string()),
    }
}

fn ensure_private_directory(path: &Path) -> Result<(), String> {
    validate_private_directory_if_present(path)?;
    fs::create_dir_all(path)
        .map_err(|_| "Encrypted AI credential directory could not be created.".to_string())?;
    set_private_directory(path)
}

fn validate_private_directory_if_present(path: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(_) => {
            return Err("Encrypted AI credential directory could not be inspected.".to_string())
        }
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Encrypted AI credential directory is invalid.".to_string());
    }
    validate_private_permissions(&metadata, true)
}

fn validate_private_file_if_present(path: &Path) -> Result<bool, String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(_) => return Err("Encrypted AI credential file could not be inspected.".to_string()),
    };
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Encrypted AI credential file is invalid.".to_string());
    }
    validate_private_permissions(&metadata, false)?;
    Ok(true)
}

#[cfg(unix)]
fn validate_private_permissions(metadata: &fs::Metadata, directory: bool) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let expected = if directory { 0o700 } else { 0o600 };
    if metadata.permissions().mode() & 0o777 != expected {
        return Err("Encrypted AI credential permissions are not private.".to_string());
    }
    Ok(())
}

#[cfg(not(unix))]
fn validate_private_permissions(_metadata: &fs::Metadata, _directory: bool) -> Result<(), String> {
    Ok(())
}

#[cfg(unix)]
fn set_private_directory(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|_| "Encrypted AI credential directory permissions could not be set.".to_string())
}

#[cfg(not(unix))]
fn set_private_directory(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(unix)]
fn set_private_file(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .map_err(|_| "Encrypted AI credential file permissions could not be set.".to_string())
}

#[cfg(not(unix))]
fn set_private_file(_path: &Path) -> Result<(), String> {
    Ok(())
}

pub(crate) fn read_provider_api_key(
    app_handle: &tauri::AppHandle,
) -> Result<Option<String>, String> {
    credential_repository(app_handle)?.load()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CredentialStatus {
    configured: bool,
}

#[tauri::command]
pub(crate) fn get_ai_credential_status(
    app_handle: tauri::AppHandle,
) -> Result<CredentialStatus, String> {
    let mut credential = read_provider_api_key(&app_handle)?;
    let configured = credential.is_some();
    if let Some(value) = credential.as_mut() {
        value.zeroize();
    }
    Ok(CredentialStatus { configured })
}

#[tauri::command]
pub(crate) fn set_ai_credential(
    app_handle: tauri::AppHandle,
    api_key: String,
) -> Result<CredentialStatus, String> {
    let mut api_key = Zeroizing::new(api_key);
    let result = credential_repository(&app_handle)?.save(api_key.trim());
    api_key.zeroize();
    result?;
    Ok(CredentialStatus { configured: true })
}

#[tauri::command]
pub(crate) fn delete_ai_credential(
    app_handle: tauri::AppHandle,
) -> Result<CredentialStatus, String> {
    credential_repository(&app_handle)?.delete()?;
    Ok(CredentialStatus { configured: false })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn repository(root: &TempDir) -> CredentialRepository {
        CredentialRepository::new(root.path().join("credentials"))
    }

    #[test]
    fn credential_round_trip_is_encrypted_replaceable_and_removable() {
        let root = TempDir::new().unwrap();
        let repository = repository(&root);

        repository.save("test-token-one").unwrap();
        assert_eq!(
            repository.load().unwrap().as_deref(),
            Some("test-token-one")
        );
        let first = fs::read_to_string(repository.envelope_path()).unwrap();
        assert!(!first.contains("test-token-one"));
        let first_envelope: CredentialEnvelope = serde_json::from_str(&first).unwrap();

        repository.save("test-token-two").unwrap();
        assert_eq!(
            repository.load().unwrap().as_deref(),
            Some("test-token-two")
        );
        let second = fs::read_to_string(repository.envelope_path()).unwrap();
        assert!(!second.contains("test-token-two"));
        let second_envelope: CredentialEnvelope = serde_json::from_str(&second).unwrap();
        assert_ne!(first_envelope.nonce, second_envelope.nonce);
        assert_ne!(first, second);

        repository.delete().unwrap();
        assert_eq!(repository.load().unwrap(), None);
    }

    #[test]
    fn malformed_partial_and_tampered_credentials_fail_without_secret_details() {
        let root = TempDir::new().unwrap();
        let repository = repository(&root);
        ensure_private_directory(&repository.root).unwrap();
        fs::write(repository.key_path(), [7_u8; 32]).unwrap();
        set_private_file(&repository.key_path()).unwrap();
        let partial = repository.load().unwrap_err();
        assert!(partial.contains("incomplete"));
        assert!(!partial.contains("test-token"));

        repository.save("test-token").unwrap();
        let mut envelope: CredentialEnvelope =
            serde_json::from_slice(&fs::read(repository.envelope_path()).unwrap()).unwrap();
        envelope.ciphertext = BASE64.encode(b"tampered");
        fs::write(
            repository.envelope_path(),
            serde_json::to_vec_pretty(&envelope).unwrap(),
        )
        .unwrap();
        let tampered = repository.load().unwrap_err();
        assert!(tampered.contains("could not be decrypted"));
        assert!(!tampered.contains("test-token"));
    }

    #[test]
    fn empty_and_oversized_credentials_are_rejected() {
        let root = TempDir::new().unwrap();
        let repository = repository(&root);
        assert!(repository.save("  ").unwrap_err().contains("empty"));
        assert!(repository
            .save(&"x".repeat(MAX_API_KEY_BYTES + 1))
            .unwrap_err()
            .contains("supported size"));
    }

    #[test]
    fn corrupt_and_invalidly_encoded_envelopes_fail_with_redacted_errors() {
        let root = TempDir::new().unwrap();
        let repository = repository(&root);
        repository.save("test-token").unwrap();

        fs::write(repository.envelope_path(), b"{").unwrap();
        let malformed = repository.load().unwrap_err();
        assert!(malformed.contains("invalid"));
        assert!(!malformed.contains("test-token"));

        repository.save("test-token").unwrap();
        let mut envelope: CredentialEnvelope =
            serde_json::from_slice(&fs::read(repository.envelope_path()).unwrap()).unwrap();
        envelope.nonce = "not-base64".to_string();
        fs::write(
            repository.envelope_path(),
            serde_json::to_vec_pretty(&envelope).unwrap(),
        )
        .unwrap();
        let invalid_base64 = repository.load().unwrap_err();
        assert!(invalid_base64.contains("invalid"));
        assert!(!invalid_base64.contains("test-token"));

        repository.save("test-token").unwrap();
        fs::remove_file(repository.key_path()).unwrap();
        let missing_key = repository.load().unwrap_err();
        assert!(missing_key.contains("incomplete"));
        assert!(!missing_key.contains("test-token"));
    }

    #[cfg(unix)]
    #[test]
    fn credential_files_and_directories_are_current_user_only() {
        use std::os::unix::fs::PermissionsExt;

        let root = TempDir::new().unwrap();
        let repository = repository(&root);
        repository.save("test-token").unwrap();

        assert_eq!(
            fs::metadata(&repository.root).unwrap().permissions().mode() & 0o777,
            0o700
        );
        assert_eq!(
            fs::metadata(repository.key_path())
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
        assert_eq!(
            fs::metadata(repository.envelope_path())
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }

    #[cfg(unix)]
    #[test]
    fn unsafe_permissions_and_symlinked_files_are_rejected_before_reading() {
        use std::os::unix::fs::{symlink, PermissionsExt};

        let root = TempDir::new().unwrap();
        let repository = repository(&root);
        repository.save("test-token").unwrap();

        fs::set_permissions(repository.key_path(), fs::Permissions::from_mode(0o644)).unwrap();
        assert!(repository
            .load()
            .unwrap_err()
            .contains("permissions are not private"));

        fs::remove_file(repository.key_path()).unwrap();
        let external = root.path().join("external.key");
        fs::write(&external, [9_u8; 32]).unwrap();
        symlink(&external, repository.key_path()).unwrap();
        assert!(repository.load().unwrap_err().contains("file is invalid"));
    }
}
