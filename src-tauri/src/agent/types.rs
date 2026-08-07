use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentRunRequest {
    pub run_id: String,
    pub prompt: String,
    pub base_url: String,
    pub model: String,
    pub system_prompt: String,
    pub skill_id: Option<String>,
    pub context: serde_json::Value,
    pub tools: Vec<AgentToolDescriptor>,
    pub messages: Vec<AgentMessageInput>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentMessageInput {
    pub role: AgentMessageRole,
    pub content: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentMessageRole {
    User,
    Assistant,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentToolDescriptor {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentRunResponse {
    pub run_id: String,
    pub text: String,
    pub skill_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum AgentRunEvent {
    Started {
        run_id: String,
    },
    TextDelta {
        run_id: String,
        text: String,
    },
    Completed {
        run_id: String,
        text: String,
        skill_id: Option<String>,
    },
    Cancelled {
        run_id: String,
    },
    Error {
        run_id: String,
        message: String,
    },
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSkillMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
}
