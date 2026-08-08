use serde_json::Value;

pub(crate) const INITIALIZE: &str = "initialize";
pub(crate) const AUTHENTICATE: &str = "authenticate";
pub(crate) const SESSION_NEW: &str = "session/new";
pub(crate) const SESSION_LOAD: &str = "session/load";
pub(crate) const SESSION_PROMPT: &str = "session/prompt";
pub(crate) const SESSION_CANCEL: &str = "session/cancel";
pub(crate) const SESSION_UPDATE: &str = "session/update";

pub(crate) fn update_kind(params: &Value) -> Option<&str> {
    params
        .get("update")
        .and_then(|update| update.get("sessionUpdate"))
        .and_then(Value::as_str)
}

pub(crate) fn text_chunk(params: &Value) -> Option<&str> {
    let update = params.get("update")?;
    update
        .get("content")
        .and_then(|content| content.get("text"))
        .and_then(Value::as_str)
}

pub(crate) fn plan_steps(params: &Value) -> Vec<String> {
    let update = params.get("update").unwrap_or(params);
    update
        .get("entries")
        .or_else(|| update.get("steps"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|step| {
            step.get("content")
                .or_else(|| step.get("label"))
                .or_else(|| step.get("text"))
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .collect()
}

pub(crate) fn tool_update(params: &Value) -> Option<(&str, &str, Value)> {
    let update = params.get("update").unwrap_or(params);
    let call_id = update
        .get("toolCallId")
        .or_else(|| update.get("callId"))
        .and_then(Value::as_str)?;
    let name = update
        .get("title")
        .or_else(|| update.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("Grok Tool");
    let arguments = update
        .get("rawInput")
        .or_else(|| update.get("input"))
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    Some((call_id, name, arguments))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_acp_message_chunks() {
        let params = serde_json::json!({
            "update": {
                "sessionUpdate": "agent_message_chunk",
                "content": {"type": "text", "text": "Hello"}
            }
        });
        assert_eq!(update_kind(&params), Some("agent_message_chunk"));
        assert_eq!(text_chunk(&params), Some("Hello"));
    }
}
