import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { exportToSvg, getCommonBounds } from "@excalidraw/excalidraw";
import type { Camera } from "./cameraUtils";
import {
  calculateCameraThumbnailViewBox,
  formatSvgViewBox,
  getCameraThumbnailRenderableElements,
  parseSvgViewBox,
} from "./cameraThumbnail";
import {
  LatestOnlyExecutor,
  type LatestOnlyExecutorResult,
} from "./latestOnlyExecutor";

const CAMERA_RENDER_REQUEST_EVENT = "camera-thumbnail-render-request";
const CAMERA_RENDER_RESPONSE_EVENT = "camera-thumbnail-render-response";
const CAMERA_RENDER_READY_EVENT = "camera-renderer-ready";
const CAMERA_RENDER_READY_TIMEOUT_MS = 10000;

interface CameraThumbnailRenderRequest {
  request_id: string;
  render_key: string;
  scene_content: string;
  cameras: Camera[];
}

interface CameraThumbnailRenderResponse {
  request_id: string;
  render_key: string;
  thumbnails: Array<{
    camera_id: string;
    svg_markup: string;
  }>;
  error?: string;
}

interface CameraThumbnailRenderPayload {
  renderKey: string;
  cameras: Camera[];
  elements: readonly any[];
  files: Record<string, any>;
}

type CameraThumbnailMarkupMap = Map<string, string>;

type PendingResponse = {
  resolve: (value: CameraThumbnailMarkupMap) => void;
  reject: (reason?: unknown) => void;
};

let cameraRendererInitialized = false;

function cloneMarkupMap(thumbnails: CameraThumbnailMarkupMap) {
  return new Map(thumbnails);
}

export async function initCameraThumbnailRenderer(): Promise<void> {
  if (cameraRendererInitialized) {
    return;
  }

  cameraRendererInitialized = true;

  await listen<CameraThumbnailRenderRequest>(
    CAMERA_RENDER_REQUEST_EVENT,
    async (event) => {
      const { request_id, render_key, scene_content, cameras } = event.payload;

      try {
        const scene = JSON.parse(scene_content) as {
          elements?: readonly any[];
          files?: Record<string, any>;
        };
        const elements = scene.elements ?? [];
        const files = scene.files ?? {};
        const sceneElements = getCameraThumbnailRenderableElements(elements);

        if (cameras.length === 0 || sceneElements.length === 0) {
          await emit(CAMERA_RENDER_RESPONSE_EVENT, {
            request_id,
            render_key,
            thumbnails: [],
          } satisfies CameraThumbnailRenderResponse);
          return;
        }

        const sceneBounds = getCommonBounds(sceneElements as any);
        const baseSvg = await exportToSvg({
          elements: sceneElements as any,
          appState: {
            viewBackgroundColor: "#ffffff",
            exportBackground: true,
            exportPadding: 0,
          },
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

        await emit(CAMERA_RENDER_RESPONSE_EVENT, {
          request_id,
          render_key,
          thumbnails,
        } satisfies CameraThumbnailRenderResponse);
      } catch (error) {
        await emit(CAMERA_RENDER_RESPONSE_EVENT, {
          request_id,
          render_key,
          thumbnails: [],
          error: error instanceof Error ? error.message : String(error),
        } satisfies CameraThumbnailRenderResponse);
      }
    }
  );

  await invoke("camera_renderer_ready");
}

class CameraThumbnailRendererClient {
  private initialized = false;
  private ready = false;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private requestCounter = 0;
  private readonly cache = new Map<string, CameraThumbnailMarkupMap>();
  private readonly inflightByKey = new Map<string, Promise<CameraThumbnailMarkupMap>>();
  private readonly pendingResponses = new Map<string, PendingResponse>();
  private readonly executor = new LatestOnlyExecutor<
    CameraThumbnailRenderPayload,
    CameraThumbnailMarkupMap
  >((payload) => this.performRender(payload));

  async render(
    payload: CameraThumbnailRenderPayload
  ): Promise<LatestOnlyExecutorResult<CameraThumbnailMarkupMap>> {
    await this.ensureInitialized();

    if (payload.cameras.length === 0) {
      this.cache.set(payload.renderKey, new Map());
      return { status: "completed", value: new Map() };
    }

    const cached = this.cache.get(payload.renderKey);
    if (cached) {
      return { status: "completed", value: cloneMarkupMap(cached) };
    }

    const inflight = this.inflightByKey.get(payload.renderKey);
    if (inflight) {
      return {
        status: "completed",
        value: cloneMarkupMap(await inflight),
      };
    }

    const result = await this.executor.schedule(payload);
    if (result.status === "replaced") {
      return result;
    }

    return {
      status: "completed",
      value: cloneMarkupMap(result.value),
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

    await listen(CAMERA_RENDER_READY_EVENT, () => {
      this.markReady();
    });

    await listen<CameraThumbnailRenderResponse>(
      CAMERA_RENDER_RESPONSE_EVENT,
      (event) => {
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

        pending.resolve(
          new Map(
            response.thumbnails.map((thumbnail) => [
              thumbnail.camera_id,
              thumbnail.svg_markup,
            ])
          )
        );
      }
    );

    const rendererReady = await invoke<boolean>("is_camera_renderer_ready").catch(
      () => false
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
      throw new Error("Camera renderer did not initialize correctly");
    }

    await Promise.race([
      this.readyPromise,
      new Promise((_, reject) => {
        window.setTimeout(() => {
          reject(new Error("Camera renderer ready timeout"));
        }, CAMERA_RENDER_READY_TIMEOUT_MS);
      }),
    ]);
  }

  private async performRender(payload: CameraThumbnailRenderPayload) {
    const inflight = this.inflightByKey.get(payload.renderKey);
    if (inflight) {
      return inflight;
    }

    const renderPromise = this.sendRenderRequest(payload)
      .then((thumbnails) => {
        const next = cloneMarkupMap(thumbnails);
        this.cache.set(payload.renderKey, next);
        return next;
      })
      .finally(() => {
        this.inflightByKey.delete(payload.renderKey);
      });

    this.inflightByKey.set(payload.renderKey, renderPromise);
    return renderPromise;
  }

  private async sendRenderRequest(payload: CameraThumbnailRenderPayload) {
    await this.waitForReady();

    const requestId = `camera-thumb-${this.requestCounter++}`;
    const responsePromise = new Promise<CameraThumbnailMarkupMap>((resolve, reject) => {
      this.pendingResponses.set(requestId, { resolve, reject });
    });

    try {
      await emit(CAMERA_RENDER_REQUEST_EVENT, {
        request_id: requestId,
        render_key: payload.renderKey,
        scene_content: JSON.stringify({
          elements: payload.elements,
          files: payload.files,
        }),
        cameras: payload.cameras,
      } satisfies CameraThumbnailRenderRequest);
    } catch (error) {
      this.pendingResponses.delete(requestId);
      throw error;
    }

    return responsePromise;
  }
}

export const cameraThumbnailRendererClient = new CameraThumbnailRendererClient();
