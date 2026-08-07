use std::{collections::HashMap, sync::Mutex};

use tokio::sync::watch;

#[derive(Default)]
pub(crate) struct AgentSessionState {
    runs: Mutex<HashMap<String, watch::Sender<bool>>>,
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
        self.runs
            .lock()
            .ok()
            .and_then(|runs| runs.get(run_id).cloned())
            .is_some_and(|sender| sender.send(true).is_ok())
    }

    pub(crate) fn finish_run(&self, run_id: &str) {
        if let Ok(mut runs) = self.runs.lock() {
            runs.remove(run_id);
        }
    }
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
}
