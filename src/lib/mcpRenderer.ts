import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

interface RenderRequest {
  request_id: string;
  slide_content: string; // JSON string of Excalidraw scene
}

interface RenderResponse {
  request_id: string;
  png_bytes: number[]; // byte array
  error?: string;
}

export async function initMcpRenderer(): Promise<void> {
  const { exportToBlob } = await import('@excalidraw/excalidraw');

  await listen<RenderRequest>('mcp-render-request', async (event) => {
    const { request_id, slide_content } = event.payload;

    try {
      const scene = JSON.parse(slide_content);
      const elements = scene.elements || [];
      const appState = scene.appState || {};
      const files = scene.files || {};

      const blob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
          viewBackgroundColor: appState.viewBackgroundColor || '#ffffff',
        },
        files,
        getDimensions: () => ({ width: 1920, height: 1080, scale: 1 }),
      });

      const arrayBuffer = await blob.arrayBuffer();
      const pngBytes = Array.from(new Uint8Array(arrayBuffer));

      const response: RenderResponse = {
        request_id,
        png_bytes: pngBytes,
      };
      await emit('mcp-render-response', response);
    } catch (err) {
      const response: RenderResponse = {
        request_id,
        png_bytes: [],
        error: err instanceof Error ? err.message : String(err),
      };
      await emit('mcp-render-response', response);
    }
  });

  // Signal to backend that renderer is ready
  await invoke('mcp_renderer_ready');
}
