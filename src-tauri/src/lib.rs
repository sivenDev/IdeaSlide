mod commands;
mod file_format;
mod recent_files;

use std::sync::Mutex;
use tauri::{command, Emitter, Manager, RunEvent};

/// Stores the file path when the app is launched by opening a .is file.
struct PendingFile(Mutex<Option<String>>);

#[command]
fn get_opened_file(state: tauri::State<'_, PendingFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PendingFile(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            commands::create_file,
            commands::open_file,
            commands::save_file,
            commands::write_file_bytes,
            recent_files::get_recent_files,
            recent_files::add_recent_file,
            get_opened_file,
        ])
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
