export interface SettingsWriteEntry<T> {
  version: number;
  settings: T;
}

export interface LatestSettingsWriterOptions<T> {
  persist: (settings: T) => Promise<T>;
  onPersisted: (entry: SettingsWriteEntry<T>, saved: T) => void;
  onError: (entry: SettingsWriteEntry<T>, cause: Error) => void;
}

export interface LatestSettingsWriter<T> {
  submit: (entry: SettingsWriteEntry<T>) => void;
  flush: () => Promise<void>;
}

export function createLatestSettingsWriter<T>({
  persist,
  onPersisted,
  onError,
}: LatestSettingsWriterOptions<T>): LatestSettingsWriter<T> {
  let pending: SettingsWriteEntry<T> | undefined;
  let running: Promise<void> | undefined;

  const flush = () => {
    if (running) return running;
    running = (async () => {
      while (pending) {
        const entry = pending;
        pending = undefined;
        try {
          const saved = await persist(entry.settings);
          onPersisted(entry, saved);
        } catch (cause) {
          const retryEntry = pending ?? entry;
          pending = retryEntry;
          const error = cause instanceof Error ? cause : new Error(String(cause));
          onError(retryEntry, error);
          throw error;
        }
      }
    })().finally(() => {
      running = undefined;
    });
    return running;
  };

  return {
    submit(entry) {
      pending = entry;
    },
    flush,
  };
}
