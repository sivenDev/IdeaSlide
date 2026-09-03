import {
  exportPageAsExcalidraw,
  exportPageAsIdeaSketch,
  getExcalidrawExportFileName,
  getIdeaSketchExportFileName,
  projectPageToExcalidrawScene,
  projectPageToIdeaSketchDocument,
  type PageExportResult,
} from "../ideaSketchPageExport.ts";
import { exportExcalidrawToDrawio, getDrawioFileName, type DrawioExportResult } from "../drawioExport.ts";
import { isDesktopOperationCancelled } from "../tauriCommands.ts";
import { convertExcalidrawToDrawio } from "../excalidrawToDrawio.ts";
import { sdkCancelled, sdkRejected, sdkSucceeded, type IdeaSketchSdkMutationResult, type IdeaSketchSdkScope, type SdkResult } from "./types.ts";
import type { IdeaSketchSdkHostTarget } from "./host.ts";
import type { IdeaSketchRequestLedger, ReservedRequestHandle } from "./requestLedger.ts";

export type IdeaSketchSerializedFormat = "excalidraw" | "ideasketch" | "drawio";
export interface IdeaSketchSerializedPage {
  format: IdeaSketchSerializedFormat;
  fileName: string;
  mimeType: string;
  text: string;
  bytes: readonly number[];
}

export interface IdeaSketchIoServiceInput {
  getTarget: () => IdeaSketchSdkHostTarget | undefined;
  getScopes: () => readonly IdeaSketchSdkScope[];
  isActive: () => boolean;
  isMethodAvailable: (method: string) => boolean;
  openImageExportDialog?: () => void | Promise<void>;
  chooseImport?: () => Promise<{ path: string; text: string }>;
  parseExcalidraw?: (input: unknown) => Promise<SdkResult<string>>;
  applyImport?: (input: { requestId: string; draftRef: string; title?: string; reservedRequestHandle?: ReservedRequestHandle }) => Promise<SdkResult<IdeaSketchSdkMutationResult>>;
  ledger?: IdeaSketchRequestLedger;
}

function getPage(input: IdeaSketchIoServiceInput) {
  const target = input.getTarget();
  if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
  if (target.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
  target.flushDraft?.();
  const refreshed = input.getTarget();
  if (!refreshed) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
  if (refreshed.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
  const page = refreshed.document.pages.find((candidate) => candidate.id === refreshed.activePageId);
  return page ? sdkSucceeded({ target: refreshed, page }) : sdkRejected("editor_unavailable", "The active IdeaSketch Page is unavailable.", true);
}

function strictRequest(value: unknown): { requestId: string } | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string" || key !== "requestId")) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, "requestId");
    if (!descriptor?.enumerable || !("value" in descriptor) || typeof descriptor.value !== "string" || descriptor.value.trim().length === 0) return undefined;
    return { requestId: descriptor.value };
  } catch {
    return undefined;
  }
}

function guard<Value>(input: IdeaSketchIoServiceInput, method: string, userMediated = false): SdkResult<Value> | undefined {
  if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
  const scope = userMediated ? "user-mediated-io" : "io.serialize";
  if (!input.getScopes().includes(scope)) return sdkRejected("capability_denied", "The caller is not authorized for this IO method.");
  if (!input.isMethodAvailable(method)) return sdkRejected("unsupported_operation", `The io.${method} method is not available.`);
  return undefined;
}

function encoded(format: IdeaSketchSerializedFormat, page: any): IdeaSketchSerializedPage {
  if (format === "excalidraw") {
    const value = projectPageToExcalidrawScene(page);
    const text = JSON.stringify(value, null, 2);
    return Object.freeze({ format, fileName: getExcalidrawExportFileName(page.title), mimeType: "application/json", text, bytes: Object.freeze([...new TextEncoder().encode(text)]) });
  }
  if (format === "ideasketch") {
    const value = projectPageToIdeaSketchDocument(page);
    const text = JSON.stringify(value, null, 2);
    return Object.freeze({ format, fileName: getIdeaSketchExportFileName(page.title), mimeType: "application/json", text, bytes: Object.freeze([...new TextEncoder().encode(text)]) });
  }
  const conversion = convertExcalidrawToDrawio({ elements: page.elements, files: page.files }, { diagramName: page.title });
  return Object.freeze({ format, fileName: getDrawioFileName(page.title), mimeType: "application/xml", text: conversion.xml, bytes: Object.freeze([...new TextEncoder().encode(conversion.xml)]) });
}

export function createIdeaSketchIoService(input: IdeaSketchIoServiceInput) {
  const inFlightImports = new Map<string, { digest: string; promise: Promise<SdkResult<IdeaSketchSdkMutationResult>> }>();
  const completedImports = new Map<string, { digest: string; result: SdkResult<IdeaSketchSdkMutationResult> }>();
  async function serialize(format: IdeaSketchSerializedFormat): Promise<SdkResult<IdeaSketchSerializedPage>> {
    const method = format === "excalidraw" ? "serializeActivePageAsExcalidraw" : format === "ideasketch" ? "serializeActivePageAsIdeaSketch" : "serializeActivePageAsDrawio";
    const unavailable = guard<IdeaSketchSerializedPage>(input, method);
    if (unavailable) return unavailable;
    const result = getPage(input);
    if (result.status !== "succeeded") return result;
    try {
      return sdkSucceeded(encoded(format, result.value.page));
    } catch {
      return sdkRejected("internal_error", "The active Page could not be serialized safely.", true);
    }
  }

  async function exportPage(format: "excalidraw" | "ideasketch" | "drawio"): Promise<SdkResult<PageExportResult | DrawioExportResult>> {
    const method = format === "excalidraw" ? "exportActivePageAsExcalidraw" : format === "ideasketch" ? "exportActivePageAsIdeaSketch" : "exportActivePageAsDrawio";
    const unavailable = guard<PageExportResult | DrawioExportResult>(input, method, true);
    if (unavailable) return unavailable;
    const result = getPage(input);
    if (result.status !== "succeeded") return result;
    if (format === "drawio") {
      try {
        const exported = await exportExcalidrawToDrawio({ pageTitle: result.value.page.title, elements: result.value.page.elements, files: result.value.page.files });
        return sdkSucceeded(exported);
      } catch (error) {
        if (isDesktopOperationCancelled(error)) return sdkCancelled("The export was cancelled.");
        return sdkRejected("internal_error", error instanceof Error ? error.message : "The Page could not be exported.", true);
      }
    }
    try {
      const exported = format === "excalidraw" ? await exportPageAsExcalidraw(result.value.page) : await exportPageAsIdeaSketch(result.value.page);
      return exported.status === "cancelled" ? sdkCancelled("The export was cancelled.") : sdkSucceeded(exported);
    } catch (error) {
      if (isDesktopOperationCancelled(error)) return sdkCancelled("The export was cancelled.");
      return sdkRejected("internal_error", error instanceof Error ? error.message : "The Page could not be exported.", true);
    }
  }

  async function openImageExportDialog(): Promise<SdkResult<{ outcome: "opened" }>> {
    const unavailable = guard<{ outcome: "opened" }>(input, "openImageExportDialog", true);
    if (unavailable) return unavailable;
    const result = getPage(input);
    if (result.status !== "succeeded") return result;
    if (!input.openImageExportDialog) return sdkRejected("editor_unavailable", "The image export dialog adapter is unavailable.", true);
    try {
      await input.openImageExportDialog();
      return sdkSucceeded({ outcome: "opened" });
    } catch (error) {
      return sdkRejected("internal_error", error instanceof Error ? error.message : "The image export dialog could not be opened.", true);
    }
  }

  async function pickExcalidrawAndAddPage(rawInput: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>> {
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("user-mediated-io")) return sdkRejected("capability_denied", "The caller is not authorized for this IO method.");
    const target = input.getTarget();
    if (!target?.services.desktop || !input.chooseImport || !input.parseExcalidraw || !input.applyImport) return sdkRejected("desktop_unavailable", "The Excalidraw picker is unavailable in this environment.", true);
    const unavailable = guard<IdeaSketchSdkMutationResult>(input, "pickExcalidrawAndAddPage", true);
    if (unavailable) return unavailable;
    const request = strictRequest(rawInput);
    if (!request) return sdkRejected("invalid_request", "pickExcalidrawAndAddPage requires only a non-empty requestId.");
    const requestId = request.requestId;
    const digest = `pick-excalidraw:${requestId}`;
    let reservedRequestHandle: ReservedRequestHandle | undefined;
    if (input.ledger) {
      const reservation = input.ledger.reserveComposite({ requestId, payloadDigest: digest });
      if (reservation.status === "rejected") return reservation;
      if (reservation.value.kind === "joined") return reservation.value.result;
      if (reservation.value.kind === "replay") return reservation.value.result;
      reservedRequestHandle = reservation.value.handle;
    }
    const completed = completedImports.get(requestId);
    if (completed) return completed.digest === digest ? completed.result : sdkRejected("idempotency_conflict", "The request id was already used for a different import payload.");
    const existing = inFlightImports.get(requestId);
    if (existing) {
      if (existing.digest !== digest) return sdkRejected("idempotency_conflict", "The request id was already used for a different import payload.");
      return existing.promise;
    }
    const completeReservation = (result: SdkResult<IdeaSketchSdkMutationResult>) => {
      if (reservedRequestHandle) input.ledger?.complete(reservedRequestHandle, result);
      return result;
    };
    const current = getPage(input);
    if (current.status !== "succeeded") return completeReservation(current);
    const promise = (async () => {
      try {
        const picked = await input.chooseImport!();
        const parsed = await input.parseExcalidraw!({ data: picked.text, sourceName: picked.path });
        if (parsed.status !== "succeeded") {
          return completeReservation(sdkRejected(parsed.error.code, parsed.error.message, parsed.error.retryable));
        }
        const refreshed = getPage(input);
        if (refreshed.status !== "succeeded") return completeReservation(refreshed);
        const applied = await input.applyImport!({ requestId, draftRef: parsed.value, title: picked.path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, ""), ...(reservedRequestHandle ? { reservedRequestHandle } : {}) });
        return completeReservation(applied);
      } catch (error) {
        if (isDesktopOperationCancelled(error)) return completeReservation(sdkCancelled("The import was cancelled."));
        return completeReservation(sdkRejected("internal_error", error instanceof Error ? error.message : "The Excalidraw Page could not be imported.", true));
      } finally {
        inFlightImports.delete(requestId);
      }
    })();
    inFlightImports.set(requestId, { digest, promise });
    void promise.then((result) => {
      completedImports.set(requestId, { digest, result });
      if (completedImports.size > 64) completedImports.delete(completedImports.keys().next().value as string);
    });
    return promise;
  }

  function dispose() {
    inFlightImports.clear();
    completedImports.clear();
  }

  return {
    serializeActivePageAsExcalidraw: () => serialize("excalidraw"),
    serializeActivePageAsIdeaSketch: () => serialize("ideasketch"),
    serializeActivePageAsDrawio: () => serialize("drawio"),
    exportActivePageAsExcalidraw: () => exportPage("excalidraw"),
    exportActivePageAsIdeaSketch: () => exportPage("ideasketch"),
    exportActivePageAsDrawio: () => exportPage("drawio"),
    openImageExportDialog,
    pickExcalidrawAndAddPage,
    dispose,
  };
}
