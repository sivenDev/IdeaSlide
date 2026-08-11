use std::{collections::HashSet, time::Duration};

use futures_util::StreamExt;
use reqwest::{redirect::Policy, Client, StatusCode, Url};
use serde::Serialize;
use serde_json::Value;
use zeroize::{Zeroize, Zeroizing};

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(8);
const MAX_RESPONSE_BYTES: usize = 256 * 1024;
const MAX_MODELS: usize = 200;
const MAX_MODEL_ID_BYTES: usize = 128;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProviderProbeResult {
    models: Vec<String>,
}

fn models_endpoint(base_url: &str) -> Result<Url, String> {
    let mut url =
        Url::parse(base_url.trim()).map_err(|_| "Enter a valid provider URL.".to_string())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(
            "Enter an HTTP or HTTPS provider URL without credentials, query, or fragment."
                .to_string(),
        );
    }
    let path = format!("{}/models", url.path().trim_end_matches('/'));
    url.set_path(&path);
    Ok(url)
}

async fn read_bounded_body(response: reqwest::Response) -> Result<Vec<u8>, String> {
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
    {
        return Err("The provider model catalog is too large.".to_string());
    }
    let mut stream = response.bytes_stream();
    let mut body = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| transport_error(&error))?;
        if body.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
            return Err("The provider model catalog is too large.".to_string());
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

fn transport_error(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        "The provider test timed out.".to_string()
    } else if error.is_connect() {
        "The provider could not be reached.".to_string()
    } else {
        "The provider test failed before a response was received.".to_string()
    }
}

fn parse_models(body: &[u8]) -> Result<Vec<String>, String> {
    let value: Value = serde_json::from_slice(body)
        .map_err(|_| "The provider returned an invalid model catalog.".to_string())?;
    let items = value
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| "The provider returned an invalid model catalog.".to_string())?;
    let mut seen = HashSet::new();
    let mut models = Vec::new();
    for item in items {
        let Some(id) = item.get("id").and_then(Value::as_str).map(str::trim) else {
            continue;
        };
        if id.is_empty() || id.len() > MAX_MODEL_ID_BYTES || !seen.insert(id.to_string()) {
            continue;
        }
        models.push(id.to_string());
        if models.len() == MAX_MODELS {
            break;
        }
    }
    if models.is_empty() {
        return Err("The provider returned no usable models.".to_string());
    }
    models.sort_unstable();
    Ok(models)
}

async fn probe_with_timeout(
    base_url: &str,
    api_key: &str,
    timeout: Duration,
) -> Result<ProviderProbeResult, String> {
    if api_key.trim().is_empty() {
        return Err("Enter or save a provider token before testing.".to_string());
    }
    let endpoint = models_endpoint(base_url)?;
    let client = Client::builder()
        .redirect(Policy::none())
        .timeout(timeout)
        .build()
        .map_err(|_| "The provider test could not be initialized.".to_string())?;
    let response = client
        .get(endpoint)
        .bearer_auth(api_key.trim())
        .send()
        .await
        .map_err(|error| transport_error(&error))?;
    match response.status() {
        status if status.is_success() => {}
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            return Err("The provider rejected the token.".to_string());
        }
        status => {
            return Err(format!(
                "The provider test failed with HTTP {}.",
                status.as_u16()
            ))
        }
    }
    let body = read_bounded_body(response).await?;
    Ok(ProviderProbeResult {
        models: parse_models(&body)?,
    })
}

#[tauri::command]
pub(crate) async fn probe_ai_provider(
    app_handle: tauri::AppHandle,
    base_url: String,
    api_key: Option<String>,
) -> Result<ProviderProbeResult, String> {
    let mut proposed = Zeroizing::new(api_key.unwrap_or_default());
    let saved = if proposed.trim().is_empty() {
        crate::settings::read_provider_api_key(&app_handle)?
    } else {
        None
    };
    let mut credential = Zeroizing::new(saved.unwrap_or_else(|| proposed.trim().to_string()));
    proposed.zeroize();
    let result = probe_with_timeout(&base_url, credential.as_str(), DEFAULT_TIMEOUT).await;
    credential.zeroize();
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
    };

    async fn fixture(status: &str, body: Vec<u8>, delay: Duration) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let status = status.to_string();
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = [0_u8; 4096];
            let size = socket.read(&mut request).await.unwrap();
            let request = String::from_utf8_lossy(&request[..size]);
            assert!(request.starts_with("GET /v1/models HTTP/1.1"));
            assert!(request.contains("authorization: Bearer test-secret"));
            if !delay.is_zero() {
                tokio::time::sleep(delay).await;
            }
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len(),
            );
            socket.write_all(response.as_bytes()).await.unwrap();
            socket.write_all(&body).await.unwrap();
        });
        format!("http://{address}/v1")
    }

    #[tokio::test]
    async fn successful_probe_returns_a_bounded_sorted_catalog() {
        let url = fixture(
            "200 OK",
            br#"{"data":[{"id":"z-model"},{"id":"a-model"},{"id":"a-model"}]}"#.to_vec(),
            Duration::ZERO,
        )
        .await;
        let result = probe_with_timeout(&url, "test-secret", Duration::from_secs(1))
            .await
            .unwrap();
        assert_eq!(result.models, vec!["a-model", "z-model"]);
    }

    #[tokio::test]
    async fn probe_classifies_auth_timeout_and_malformed_catalogs_without_secrets() {
        let auth_url = fixture("401 Unauthorized", b"{}".to_vec(), Duration::ZERO).await;
        let auth = probe_with_timeout(&auth_url, "test-secret", Duration::from_secs(1))
            .await
            .unwrap_err();
        assert_eq!(auth, "The provider rejected the token.");

        let malformed_url = fixture("200 OK", b"not-json".to_vec(), Duration::ZERO).await;
        let malformed = probe_with_timeout(&malformed_url, "test-secret", Duration::from_secs(1))
            .await
            .unwrap_err();
        assert_eq!(malformed, "The provider returned an invalid model catalog.");

        let timeout_url = fixture("200 OK", b"{}".to_vec(), Duration::from_millis(100)).await;
        let timeout = probe_with_timeout(&timeout_url, "test-secret", Duration::from_millis(20))
            .await
            .unwrap_err();
        assert_eq!(timeout, "The provider test timed out.");
        assert!(!format!("{auth}{malformed}{timeout}").contains("test-secret"));
    }

    #[tokio::test]
    async fn probe_rejects_invalid_urls_and_oversized_catalogs() {
        assert!(models_endpoint("file:///tmp/models").is_err());
        assert!(models_endpoint("https://secret@example.com/v1").is_err());
        let url = fixture("200 OK", vec![b'x'; MAX_RESPONSE_BYTES + 1], Duration::ZERO).await;
        assert_eq!(
            probe_with_timeout(&url, "test-secret", Duration::from_secs(1))
                .await
                .unwrap_err(),
            "The provider model catalog is too large.",
        );
    }

    #[tokio::test]
    async fn probe_does_not_forward_credentials_through_redirects() {
        let destination = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let destination_url = format!("http://{}/v1/models", destination.local_addr().unwrap());
        let redirector = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let redirector_address = redirector.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut socket, _) = redirector.accept().await.unwrap();
            let mut request = [0_u8; 4096];
            let size = socket.read(&mut request).await.unwrap();
            let request = String::from_utf8_lossy(&request[..size]);
            assert!(request.contains("authorization: Bearer test-secret"));
            let response = format!(
                "HTTP/1.1 302 Found\r\nLocation: {destination_url}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            );
            socket.write_all(response.as_bytes()).await.unwrap();
        });

        let error = probe_with_timeout(
            &format!("http://{redirector_address}/v1"),
            "test-secret",
            Duration::from_secs(1),
        )
        .await
        .unwrap_err();
        assert_eq!(error, "The provider test failed with HTTP 302.");
        assert!(
            tokio::time::timeout(Duration::from_millis(50), destination.accept())
                .await
                .is_err()
        );
    }
}
