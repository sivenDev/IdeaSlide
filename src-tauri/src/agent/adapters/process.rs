use std::{collections::VecDeque, process::Stdio};

use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout, Command},
    task::JoinHandle,
};

use super::{
    stdio_json_rpc::{decode_line, redact_text, JsonRpcId, JsonRpcMessage},
    RuntimeAdapterError, RuntimeCommandSpec,
};

const MAX_STDERR_BYTES: usize = 16 * 1024;

pub(crate) struct LocalRuntimeProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    stderr_task: JoinHandle<String>,
    queued: VecDeque<JsonRpcMessage>,
    spec: RuntimeCommandSpec,
}

#[derive(Clone, Debug)]
pub(crate) struct RestartBudget {
    attempts: u8,
    maximum: u8,
}

impl RestartBudget {
    pub(crate) fn new(maximum: u8) -> Self {
        Self {
            attempts: 0,
            maximum,
        }
    }

    pub(crate) fn claim(&mut self) -> bool {
        if self.attempts >= self.maximum {
            return false;
        }
        self.attempts += 1;
        true
    }
}

impl LocalRuntimeProcess {
    pub(crate) async fn spawn(spec: RuntimeCommandSpec) -> Result<Self, RuntimeAdapterError> {
        if !spec.executable.is_absolute() {
            return Err(RuntimeAdapterError::unavailable(
                "Local Agent runtime executable must use a native-resolved absolute path.",
            ));
        }
        if let Some(expected_version) = &spec.expected_version {
            let version = Command::new(&spec.executable)
                .args(&spec.version_args)
                .kill_on_drop(true)
                .output()
                .await
                .map_err(|_| {
                    RuntimeAdapterError::unavailable("Local Agent runtime is unavailable.")
                })?;
            let version_text = format!(
                "{}{}",
                String::from_utf8_lossy(&version.stdout),
                String::from_utf8_lossy(&version.stderr)
            );
            verify_version(&version_text, expected_version)?;
        }

        let mut child = Command::new(&spec.executable)
            .args(&spec.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|_| {
                RuntimeAdapterError::unavailable("Local Agent runtime could not start.")
            })?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| RuntimeAdapterError::unavailable("Runtime stdin is unavailable."))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| RuntimeAdapterError::unavailable("Runtime stdout is unavailable."))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| RuntimeAdapterError::unavailable("Runtime stderr is unavailable."))?;
        let stderr_task = tokio::spawn(async move {
            let mut stderr = stderr;
            let mut bytes = Vec::new();
            let mut chunk = [0_u8; 1024];
            while bytes.len() < MAX_STDERR_BYTES {
                let remaining = MAX_STDERR_BYTES - bytes.len();
                let limit = remaining.min(chunk.len());
                match stderr.read(&mut chunk[..limit]).await {
                    Ok(0) | Err(_) => break,
                    Ok(count) => bytes.extend_from_slice(&chunk[..count]),
                }
            }
            redact_text(&String::from_utf8_lossy(&bytes))
        });
        Ok(Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
            stderr_task,
            queued: VecDeque::new(),
            spec,
        })
    }

    pub(crate) async fn send(
        &mut self,
        message: &JsonRpcMessage,
    ) -> Result<(), RuntimeAdapterError> {
        if self
            .child
            .try_wait()
            .map_err(|_| RuntimeAdapterError::unavailable("Runtime process state is unavailable."))?
            .is_some()
        {
            return Err(RuntimeAdapterError::unavailable(
                "Local Agent runtime exited unexpectedly.",
            ));
        }
        let encoded = message.encode_line()?;
        if encoded.len() > self.spec.max_frame_bytes {
            return Err(RuntimeAdapterError::protocol(
                "Outgoing runtime message exceeded the configured frame limit.",
            ));
        }
        self.stdin.write_all(&encoded).await.map_err(|_| {
            RuntimeAdapterError::unavailable("Local Agent runtime stopped accepting requests.")
        })?;
        self.stdin.flush().await.map_err(|_| {
            RuntimeAdapterError::unavailable("Local Agent runtime request could not be flushed.")
        })
    }

    pub(crate) async fn next_message(&mut self) -> Result<JsonRpcMessage, RuntimeAdapterError> {
        if let Some(message) = self.queued.pop_front() {
            return Ok(message);
        }
        self.read_transport_message().await
    }

    async fn read_transport_message(&mut self) -> Result<JsonRpcMessage, RuntimeAdapterError> {
        let deadline = tokio::time::Instant::now() + self.spec.turn_event_timeout;
        self.read_transport_message_until(deadline, "Local Agent runtime Turn became inactive.")
            .await
    }

    async fn read_transport_message_until(
        &mut self,
        deadline: tokio::time::Instant,
        timeout_message: &'static str,
    ) -> Result<JsonRpcMessage, RuntimeAdapterError> {
        let line = tokio::time::timeout_at(
            deadline,
            read_bounded_line(&mut self.stdout, self.spec.max_frame_bytes),
        )
        .await
        .map_err(|_| RuntimeAdapterError::unavailable(timeout_message))?
        .map_err(|_| RuntimeAdapterError::unavailable("Local Agent runtime stream failed."))?
        .ok_or_else(|| RuntimeAdapterError::unavailable("Local Agent runtime closed stdout."))?;
        decode_line(&line, self.spec.max_frame_bytes)
    }

    pub(crate) async fn request(
        &mut self,
        message: &JsonRpcMessage,
    ) -> Result<JsonRpcMessage, RuntimeAdapterError> {
        let expected = message
            .id()
            .cloned()
            .ok_or_else(|| RuntimeAdapterError::protocol("Runtime request is missing an id."))?;
        self.send(message).await?;
        let deadline = tokio::time::Instant::now() + self.spec.request_timeout;
        loop {
            let response = self
                .read_transport_message_until(deadline, "Local Agent runtime request timed out.")
                .await?;
            if matches!(response.id(), Some(id) if *id == expected)
                && matches!(response, JsonRpcMessage::Response { .. })
            {
                return Ok(response);
            }
            self.queued.push_back(response);
        }
    }

    pub(crate) async fn shutdown(mut self) -> Result<String, RuntimeAdapterError> {
        let _ = self.stdin.shutdown().await;
        if tokio::time::timeout(std::time::Duration::from_secs(2), self.child.wait())
            .await
            .is_err()
        {
            let _ = self.child.start_kill();
            let _ = self.child.wait().await;
        }
        Ok(self.stderr_task.await.unwrap_or_default())
    }
}

async fn read_bounded_line(
    reader: &mut BufReader<ChildStdout>,
    maximum: usize,
) -> std::io::Result<Option<Vec<u8>>> {
    let mut frame = Vec::new();
    loop {
        let buffer = reader.fill_buf().await?;
        if buffer.is_empty() {
            return Ok((!frame.is_empty()).then_some(frame));
        }
        let newline = buffer.iter().position(|byte| *byte == b'\n');
        let consumed = newline.map_or(buffer.len(), |position| position + 1);
        let payload = newline.map_or(buffer, |position| &buffer[..position]);
        if frame.len().saturating_add(payload.len()) > maximum {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "runtime frame exceeded limit",
            ));
        }
        frame.extend_from_slice(payload);
        reader.consume(consumed);
        if newline.is_some() {
            return Ok(Some(frame));
        }
    }
}

pub(crate) fn verify_version(
    output: &str,
    expected_version: &str,
) -> Result<(), RuntimeAdapterError> {
    let versions = output
        .split(|character: char| character.is_whitespace() || character == 'v')
        .filter(|part| {
            part.chars()
                .next()
                .is_some_and(|first| first.is_ascii_digit())
        });
    if versions
        .into_iter()
        .any(|version| version == expected_version)
    {
        return Ok(());
    }
    Err(RuntimeAdapterError::unavailable(format!(
        "Local Agent runtime version is incompatible; expected {expected_version}."
    )))
}

pub(crate) fn response_error(message: &JsonRpcMessage) -> Option<String> {
    match message {
        JsonRpcMessage::Response {
            error: Some(error), ..
        } => Some(redact_text(
            error
                .get("message")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("Runtime request failed."),
        )),
        _ => None,
    }
}

pub(crate) fn response_id(message: &JsonRpcMessage) -> Option<&JsonRpcId> {
    message.id()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_version_policy_rejects_mismatches() {
        assert!(verify_version("codex-cli 0.147.0", "0.147.0").is_ok());
        assert!(verify_version("codex-cli 0.148.0", "0.147.0").is_err());
    }

    #[test]
    fn provider_errors_are_redacted() {
        let message = JsonRpcMessage::Response {
            id: JsonRpcId::Number(1),
            result: None,
            error: Some(serde_json::json!({"message": "Bearer secret-token failed"})),
        };
        let error = response_error(&message).expect("error should be present");
        assert!(!error.contains("secret-token"));
    }

    #[test]
    fn restart_budget_is_bounded() {
        let mut budget = RestartBudget::new(1);
        assert!(budget.claim());
        assert!(!budget.claim());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn supervised_process_correlates_requests_and_shuts_down() {
        let spec = RuntimeCommandSpec {
            executable: std::path::PathBuf::from("/bin/sh"),
            args: vec![
                "-c".to_string(),
                "read line; printf '{\"id\":1,\"result\":{\"ok\":true}}\\n'".to_string(),
            ],
            expected_version: None,
            version_args: Vec::new(),
            request_timeout: std::time::Duration::from_secs(2),
            turn_event_timeout: std::time::Duration::from_secs(2),
            max_frame_bytes: 1024,
        };
        let mut process = LocalRuntimeProcess::spawn(spec)
            .await
            .expect("fake runtime should start");
        let response = process
            .request(&JsonRpcMessage::request(
                1,
                "initialize",
                serde_json::json!({}),
            ))
            .await
            .expect("response should correlate");
        assert!(matches!(response, JsonRpcMessage::Response { .. }));
        let stderr = process.shutdown().await.expect("runtime should stop");
        assert!(stderr.is_empty());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn active_turn_messages_can_arrive_after_the_request_timeout() {
        let spec = RuntimeCommandSpec {
            executable: std::path::PathBuf::from("/bin/sh"),
            args: vec![
                "-c".to_string(),
                "sleep 0.12; printf '{\"method\":\"turn/completed\",\"params\":{}}\\n'".to_string(),
            ],
            expected_version: None,
            version_args: Vec::new(),
            request_timeout: std::time::Duration::from_millis(40),
            turn_event_timeout: std::time::Duration::from_millis(250),
            max_frame_bytes: 1024,
        };
        let mut process = LocalRuntimeProcess::spawn(spec)
            .await
            .expect("fake runtime should start");
        let message = process
            .next_message()
            .await
            .expect("active Turn event waiting must not reuse the request timeout");
        assert_eq!(message.method(), Some("turn/completed"));
        let _ = process.shutdown().await;
    }
}
