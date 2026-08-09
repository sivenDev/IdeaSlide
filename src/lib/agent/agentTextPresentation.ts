import type { AgentItem, AgentThreadState, AgentTurn } from "./protocol";
import type { AgentStreamingBehavior } from "./types";

const TICK_MS = 60;
const MIN_REVEAL_MS = 800;
const MAX_REVEAL_MS = 2_500;
const MIN_PACED_GRAPHEMES = 32;
const UNKNOWN_BURST_GRAPHEMES = 80;
const UNKNOWN_BURST_WINDOW_MS = 120;
const BOUNDARY_LOOKAROUND = 8;

export interface AgentPresentationScheduler {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(timerId: number): void;
}

export interface AgentTextDeliveryState {
  sourceContent: string;
  displayedContent: string;
  sourceDelivery: AgentStreamingBehavior;
  presentationMode: "direct" | "paced";
  presentationStatus: "idle" | "revealing" | "settled";
}

export interface AgentPresentationSnapshot {
  items: Readonly<Record<string, AgentTextDeliveryState>>;
  revealing: boolean;
  revision: number;
}

interface MutablePresentationItem extends AgentTextDeliveryState {
  turnId: string;
  sourceGraphemes: string[];
  displayedGraphemeCount: number;
  lastSourceAt: number;
}

interface SegmenterPart {
  segment: string;
}

interface SegmenterLike {
  segment(input: string): Iterable<SegmenterPart>;
}

type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: "grapheme" },
) => SegmenterLike;

const Segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterConstructor }).Segmenter;
const graphemeSegmenter = Segmenter ? new Segmenter(undefined, { granularity: "grapheme" }) : undefined;

export function segmentAgentText(text: string): string[] {
  if (!text) return [];
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(text), (part) => part.segment);
  }
  const graphemes: string[] = [];
  for (const point of Array.from(text)) {
    const previous = graphemes[graphemes.length - 1];
    if (previous && (isCombiningPoint(point) || previous.endsWith("\u200d") || point === "\u200d")) {
      graphemes[graphemes.length - 1] = `${previous}${point}`;
    } else {
      graphemes.push(point);
    }
  }
  return graphemes;
}

function isCombiningPoint(point: string): boolean {
  return /[\u0300-\u036f\ufe00-\ufe0f\u{1f3fb}-\u{1f3ff}]/u.test(point);
}

function browserScheduler(): AgentPresentationScheduler {
  return {
    now: () => performance.now(),
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeout: (timerId) => window.clearTimeout(timerId),
  };
}

export class AgentTextPresentationController {
  private readonly scheduler: AgentPresentationScheduler;
  private readonly onChange: () => void;
  private readonly items = new Map<string, MutablePresentationItem>();
  private readonly liveTurnIds = new Set<string>();
  private itemOrder: string[] = [];
  private currentThreadId?: string;
  private timerId?: number;
  private reducedMotion: boolean;
  private disposed = false;
  private revision = 0;
  private snapshot: AgentPresentationSnapshot = { items: {}, revealing: false, revision: 0 };

  constructor({
    scheduler = browserScheduler(),
    onChange,
    reducedMotion = false,
  }: {
    scheduler?: AgentPresentationScheduler;
    onChange: () => void;
    reducedMotion?: boolean;
  }) {
    this.scheduler = scheduler;
    this.onChange = onChange;
    this.reducedMotion = reducedMotion;
  }

  getSnapshot(): AgentPresentationSnapshot {
    return this.snapshot;
  }

  setReducedMotion(reducedMotion: boolean): void {
    if (this.reducedMotion === reducedMotion) return;
    this.reducedMotion = reducedMotion;
    if (reducedMotion) {
      for (const item of this.items.values()) this.settleItem(item);
      this.cancelTimer();
      this.publish();
    }
  }

  sync(state: AgentThreadState, options: { hydrate?: boolean } = {}): void {
    if (this.disposed) return;
    const threadChanged = this.currentThreadId !== state.thread.id;
    if (threadChanged) {
      this.cancelTimer();
      this.items.clear();
      this.liveTurnIds.clear();
      this.itemOrder = [];
      this.currentThreadId = state.thread.id;
    }
    const hydrate = options.hydrate === true;
    let changed = threadChanged;
    const retainedItemIds = new Set<string>();
    const nextOrder: string[] = [];

    for (const turn of state.thread.turns) {
      const previouslyLive = this.liveTurnIds.has(turn.id);
      if (turn.status === "running") this.liveTurnIds.add(turn.id);
      const historical = hydrate || (!previouslyLive && turn.status !== "running");
      const precedingAssistantIds: string[] = [];

      for (const item of turn.items) {
        if (isAssistantMessage(item)) {
          retainedItemIds.add(item.id);
          nextOrder.push(item.id);
          precedingAssistantIds.push(item.id);
          changed = this.syncAssistantItem(turn, item, historical) || changed;
        } else if (isChronologicalBarrier(item)) {
          for (const assistantItemId of precedingAssistantIds) {
            const presentationItem = this.items.get(assistantItemId);
            if (presentationItem?.presentationStatus === "revealing") {
              this.settleItem(presentationItem);
              changed = true;
            }
          }
        }
      }

      if (turn.status === "cancelled") {
        for (const assistantItemId of precedingAssistantIds) {
          const presentationItem = this.items.get(assistantItemId);
          if (presentationItem?.presentationStatus === "revealing") {
            presentationItem.presentationStatus = "settled";
            changed = true;
          }
        }
      } else if (turn.status === "failed") {
        for (const assistantItemId of precedingAssistantIds) {
          const presentationItem = this.items.get(assistantItemId);
          if (presentationItem && presentationItem.displayedContent !== presentationItem.sourceContent) {
            this.settleItem(presentationItem);
            changed = true;
          }
        }
      }
    }

    for (const itemId of this.items.keys()) {
      if (!retainedItemIds.has(itemId)) {
        this.items.delete(itemId);
        changed = true;
      }
    }
    if (!sameOrder(this.itemOrder, nextOrder)) {
      this.itemOrder = nextOrder;
      changed = true;
    }
    if (this.hasPendingItems()) this.ensureTimer();
    else this.cancelTimer();
    if (changed) this.publish();
  }

  reset(notify = true): void {
    this.cancelTimer();
    this.items.clear();
    this.liveTurnIds.clear();
    this.itemOrder = [];
    this.currentThreadId = undefined;
    if (!this.disposed && notify) this.publish();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelTimer();
    this.items.clear();
    this.liveTurnIds.clear();
    this.itemOrder = [];
    this.currentThreadId = undefined;
  }

  private syncAssistantItem(
    turn: AgentTurn,
    item: Extract<AgentItem, { kind: "message" }>,
    historical: boolean,
  ): boolean {
    const now = this.scheduler.now();
    let presentationItem = this.items.get(item.id);
    if (!presentationItem) {
      presentationItem = {
        turnId: turn.id,
        sourceContent: item.content,
        displayedContent: "",
        sourceDelivery: turn.telemetry?.behavior ?? "unknown",
        presentationMode: "direct",
        presentationStatus: "idle",
        sourceGraphemes: segmentAgentText(item.content),
        displayedGraphemeCount: 0,
        lastSourceAt: now,
      };
      this.items.set(item.id, presentationItem);
      if (historical || this.reducedMotion) {
        this.settleItem(presentationItem);
      } else {
        this.applyLiveSource(presentationItem, turn, item.content, now);
      }
      return true;
    }

    const delivery = turn.telemetry?.behavior ?? presentationItem.sourceDelivery;
    const sourceChanged = presentationItem.sourceContent !== item.content;
    const deliveryChanged = presentationItem.sourceDelivery !== delivery;
    if (!sourceChanged && !deliveryChanged && !(historical && presentationItem.displayedContent !== item.content)) {
      return false;
    }
    presentationItem.sourceDelivery = delivery;
    if (historical || this.reducedMotion) {
      presentationItem.sourceContent = item.content;
      presentationItem.sourceGraphemes = segmentAgentText(item.content);
      this.settleItem(presentationItem);
    } else {
      this.applyLiveSource(presentationItem, turn, item.content, now);
    }
    return true;
  }

  private applyLiveSource(
    item: MutablePresentationItem,
    turn: AgentTurn,
    sourceContent: string,
    now: number,
  ): void {
    const previousSourceLength = item.sourceGraphemes.length;
    const sourceGraphemes = segmentAgentText(sourceContent);
    const addedGraphemes = Math.max(0, sourceGraphemes.length - previousSourceLength);
    const sourceWindowMs = Math.max(0, now - item.lastSourceAt);
    item.sourceContent = sourceContent;
    item.sourceGraphemes = sourceGraphemes;
    item.lastSourceAt = now;
    const mode = presentationMode(
      item.sourceDelivery,
      sourceGraphemes.length,
      addedGraphemes,
      sourceWindowMs,
      turn.status,
    );
    item.presentationMode = mode;
    if (mode === "direct" || sourceGraphemes.length < MIN_PACED_GRAPHEMES) {
      this.settleItem(item);
      return;
    }
    if (!sourceContent.startsWith(item.displayedContent)) {
      item.displayedContent = "";
      item.displayedGraphemeCount = 0;
    }
    item.presentationStatus = item.displayedContent === sourceContent ? "settled" : "revealing";
  }

  private tick = (): void => {
    this.timerId = undefined;
    if (this.disposed) return;
    const item = this.itemOrder
      .map((itemId) => this.items.get(itemId))
      .find((candidate): candidate is MutablePresentationItem => candidate?.presentationStatus === "revealing");
    if (!item) {
      this.publish();
      return;
    }
    const total = item.sourceGraphemes.length;
    const remaining = total - item.displayedGraphemeCount;
    if (remaining <= 0) {
      this.settleItem(item);
    } else {
      const targetDuration = clamp(total * 2.5, MIN_REVEAL_MS, MAX_REVEAL_MS);
      const targetTicks = Math.max(1, Math.ceil(targetDuration / TICK_MS));
      const chunkSize = Math.max(1, Math.ceil(total / targetTicks));
      const idealEnd = Math.min(total, item.displayedGraphemeCount + chunkSize);
      const nextEnd = preferredChunkEnd(item.sourceGraphemes, idealEnd);
      item.displayedGraphemeCount = nextEnd;
      item.displayedContent = item.sourceGraphemes.slice(0, nextEnd).join("");
      if (nextEnd >= total) item.presentationStatus = "settled";
    }
    this.publish();
    if (this.hasPendingItems()) this.ensureTimer();
  };

  private settleItem(item: MutablePresentationItem): void {
    item.displayedContent = item.sourceContent;
    item.displayedGraphemeCount = item.sourceGraphemes.length;
    item.presentationStatus = item.sourceContent ? "settled" : "idle";
  }

  private hasPendingItems(): boolean {
    return this.itemOrder.some((itemId) => this.items.get(itemId)?.presentationStatus === "revealing");
  }

  private ensureTimer(): void {
    if (this.timerId !== undefined || this.disposed) return;
    this.timerId = this.scheduler.setTimeout(this.tick, TICK_MS);
  }

  private cancelTimer(): void {
    if (this.timerId === undefined) return;
    this.scheduler.clearTimeout(this.timerId);
    this.timerId = undefined;
  }

  private publish(): void {
    const items: Record<string, AgentTextDeliveryState> = {};
    for (const [itemId, item] of this.items) {
      items[itemId] = {
        sourceContent: item.sourceContent,
        displayedContent: item.displayedContent,
        sourceDelivery: item.sourceDelivery,
        presentationMode: item.presentationMode,
        presentationStatus: item.presentationStatus,
      };
    }
    this.revision += 1;
    this.snapshot = {
      items,
      revealing: Object.values(items).some((item) => item.presentationStatus === "revealing"),
      revision: this.revision,
    };
    this.onChange();
  }
}

function isAssistantMessage(item: AgentItem): item is Extract<AgentItem, { kind: "message" }> {
  return item.kind === "message" && item.role === "assistant";
}

function isChronologicalBarrier(item: AgentItem): boolean {
  return item.kind !== "message";
}

function presentationMode(
  delivery: AgentStreamingBehavior,
  totalGraphemes: number,
  addedGraphemes: number,
  sourceWindowMs: number,
  turnStatus: AgentTurn["status"],
): "direct" | "paced" {
  if (delivery === "incremental") return "direct";
  if (delivery === "burst" || delivery === "atomic") return "paced";
  if (totalGraphemes < MIN_PACED_GRAPHEMES) return "direct";
  if (addedGraphemes >= UNKNOWN_BURST_GRAPHEMES && sourceWindowMs <= UNKNOWN_BURST_WINDOW_MS) {
    return "paced";
  }
  return turnStatus === "completed" && addedGraphemes >= UNKNOWN_BURST_GRAPHEMES ? "paced" : "direct";
}

function preferredChunkEnd(graphemes: string[], idealEnd: number): number {
  if (idealEnd >= graphemes.length) return graphemes.length;
  const maximum = Math.min(graphemes.length, idealEnd + BOUNDARY_LOOKAROUND);
  for (let index = idealEnd; index <= maximum; index += 1) {
    if (isReadableBoundary(graphemes[index - 1])) return index;
  }
  return idealEnd;
}

function isReadableBoundary(grapheme: string): boolean {
  return /[\s.,!?;:，。！？；：)\]}]/u.test(grapheme);
}

function sameOrder(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((itemId, index) => itemId === right[index]);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
