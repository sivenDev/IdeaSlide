use serde_json::Value;

pub(crate) const INITIALIZE: &str = "initialize";
pub(crate) const INITIALIZED: &str = "initialized";
pub(crate) const THREAD_START: &str = "thread/start";
pub(crate) const THREAD_RESUME: &str = "thread/resume";
pub(crate) const TURN_START: &str = "turn/start";
pub(crate) const TURN_STEER: &str = "turn/steer";
pub(crate) const TURN_INTERRUPT: &str = "turn/interrupt";

pub(crate) fn string_at<'a>(value: &'a Value, path: &[&str]) -> Option<&'a str> {
    let mut current = value;
    for segment in path {
        current = current.get(*segment)?;
    }
    current.as_str()
}

pub(crate) fn bool_at(value: &Value, path: &[&str]) -> Option<bool> {
    let mut current = value;
    for segment in path {
        current = current.get(*segment)?;
    }
    current.as_bool()
}

pub(crate) fn plan_steps(params: &Value) -> Vec<String> {
    params
        .get("plan")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|step| {
            step.get("step")
                .or_else(|| step.get("label"))
                .or_else(|| step.get("text"))
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .collect()
}

pub(crate) fn dynamic_tool(params: &Value) -> Option<(&str, &str, Value)> {
    let item = params.get("item").unwrap_or(params);
    if string_at(item, &["type"]).is_some_and(|kind| kind != "dynamicToolCall") {
        return None;
    }
    let call_id = string_at(item, &["id"])
        .filter(|value| valid_call_id(value))
        .or_else(|| string_at(item, &["callId"]).filter(|value| valid_call_id(value)))?;
    let name = string_at(item, &["tool"]).or_else(|| string_at(item, &["name"]))?;
    let arguments = item
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    Some((call_id, name, arguments))
}

fn valid_call_id(value: &str) -> bool {
    let value = value.trim();
    !value.is_empty() && !matches!(value.to_ascii_lowercase().as_str(), "undefined" | "null")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_dynamic_tools_without_exposing_codex_types() {
        let value = serde_json::json!({
            "item": {
                "type": "dynamicToolCall",
                "id": "call-1",
                "tool": "propose_change",
                "arguments": {"title": "Example"}
            }
        });
        let (call_id, name, arguments) = dynamic_tool(&value).expect("tool should parse");
        assert_eq!(call_id, "call-1");
        assert_eq!(name, "propose_change");
        assert_eq!(arguments["title"], "Example");

        let direct = serde_json::json!({
            "callId": "call-2",
            "tool": "read_context",
            "arguments": {"scope": "active"}
        });
        assert_eq!(
            dynamic_tool(&direct).map(|(call_id, name, _)| (call_id, name)),
            Some(("call-2", "read_context"))
        );
    }
}
