import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Channel } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import {
  AppUpdateController,
  shouldEnableAppUpdates,
  type AppUpdateClient,
  type AppUpdateDownloadEvent,
  type AppUpdateResource,
} from "../lib/appUpdates";
import {
  checkOfficialUpdate,
  closeOfficialUpdate,
  downloadOfficialUpdate,
  installOfficialUpdate,
  relaunchAfterUpdate,
  type OfficialUpdateMetadata,
} from "../lib/tauriCommands.ts";

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
    source: "proxy",
  };
}

function wrapOfficialUpdate(metadata: OfficialUpdateMetadata): AppUpdateResource {
  let bytesRid: number | undefined;
  return {
    currentVersion: metadata.currentVersion,
    version: metadata.version,
    date: metadata.date,
    body: metadata.body,
    source: "official",
    download: async (onEvent) => {
      const channel = new Channel<AppUpdateDownloadEvent>();
      channel.onmessage = onEvent ?? (() => undefined);
      bytesRid = await downloadOfficialUpdate(metadata.rid, channel);
    },
    install: async () => {
      if (bytesRid === undefined) throw new Error("Official update download has not completed.");
      await installOfficialUpdate(metadata.rid, bytesRid);
      bytesRid = undefined;
    },
    close: async () => {
      await closeOfficialUpdate(metadata.rid, bytesRid);
      bytesRid = undefined;
    },
  };
}

const nativeClient: AppUpdateClient = {
  check: async () => {
    const update = await check({ timeout: 30_000 });
    return update ? wrapUpdate(update) : null;
  },
  checkOfficial: async (expectedVersion) => {
    const metadata = await checkOfficialUpdate(expectedVersion);
    return metadata ? wrapOfficialUpdate(metadata) : null;
  },
  relaunch: relaunchAfterUpdate,
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
