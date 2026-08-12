import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  AppUpdateController,
  shouldEnableAppUpdates,
  type AppUpdateClient,
  type AppUpdateDownloadEvent,
  type AppUpdateResource,
} from "../lib/appUpdates";

const DISMISSED_UPDATE_KEY = "ideanote.dismissed-update-version";

function wrapUpdate(update: Update): AppUpdateResource {
  return {
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date,
    body: update.body,
    download: (onEvent) => update.download((event) => onEvent?.(event as AppUpdateDownloadEvent)),
    install: () => update.install(),
    close: () => update.close(),
  };
}

const nativeClient: AppUpdateClient = {
  check: async () => {
    const update = await check({ timeout: 30_000 });
    return update ? wrapUpdate(update) : null;
  },
  relaunch,
};

const inertClient: AppUpdateClient = {
  check: async () => null,
  relaunch: async () => undefined,
};

export function useAppUpdate() {
  const enabled = shouldEnableAppUpdates({
    isTauri: "__TAURI_INTERNALS__" in window,
    windowLabel: "__TAURI_INTERNALS__" in window ? getCurrentWindow().label : "browser",
  });
  const controller = useMemo(() => new AppUpdateController(enabled ? nativeClient : inertClient, {
    getDismissedVersion: () => window.localStorage.getItem(DISMISSED_UPDATE_KEY),
    setDismissedVersion: (version) => {
      if (version) window.localStorage.setItem(DISMISSED_UPDATE_KEY, version);
      else window.localStorage.removeItem(DISMISSED_UPDATE_KEY);
    },
  }), [enabled]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  useEffect(() => {
    if (!enabled) return () => void controller.dispose();
    void controller.check();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void controller.check();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      void controller.dispose();
    };
  }, [controller, enabled]);

  return {
    state,
    enabled,
    check: useCallback(() => controller.check({ force: true }), [controller]),
    download: useCallback(() => controller.download(), [controller]),
    install: useCallback((confirmExit: () => Promise<boolean>) => controller.install(confirmExit), [controller]),
    retry: useCallback(() => controller.retry(), [controller]),
    dismiss: useCallback(() => controller.dismiss(), [controller]),
    restore: useCallback(() => controller.restore(), [controller]),
  };
}
