import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function loadHookModule() {
  const result = await build({
    entryPoints: ["src/hooks/useSlideThumbnails.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    plugins: [
      {
        name: "mock-react-and-excalidraw",
        setup(buildApi) {
          buildApi.onResolve({ filter: /^react$/ }, () => ({
            path: "react-mock",
            namespace: "mock",
          }));

          buildApi.onResolve({ filter: /^@excalidraw\/excalidraw$/ }, () => ({
            path: "excalidraw-mock",
            namespace: "mock",
          }));

          buildApi.onLoad({ filter: /^react-mock$/, namespace: "mock" }, () => ({
            loader: "js",
            contents: `
              export const useRef = (value) => ({ current: value });
              export const useState = (initialValue) => {
                let state = initialValue;
                const setState = (next) => {
                  state = typeof next === "function" ? next(state) : next;
                  globalThis.__thumbState = state;
                };
                globalThis.__thumbState = state;
                return [state, setState];
              };
              export const useEffect = (effect) => {
                const cleanup = effect();
                globalThis.__thumbCleanup = cleanup;
              };
            `,
          }));

          buildApi.onLoad({ filter: /^excalidraw-mock$/, namespace: "mock" }, () => ({
            loader: "js",
            contents: `
              export const exportToSvg = async (input) => {
                globalThis.__lastExportInput = input;
                return {
                  setAttribute() {},
                };
              };
            `,
          }));
        },
      },
    ],
  });

  const out = result.outputFiles?.[0];
  if (!out) {
    throw new Error("Failed to bundle useSlideThumbnails");
  }

  const dir = await mkdtemp(join(tmpdir(), "idea-slide-thumb-test-"));
  const file = join(dir, "useSlideThumbnails.bundle.mjs");
  await writeFile(file, out.text, "utf8");
  return import(pathToFileURL(file).href);
}

async function run() {
  globalThis.window = globalThis;
  const mod = await loadHookModule();

  const files = {
    "image-id": {
      id: "image-id",
      mimeType: "image/png",
      dataURL: "data:image/png;base64,AAAA",
      size: 3,
    },
  };

  mod.useSlideThumbnails(
    [
      {
        id: "slide-1",
        elements: [{ id: "el-1", type: "image", fileId: "image-id" }],
        appState: {},
        files,
      },
    ],
    0,
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(globalThis.__lastExportInput, "exportToSvg should be called");
  assert.equal(
    globalThis.__lastExportInput.files,
    files,
    "exportToSvg should receive slide.files so image thumbnails can render",
  );

  if (typeof globalThis.__thumbCleanup === "function") {
    globalThis.__thumbCleanup();
  }

  console.log("PASS slide thumbnail image regression check");
}

run().catch((error) => {
  console.error("FAIL slide thumbnail image regression check");
  console.error(error);
  process.exitCode = 1;
});
