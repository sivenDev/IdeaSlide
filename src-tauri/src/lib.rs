mod commands;
pub(crate) mod file_format;
mod mcp;
mod recent_files;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{command, Emitter, Manager, RunEvent};

/// Stores the file path when the app is launched by opening a .is file.
struct PendingFile(Mutex<Option<String>>);

/// Managed state for MCP mode: holds the renderer_ready flag when running
/// with --mcp, None otherwise.
struct McpRendererReady(Option<Arc<AtomicBool>>);

/// Whether the MCP server is running in visible mode (--mcp --visible).
struct McpVisible(bool);

#[command]
fn is_mcp_visible(state: tauri::State<'_, McpVisible>) -> bool {
    state.0
}

/// Called by the hidden mcp-renderer webview once Excalidraw has initialised.
#[command]
fn mcp_renderer_ready(state: tauri::State<'_, McpRendererReady>) {
    if let Some(flag) = &state.0 {
        flag.store(true, Ordering::Release);
    }
}

#[command]
fn get_opened_file(state: tauri::State<'_, PendingFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mcp_mode = std::env::args().any(|a| a == "--mcp");
    let mcp_visible = mcp_mode && std::env::args().any(|a| a == "--visible");

    // Prepare the renderer_ready Arc up-front so we can share it between
    // the managed state and the MCP server.
    let renderer_ready: Option<Arc<AtomicBool>> = if mcp_mode {
        Some(Arc::new(AtomicBool::new(false)))
    } else {
        None
    };

    let renderer_ready_for_state = renderer_ready.clone();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PendingFile(Mutex::new(None)))
        .manage(McpRendererReady(renderer_ready_for_state))
        .manage(McpVisible(mcp_visible))
        .invoke_handler(tauri::generate_handler![
            commands::create_file,
            commands::open_file,
            commands::save_file,
            commands::write_file_bytes,
            recent_files::get_recent_files,
            recent_files::add_recent_file,
            recent_files::remove_recent_file,
            get_opened_file,
            mcp_renderer_ready,
            is_mcp_visible,
        ]);

    if mcp_mode {
        builder = builder.setup(move |app| {
            // The default "main" window is created by tauri.conf.json.
            // In headless MCP mode, hide it; in visible mode, keep it shown.
            if let Some(main_window) = app.get_webview_window("main") {
                if mcp_visible {
                    main_window.set_title("IdeaSlide (MCP)").ok();
                } else {
                    main_window.hide().ok();
                }
            }

            // Create the mcp-renderer webview after the main window is set up.
            // Delay creation slightly to avoid interfering with main window rendering.
            let app_handle_renderer = app.handle().clone();
            let app_handle_mcp = app.handle().clone();
            let flag = renderer_ready.clone();

            tauri::async_runtime::spawn(async move {
                // Give the main window time to initialize its webview.
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;

                // Create hidden renderer webview for Excalidraw PNG export.
                if let Err(e) = tauri::WebviewWindowBuilder::new(
                    &app_handle_renderer,
                    "mcp-renderer",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("MCP Renderer")
                .visible(false)
                .build()
                {
                    eprintln!("Failed to create mcp-renderer window: {e}");
                }

                // Start the MCP server on stdio.
                if let Err(e) = mcp::start_server(app_handle_mcp, flag).await {
                    eprintln!("MCP server error: {e}");
                }
            });

            Ok(())
        });
    }

    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let RunEvent::Opened { urls } = &event {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        if path.extension().is_some_and(|ext| ext == "is") {
                            let path_str = path.to_string_lossy().to_string();
                            // Store for cold-start (frontend not ready yet)
                            if let Some(state) = app_handle.try_state::<PendingFile>() {
                                *state.0.lock().unwrap() = Some(path_str.clone());
                            }
                            // Also emit for hot-start (frontend already listening)
                            let _ = app_handle.emit("file-open", path_str);
                        }
                    }
                }
            }
        });
}
