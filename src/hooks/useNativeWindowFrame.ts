import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useState } from "react";

export type NativePlatform = "macos" | "windows" | "other";

export interface NativeWindowFrame {
  platform: NativePlatform;
  fullscreen: boolean;
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
    let refreshRequest = 0;
    let unlistenResize: (() => void) | undefined;
    const refresh = () => {
      const request = ++refreshRequest;
      appWindow.isFullscreen()
        .then((nextFullscreen) => {
          if (disposed || request !== refreshRequest) return;
          setFullscreen(nextFullscreen);
        })
        .catch(console.error);
    };
    refresh();
    window.addEventListener("resize", refresh);
    appWindow.onResized(refresh)
      .then((dispose) => {
        if (disposed) dispose();
        else unlistenResize = dispose;
      })
      .catch(console.error);
    return () => {
      disposed = true;
      refreshRequest += 1;
      window.removeEventListener("resize", refresh);
      unlistenResize?.();
    };
  }, [isTauri]);

  return {
    platform,
    fullscreen,
    className: `is-${platform} ${fullscreen ? "is-fullscreen" : "is-windowed"}`,
  };
}
