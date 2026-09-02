export type AppUpdatePhase = "idle" | "checking" | "available" | "downloading" | "ready" | "installing" | "error";
export type AppUpdateRetryAction = "check" | "download" | "install";

export interface AppUpdateDownloadEvent {
  event: "Started" | "Progress" | "Finished";
  data?: {
    contentLength?: number;
    chunkLength?: number;
  };
}

export interface AppUpdateResource {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  download: (onEvent?: (event: AppUpdateDownloadEvent) => void) => Promise<void>;
  install: () => Promise<void>;
  close: () => Promise<void>;
  source?: "proxy" | "official";
}

export interface AppUpdateClient {
  check: () => Promise<AppUpdateResource | null>;
  checkOfficial?: (expectedVersion: string) => Promise<AppUpdateResource | null>;
  relaunch: () => Promise<void>;
}

export interface AppUpdateState {
  phase: AppUpdatePhase;
  currentVersion?: string;
  availableVersion?: string;
  date?: string;
  notes?: string;
  downloadedBytes: number;
  totalBytes?: number;
  dismissed: boolean;
  error?: string;
  retryAction?: AppUpdateRetryAction;
}

interface AppUpdateControllerOptions {
  now?: () => number;
  checkIntervalMs?: number;
  getDismissedVersion?: () => string | null;
  setDismissedVersion?: (version: string | null) => void;
}

const initialState: AppUpdateState = {
  phase: "idle",
  downloadedBytes: 0,
  dismissed: false,
};

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function shouldEnableAppUpdates({
  isTauri,
  windowLabel,
}: {
  isTauri: boolean;
  windowLabel: string;
}): boolean {
  return isTauri && windowLabel === "main";
}

export class AppUpdateController {
  private readonly client: AppUpdateClient;
  private state: AppUpdateState = initialState;
  private update?: AppUpdateResource;
  private listeners = new Set<() => void>();
  private lastCheckAt?: number;
  private checkPromise?: Promise<void>;
  private operationPromise?: Promise<void>;
  private generation = 0;
  private readonly now: () => number;
  private readonly checkIntervalMs: number;
  private readonly getDismissedVersion: () => string | null;
  private readonly setDismissedVersion: (version: string | null) => void;

  constructor(
    client: AppUpdateClient,
    options: AppUpdateControllerOptions = {},
  ) {
    this.client = client;
    this.now = options.now ?? Date.now;
    this.checkIntervalMs = options.checkIntervalMs ?? 3_600_000;
    this.getDismissedVersion = options.getDismissedVersion ?? (() => null);
    this.setDismissedVersion = options.setDismissedVersion ?? (() => undefined);
  }

  getState = (): AppUpdateState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(next: AppUpdateState) {
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }

  private async retireUpdate() {
    const current = this.update;
    this.update = undefined;
    if (current) await current.close().catch(() => undefined);
  }

  check = async ({ force = false }: { force?: boolean } = {}): Promise<void> => {
    const now = this.now();
    if (this.operationPromise || ["downloading", "ready", "installing"].includes(this.state.phase)) return;
    if (!force && this.lastCheckAt !== undefined && now - this.lastCheckAt < this.checkIntervalMs) return;
    if (this.checkPromise) return this.checkPromise;
    const generation = ++this.generation;
    const previous = this.state;
    this.publish(previous.availableVersion
      ? { ...previous, error: undefined, retryAction: undefined }
      : { ...previous, phase: "checking", error: undefined, retryAction: undefined });
    this.checkPromise = (async () => {
      try {
        const found = await this.client.check();
        if (generation !== this.generation) {
          await found?.close().catch(() => undefined);
          return;
        }
        this.lastCheckAt = now;
        if (!found) {
          await this.retireUpdate();
          this.publish(initialState);
          return;
        }
        if (this.update && this.update !== found) await this.retireUpdate();
        this.update = found;
        this.publish({
          phase: "available",
          currentVersion: found.currentVersion,
          availableVersion: found.version,
          date: found.date,
          notes: found.body,
          downloadedBytes: 0,
          dismissed: this.getDismissedVersion() === found.version,
        });
      } catch (cause) {
        if (generation !== this.generation) return;
        this.lastCheckAt = now;
        if (this.update && previous.availableVersion) {
          this.publish({
            ...previous,
            phase: "error",
            error: errorMessage(cause),
            retryAction: "check",
          });
        } else {
          this.publish(initialState);
        }
      } finally {
        this.checkPromise = undefined;
      }
    })();
    return this.checkPromise;
  };

  dismiss = () => {
    if (!this.state.availableVersion) return;
    this.setDismissedVersion(this.state.availableVersion);
    this.publish({ ...this.state, dismissed: true });
  };

  restore = () => {
    this.setDismissedVersion(null);
    this.publish({ ...this.state, dismissed: false });
  };

  download = async (): Promise<void> => {
    if (!this.update || this.operationPromise || !["available", "error"].includes(this.state.phase)) return;
    const generation = this.generation;
    this.publish({
      ...this.state,
      phase: "downloading",
      downloadedBytes: 0,
      totalBytes: undefined,
      error: undefined,
      retryAction: undefined,
    });
    this.operationPromise = (async () => {
      try {
        const update = this.update;
        if (!update) return;
        let downloadedBytes = 0;
        let totalBytes: number | undefined;
        await update.download((event) => {
          if (generation !== this.generation) return;
          if (event.event === "Started") totalBytes = event.data?.contentLength;
          if (event.event === "Progress") downloadedBytes += event.data?.chunkLength ?? 0;
          this.publish({ ...this.state, downloadedBytes, totalBytes });
        });
        if (generation !== this.generation) return;
        this.publish({ ...this.state, phase: "ready", downloadedBytes, totalBytes });
      } catch (cause) {
        if (generation !== this.generation) return;
        const proxyUpdate = this.update;
        if (proxyUpdate?.source === "proxy" && this.client.checkOfficial && this.state.availableVersion) {
          let officialUpdate: AppUpdateResource | null = null;
          try {
            officialUpdate = await this.client.checkOfficial(this.state.availableVersion);
            if (!officialUpdate) throw new Error("The official GitHub release is unavailable.");
            if (generation !== this.generation) {
              await officialUpdate.close().catch(() => undefined);
              return;
            }
            this.update = officialUpdate;
            await proxyUpdate.close().catch(() => undefined);
            this.publish({
              ...this.state,
              phase: "downloading",
              downloadedBytes: 0,
              totalBytes: undefined,
              error: undefined,
              retryAction: undefined,
            });
            let downloadedBytes = 0;
            let totalBytes: number | undefined;
            await officialUpdate.download((event) => {
              if (generation !== this.generation) return;
              if (event.event === "Started") totalBytes = event.data?.contentLength;
              if (event.event === "Progress") downloadedBytes += event.data?.chunkLength ?? 0;
              this.publish({ ...this.state, downloadedBytes, totalBytes });
            });
            if (generation !== this.generation) return;
            this.publish({ ...this.state, phase: "ready", downloadedBytes, totalBytes });
            return;
          } catch (fallbackCause) {
            await officialUpdate?.close().catch(() => undefined);
            if (generation !== this.generation) return;
            this.publish({
              ...this.state,
              phase: "error",
              error: `Proxy download failed; official GitHub fallback also failed: ${errorMessage(fallbackCause)}`,
              retryAction: "download",
            });
            return;
          }
        }
        this.publish({
          ...this.state,
          phase: "error",
          error: errorMessage(cause),
          retryAction: "download",
        });
      } finally {
        this.operationPromise = undefined;
      }
    })();
    return this.operationPromise;
  };

  install = async (confirmExit: () => Promise<boolean>): Promise<boolean> => {
    if (!this.update || this.operationPromise || !["ready", "error"].includes(this.state.phase)) return false;
    if (this.state.phase === "error" && this.state.retryAction !== "install") return false;
    const generation = this.generation;
    const retryingRelaunch = this.state.phase === "error" && this.state.retryAction === "install";
    let installed = false;
    this.operationPromise = (async () => {
      try {
        if (!await confirmExit()) return;
        if (generation !== this.generation || !this.update) return;
        this.publish({ ...this.state, phase: "installing", error: undefined, retryAction: undefined });
        try {
          if (!retryingRelaunch) await this.update.install();
          if (generation !== this.generation) return;
          installed = true;
          await this.client.relaunch();
        } catch (cause) {
          if (generation !== this.generation) return;
          this.publish({
            ...this.state,
            phase: "error",
            error: errorMessage(cause),
            retryAction: "install",
          });
        }
      } finally {
        this.operationPromise = undefined;
      }
    })();
    await this.operationPromise;
    return installed;
  };

  retry = async (): Promise<void> => {
    if (this.state.retryAction === "check") return this.check({ force: true });
    if (this.state.retryAction === "download") return this.download();
  };

  dispose = async (): Promise<void> => {
    this.generation += 1;
    this.listeners.clear();
    await this.retireUpdate();
  };
}
