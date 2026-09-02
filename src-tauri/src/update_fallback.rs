use serde::Serialize;
use std::time::Duration;
use tauri::{ipc::Channel, Manager, Resource, ResourceId, Runtime, Webview};
use tauri_plugin_updater::{Update, UpdaterExt};
use url::Url;

const OFFICIAL_MANIFEST_ENDPOINT: &str =
    "https://github.com/sivenDev/IdeaSlide/releases/latest/download/latest.json";
const UPDATE_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OfficialUpdateMetadata {
    rid: ResourceId,
    current_version: String,
    version: String,
    date: Option<String>,
    body: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub(crate) enum OfficialDownloadEvent {
    #[serde(rename_all = "camelCase")]
    Started { content_length: Option<u64> },
    #[serde(rename_all = "camelCase")]
    Progress { chunk_length: usize },
    Finished,
}

struct DownloadedBytes(Vec<u8>);
impl Resource for DownloadedBytes {}

fn command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[tauri::command]
pub(crate) async fn check_official_update<R: Runtime>(
    webview: Webview<R>,
    expected_version: String,
) -> Result<Option<OfficialUpdateMetadata>, String> {
    let expected_version = expected_version.trim();
    if expected_version.is_empty() {
        return Err("An expected update version is required.".to_string());
    }
    let endpoint = Url::parse(OFFICIAL_MANIFEST_ENDPOINT).map_err(command_error)?;
    let updater = webview
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(command_error)?
        .timeout(UPDATE_TIMEOUT)
        .build()
        .map_err(command_error)?;
    let update = updater.check().await.map_err(command_error)?;
    let Some(update) = update else {
        return Ok(None);
    };
    if update.version != expected_version {
        return Err(format!(
            "Official update version {} does not match the expected version {}.",
            update.version, expected_version
        ));
    }
    let date = update
        .date
        .map(|value| {
            value
                .format(&time::format_description::well_known::Rfc3339)
                .map_err(|_| "Failed to format the official update date.".to_string())
        })
        .transpose()?;
    let metadata = OfficialUpdateMetadata {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        date,
        body: update.body.clone(),
        rid: webview.resources_table().add(update),
    };
    Ok(Some(metadata))
}

#[tauri::command]
pub(crate) async fn download_official_update<R: Runtime>(
    webview: Webview<R>,
    rid: ResourceId,
    on_event: Channel<OfficialDownloadEvent>,
) -> Result<ResourceId, String> {
    let update = webview
        .resources_table()
        .get::<Update>(rid)
        .map_err(command_error)?;
    let mut first_chunk = true;
    let bytes = update
        .download(
            |chunk_length, content_length| {
                if first_chunk {
                    first_chunk = false;
                    let _ = on_event.send(OfficialDownloadEvent::Started { content_length });
                }
                let _ = on_event.send(OfficialDownloadEvent::Progress { chunk_length });
            },
            || {
                let _ = on_event.send(OfficialDownloadEvent::Finished);
            },
        )
        .await
        .map_err(command_error)?;
    Ok(webview.resources_table().add(DownloadedBytes(bytes)))
}

#[tauri::command]
pub(crate) fn install_official_update<R: Runtime>(
    webview: Webview<R>,
    update_rid: ResourceId,
    bytes_rid: ResourceId,
) -> Result<(), String> {
    let update = webview
        .resources_table()
        .get::<Update>(update_rid)
        .map_err(command_error)?;
    let bytes = webview
        .resources_table()
        .get::<DownloadedBytes>(bytes_rid)
        .map_err(command_error)?;
    update.install(&bytes.0).map_err(command_error)?;
    let _ = webview.resources_table().take::<DownloadedBytes>(bytes_rid);
    let _ = webview.resources_table().take::<Update>(update_rid);
    Ok(())
}

#[tauri::command]
pub(crate) fn close_official_update<R: Runtime>(
    webview: Webview<R>,
    update_rid: ResourceId,
    bytes_rid: Option<ResourceId>,
) -> Result<(), String> {
    if let Some(bytes_rid) = bytes_rid {
        let _ = webview
            .resources_table()
            .take::<DownloadedBytes>(bytes_rid);
    }
    let _ = webview.resources_table().take::<Update>(update_rid);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{OFFICIAL_MANIFEST_ENDPOINT, UPDATE_TIMEOUT};

    #[test]
    fn official_endpoint_is_the_canonical_github_manifest() {
        assert_eq!(
            OFFICIAL_MANIFEST_ENDPOINT,
            "https://github.com/sivenDev/IdeaSlide/releases/latest/download/latest.json"
        );
        assert_eq!(UPDATE_TIMEOUT.as_secs(), 30);
    }
}
