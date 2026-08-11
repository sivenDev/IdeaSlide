import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useState } from "react";

export type NativePlatform = "macos" | "windows" | "other";

export interface NativeWindowFrame {
  platform: NativePlatform;
  fullscreen: boolean;
  isTauri: boolean;
  className: string;
}

export function useNativeWindowFrame(): NativeWindowFrame {
  const isTauri = "__TAURI_INTERNALS__" in window;
  const platform = useMemo<NativePlatform>(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) return "macos";
    if (/Windows/.test(navigator.userAgent)) return "windows";
    return "other";
  }, []);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const refresh = () => {
      appWindow.isFullscreen()
        .then((value) => { if (!disposed) setFullscreen(value); })
        .catch(console.error);
    };
    refresh();
    appWindow.onResized(refresh)
      .then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      })
      .catch(console.error);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [isTauri]);

  return {
    platform,
    fullscreen,
    isTauri,
    className: `is-${platform} ${fullscreen ? "is-fullscreen" : "is-windowed"}`,
  };
}
