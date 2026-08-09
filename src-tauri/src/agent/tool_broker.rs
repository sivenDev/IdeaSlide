use std::collections::{HashMap, HashSet};

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
    successful_tools: HashSet<String>,
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
        validate_prerequisites(&definitions)?;
        Ok(Self {
            tools: definitions,
            ledger: HashMap::new(),
            successful_tools: HashSet::new(),
        })
    }

    pub(crate) fn begin(&mut self, call: &AgentToolCall) -> Result<BrokerDecision, String> {
        validate_call_id(&call.call_id)?;
        let descriptor = self
            .tools
            .get(&call.name)
            .ok_or_else(|| format!("Editor Tool is not registered: {}", call.name))?;
        let missing = descriptor
            .requires
            .iter()
            .filter(|required| !self.successful_tools.contains(*required))
            .cloned()
            .collect::<Vec<_>>();
        if !missing.is_empty() {
            return Err(format!(
                "Editor Tool {} requires successful Tool completion first: {}",
                call.name,
                missing.join(", ")
            ));
        }
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
        if result
            .get("success")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            self.successful_tools.insert(call.name.clone());
        }
        Ok(result)
    }
}

fn validate_prerequisites(
    definitions: &HashMap<String, AgentToolDescriptor>,
) -> Result<(), String> {
    for (name, tool) in definitions {
        for required in &tool.requires {
            validate_tool_name(required)?;
            if required == name {
                return Err(format!("Editor Tool {name} cannot require itself."));
            }
            if !definitions.contains_key(required) {
                return Err(format!(
                    "Editor Tool {name} requires an unregistered Tool: {required}"
                ));
            }
        }
    }

    fn visit(
        name: &str,
        definitions: &HashMap<String, AgentToolDescriptor>,
        visiting: &mut HashSet<String>,
        visited: &mut HashSet<String>,
    ) -> Result<(), String> {
        if visited.contains(name) {
            return Ok(());
        }
        if !visiting.insert(name.to_string()) {
            return Err(format!(
                "Editor Tool prerequisites contain a cycle involving {name}."
            ));
        }
        if let Some(tool) = definitions.get(name) {
            for required in &tool.requires {
                visit(required, definitions, visiting, visited)?;
            }
        }
        visiting.remove(name);
        visited.insert(name.to_string());
        Ok(())
    }

    let mut visiting = HashSet::new();
    let mut visited = HashSet::new();
    for name in definitions.keys() {
        visit(name, definitions, &mut visiting, &mut visited)?;
    }
    Ok(())
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
            requires: Vec::new(),
        }]
    }

    fn prerequisite_tools() -> Vec<AgentToolDescriptor> {
        vec![
            AgentToolDescriptor {
                name: "read_active_page".to_string(),
                description: "Read the active Page".to_string(),
                input_schema: json!({
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }),
                requires: Vec::new(),
            },
            AgentToolDescriptor {
                name: "replace_page_elements".to_string(),
                description: "Replace active Page elements".to_string(),
                input_schema: json!({
                    "type": "object",
                    "properties": {"pageId": {"type": "string"}},
                    "required": ["pageId"],
                    "additionalProperties": false
                }),
                requires: vec!["read_active_page".to_string()],
            },
        ]
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

    #[test]
    fn requires_a_successful_prerequisite_before_dependent_tool_execution() {
        let mut broker = AgentToolBroker::new(&prerequisite_tools()).unwrap();
        let mutation = AgentToolCall {
            call_id: "mutation-before-read".to_string(),
            name: "replace_page_elements".to_string(),
            arguments: json!({"pageId": "page-1"}),
        };
        let error = match broker.begin(&mutation) {
            Err(error) => error,
            Ok(_) => panic!("mutation must wait for its prerequisite"),
        };
        assert!(error.contains("read_active_page"));

        let failed_read = AgentToolCall {
            call_id: "failed-read".to_string(),
            name: "read_active_page".to_string(),
            arguments: json!({}),
        };
        assert!(matches!(
            broker.begin(&failed_read).unwrap(),
            BrokerDecision::Execute
        ));
        broker
            .complete(
                &failed_read,
                json!({
                    "kind": "failure", "callId": "failed-read", "name": "read_active_page",
                    "success": false, "summary": "Read failed", "truncated": false,
                    "persistable": true
                }),
            )
            .unwrap();
        assert!(broker.begin(&mutation).is_err());

        let successful_read = AgentToolCall {
            call_id: "successful-read".to_string(),
            ..failed_read
        };
        assert!(matches!(
            broker.begin(&successful_read).unwrap(),
            BrokerDecision::Execute
        ));
        broker
            .complete(
                &successful_read,
                json!({
                    "kind": "read", "callId": "successful-read", "name": "read_active_page",
                    "success": true, "summary": "Read Page", "content": {"id": "page-1"},
                    "truncated": false, "persistable": false
                }),
            )
            .unwrap();
        assert!(matches!(
            broker.begin(&mutation).unwrap(),
            BrokerDecision::Execute
        ));
    }

    #[test]
    fn rejects_invalid_prerequisite_descriptors() {
        let mut missing = prerequisite_tools();
        missing[1].requires = vec!["missing_read".to_string()];
        assert!(AgentToolBroker::new(&missing).is_err());

        let mut self_referential = prerequisite_tools();
        self_referential[1].requires = vec!["replace_page_elements".to_string()];
        assert!(AgentToolBroker::new(&self_referential).is_err());

        let mut cyclic = prerequisite_tools();
        cyclic[0].requires = vec!["replace_page_elements".to_string()];
        assert!(AgentToolBroker::new(&cyclic).is_err());
    }
}
