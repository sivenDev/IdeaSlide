import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { writeFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function loadTauriCommandsModule() {
  const result = await build({
    entryPoints: ["src/lib/tauriCommands.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    plugins: [
      {
        name: "mock-tauri-modules",
        setup(buildApi) {
          buildApi.onResolve({ filter: /^@tauri-apps\/api\/core$/ }, () => ({
            path: "tauri-core-mock",
            namespace: "mock",
          }));
          buildApi.onResolve({ filter: /^@tauri-apps\/plugin-dialog$/ }, () => ({
            path: "tauri-dialog-mock",
            namespace: "mock",
          }));

          buildApi.onLoad({ filter: /^tauri-core-mock$/, namespace: "mock" }, () => ({
            contents:
              "export const invoke = (...args) => globalThis.__invokeMock(...args);",
            loader: "js",
          }));

          buildApi.onLoad({ filter: /^tauri-dialog-mock$/, namespace: "mock" }, () => ({
            contents:
              "export const open = async () => { throw new Error('open not available in test'); }; export const save = async () => { throw new Error('save not available in test'); };",
            loader: "js",
          }));
        },
      },
    ],
  });

  const out = result.outputFiles?.[0];
  if (!out) {
    throw new Error("esbuild did not produce output");
  }

  const tempDir = await mkdtemp(join(tmpdir(), "idea-slide-test-"));
  const bundlePath = join(tempDir, "tauriCommands.bundle.mjs");
  await writeFile(bundlePath, out.text, "utf8");
  return import(pathToFileURL(bundlePath).href);
}

async function captureSavePayload(saveFile, slides) {
  let payload = null;
  globalThis.__invokeMock = async (cmd, args) => {
    if (cmd === "save_file") {
      payload = args;
      return null;
    }
    throw new Error(`Unexpected command: ${cmd}`);
  };

  await saveFile("/tmp/test.is", slides);

  if (!payload) {
    throw new Error("save_file was not invoked");
  }

  return payload;
}

async function run() {
  const mod = await loadTauriCommandsModule();
  const saveFile = mod.saveFile;

  const imageFile = {
    id: "img-file-id",
    mimeType: "image/png",
    dataURL: "data:image/png;base64,AAAA",
    size: 3,
  };

  const element = {
    id: "el-1",
    type: "image",
    fileId: "img-file-id",
  };

  const payloadFromMapFiles = await captureSavePayload(saveFile, [
    {
      id: "slide-1",
      elements: [element],
      appState: {},
      files: new Map([["arbitrary-key", imageFile]]),
    },
  ]);

  assert.equal(
    payloadFromMapFiles.data.media.length,
    1,
    "saveFile should persist media when slide.files is a Map"
  );

  const payloadFromMismatchedRecordKey = await captureSavePayload(saveFile, [
    {
      id: "slide-2",
      elements: [element],
      appState: {},
      files: {
        "random-key": imageFile,
      },
    },
  ]);

  assert.equal(
    payloadFromMismatchedRecordKey.data.media.length,
    1,
    "saveFile should persist media when record key differs from file.id"
  );

  console.log("PASS tauriCommands media regression checks");
}

run().catch((error) => {
  console.error("FAIL tauriCommands media regression checks");
  console.error(error);
  process.exitCode = 1;
});
