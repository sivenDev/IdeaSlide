use std::collections::HashMap;

use serde_json::{json, Value};

use super::{
    adapters::stdio_json_rpc::redact_value,
    types::{AgentToolCall, AgentToolDescriptor},
};

const MAX_CALL_ID_BYTES: usize = 160;
const MAX_TOOL_RESULT_BYTES: usize = 64 * 1024;

#[derive(Clone)]
struct LedgerEntry {
    signature: Vec<u8>,
    result: Option<Value>,
}

pub(crate) enum BrokerDecision {
    Execute,
    Cached(Value),
}

pub(crate) struct AgentToolBroker {
    tools: HashMap<String, AgentToolDescriptor>,
    ledger: HashMap<String, LedgerEntry>,
}

impl AgentToolBroker {
    pub(crate) fn new(tools: &[AgentToolDescriptor]) -> Result<Self, String> {
        let mut definitions = HashMap::new();
        for tool in tools {
            validate_tool_name(&tool.name)?;
            jsonschema::JSONSchema::compile(&tool.input_schema)
                .map_err(|_| format!("Editor Tool schema is invalid: {}", tool.name))?;
            if definitions
                .insert(tool.name.clone(), tool.clone())
                .is_some()
            {
                return Err(format!(
                    "Editor Tool is registered more than once: {}",
                    tool.name
                ));
            }
        }
        Ok(Self {
            tools: definitions,
            ledger: HashMap::new(),
        })
    }

    pub(crate) fn begin(&mut self, call: &AgentToolCall) -> Result<BrokerDecision, String> {
        validate_call_id(&call.call_id)?;
        let descriptor = self
            .tools
            .get(&call.name)
            .ok_or_else(|| format!("Editor Tool is not registered: {}", call.name))?;
        let validator = jsonschema::JSONSchema::compile(&descriptor.input_schema)
            .map_err(|_| format!("Editor Tool schema is invalid: {}", call.name))?;
        if let Err(errors) = validator.validate(&call.arguments) {
            let detail = errors
                .take(3)
                .map(|error| error.to_string())
                .collect::<Vec<_>>()
                .join("; ");
            return Err(format!("Invalid {} arguments: {detail}", call.name));
        }
        let signature = serde_json::to_vec(&json!({
            "name": call.name,
            "arguments": call.arguments,
        }))
        .map_err(|_| "Agent Tool call could not be encoded".to_string())?;
        if let Some(previous) = self.ledger.get(&call.call_id) {
            if previous.signature != signature {
                return Err(format!(
                    "Tool call id {} was reused with different arguments.",
                    call.call_id
                ));
            }
            return previous
                .result
                .clone()
                .map(BrokerDecision::Cached)
                .ok_or_else(|| format!("Tool call {} is already running.", call.call_id));
        }
        self.ledger.insert(
            call.call_id.clone(),
            LedgerEntry {
                signature,
                result: None,
            },
        );
        Ok(BrokerDecision::Execute)
    }

    pub(crate) fn complete(
        &mut self,
        call: &AgentToolCall,
        result: Value,
    ) -> Result<Value, String> {
        let object = result
            .as_object()
            .ok_or_else(|| "Editor Tool result must be an object".to_string())?;
        if object.get("callId").and_then(Value::as_str) != Some(call.call_id.as_str())
            || object.get("name").and_then(Value::as_str) != Some(call.name.as_str())
        {
            return Err("Editor Tool returned a mismatched call identity.".to_string());
        }
        let kind = object
            .get("kind")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if !matches!(kind, "read" | "mutation" | "failure") {
            return Err("Editor Tool returned an unsupported result kind.".to_string());
        }
        if kind == "mutation"
            && object
                .get("changeSet")
                .and_then(|change_set| change_set.get("status"))
                .and_then(Value::as_str)
                != Some("applied")
        {
            return Err("Mutation Tool returned a Change Set that was not applied.".to_string());
        }
        let result = redact_value(&result);
        let encoded = serde_json::to_vec(&result)
            .map_err(|_| "Editor Tool result could not be encoded".to_string())?;
        if encoded.len() > MAX_TOOL_RESULT_BYTES {
            return Err("Editor Tool result exceeded the bounded result limit.".to_string());
        }
        let entry = self
            .ledger
            .get_mut(&call.call_id)
            .ok_or_else(|| "Editor Tool call is not active.".to_string())?;
        entry.result = Some(result.clone());
        Ok(result)
    }
}

fn validate_tool_name(name: &str) -> Result<(), String> {
    if name.is_empty()
        || name.len() > 128
        || !name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
    {
        return Err("Editor Tool name is invalid.".to_string());
    }
    Ok(())
}

fn validate_call_id(call_id: &str) -> Result<(), String> {
    let normalized = call_id.trim();
    if normalized.is_empty()
        || call_id.len() > MAX_CALL_ID_BYTES
        || call_id.contains(['\n', '\r', '\0'])
        || matches!(
            normalized.to_ascii_lowercase().as_str(),
            "undefined" | "null"
        )
    {
        return Err("Agent Tool call id is invalid.".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tools() -> Vec<AgentToolDescriptor> {
        vec![AgentToolDescriptor {
            name: "read_outline".to_string(),
            description: "Read the outline".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {"pageId": {"type": "string"}},
                "required": ["pageId"],
                "additionalProperties": false
            }),
        }]
    }

    #[test]
    fn validates_schema_identity_bounds_and_replays_completed_calls() {
        let mut broker = AgentToolBroker::new(&tools()).unwrap();
        let call = AgentToolCall {
            call_id: "call-1".to_string(),
            name: "read_outline".to_string(),
            arguments: json!({"pageId": "page-1"}),
        };
        assert!(matches!(
            broker.begin(&call).unwrap(),
            BrokerDecision::Execute
        ));
        let result = broker
            .complete(
                &call,
                json!({
                    "kind": "read", "callId": "call-1", "name": "read_outline",
                    "success": true, "summary": "Read outline", "content": {"title": "A"},
                    "truncated": false, "persistable": true
                }),
            )
            .unwrap();
        assert_eq!(result["content"]["title"], "A");
        assert!(matches!(
            broker.begin(&call).unwrap(),
            BrokerDecision::Cached(_)
        ));

        let invalid = AgentToolCall {
            arguments: json!({}),
            ..call.clone()
        };
        assert!(broker.begin(&invalid).is_err());
        let reused = AgentToolCall {
            arguments: json!({"pageId": "page-2"}),
            ..call
        };
        assert!(broker.begin(&reused).is_err());
    }

    #[test]
    fn rejects_unknown_tools_mismatched_results_and_oversized_output() {
        let mut broker = AgentToolBroker::new(&tools()).unwrap();
        let unknown = AgentToolCall {
            call_id: "call-unknown".to_string(),
            name: "write_file".to_string(),
            arguments: json!({}),
        };
        assert!(broker.begin(&unknown).is_err());

        let invalid_identity = AgentToolCall {
            call_id: "undefined".to_string(),
            name: "read_outline".to_string(),
            arguments: json!({"pageId": "page-1"}),
        };
        assert!(broker.begin(&invalid_identity).is_err());

        let call = AgentToolCall {
            call_id: "call-2".to_string(),
            name: "read_outline".to_string(),
            arguments: json!({"pageId": "page-1"}),
        };
        broker.begin(&call).unwrap();
        assert!(broker
            .complete(
                &call,
                json!({"kind": "read", "callId": "other", "name": "read_outline"})
            )
            .is_err());
        let bounded = broker
            .complete(
                &call,
                json!({
                    "kind": "read", "callId": "call-2", "name": "read_outline",
                    "content": "x".repeat(MAX_TOOL_RESULT_BYTES)
                }),
            )
            .unwrap();
        assert!(bounded["content"].as_str().unwrap().len() < MAX_TOOL_RESULT_BYTES);
    }

    #[test]
    fn accepts_only_editor_applied_mutation_results() {
        let mut broker = AgentToolBroker::new(&tools()).unwrap();
        let call = AgentToolCall {
            call_id: "mutation-1".to_string(),
            name: "read_outline".to_string(),
            arguments: json!({"pageId": "page-1"}),
        };
        broker.begin(&call).unwrap();
        assert!(broker
            .complete(
                &call,
                json!({
                    "kind": "mutation", "callId": "mutation-1", "name": "read_outline",
                    "success": true, "summary": "Applied", "changeSet": {"status": "proposed"}
                }),
            )
            .is_err());
        let applied = broker
            .complete(
                &call,
                json!({
                    "kind": "mutation", "callId": "mutation-1", "name": "read_outline",
                    "success": true, "summary": "Applied", "changeSet": {"status": "applied"}
                }),
            )
            .unwrap();
        assert_eq!(applied["changeSet"]["status"], "applied");
    }
}
