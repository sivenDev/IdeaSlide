use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
pub struct SlideSession {
    pub session_id: String,
    pub path: String,
    pub index: Option<usize>,
    pub elements: Vec<serde_json::Value>,
    pub app_state: Option<serde_json::Value>,
}

pub struct SessionManager {
    sessions: Mutex<HashMap<String, SlideSession>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn create_session(&self, path: String, index: Option<usize>) -> String {
        let session_id = uuid::Uuid::new_v4().to_string();
        let session = SlideSession {
            session_id: session_id.clone(),
            path,
            index,
            elements: Vec::new(),
            app_state: None,
        };
        self.sessions.lock().unwrap().insert(session_id.clone(), session);
        session_id
    }

    pub fn append_elements(&self, session_id: &str, elements: Vec<serde_json::Value>) -> Result<usize, String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions.get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;
        session.elements.extend(elements);
        Ok(session.elements.len())
    }

    pub fn get_session(&self, session_id: &str) -> Result<SlideSession, String> {
        self.sessions.lock().unwrap()
            .get(session_id)
            .cloned()
            .ok_or_else(|| format!("Session not found: {}", session_id))
    }

    pub fn remove_session(&self, session_id: &str) -> Result<SlideSession, String> {
        self.sessions.lock().unwrap()
            .remove(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))
    }

    pub fn abort_session(&self, session_id: &str) -> Result<(), String> {
        self.sessions.lock().unwrap()
            .remove(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_get_session() {
        let manager = SessionManager::new();
        let session_id = manager.create_session("/test.is".to_string(), None);
        let session = manager.get_session(&session_id).unwrap();
        assert_eq!(session.path, "/test.is");
        assert_eq!(session.elements.len(), 0);
    }

    #[test]
    fn test_append_elements() {
        let manager = SessionManager::new();
        let session_id = manager.create_session("/test.is".to_string(), None);

        let elem = serde_json::json!({"type": "rectangle"});
        let count = manager.append_elements(&session_id, vec![elem]).unwrap();
        assert_eq!(count, 1);

        let session = manager.get_session(&session_id).unwrap();
        assert_eq!(session.elements.len(), 1);
    }

    #[test]
    fn test_append_elements_multiple_calls() {
        let manager = SessionManager::new();
        let session_id = manager.create_session("/test.is".to_string(), None);

        manager.append_elements(&session_id, vec![serde_json::json!({"type": "rectangle"})]).unwrap();
        manager.append_elements(&session_id, vec![serde_json::json!({"type": "text"})]).unwrap();

        let session = manager.get_session(&session_id).unwrap();
        assert_eq!(session.elements.len(), 2);
    }

    #[test]
    fn test_append_to_nonexistent_session() {
        let manager = SessionManager::new();
        let result = manager.append_elements("nonexistent", vec![]);
        assert!(result.is_err());
    }

    #[test]
    fn test_remove_session() {
        let manager = SessionManager::new();
        let session_id = manager.create_session("/test.is".to_string(), None);
        let session = manager.remove_session(&session_id).unwrap();
        assert_eq!(session.path, "/test.is");
        assert!(manager.get_session(&session_id).is_err());
    }

    #[test]
    fn test_abort_session() {
        let manager = SessionManager::new();
        let session_id = manager.create_session("/test.is".to_string(), None);
        manager.abort_session(&session_id).unwrap();
        assert!(manager.get_session(&session_id).is_err());
    }

    #[test]
    fn test_abort_nonexistent_session() {
        let manager = SessionManager::new();
        let result = manager.abort_session("nonexistent");
        assert!(result.is_err());
    }
}
