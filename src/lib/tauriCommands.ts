import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Slide } from "../types";

interface IsFileData {
  manifest: {
    version: string;
    created: string;
    modified: string;
    slides: Array<{ id: string; title: string }>;
  };
  slides: Array<{
    id: string;
    content: any;
  }>;
}

function convertFromIsFileData(data: IsFileData): Slide[] {
  return data.slides.map((slide) => ({
    id: slide.id,
    elements: slide.content.elements || [],
    appState: slide.content.appState || {},
  }));
}

function convertToIsFileData(slides: Slide[]): IsFileData {
  return {
    manifest: {
      version: "1.0",
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      slides: slides.map((slide, index) => ({
        id: slide.id,
        title: `Slide ${index + 1}`,
      })),
    },
    slides: slides.map((slide) => ({
      id: slide.id,
      content: {
        type: "excalidraw",
        version: 2,
        elements: slide.elements,
        appState: slide.appState,
        files: {},
      },
    })),
  };
}

export async function createNewFile(): Promise<{ path: string; slides: Slide[] }> {
  const filePath = await save({
    filters: [{ name: "IdeaSlide", extensions: ["is"] }],
    defaultPath: "Untitled.is",
  });

  if (!filePath) {
    throw new Error("File creation cancelled");
  }

  const data = await invoke<IsFileData>("create_file", { path: filePath });
  const slides = convertFromIsFileData(data);

  return { path: filePath, slides };
}

export async function openFile(): Promise<{ path: string; slides: Slide[] }> {
  const filePath = await open({
    filters: [{ name: "IdeaSlide", extensions: ["is"] }],
    multiple: false,
  });

  if (!filePath || typeof filePath !== "string") {
    throw new Error("File selection cancelled");
  }

  const data = await invoke<IsFileData>("open_file", { path: filePath });
  const slides = convertFromIsFileData(data);

  return { path: filePath, slides };
}

export async function saveFile(path: string, slides: Slide[]): Promise<void> {
  const data = convertToIsFileData(slides);
  await invoke("save_file", { path, data });
}

export async function getRecentFiles(): Promise<any[]> {
  try {
    return await invoke<any[]>("get_recent_files");
  } catch {
    return [];
  }
}

export async function openRecentFile(path: string): Promise<Slide[]> {
  const data = await invoke<IsFileData>("open_file", { path });
  return convertFromIsFileData(data);
}
