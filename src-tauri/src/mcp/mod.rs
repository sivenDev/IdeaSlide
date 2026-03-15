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

use crate::mcp::services::file_service::FileService;
use crate::mcp::services::slide_service::SlideService;
use crate::mcp::tools::{file_tools, preview_tools, slide_tools};

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

// --- Server ---

#[derive(Clone)]
pub struct IdeaSlideServer {
    file_service: Arc<FileService>,
    slide_service: Arc<SlideService>,
    renderer_ready: Arc<AtomicBool>,
    #[allow(dead_code)]
    app_handle: tauri::AppHandle,
    tool_router: ToolRouter<Self>,
}

impl IdeaSlideServer {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        let file_service = Arc::new(FileService::new());
        let slide_service = Arc::new(SlideService);
        let renderer_ready = Arc::new(AtomicBool::new(false));
        Self {
            file_service,
            slide_service,
            renderer_ready,
            app_handle,
            tool_router: Self::tool_router(),
        }
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
        Self {
            file_service,
            slide_service,
            renderer_ready,
            app_handle,
            tool_router: Self::tool_router(),
        }
    }
}

#[tool_router(router = tool_router)]
impl IdeaSlideServer {
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
        tokio::task::spawn_blocking(move || {
            file_tools::handle_create_presentation(&fs, &path)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
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
        let index = params.index;
        let content = params.content;
        tokio::task::spawn_blocking(move || {
            slide_tools::handle_add_slide(&fs, &ss, &path, index, content)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
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
        let slide_id = params.slide_id;
        tokio::task::spawn_blocking(move || {
            slide_tools::handle_delete_slide(&fs, &ss, &path, &slide_id)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
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
        let slide_id = params.slide_id;
        let content = params.content;
        tokio::task::spawn_blocking(move || {
            slide_tools::handle_set_slide_content(&fs, &ss, &path, &slide_id, &content)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
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
        let slide_ids = params.slide_ids;
        tokio::task::spawn_blocking(move || {
            slide_tools::handle_reorder_slides(&fs, &ss, &path, &slide_ids)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    #[tool(
        name = "preview_slide",
        description = "Render a slide to a PNG image file. Returns the local file path to the rendered image."
    )]
    async fn preview_slide(
        &self,
        Parameters(params): Parameters<SlideIdParam>,
    ) -> Result<String, String> {
        preview_tools::handle_preview_slide(
            &self.renderer_ready,
            &self.app_handle,
            &self.file_service,
            &self.slide_service,
            &params.path,
            &params.slide_id,
        )
        .await
    }

    #[tool(
        name = "preview_presentation",
        description = "Render all slides to PNG thumbnails. Returns array of local file paths."
    )]
    async fn preview_presentation(
        &self,
        Parameters(params): Parameters<PathParam>,
    ) -> Result<String, String> {
        preview_tools::handle_preview_presentation(
            &self.renderer_ready,
            &self.app_handle,
            &self.file_service,
            &self.slide_service,
            &params.path,
        )
        .await
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for IdeaSlideServer {}

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
