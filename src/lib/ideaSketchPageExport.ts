import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { IdeaSketchDocument, IdeaSketchPage } from "../types";
import { createIdeaSketchDocumentFromPage } from "./ideaSketchDocument.ts";
import {
  chooseStandaloneSavePath,
  saveStandaloneDocument,
  writeFileBytes,
} from "./tauriCommands.ts";

const FALLBACK_BASE_NAME = "page";

export interface ExcalidrawScene {
  type: "excalidraw";
  version: number;
  source: string;
  elements: any[];
  appState: Record<string, any>;
  files: Record<string, any>;
}

export interface PageProjectionOptions {
  now?: string;
  pageId?: string;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function sanitizePageFileBaseName(pageTitle: string, extension: string): string {
  const withoutExtension = pageTitle.trim().replace(new RegExp(`\\.${extension}$`, "i"), "");
  const sanitized = withoutExtension
    .replace(/[\\/]+/g, " - ")
    .replace(/[<>:"|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .trim();
  return sanitized || FALLBACK_BASE_NAME;
}

export function getExcalidrawExportFileName(pageTitle: string): string {
  return `${sanitizePageFileBaseName(pageTitle, "excalidraw")}.excalidraw`;
}

export function getIdeaSketchExportFileName(pageTitle: string): string {
  return `${sanitizePageFileBaseName(pageTitle, "is")}.is`;
}

export function projectPageToExcalidrawScene(page: IdeaSketchPage): ExcalidrawScene {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements: clone(page.elements as any[]),
    appState: clone((page.appState ?? {}) as Record<string, any>),
    files: clone((page.files ?? {}) as Record<string, any>),
  };
}

export function projectPageToIdeaSketchDocument(
  page: IdeaSketchPage,
  options: PageProjectionOptions = {},
): IdeaSketchDocument {
  return createIdeaSketchDocumentFromPage(page, options);
}

export type PageExportResult =
  | { status: "saved"; fileName: string; path: string }
  | { status: "downloaded"; fileName: string }
  | { status: "cancelled"; fileName: string };

interface ExcalidrawExportDependencies {
  isTauriRuntime: () => boolean;
  choosePath: (fileName: string) => Promise<string | null>;
  writeBytes: (path: string, data: number[]) => Promise<void>;
  download: (fileName: string, contents: string) => void;
}

interface IdeaSketchExportDependencies {
  choosePath: (fileName: string) => Promise<string | null>;
  saveDocument: (path: string, model: IdeaSketchDocument) => Promise<void>;
  now: () => string;
}

async function chooseExcalidrawSavePath(fileName: string): Promise<string | null> {
  return save({
    defaultPath: fileName,
    filters: [{ name: "Excalidraw scene", extensions: ["excalidraw"] }],
  });
}

function downloadTextInBrowser(fileName: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const excalidrawExportDependencies: ExcalidrawExportDependencies = {
  isTauriRuntime: isTauri,
  choosePath: chooseExcalidrawSavePath,
  writeBytes: writeFileBytes,
  download: downloadTextInBrowser,
};

const ideaSketchExportDependencies: IdeaSketchExportDependencies = {
  choosePath: (fileName) => chooseStandaloneSavePath(fileName, "ideasketch"),
  saveDocument: async (path, model) => {
    await saveStandaloneDocument(path, model);
  },
  now: () => new Date().toISOString(),
};

export async function exportPageAsExcalidraw(
  page: IdeaSketchPage,
  dependencies: ExcalidrawExportDependencies = excalidrawExportDependencies,
): Promise<PageExportResult> {
  const fileName = getExcalidrawExportFileName(page.title);
  const scene = projectPageToExcalidrawScene(page);
  const contents = JSON.stringify(scene, null, 2);

  if (!dependencies.isTauriRuntime()) {
    dependencies.download(fileName, contents);
    return { status: "downloaded", fileName };
  }

  const path = await dependencies.choosePath(fileName);
  if (!path) return { status: "cancelled", fileName };

  await dependencies.writeBytes(path, Array.from(new TextEncoder().encode(contents)));
  return { status: "saved", fileName, path };
}

export async function exportPageAsIdeaSketch(
  page: IdeaSketchPage,
  dependencies: IdeaSketchExportDependencies = ideaSketchExportDependencies,
): Promise<PageExportResult> {
  const fileName = getIdeaSketchExportFileName(page.title);
  const path = await dependencies.choosePath(fileName);
  if (!path) return { status: "cancelled", fileName };

  const model = projectPageToIdeaSketchDocument(page, { now: dependencies.now() });
  await dependencies.saveDocument(path, model);
  return { status: "saved", fileName, path };
}
