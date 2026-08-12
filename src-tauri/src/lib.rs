mod agent;
mod commands;
pub(crate) mod document_formats;
mod provider_probe;
mod recent_files;
mod recovery;
pub(crate) mod safe_write;
mod settings;
pub(crate) mod workspace;
mod workspace_agent;
mod workspace_watcher;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{command, Emitter, Manager, RunEvent};

/// Stores the file path when the app is launched by opening a .is file.
struct PendingFile(Mutex<Option<String>>);

/// Readiness flag for the hidden preview renderer window.
struct PreviewRendererReady(Arc<AtomicBool>);

#[command]
fn is_preview_renderer_ready(state: tauri::State<'_, PreviewRendererReady>) -> bool {
    state.0.load(Ordering::Acquire)
}

#[command]
fn preview_renderer_ready(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, PreviewRendererReady>,
) {
    state.0.store(true, Ordering::Release);
    let _ = app_handle.emit("preview-renderer-ready", true);
}

#[command]
fn get_opened_file(state: tauri::State<'_, PendingFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[command]
fn exit_application(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let preview_renderer_ready_flag = Arc::new(AtomicBool::new(false));

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(PendingFile(Mutex::new(None)))
        .manage(agent::state())
        .manage(workspace_agent::WorkspaceAgentHost::default())
        .manage(PreviewRendererReady(preview_renderer_ready_flag))
        .manage(workspace_watcher::WorkspaceWatcherState::default())
        .invoke_handler(tauri::generate_handler![
            commands::create_file,
            commands::open_file,
            commands::save_file,
            commands::write_file_bytes,
            commands::inspect_file,
            commands::rename_standalone_path,
            commands::rename_workspace_root,
            commands::read_document_image,
            commands::open_workspace,
            commands::scan_workspace,
            commands::refresh_workspace,
            commands::read_workspace_file,
            commands::open_workspace_document,
            commands::create_workspace_folder,
            commands::create_workspace_document,
            commands::rename_workspace_entry,
            commands::move_workspace_entry,
            commands::trash_workspace_entry,
            commands::save_workspace_document,
            commands::save_workspace_state,
            workspace_watcher::start_workspace_watcher,
            workspace_watcher::stop_workspace_watcher,
            recovery::write_recovery_draft,
            recovery::load_recovery_draft,
            recovery::delete_recovery_draft,
            recovery::list_standalone_recovery_drafts,
            recovery::delete_standalone_recovery_draft,
            recent_files::get_recent_files,
            recent_files::get_recent_workspaces,
            recent_files::add_recent_file,
            recent_files::remove_recent_file,
            recent_files::remove_recent_workspace,
            settings::get_ai_credential_status,
            settings::set_ai_credential,
            settings::delete_ai_credential,
            provider_probe::probe_ai_provider,
            agent::discover_agent_skills,
            agent::import_agent_skill,
            agent::update_agent_skill,
            agent::remove_agent_skill,
            agent::list_agent_runtimes,
            agent::save_agent_thread,
            agent::get_agent_thread,
            agent::list_agent_threads,
            agent::rename_agent_thread,
            agent::archive_agent_thread,
            agent::delete_agent_thread,
            agent::run_agent,
            agent::submit_agent_tool_result,
            agent::cancel_agent,
            agent::resolve_agent_approval,
            workspace_agent::sync_workspace_agent_context,
            get_opened_file,
            preview_renderer_ready,
            is_preview_renderer_ready,
            exit_application,
        ]);

    builder = builder.setup(move |app| {
        let app_handle_preview = app.handle().clone();

        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;

            if app_handle_preview
                .get_webview_window("preview-renderer")
                .is_some()
            {
                return;
            }

            if let Err(e) = tauri::WebviewWindowBuilder::new(
                &app_handle_preview,
                "preview-renderer",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Preview Renderer")
            .visible(false)
            .build()
            {
                eprintln!("Failed to create preview-renderer window: {e}");
            }
        });

        Ok(())
    });

    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |app_handle, event| {
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
