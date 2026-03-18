import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Camera } from "./cameraUtils";
import {
  calculateCameraThumbnailViewBox,
  formatSvgViewBox,
  getCameraThumbnailRenderableElements,
  parseSvgViewBox,
} from "./cameraThumbnail";
import { LatestOnlyExecutor, type LatestOnlyExecutorResult } from "./latestOnlyExecutor";
import { extractPreviewAppState } from "./previewKeys";

const PREVIEW_RENDER_REQUEST_EVENT = "preview-render-request";
const PREVIEW_RENDER_RESPONSE_EVENT = "preview-render-response";
const PREVIEW_RENDER_READY_EVENT = "preview-renderer-ready";
const PREVIEW_RENDER_READY_TIMEOUT_MS = 10000;

type PreviewLane = "slide" | "camera";

type SvgMarkupMap = Map<string, string>;

export interface SlidePreviewScene {
  slideId: string;
  renderKey: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
}

interface SlideRenderBatchPayload {
  scenes: SlidePreviewScene[];
}

interface CameraRenderPayload {
  renderKey: string;
  cameras: Camera[];
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
}

interface SlideRenderRequestItem {
  slide_id: string;
  render_key: string;
  scene_content: string;
}

interface PreviewRenderRequest {
  request_id: string;
  lane: PreviewLane;
  slides?: SlideRenderRequestItem[];
  render_key?: string;
  scene_content?: string;
  cameras?: Camera[];
}

interface PreviewRenderResponse {
  request_id: string;
  lane: PreviewLane;
  slides?: Array<{
    slide_id: string;
    render_key: string;
    svg_markup: string;
  }>;
  thumbnails?: Array<{
    camera_id: string;
    svg_markup: string;
  }>;
  error?: string;
}

interface PendingPreviewResponse {
  lane: PreviewLane;
  resolve: (value: SvgMarkupMap) => void;
  reject: (reason?: unknown) => void;
}

function cloneMarkupMap(markup: SvgMarkupMap) {
  return new Map(markup);
}

function createPreviewExportAppState(appState: Partial<any>, exportPadding: number) {
  return {
    ...extractPreviewAppState(appState),
    exportBackground: true,
    exportPadding,
  };
}

let previewRendererInitialized = false;

export async function initPreviewRenderer(): Promise<void> {
  if (previewRendererInitialized) {
    return;
  }

  previewRendererInitialized = true;

  const { exportToSvg, getCommonBounds } = await import("@excalidraw/excalidraw");

  await listen<PreviewRenderRequest>(PREVIEW_RENDER_REQUEST_EVENT, async (event) => {
    const payload = event.payload;

    try {
      if (payload.lane === "slide") {
        const renderedSlides = await Promise.all(
          (payload.slides ?? []).map(async (slide) => {
            const scene = JSON.parse(slide.scene_content) as {
              elements?: readonly any[];
              appState?: Partial<any>;
              files?: Record<string, any>;
            };

            const svg = await exportToSvg({
              elements: (scene.elements ?? []) as any,
              appState: createPreviewExportAppState(scene.appState ?? {}, 10),
              files: (scene.files ?? {}) as any,
            });

            svg.setAttribute("width", "100%");
            svg.setAttribute("height", "100%");

            return {
              slide_id: slide.slide_id,
              render_key: slide.render_key,
              svg_markup: svg.outerHTML,
            };
          }),
        );

        await emit(PREVIEW_RENDER_RESPONSE_EVENT, {
          request_id: payload.request_id,
          lane: "slide",
          slides: renderedSlides,
        } satisfies PreviewRenderResponse);
        return;
      }

      const scene = JSON.parse(payload.scene_content ?? "{}") as {
        elements?: readonly any[];
        appState?: Partial<any>;
        files?: Record<string, any>;
      };
      const elements = scene.elements ?? [];
      const files = scene.files ?? {};
      const cameras = payload.cameras ?? [];
      const renderableElements = getCameraThumbnailRenderableElements(elements);

      if (cameras.length === 0 || renderableElements.length === 0) {
        await emit(PREVIEW_RENDER_RESPONSE_EVENT, {
          request_id: payload.request_id,
          lane: "camera",
          thumbnails: [],
        } satisfies PreviewRenderResponse);
        return;
      }

      const sceneBounds = getCommonBounds(renderableElements as any);
      const baseSvg = await exportToSvg({
        elements: renderableElements as any,
        appState: createPreviewExportAppState(scene.appState ?? {}, 0),
        files: files as any,
      });

      baseSvg.setAttribute("width", "100%");
      baseSvg.setAttribute("height", "100%");

      const sourceViewBox = parseSvgViewBox(baseSvg.getAttribute("viewBox"));
      const thumbnails = cameras.map((camera) => {
        const svg = baseSvg.cloneNode(true) as SVGSVGElement;

        if (sourceViewBox) {
          const thumbnailViewBox = calculateCameraThumbnailViewBox({
            cameraBounds: camera.bounds,
            sceneBounds,
            sourceViewBox,
          });
          svg.setAttribute("viewBox", formatSvgViewBox(thumbnailViewBox));
        }

        return {
          camera_id: camera.id,
          svg_markup: svg.outerHTML,
        };
      });

      await emit(PREVIEW_RENDER_RESPONSE_EVENT, {
        request_id: payload.request_id,
        lane: "camera",
        thumbnails,
      } satisfies PreviewRenderResponse);
    } catch (error) {
      await emit(PREVIEW_RENDER_RESPONSE_EVENT, {
        request_id: payload.request_id,
        lane: payload.lane,
        error: error instanceof Error ? error.message : String(error),
      } satisfies PreviewRenderResponse);
    }
  });

  await invoke("preview_renderer_ready");
}

class PreviewRendererClient {
  private initialized = false;
  private ready = false;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private requestCounter = 0;
  private readonly slideCache = new Map<string, string>();
  private readonly cameraCache = new Map<string, SvgMarkupMap>();
  private readonly pendingResponses = new Map<string, PendingPreviewResponse>();
  private readonly slideExecutor = new LatestOnlyExecutor<SlideRenderBatchPayload, SvgMarkupMap>(
    (payload) => this.performSlideRender(payload),
  );
  private readonly cameraExecutor = new LatestOnlyExecutor<CameraRenderPayload, SvgMarkupMap>(
    (payload) => this.performCameraRender(payload),
  );

  async renderSlides(
    scenes: SlidePreviewScene[],
  ): Promise<LatestOnlyExecutorResult<SvgMarkupMap>> {
    await this.ensureInitialized();

    if (scenes.length === 0) {
      return { status: "completed", value: new Map() };
    }

    const resolved = new Map<string, string>();
    const missingScenes: SlidePreviewScene[] = [];

    for (const scene of scenes) {
      const cachedMarkup = this.slideCache.get(scene.renderKey);
      if (cachedMarkup) {
        resolved.set(scene.slideId, cachedMarkup);
        continue;
      }

      missingScenes.push(scene);
    }

    if (missingScenes.length === 0) {
      return { status: "completed", value: resolved };
    }

    const renderResult = await this.slideExecutor.schedule({ scenes: missingScenes });
    if (renderResult.status === "replaced") {
      return renderResult;
    }

    for (const [renderKey, svgMarkup] of renderResult.value) {
      this.slideCache.set(renderKey, svgMarkup);
    }

    for (const scene of missingScenes) {
      const svgMarkup = renderResult.value.get(scene.renderKey);
      if (svgMarkup) {
        resolved.set(scene.slideId, svgMarkup);
      }
    }

    return {
      status: "completed",
      value: resolved,
    };
  }

  async renderCameras(
    payload: CameraRenderPayload,
  ): Promise<LatestOnlyExecutorResult<SvgMarkupMap>> {
    await this.ensureInitialized();

    if (payload.cameras.length === 0) {
      this.cameraCache.set(payload.renderKey, new Map());
      return { status: "completed", value: new Map() };
    }

    const cached = this.cameraCache.get(payload.renderKey);
    if (cached) {
      return {
        status: "completed",
        value: cloneMarkupMap(cached),
      };
    }

    const renderResult = await this.cameraExecutor.schedule(payload);
    if (renderResult.status === "replaced") {
      return renderResult;
    }

    const nextValue = cloneMarkupMap(renderResult.value);
    this.cameraCache.set(payload.renderKey, nextValue);

    return {
      status: "completed",
      value: cloneMarkupMap(nextValue),
    };
  }

  private async ensureInitialized() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    await listen(PREVIEW_RENDER_READY_EVENT, () => {
      this.markReady();
    });

    await listen<PreviewRenderResponse>(PREVIEW_RENDER_RESPONSE_EVENT, (event) => {
      const response = event.payload;
      const pending = this.pendingResponses.get(response.request_id);
      if (!pending) {
        return;
      }

      this.pendingResponses.delete(response.request_id);

      if (response.error) {
        pending.reject(new Error(response.error));
        return;
      }

      if (pending.lane === "slide") {
        pending.resolve(
          new Map(
            (response.slides ?? []).map((slide) => [slide.render_key, slide.svg_markup]),
          ),
        );
        return;
      }

      pending.resolve(
        new Map(
          (response.thumbnails ?? []).map((thumbnail) => [thumbnail.camera_id, thumbnail.svg_markup]),
        ),
      );
    });

    const rendererReady = await invoke<boolean>("is_preview_renderer_ready").catch(
      () => false,
    );
    if (rendererReady) {
      this.markReady();
    }
  }

  private markReady() {
    if (this.ready) {
      return;
    }

    this.ready = true;
    this.resolveReady?.();
    this.resolveReady = null;
  }

  private async waitForReady() {
    if (this.ready) {
      return;
    }

    if (!this.readyPromise) {
      throw new Error("Preview renderer did not initialize correctly");
    }

    await Promise.race([
      this.readyPromise,
      new Promise((_, reject) => {
        window.setTimeout(() => {
          reject(new Error("Preview renderer ready timeout"));
        }, PREVIEW_RENDER_READY_TIMEOUT_MS);
      }),
    ]);
  }

  private async performSlideRender(payload: SlideRenderBatchPayload) {
    return this.sendSlideRenderRequest(payload);
  }

  private async performCameraRender(payload: CameraRenderPayload) {
    const rendered = await this.sendCameraRenderRequest(payload);
    const nextValue = cloneMarkupMap(rendered);
    this.cameraCache.set(payload.renderKey, nextValue);
    return nextValue;
  }

  private async sendSlideRenderRequest(payload: SlideRenderBatchPayload) {
    await this.waitForReady();

    const requestId = `slide-preview-${this.requestCounter++}`;
    const responsePromise = new Promise<SvgMarkupMap>((resolve, reject) => {
      this.pendingResponses.set(requestId, {
        lane: "slide",
        resolve,
        reject,
      });
    });

    try {
      await emit(PREVIEW_RENDER_REQUEST_EVENT, {
        request_id: requestId,
        lane: "slide",
        slides: payload.scenes.map((scene) => ({
          slide_id: scene.slideId,
          render_key: scene.renderKey,
          scene_content: JSON.stringify({
            elements: scene.elements,
            appState: extractPreviewAppState(scene.appState),
            files: scene.files,
          }),
        })),
      } satisfies PreviewRenderRequest);
    } catch (error) {
      this.pendingResponses.delete(requestId);
      throw error;
    }

    return responsePromise;
  }

  private async sendCameraRenderRequest(payload: CameraRenderPayload) {
    await this.waitForReady();

    const requestId = `camera-preview-${this.requestCounter++}`;
    const responsePromise = new Promise<SvgMarkupMap>((resolve, reject) => {
      this.pendingResponses.set(requestId, {
        lane: "camera",
        resolve,
        reject,
      });
    });

    try {
      await emit(PREVIEW_RENDER_REQUEST_EVENT, {
        request_id: requestId,
        lane: "camera",
        render_key: payload.renderKey,
        scene_content: JSON.stringify({
          elements: payload.elements,
          appState: extractPreviewAppState(payload.appState),
          files: payload.files,
        }),
        cameras: payload.cameras,
      } satisfies PreviewRenderRequest);
    } catch (error) {
      this.pendingResponses.delete(requestId);
      throw error;
    }

    return responsePromise;
  }
}

export const previewRendererClient = new PreviewRendererClient();
