import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
  convertExcalidrawToDrawio,
  type DrawioConversionResult,
  type ExcalidrawDrawioScene,
  type ExcalidrawToDrawioOptions,
} from "./excalidrawToDrawio.ts";

export interface DrawioExportInput extends ExcalidrawDrawioScene {
  pageTitle: string;
}

interface DrawioExportDependencies {
  convert: (
    scene: ExcalidrawDrawioScene,
    options: ExcalidrawToDrawioOptions,
  ) => DrawioConversionResult;
  isTauriRuntime: () => boolean;
  choosePath: (fileName: string) => Promise<string | null>;
  writeBytes: (path: string, data: number[]) => Promise<void>;
  download: (fileName: string, xml: string) => void;
}

export type DrawioExportResult = {
  status: "saved" | "downloaded" | "cancelled";
  fileName: string;
  path?: string;
  summary: DrawioConversionResult["summary"];
};

export function getDrawioFileName(pageTitle: string) {
  const withoutExtension = pageTitle.trim().replace(/\.drawio$/i, "");
  const sanitized = withoutExtension
    .replace(/[\\/]+/g, " - ")
    .replace(/[<>:"|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .trim();
  return `${sanitized || "diagram"}.drawio`;
}

async function chooseNativePath(fileName: string) {
  return save({
    defaultPath: fileName,
    filters: [{ name: "draw.io diagram", extensions: ["drawio"] }],
  });
}

async function writeNativeBytes(path: string, data: number[]) {
  await invoke("write_file_bytes", { path, data });
}

function downloadInBrowser(fileName: string, xml: string) {
  const blob = new Blob([xml], { type: "application/vnd.jgraph.mxfile;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const defaultDependencies: DrawioExportDependencies = {
  convert: convertExcalidrawToDrawio,
  isTauriRuntime: isTauri,
  choosePath: chooseNativePath,
  writeBytes: writeNativeBytes,
  download: downloadInBrowser,
};

export async function exportExcalidrawToDrawio(
  input: DrawioExportInput,
  dependencies: DrawioExportDependencies = defaultDependencies,
): Promise<DrawioExportResult> {
  const fileName = getDrawioFileName(input.pageTitle);
  const conversion = dependencies.convert(
    { elements: input.elements, files: input.files },
    { diagramName: input.pageTitle },
  );

  if (!dependencies.isTauriRuntime()) {
    dependencies.download(fileName, conversion.xml);
    return {
      status: "downloaded",
      fileName,
      summary: conversion.summary,
    };
  }

  const path = await dependencies.choosePath(fileName);
  if (!path) {
    return {
      status: "cancelled",
      fileName,
      summary: conversion.summary,
    };
  }

  const data = Array.from(new TextEncoder().encode(conversion.xml));
  await dependencies.writeBytes(path, data);
  return {
    status: "saved",
    fileName,
    path,
    summary: conversion.summary,
  };
}
