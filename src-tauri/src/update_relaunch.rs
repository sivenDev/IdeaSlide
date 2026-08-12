#[cfg(any(target_os = "macos", test))]
use std::path::{Path, PathBuf};

#[cfg(target_os = "macos")]
use std::ffi::{OsStr, OsString};
#[cfg(target_os = "macos")]
use std::process::Command;

#[cfg(target_os = "macos")]
const MACOS_OPEN_COMMAND: &str = "/usr/bin/open";

#[cfg(any(target_os = "macos", test))]
fn resolve_macos_bundle(current_exe: &Path) -> Option<PathBuf> {
    let macos_dir = current_exe.parent()?;
    if macos_dir.file_name()? != "MacOS" {
        return None;
    }

    let contents_dir = macos_dir.parent()?;
    if contents_dir.file_name()? != "Contents" {
        return None;
    }

    let bundle = contents_dir.parent()?;
    (bundle.extension()? == "app").then(|| bundle.to_path_buf())
}

#[cfg(target_os = "macos")]
fn macos_launch_spec(bundle: &Path) -> (&'static str, [OsString; 2]) {
    (
        MACOS_OPEN_COMMAND,
        [
            OsStr::new("-n").to_os_string(),
            bundle.as_os_str().to_os_string(),
        ],
    )
}

#[cfg(target_os = "macos")]
fn launch_macos_bundle(bundle: &Path) -> Result<(), String> {
    let (command, args) = macos_launch_spec(bundle);
    let status = Command::new(command)
        .args(args)
        .status()
        .map_err(|error| format!("Failed to ask LaunchServices to reopen IdeaNote: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "LaunchServices could not reopen IdeaNote (status {status})"
        ))
    }
}

#[cfg(target_os = "macos")]
fn finish_handoff(
    launch: impl FnOnce() -> Result<(), String>,
    exit: impl FnOnce(),
) -> Result<(), String> {
    launch()?;
    exit();
    Ok(())
}

#[tauri::command]
pub fn relaunch_after_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;

        let current_exe = tauri::process::current_binary(&app_handle.env()).map_err(|error| {
            format!("Failed to resolve the current IdeaNote executable: {error}")
        })?;

        if let Some(bundle) = resolve_macos_bundle(&current_exe) {
            return finish_handoff(|| launch_macos_bundle(&bundle), || app_handle.exit(0));
        }
    }

    app_handle.request_restart();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use std::path::Path;

    #[test]
    fn resolves_an_application_bundle_from_its_exact_executable_layout() {
        assert_eq!(
            resolve_macos_bundle(Path::new(
                "/Applications/IdeaNote.app/Contents/MacOS/idea-slide"
            )),
            Some(PathBuf::from("/Applications/IdeaNote.app"))
        );
        assert_eq!(
            resolve_macos_bundle(Path::new(
                "/Applications/Idea Note Preview.app/Contents/MacOS/idea-slide"
            )),
            Some(PathBuf::from("/Applications/Idea Note Preview.app"))
        );
    }

    #[test]
    fn rejects_paths_that_are_not_exact_application_executable_layouts() {
        for path in [
            "/usr/local/bin/idea-slide",
            "/Applications/IdeaNote/Contents/MacOS/idea-slide",
            "/Applications/IdeaNote.app/Content/MacOS/idea-slide",
            "/Applications/IdeaNote.app/Contents/Mac/idea-slide",
            "/Applications/IdeaNote.app/Contents/MacOS/tools/idea-slide",
            "/Applications/IdeaNote.app/Contents/MacOS.app/idea-slide",
        ] {
            assert_eq!(resolve_macos_bundle(Path::new(path)), None, "{path}");
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn launch_spec_uses_only_open_new_instance_and_the_bundle() {
        let bundle = Path::new("/Applications/Idea Note.app");
        let (command, args) = macos_launch_spec(bundle);

        assert_eq!(command, "/usr/bin/open");
        assert_eq!(
            args,
            [OsString::from("-n"), bundle.as_os_str().to_os_string()]
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn failed_handoff_does_not_exit_the_current_process() {
        let exited = Cell::new(false);
        let result = finish_handoff(|| Err("launch rejected".to_string()), || exited.set(true));

        assert_eq!(result, Err("launch rejected".to_string()));
        assert!(!exited.get());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn successful_handoff_exits_only_after_launch_acceptance() {
        let launch_accepted = Cell::new(false);
        let exited_after_acceptance = Cell::new(false);

        finish_handoff(
            || {
                launch_accepted.set(true);
                Ok(())
            },
            || exited_after_acceptance.set(launch_accepted.get()),
        )
        .unwrap();

        assert!(exited_after_acceptance.get());
    }
}
