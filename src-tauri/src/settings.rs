use keyring::{Entry, Error as KeyringError};
use serde::Serialize;

const CREDENTIAL_SERVICE: &str = "com.ideanote.desktop.ai";
const CREDENTIAL_ACCOUNT: &str = "provider-api-key";

fn credential_entry() -> Result<Entry, String> {
    Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT)
        .map_err(|error| format!("Credential vault is unavailable: {error}"))
}

pub(crate) fn read_provider_api_key() -> Result<Option<String>, String> {
    match credential_entry()?.get_password() {
        Ok(value) if value.trim().is_empty() => Ok(None),
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!("Credential could not be read: {error}")),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CredentialStatus {
    configured: bool,
}

#[tauri::command]
pub(crate) fn get_ai_credential_status() -> Result<CredentialStatus, String> {
    Ok(CredentialStatus {
        configured: read_provider_api_key()?.is_some(),
    })
}

#[tauri::command]
pub(crate) fn set_ai_credential(api_key: String) -> Result<CredentialStatus, String> {
    let value = api_key.trim();
    if value.is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    credential_entry()?
        .set_password(value)
        .map_err(|error| format!("Credential could not be stored: {error}"))?;
    Ok(CredentialStatus { configured: true })
}

#[tauri::command]
pub(crate) fn delete_ai_credential() -> Result<CredentialStatus, String> {
    match credential_entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(CredentialStatus { configured: false }),
        Err(error) => Err(format!("Credential could not be removed: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_identifiers_are_application_scoped() {
        assert!(CREDENTIAL_SERVICE.contains("ideanote"));
        assert!(!CREDENTIAL_ACCOUNT.contains("key="));
    }
}
