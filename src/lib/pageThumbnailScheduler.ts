export type PageThumbnailPriority = "active-visible" | "visible" | "overscan";

export interface PageThumbnailDemand {
  pageId: string;
  index: number;
  priority: PageThumbnailPriority;
}

export interface PageThumbnailVisibleRange {
  startIndex: number;
  endIndex: number;
}

export interface ScheduledPageThumbnailJob<TResult, TMeta = undefined> {
  pageId: string;
  priority: PageThumbnailPriority;
  run: () => Promise<TResult>;
  meta?: TMeta;
}

interface QueuedPageThumbnailJob<TResult, TMeta> extends ScheduledPageThumbnailJob<TResult, TMeta> {
  generation: number;
  sequence: number;
}

interface PageThumbnailSchedulerOptions<TResult, TMeta> {
  yieldToMain?: () => Promise<void>;
  onResult: (job: ScheduledPageThumbnailJob<TResult, TMeta>, result: TResult) => void;
  onError?: (job: ScheduledPageThumbnailJob<TResult, TMeta>, error: unknown) => void;
}

const PRIORITY_RANK: Record<PageThumbnailPriority, number> = {
  "active-visible": 0,
  visible: 1,
  overscan: 2,
};

type IdleCapableGlobal = typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
};

export function yieldToMainThread() {
  return new Promise<void>((resolve) => {
    const host = globalThis as IdleCapableGlobal;
    if (typeof host.requestIdleCallback === "function") {
      host.requestIdleCallback(resolve, { timeout: 48 });
      return;
    }
    if (typeof host.requestAnimationFrame === "function") {
      host.requestAnimationFrame(() => globalThis.setTimeout(resolve, 0));
      return;
    }
    globalThis.setTimeout(resolve, 0);
  });
}

export function buildPageThumbnailDemands(
  pageIds: readonly string[],
  virtualIndexes: readonly number[],
  visibleRange: PageThumbnailVisibleRange | null,
  activePageId: string,
) {
  return virtualIndexes
    .filter((index) => index >= 0 && index < pageIds.length)
    .map<PageThumbnailDemand>((index) => {
      const pageId = pageIds[index]!;
      const visible = visibleRange
        ? index >= visibleRange.startIndex && index <= visibleRange.endIndex
        : true;
      return {
        pageId,
        index,
        priority: visible
          ? pageId === activePageId ? "active-visible" : "visible"
          : "overscan",
      };
    })
    .sort((left, right) => (
      PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]
      || left.index - right.index
    ));
}

export class PageThumbnailScheduler<TResult, TMeta = undefined> {
  private generation = 0;
  private sequence = 0;
  private pending: Array<QueuedPageThumbnailJob<TResult, TMeta>> = [];
  private running = false;
  private paused = false;
  private disposed = false;
  private idleResolvers: Array<() => void> = [];
  private readonly yieldToMain: () => Promise<void>;
  private readonly onResult: PageThumbnailSchedulerOptions<TResult, TMeta>["onResult"];
  private readonly onError?: PageThumbnailSchedulerOptions<TResult, TMeta>["onError"];

  constructor(options: PageThumbnailSchedulerOptions<TResult, TMeta>) {
    this.yieldToMain = options.yieldToMain ?? yieldToMainThread;
    this.onResult = options.onResult;
    this.onError = options.onError;
  }

  replace(jobs: Array<ScheduledPageThumbnailJob<TResult, TMeta>>) {
    if (this.disposed) return;
    this.generation += 1;
    const generation = this.generation;
    this.pending = jobs.map((job) => ({
      ...job,
      generation,
      sequence: this.sequence++,
    }));
    void this.drain();
  }

  setPaused(paused: boolean) {
    if (this.disposed || this.paused === paused) return;
    this.paused = paused;
    if (!paused) void this.drain();
  }

  waitForIdle() {
    if (this.disposed || (!this.running && this.pending.length === 0)) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.idleResolvers.push(resolve));
  }

  clear() {
    if (this.disposed) return;
    this.generation += 1;
    this.pending = [];
    if (!this.running) this.resolveIdleWaiters();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.pending = [];
    this.resolveIdleWaiters();
  }

  private takeNext() {
    this.pending.sort((left, right) => (
      PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]
      || left.sequence - right.sequence
    ));
    return this.pending.shift();
  }

  private async drain() {
    if (this.disposed || this.paused || this.running) return;
    this.running = true;
    try {
      while (!this.disposed && !this.paused && this.pending.length > 0) {
        await this.yieldToMain();
        if (this.disposed || this.paused) break;
        const job = this.takeNext();
        if (!job) break;
        try {
          const result = await job.run();
          if (!this.disposed && job.generation === this.generation) {
            this.onResult(job, result);
          }
        } catch (error) {
          if (!this.disposed && job.generation === this.generation) {
            this.onError?.(job, error);
          }
        }
      }
    } finally {
      this.running = false;
      if (!this.disposed && !this.paused && this.pending.length > 0) {
        void this.drain();
      } else if (this.disposed || this.pending.length === 0) {
        this.resolveIdleWaiters();
      }
    }
  }

  private resolveIdleWaiters() {
    const resolvers = this.idleResolvers;
    this.idleResolvers = [];
    resolvers.forEach((resolve) => resolve());
  }
}
