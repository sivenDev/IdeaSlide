import { invoke, isTauri } from "@tauri-apps/api/core";
import { message, save } from "@tauri-apps/plugin-dialog";

export type ImageDownloadExtension = "png" | "svg";

export interface BlobDownloadAnchor {
  href: string;
  download: string;
}

export interface ImageBlobDownload {
  extension: ImageDownloadExtension;
  fileName: string;
  mimeType: "image/png" | "image/svg+xml";
}

export interface PersistBlobDownloadDependencies {
  choosePath: (request: ImageBlobDownload) => Promise<string | null>;
  readBytes: (url: string) => Promise<number[]>;
  revokeUrl: (url: string) => void;
  writeBytes: (path: string, data: number[]) => Promise<void>;
}

interface AnchorPrototypeLike {
  click: (this: BlobDownloadAnchor) => void;
}

interface InstallBlobDownloadBridgeOptions {
  anchorPrototype?: AnchorPrototypeLike;
  isTauriRuntime?: () => boolean;
  persist?: (anchor: BlobDownloadAnchor) => Promise<unknown>;
  reportError?: (error: unknown) => void;
}

export function getImageBlobDownload(
  anchor: BlobDownloadAnchor,
): ImageBlobDownload | null {
  if (!anchor.href.startsWith("blob:")) {
    return null;
  }

  const fileName = anchor.download.trim();
  const extensionMatch = /\.(png|svg)$/i.exec(fileName);
  if (!extensionMatch) {
    return null;
  }

  const extension = extensionMatch[1].toLowerCase() as ImageDownloadExtension;
  return {
    extension,
    fileName,
    mimeType: extension === "png" ? "image/png" : "image/svg+xml",
  };
}

async function chooseNativePath(request: ImageBlobDownload) {
  return save({
    defaultPath: request.fileName,
    filters: [
      {
        name: request.extension === "png" ? "PNG image" : "SVG image",
        extensions: [request.extension],
      },
    ],
  });
}

async function readBlobBytes(url: string) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
}

async function writeNativeBytes(path: string, data: number[]) {
  await invoke("write_file_bytes", { path, data });
}

const defaultPersistDependencies: PersistBlobDownloadDependencies = {
  choosePath: chooseNativePath,
  readBytes: readBlobBytes,
  revokeUrl: (url) => URL.revokeObjectURL(url),
  writeBytes: writeNativeBytes,
};

export async function persistTauriBlobDownload(
  anchor: BlobDownloadAnchor,
  dependencies: PersistBlobDownloadDependencies = defaultPersistDependencies,
) {
  const request = getImageBlobDownload(anchor);
  if (!request) {
    return "ignored" as const;
  }

  try {
    const path = await dependencies.choosePath(request);
    if (!path) {
      return "cancelled" as const;
    }

    const data = await dependencies.readBytes(anchor.href);
    await dependencies.writeBytes(path, data);
    return "saved" as const;
  } finally {
    dependencies.revokeUrl(anchor.href);
  }
}

function reportBlobDownloadError(error: unknown) {
  console.error("Failed to export image:", error);
  const detail = error instanceof Error ? error.message : String(error);

  void message(`Failed to export image: ${detail}`, {
    title: "Export Error",
    kind: "error",
  })
    .catch((dialogError) => {
      console.error("Failed to show export error dialog:", dialogError);
    });
}

export function installTauriBlobDownloadBridge(
  options: InstallBlobDownloadBridgeOptions = {},
) {
  const isTauriRuntime = options.isTauriRuntime ?? isTauri;
  if (!isTauriRuntime()) {
    return () => {};
  }

  const anchorPrototype =
    options.anchorPrototype ??
    (typeof HTMLAnchorElement === "undefined"
      ? undefined
      : (HTMLAnchorElement.prototype as AnchorPrototypeLike));
  if (!anchorPrototype) {
    return () => {};
  }

  const originalClick = anchorPrototype.click;
  const persist = options.persist ?? persistTauriBlobDownload;
  const reportError = options.reportError ?? reportBlobDownloadError;
  const bridgedClick = function (this: BlobDownloadAnchor) {
    if (!getImageBlobDownload(this)) {
      originalClick.call(this);
      return;
    }

    void persist(this).catch(reportError);
  };

  anchorPrototype.click = bridgedClick;

  return () => {
    if (anchorPrototype.click === bridgedClick) {
      anchorPrototype.click = originalClick;
    }
  };
}
