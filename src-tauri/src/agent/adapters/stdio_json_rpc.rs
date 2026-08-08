use serde_json::{json, Map, Value};

use super::RuntimeAdapterError;

pub(crate) const DEFAULT_MAX_FRAME_BYTES: usize = 1024 * 1024;

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub(crate) enum JsonRpcId {
    Number(u64),
    String(String),
}

impl JsonRpcId {
    fn from_value(value: &Value) -> Option<Self> {
        value
            .as_u64()
            .map(Self::Number)
            .or_else(|| value.as_str().map(|value| Self::String(value.to_string())))
    }

    fn to_value(&self) -> Value {
        match self {
            Self::Number(value) => json!(value),
            Self::String(value) => json!(value),
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) enum JsonRpcMessage {
    Request {
        id: JsonRpcId,
        method: String,
        params: Value,
    },
    Response {
        id: JsonRpcId,
        result: Option<Value>,
        error: Option<Value>,
    },
    Notification {
        method: String,
        params: Value,
    },
}

impl JsonRpcMessage {
    pub(crate) fn request(id: u64, method: impl Into<String>, params: Value) -> Self {
        Self::Request {
            id: JsonRpcId::Number(id),
            method: method.into(),
            params,
        }
    }

    pub(crate) fn notification(method: impl Into<String>, params: Value) -> Self {
        Self::Notification {
            method: method.into(),
            params,
        }
    }

    pub(crate) fn response(id: JsonRpcId, result: Value) -> Self {
        Self::Response {
            id,
            result: Some(result),
            error: None,
        }
    }

    pub(crate) fn id(&self) -> Option<&JsonRpcId> {
        match self {
            Self::Request { id, .. } | Self::Response { id, .. } => Some(id),
            Self::Notification { .. } => None,
        }
    }

    pub(crate) fn method(&self) -> Option<&str> {
        match self {
            Self::Request { method, .. } | Self::Notification { method, .. } => Some(method),
            Self::Response { .. } => None,
        }
    }

    pub(crate) fn params(&self) -> Option<&Value> {
        match self {
            Self::Request { params, .. } | Self::Notification { params, .. } => Some(params),
            Self::Response { .. } => None,
        }
    }

    pub(crate) fn encode_line(&self) -> Result<Vec<u8>, RuntimeAdapterError> {
        let value = match self {
            Self::Request { id, method, params } => {
                json!({"id": id.to_value(), "method": method, "params": params})
            }
            Self::Response { id, result, error } => {
                let mut value = Map::new();
                value.insert("id".to_string(), id.to_value());
                if let Some(result) = result {
                    value.insert("result".to_string(), result.clone());
                }
                if let Some(error) = error {
                    value.insert("error".to_string(), error.clone());
                }
                Value::Object(value)
            }
            Self::Notification { method, params } => {
                json!({"method": method, "params": params})
            }
        };
        let mut encoded = serde_json::to_vec(&value).map_err(|error| {
            RuntimeAdapterError::protocol(format!("Runtime message could not be encoded: {error}"))
        })?;
        encoded.push(b'\n');
        Ok(encoded)
    }
}

pub(crate) fn decode_line(
    line: &[u8],
    max_frame_bytes: usize,
) -> Result<JsonRpcMessage, RuntimeAdapterError> {
    if line.len() > max_frame_bytes {
        return Err(RuntimeAdapterError::protocol(format!(
            "Runtime message exceeded the {max_frame_bytes} byte limit."
        )));
    }
    let value: Value = serde_json::from_slice(line)
        .map_err(|_| RuntimeAdapterError::protocol("Runtime returned malformed JSON-RPC data."))?;
    let object = value
        .as_object()
        .ok_or_else(|| RuntimeAdapterError::protocol("Runtime message must be a JSON object."))?;
    let id = object.get("id").and_then(JsonRpcId::from_value);
    if let Some(method) = object.get("method").and_then(Value::as_str) {
        let params = object.get("params").cloned().unwrap_or_else(|| json!({}));
        return Ok(match id {
            Some(id) => JsonRpcMessage::Request {
                id,
                method: method.to_string(),
                params,
            },
            None => JsonRpcMessage::Notification {
                method: method.to_string(),
                params,
            },
        });
    }
    let id = id.ok_or_else(|| {
        RuntimeAdapterError::protocol("Runtime response is missing a correlation id.")
    })?;
    let result = object.get("result").cloned();
    let error = object.get("error").cloned();
    if result.is_none() && error.is_none() {
        return Err(RuntimeAdapterError::protocol(
            "Runtime response contains neither a result nor an error.",
        ));
    }
    Ok(JsonRpcMessage::Response { id, result, error })
}

pub(crate) fn redact_value(value: &Value) -> Value {
    match value {
        Value::Object(object) => Value::Object(
            object
                .iter()
                .map(|(key, value)| {
                    let lower = key.to_ascii_lowercase();
                    let redacted = if lower.contains("authorization")
                        || lower.contains("apikey")
                        || lower == "token"
                        || lower.ends_with("token")
                        || lower.contains("secret")
                    {
                        Value::String("[REDACTED]".to_string())
                    } else {
                        redact_value(value)
                    };
                    (key.clone(), redacted)
                })
                .collect(),
        ),
        Value::Array(values) => Value::Array(values.iter().map(redact_value).collect()),
        Value::String(value) => Value::String(redact_text(value)),
        _ => value.clone(),
    }
}

pub(crate) fn redact_text(value: &str) -> String {
    const MAX_DIAGNOSTIC_BYTES: usize = 4096;
    let mut redacted = value.to_string();
    for marker in ["bearer ", "api_key=", "apikey=", "access_token=", "token="] {
        let mut search_from = 0;
        loop {
            let lower = redacted.to_ascii_lowercase();
            let Some(offset) = lower[search_from..].find(marker) else {
                break;
            };
            let start = search_from + offset;
            let value_start = start + marker.len();
            let value_end = redacted[value_start..]
                .find(|character: char| {
                    character.is_whitespace() || matches!(character, '&' | ',' | '"' | '\'')
                })
                .map(|offset| value_start + offset)
                .unwrap_or(redacted.len());
            redacted.replace_range(value_start..value_end, "[REDACTED]");
            search_from = value_start + "[REDACTED]".len();
        }
    }
    if redacted.len() > MAX_DIAGNOSTIC_BYTES {
        redacted.truncate(MAX_DIAGNOSTIC_BYTES);
        redacted.push('…');
    }
    redacted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_requests_notifications_and_responses() {
        assert!(matches!(
            decode_line(br#"{"id":1,"method":"initialize","params":{}}"#, 1024)
                .expect("request should decode"),
            JsonRpcMessage::Request { .. }
        ));
        assert!(matches!(
            decode_line(br#"{"method":"turn/started","params":{}}"#, 1024)
                .expect("notification should decode"),
            JsonRpcMessage::Notification { .. }
        ));
        assert!(matches!(
            decode_line(br#"{"id":1,"result":{"ok":true}}"#, 1024).expect("response should decode"),
            JsonRpcMessage::Response { .. }
        ));
    }

    #[test]
    fn rejects_malformed_and_oversized_frames() {
        assert!(decode_line(b"not-json", 1024).is_err());
        assert!(decode_line(br#"{"method":"x"}"#, 4).is_err());
    }

    #[test]
    fn redacts_structured_and_stderr_secrets() {
        let value = json!({
            "authorization": "Bearer secret",
            "nested": {"accessToken": "secret-two"},
            "message": "failed with Bearer secret-three and token=secret-four"
        });
        let text = redact_value(&value).to_string();
        assert!(!text.contains("secret"));
        assert!(text.contains("[REDACTED]"));
    }
}
