export const APP_DESTINATIONS = {
  repository: "https://github.com/sivenDev/IdeaSlide",
  releases: "https://github.com/sivenDev/IdeaSlide/releases",
} as const;

export type AppDestination = keyof typeof APP_DESTINATIONS;

export interface AppInfoPlatform {
  isNative: boolean;
  getVersion: () => Promise<string>;
  openUrl: (url: string) => Promise<void>;
}

export type RuntimeAppVersion =
  | { kind: "version"; value: string }
  | { kind: "development" }
  | { kind: "unavailable" };

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const nativeAppInfoPlatform: AppInfoPlatform = {
  isNative: isTauriRuntime(),
  getVersion: async () => {
    const { getVersion } = await import("@tauri-apps/api/app");
    return getVersion();
  },
  openUrl: async (url) => {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  },
};

export async function getRuntimeAppVersion(
  platform: AppInfoPlatform = nativeAppInfoPlatform,
): Promise<RuntimeAppVersion> {
  if (!platform.isNative) return { kind: "development" };
  try {
    const value = (await platform.getVersion()).trim();
    return value ? { kind: "version", value } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function openOfficialAppDestination(
  destination: AppDestination,
  platform: AppInfoPlatform = nativeAppInfoPlatform,
): Promise<void> {
  const url = APP_DESTINATIONS[destination];
  if (!url) throw new Error("This is not an approved IdeaNote destination.");
  if (!platform.isNative) throw new Error("External links are available in the IdeaNote desktop app.");
  await platform.openUrl(url);
}
