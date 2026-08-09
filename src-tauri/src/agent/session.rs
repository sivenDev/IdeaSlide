use std::{collections::HashMap, sync::Mutex};

use serde_json::Value;
use tokio::sync::{oneshot, watch};

#[derive(Default)]
pub(crate) struct AgentSessionState {
    runs: Mutex<HashMap<String, watch::Sender<bool>>>,
    tool_results: Mutex<HashMap<String, oneshot::Sender<Value>>>,
}

impl AgentSessionState {
    pub(crate) fn start_run(&self, run_id: &str) -> Result<watch::Receiver<bool>, String> {
        let mut runs = self
            .runs
            .lock()
            .map_err(|_| "Agent run state is unavailable")?;
        if runs.contains_key(run_id) {
            return Err("Agent run id is already active".to_string());
        }
        let (sender, receiver) = watch::channel(false);
        runs.insert(run_id.to_string(), sender);
        Ok(receiver)
    }

    pub(crate) fn cancel_run(&self, run_id: &str) -> bool {
        let cancelled = self
            .runs
            .lock()
            .ok()
            .and_then(|runs| runs.get(run_id).cloned())
            .is_some_and(|sender| sender.send(true).is_ok());
        self.clear_tool_results(run_id);
        cancelled
    }

    pub(crate) fn finish_run(&self, run_id: &str) {
        if let Ok(mut runs) = self.runs.lock() {
            runs.remove(run_id);
        }
        self.clear_tool_results(run_id);
    }

    pub(crate) fn await_tool_result(
        &self,
        run_id: &str,
        call_id: &str,
    ) -> Result<oneshot::Receiver<Value>, String> {
        let key = tool_result_key(run_id, call_id);
        let (sender, receiver) = oneshot::channel();
        let mut results = self
            .tool_results
            .lock()
            .map_err(|_| "Agent Tool result state is unavailable")?;
        if results.insert(key, sender).is_some() {
            return Err("Agent Tool call id is already awaiting a result".to_string());
        }
        Ok(receiver)
    }

    pub(crate) fn resolve_tool_result(&self, run_id: &str, result: Value) -> bool {
        let Some(call_id) = result.get("callId").and_then(Value::as_str) else {
            return false;
        };
        self.tool_results
            .lock()
            .ok()
            .and_then(|mut results| results.remove(&tool_result_key(run_id, call_id)))
            .is_some_and(|sender| sender.send(result).is_ok())
    }

    fn clear_tool_results(&self, run_id: &str) {
        if let Ok(mut results) = self.tool_results.lock() {
            let prefix = format!("{run_id}\0");
            results.retain(|key, _| !key.starts_with(&prefix));
        }
    }
}

fn tool_result_key(run_id: &str, call_id: &str) -> String {
    format!("{run_id}\0{call_id}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn active_runs_can_be_cancelled_and_retired() {
        let state = AgentSessionState::default();
        let receiver = state.start_run("run-1").expect("run should start");
        assert!(!*receiver.borrow());
        assert!(state.cancel_run("run-1"));
        assert!(*receiver.borrow());
        state.finish_run("run-1");
        assert!(!state.cancel_run("run-1"));
    }

    #[tokio::test]
    async fn tool_results_are_correlated_and_cleared_with_the_run() {
        let state = AgentSessionState::default();
        state.start_run("run-1").unwrap();
        let receiver = state.await_tool_result("run-1", "call-1").unwrap();
        assert!(state.resolve_tool_result(
            "run-1",
            serde_json::json!({"callId": "call-1", "name": "read", "kind": "read"}),
        ));
        assert_eq!(receiver.await.unwrap()["callId"], "call-1");

        let receiver = state.await_tool_result("run-1", "call-2").unwrap();
        state.finish_run("run-1");
        assert!(receiver.await.is_err());
    }
}
