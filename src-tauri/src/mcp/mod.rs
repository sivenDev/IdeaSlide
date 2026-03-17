pub mod error;
pub mod services;
pub mod tools;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::{ServerHandler, ServiceExt, tool, tool_handler, tool_router};
use rmcp::schemars;
use rmcp::schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use tauri::{Emitter, Manager};

use crate::mcp::services::file_service::FileService;
use crate::mcp::services::session_manager::SessionManager;
use crate::mcp::services::slide_service::SlideService;
use crate::mcp::tools::{file_tools, help_tools, preview_tools, session_tools, slide_tools};

// --- Parameter types for tools ---

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct PathParam {
    /// Absolute path to the .is presentation file.
    pub path: String,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct AddSlideParam {
    /// Absolute path to the .is presentation file.
    pub path: String,
    /// Optional zero-based index at which to insert the new slide.
    pub index: Option<usize>,
    /// Optional initial Excalidraw JSON content for the slide.
    pub content: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct SlideIdParam {
    /// Absolute path to the .is presentation file.
    pub path: String,
    /// The unique ID of the slide.
    pub slide_id: String,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct SetSlideContentParam {
    /// Absolute path to the .is presentation file.
    pub path: String,
    /// The unique ID of the slide.
    pub slide_id: String,
    /// The full Excalidraw JSON content to set. Should include elements and appState.
    pub content: String,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct ReorderSlidesParam {
    /// Absolute path to the .is presentation file.
    pub path: String,
    /// All slide IDs in the desired order.
    pub slide_ids: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct PreviewSlideParam {
    /// Absolute path to the .is presentation file.
    pub path: String,
    /// The unique ID of the slide.
    pub slide_id: String,
    /// Optional output path for the PNG file. If not provided, returns base64-encoded data.
    pub output_path: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct PreviewPresentationParam {
    /// Absolute path to the .is presentation file.
    pub path: String,
    /// Optional output directory for PNG files. If not provided, returns base64-encoded data.
    pub output_dir: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct BeginSlideStreamParam {
    /// Absolute path to the .is presentation file.
    pub path: String,
    /// Optional zero-based index at which to insert the new slide.
    pub index: Option<usize>,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct AppendElementsParam {
    /// The session ID returned by begin_slide_stream.
    pub session_id: String,
    /// Array of Excalidraw elements to append (JSON objects).
    pub elements: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct SessionIdParam {
    /// The session ID returned by begin_slide_stream.
    pub session_id: String,
}

// --- Server ---

#[derive(Clone)]
pub struct IdeaSlideServer {
    file_service: Arc<FileService>,
    slide_service: Arc<SlideService>,
    session_manager: Arc<SessionManager>,
    renderer_ready: Arc<AtomicBool>,
    #[allow(dead_code)]
    app_handle: tauri::AppHandle,
    tool_router: ToolRouter<Self>,
}

impl IdeaSlideServer {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        let file_service = Arc::new(FileService::new());
        let slide_service = Arc::new(SlideService);
        let session_manager = Arc::new(SessionManager::new());
        let renderer_ready = Arc::new(AtomicBool::new(false));
        Self {
            file_service,
            slide_service,
            session_manager,
            renderer_ready,
            app_handle,
            tool_router: Self::tool_router(),
        }
    }

    /// After a mutating tool call, emit state to the main window (if it exists)
    /// so the UI can refresh. In headless mode there is no main window and this
    /// is a no-op.
    fn emit_state_changed(&self, path: &str) {
        let main_window = self.app_handle.get_webview_window("main");
        let main_window = match main_window {
            Some(w) => w,
            None => return,
        };

        let fs = Arc::clone(&self.file_service);
        let path_owned = path.to_string();
        let data = match fs.read(std::path::Path::new(&path_owned)) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("emit_state_changed: failed to read {path_owned}: {e}");
                return;
            }
        };

        #[derive(Clone, Serialize)]
        struct StateChangedPayload {
            path: String,
            data: crate::file_format::IsFileData,
        }

        let _ = main_window.emit("mcp-state-changed", StateChangedPayload {
            path: path_owned,
            data,
        });
    }

    /// Create a server with a shared `renderer_ready` flag so the caller can
    /// set it from outside (e.g. from a Tauri command fired by the hidden
    /// mcp-renderer webview once Excalidraw is initialised).
    pub fn new_with_renderer_ready(
        app_handle: tauri::AppHandle,
        renderer_ready: Arc<AtomicBool>,
    ) -> Self {
        let file_service = Arc::new(FileService::new());
        let slide_service = Arc::new(SlideService);
        let session_manager = Arc::new(SessionManager::new());
        Self {
            file_service,
            slide_service,
            session_manager,
            renderer_ready,
            app_handle,
            tool_router: Self::tool_router(),
        }
    }
}

#[tool_router(router = tool_router)]
impl IdeaSlideServer {
    #[tool(
        name = "read_me",
        description = "Returns the Excalidraw element format reference. Call this ONCE before creating slide content. Provides color palette, element types, layout guidelines, and examples."
    )]
    async fn read_me(&self) -> Result<String, String> {
        help_tools::handle_read_me()
    }

    #[tool(
        name = "create_presentation",
        description = "Create a new .is presentation file. Errors if file already exists at the given path."
    )]
    async fn create_presentation(
        &self,
        Parameters(params): Parameters<PathParam>,
    ) -> Result<String, String> {
        let fs = Arc::clone(&self.file_service);
        let path = params.path;
        let path_for_emit = path.clone();
        let result = tokio::task::spawn_blocking(move || {
            file_tools::handle_create_presentation(&fs, &path)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?;
        if result.is_ok() {
            self.emit_state_changed(&path_for_emit);
        }
        result
    }

    #[tool(
        name = "open_presentation",
        description = "Open an existing .is presentation file. Returns manifest metadata and slide list."
    )]
    async fn open_presentation(
        &self,
        Parameters(params): Parameters<PathParam>,
    ) -> Result<String, String> {
        let fs = Arc::clone(&self.file_service);
        let ss = Arc::clone(&self.slide_service);
        let path = params.path;
        tokio::task::spawn_blocking(move || {
            file_tools::handle_open_presentation(&fs, &ss, &path)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    #[tool(
        name = "get_presentation_info",
        description = "Get metadata (manifest) of a presentation without loading slide contents."
    )]
    async fn get_presentation_info(
        &self,
        Parameters(params): Parameters<PathParam>,
    ) -> Result<String, String> {
        let fs = Arc::clone(&self.file_service);
        let path = params.path;
        tokio::task::spawn_blocking(move || {
            file_tools::handle_get_presentation_info(&fs, &path)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    #[tool(
        name = "list_slides",
        description = "List all slides in a presentation. Returns slide IDs and titles."
    )]
    async fn list_slides(
        &self,
        Parameters(params): Parameters<PathParam>,
    ) -> Result<String, String> {
        let fs = Arc::clone(&self.file_service);
        let ss = Arc::clone(&self.slide_service);
        let path = params.path;
        tokio::task::spawn_blocking(move || {
            slide_tools::handle_list_slides(&fs, &ss, &path)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    #[tool(
        name = "add_slide",
        description = "Add a new slide to the presentation. Optionally specify position index and initial Excalidraw JSON content."
    )]
    async fn add_slide(
        &self,
        Parameters(params): Parameters<AddSlideParam>,
    ) -> Result<String, String> {
        let fs = Arc::clone(&self.file_service);
        let ss = Arc::clone(&self.slide_service);
        let path = params.path;
        let path_for_emit = path.clone();
        let index = params.index;
        let content = params.content;
        let result = tokio::task::spawn_blocking(move || {
            slide_tools::handle_add_slide(&fs, &ss, &path, index, content)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?;
        if result.is_ok() {
            self.emit_state_changed(&path_for_emit);
        }
        result
    }

    #[tool(
        name = "delete_slide",
        description = "Delete a slide from the presentation by its ID."
    )]
    async fn delete_slide(
        &self,
        Parameters(params): Parameters<SlideIdParam>,
    ) -> Result<String, String> {
        let fs = Arc::clone(&self.file_service);
        let ss = Arc::clone(&self.slide_service);
        let path = params.path;
        let path_for_emit = path.clone();
        let slide_id = params.slide_id;
        let result = tokio::task::spawn_blocking(move || {
            slide_tools::handle_delete_slide(&fs, &ss, &path, &slide_id)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?;
        if result.is_ok() {
            self.emit_state_changed(&path_for_emit);
        }
        result
    }

    #[tool(
        name = "get_slide_content",
        description = "Get the full Excalidraw JSON content of a slide (elements, appState, files)."
    )]
    async fn get_slide_content(
        &self,
        Parameters(params): Parameters<SlideIdParam>,
    ) -> Result<String, String> {
        let fs = Arc::clone(&self.file_service);
        let ss = Arc::clone(&self.slide_service);
        let path = params.path;
        let slide_id = params.slide_id;
        tokio::task::spawn_blocking(move || {
            slide_tools::handle_get_slide_content(&fs, &ss, &path, &slide_id)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    #[tool(
        name = "set_slide_content",
        description = "Replace the full Excalidraw JSON content of a slide. The content should include elements and appState."
    )]
    async fn set_slide_content(
        &self,
        Parameters(params): Parameters<SetSlideContentParam>,
    ) -> Result<String, String> {
        let fs = Arc::clone(&self.file_service);
        let ss = Arc::clone(&self.slide_service);
        let path = params.path;
        let path_for_emit = path.clone();
        let slide_id = params.slide_id;
        let content = params.content;
        let result = tokio::task::spawn_blocking(move || {
            slide_tools::handle_set_slide_content(&fs, &ss, &path, &slide_id, &content)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?;
        if result.is_ok() {
            self.emit_state_changed(&path_for_emit);
        }
        result
    }

    #[tool(
        name = "reorder_slides",
        description = "Reorder slides in the presentation. Provide all slide IDs in the desired order."
    )]
    async fn reorder_slides(
        &self,
        Parameters(params): Parameters<ReorderSlidesParam>,
    ) -> Result<String, String> {
        let fs = Arc::clone(&self.file_service);
        let ss = Arc::clone(&self.slide_service);
        let path = params.path;
        let path_for_emit = path.clone();
        let slide_ids = params.slide_ids;
        let result = tokio::task::spawn_blocking(move || {
            slide_tools::handle_reorder_slides(&fs, &ss, &path, &slide_ids)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?;
        if result.is_ok() {
            self.emit_state_changed(&path_for_emit);
        }
        result
    }

    #[tool(
        name = "preview_slide",
        description = "Render a slide to a PNG image. If output_path is provided, saves to that file and returns {\"path\": \"...\"}. Otherwise returns base64-encoded PNG data: {\"base64\": \"...\"}"
    )]
    async fn preview_slide(
        &self,
        Parameters(params): Parameters<PreviewSlideParam>,
    ) -> Result<String, String> {
        preview_tools::handle_preview_slide(
            &self.renderer_ready,
            &self.app_handle,
            &self.file_service,
            &self.slide_service,
            &params.path,
            &params.slide_id,
            params.output_path.as_deref(),
        )
        .await
    }

    #[tool(
        name = "preview_presentation",
        description = "Render all slides to PNG thumbnails. If output_dir is provided, saves files there and returns paths. Otherwise returns base64-encoded data: {\"previews\": [{\"slide_id\": \"...\", \"base64\": \"...\"}]}"
    )]
    async fn preview_presentation(
        &self,
        Parameters(params): Parameters<PreviewPresentationParam>,
    ) -> Result<String, String> {
        preview_tools::handle_preview_presentation(
            &self.renderer_ready,
            &self.app_handle,
            &self.file_service,
            &self.slide_service,
            &params.path,
            params.output_dir.as_deref(),
        )
        .await
    }

    #[tool(
        name = "begin_slide_stream",
        description = "Start a streaming session to build a slide incrementally. Returns a session_id for subsequent append_elements calls."
    )]
    async fn begin_slide_stream(
        &self,
        Parameters(params): Parameters<BeginSlideStreamParam>,
    ) -> Result<String, String> {
        let sm = Arc::clone(&self.session_manager);
        let path = params.path;
        let index = params.index;
        tokio::task::spawn_blocking(move || {
            session_tools::handle_begin_slide_stream(&sm, &path, index)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    #[tool(
        name = "append_elements",
        description = "Append Excalidraw elements to an active streaming session. Can be called multiple times to build the slide progressively."
    )]
    async fn append_elements(
        &self,
        Parameters(params): Parameters<AppendElementsParam>,
    ) -> Result<String, String> {
        let sm = Arc::clone(&self.session_manager);
        let session_id = params.session_id.clone();
        let elements = params.elements;

        let result = tokio::task::spawn_blocking(move || {
            session_tools::handle_append_elements(&sm, &session_id, elements)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;

        // Emit event to frontend for live preview
        if let Ok(session) = self.session_manager.get_session(&params.session_id) {
            let _ = self.app_handle.emit("mcp-session-event", serde_json::json!({
                "type": "elements_appended",
                "session_id": params.session_id,
                "path": session.path,
                "elements": session.elements,
                "total_elements": session.elements.len(),
            }));
        }

        Ok(result)
    }

    #[tool(
        name = "commit_slide",
        description = "Commit the streaming session and write the slide to the .is file. Returns the new slide_id."
    )]
    async fn commit_slide(
        &self,
        Parameters(params): Parameters<SessionIdParam>,
    ) -> Result<String, String> {
        let sm = Arc::clone(&self.session_manager);
        let fs = Arc::clone(&self.file_service);
        let ss = Arc::clone(&self.slide_service);
        let session_id = params.session_id.clone();

        let path = self.session_manager.get_session(&session_id)
            .map(|s| s.path.clone())
            .unwrap_or_default();

        let result = tokio::task::spawn_blocking(move || {
            session_tools::handle_commit_slide(&sm, &fs, &ss, &session_id)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;

        if !path.is_empty() {
            self.emit_state_changed(&path);
        }

        let _ = self.app_handle.emit("mcp-session-event", serde_json::json!({
            "type": "session_committed",
            "session_id": params.session_id,
        }));

        Ok(result)
    }

    #[tool(
        name = "abort_slide_stream",
        description = "Abort an active streaming session without saving. Discards all appended elements."
    )]
    async fn abort_slide_stream(
        &self,
        Parameters(params): Parameters<SessionIdParam>,
    ) -> Result<String, String> {
        let sm = Arc::clone(&self.session_manager);
        let session_id = params.session_id.clone();

        tokio::task::spawn_blocking(move || {
            session_tools::handle_abort_slide_stream(&sm, &session_id)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;

        let _ = self.app_handle.emit("mcp-session-event", serde_json::json!({
            "type": "session_aborted",
            "session_id": params.session_id,
        }));

        Ok(serde_json::json!({ "aborted": true }).to_string())
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for IdeaSlideServer {
    fn get_info(&self) -> rmcp::model::ServerInfo {
        rmcp::model::ServerInfo::new(
            rmcp::model::ServerCapabilities::builder()
                .enable_tools()
                .build(),
        )
        .with_server_info(rmcp::model::Implementation::new(
            "idea-slide",
            env!("CARGO_PKG_VERSION"),
        ))
        .with_instructions("IdeaSlide MCP server for creating and modifying slide presentations. Call read_me first to get the Excalidraw format reference.")
    }
}

/// Start the MCP server on stdio transport.
///
/// If `renderer_ready` is `Some`, the server will use that shared flag so the
/// hidden mcp-renderer webview can signal readiness via the
/// `mcp_renderer_ready` Tauri command.  Pass `None` to let the server create
/// its own internal flag (legacy / testing path).
pub async fn start_server(
    app_handle: tauri::AppHandle,
    renderer_ready: Option<Arc<AtomicBool>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let server = match renderer_ready {
        Some(flag) => IdeaSlideServer::new_with_renderer_ready(app_handle, flag),
        None => IdeaSlideServer::new(app_handle),
    };
    let transport = rmcp::transport::io::stdio();
    let service = server.serve(transport).await?;
    service.waiting().await?;
    Ok(())
}
