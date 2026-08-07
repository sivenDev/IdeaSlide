import { LRUCache } from "lru-cache";

export const PAGE_THUMBNAIL_CACHE_MAX_ENTRIES = 128;
export const PAGE_THUMBNAIL_CACHE_MAX_BYTES = 32 * 1024 * 1024;

export interface PageThumbnailCacheEntry {
  pageId: string;
  renderKey: string;
  url: string;
  byteSize: number;
}

interface PageThumbnailCacheOptions {
  maxEntries?: number;
  maxBytes?: number;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

export class PageThumbnailCache {
  private readonly stable: LRUCache<string, PageThumbnailCacheEntry>;
  private readonly createObjectURL: (blob: Blob) => string;
  private readonly revokeObjectURL: (url: string) => void;
  private transient?: PageThumbnailCacheEntry;

  constructor(options: PageThumbnailCacheOptions = {}) {
    this.createObjectURL = options.createObjectURL ?? URL.createObjectURL.bind(URL);
    this.revokeObjectURL = options.revokeObjectURL ?? URL.revokeObjectURL.bind(URL);
    this.stable = new LRUCache<string, PageThumbnailCacheEntry>({
      max: options.maxEntries ?? PAGE_THUMBNAIL_CACHE_MAX_ENTRIES,
      maxSize: options.maxBytes ?? PAGE_THUMBNAIL_CACHE_MAX_BYTES,
      sizeCalculation: (entry) => Math.max(1, entry.byteSize),
      dispose: (entry) => this.revokeObjectURL(entry.url),
    });
  }

  get entryCount() {
    return this.stable.size;
  }

  get byteSize() {
    return this.stable.calculatedSize;
  }

  get transientEntry() {
    return this.transient;
  }

  getStable(pageId: string, renderKey: string) {
    const entry = this.stable.get(pageId);
    if (!entry) return undefined;
    if (entry.renderKey === renderKey) return entry;
    this.stable.delete(pageId);
    return undefined;
  }

  setStable(pageId: string, renderKey: string, blob: Blob) {
    const cached = this.getStable(pageId, renderKey);
    if (cached) return cached;
    const entry = this.createEntry(pageId, renderKey, blob);
    this.stable.set(pageId, entry);
    return entry;
  }

  getTransient(pageId: string, renderKey: string) {
    return this.transient?.pageId === pageId && this.transient.renderKey === renderKey
      ? this.transient
      : undefined;
  }

  getActive(pageId: string, renderKey: string) {
    return this.getTransient(pageId, renderKey) ?? this.getStable(pageId, renderKey);
  }

  setTransient(pageId: string, renderKey: string, blob: Blob) {
    const cached = this.getTransient(pageId, renderKey);
    if (cached) return cached;
    this.clearTransient();
    this.transient = this.createEntry(pageId, renderKey, blob);
    return this.transient;
  }

  clearTransient() {
    if (!this.transient) return;
    this.revokeObjectURL(this.transient.url);
    this.transient = undefined;
  }

  retainPages(pageIds: ReadonlySet<string>) {
    for (const pageId of Array.from(this.stable.keys())) {
      if (!pageIds.has(pageId)) this.stable.delete(pageId);
    }
    if (this.transient && !pageIds.has(this.transient.pageId)) this.clearTransient();
  }

  clear() {
    this.stable.clear();
    this.clearTransient();
  }

  private createEntry(pageId: string, renderKey: string, blob: Blob): PageThumbnailCacheEntry {
    return {
      pageId,
      renderKey,
      url: this.createObjectURL(blob),
      byteSize: blob.size,
    };
  }
}
