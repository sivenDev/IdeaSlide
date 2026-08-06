import { CAMERA_PREVIEW_ID } from "./cameraDrawing.ts";

export interface ExcalidrawDrawioScene {
  elements: readonly any[];
  files?: Record<string, any>;
}

export interface ExcalidrawToDrawioOptions {
  diagramName?: string;
  modifiedAt?: Date | string;
}

export interface DrawioConversionSummary {
  exported: number;
  skipped: number;
  skippedTypes: string[];
}

export interface DrawioConversionResult {
  xml: string;
  summary: DrawioConversionSummary;
}

interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VertexCell {
  kind: "vertex";
  id: string;
  value: string;
  style: string;
  geometry: Geometry;
}

interface EdgeCell {
  kind: "edge";
  id: string;
  value: string;
  style: string;
  source?: string;
  target?: string;
  sourcePoint: { x: number; y: number };
  targetPoint: { x: number; y: number };
  waypoints: Array<{ x: number; y: number }>;
}

type DrawioCell = VertexCell | EdgeCell;

const VERTEX_TYPES = new Set(["rectangle", "ellipse", "diamond", "image", "freedraw"]);
const EDGE_TYPES = new Set(["line", "arrow"]);
const SUPPORTED_TYPES = new Set([...VERTEX_TYPES, ...EDGE_TYPES, "text"]);

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value: unknown, fallback = 0) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const rounded = Math.round(number * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function normalizeDegrees(angle: unknown) {
  if (typeof angle !== "number" || !Number.isFinite(angle) || angle === 0) return 0;
  const degrees = angle * 180 / Math.PI;
  return Math.round(((degrees % 360) + 360) % 360 * 1000) / 1000;
}

function textValue(element: any) {
  return String(element.text ?? "")
    .split(/\r?\n/)
    .map((line) => htmlEscape(line))
    .join("<br>");
}

function appendRotation(parts: string[], element: any) {
  const rotation = normalizeDegrees(element.angle);
  if (rotation !== 0) parts.push(`rotation=${formatNumber(rotation)}`);
}

function appendOpacity(parts: string[], element: any) {
  if (typeof element.opacity === "number" && element.opacity !== 100) {
    parts.push(`opacity=${formatNumber(Math.max(0, Math.min(100, element.opacity)))}`);
  }
}

function shapeStyle(element: any) {
  const shape = element.type === "ellipse"
    ? "ellipse"
    : element.type === "diamond"
      ? "rhombus"
      : "rectangle";
  const parts = [
    `shape=${shape}`,
    "whiteSpace=wrap",
    "html=1",
    `strokeColor=${element.strokeColor || "#000000"}`,
    "strokeWidth=2",
    element.backgroundColor && element.backgroundColor !== "transparent"
      ? `fillColor=${element.backgroundColor}`
      : "fillColor=none",
  ];

  appendRotation(parts, element);
  return parts.join(";");
}

function textStyle(element: any) {
  const parts = [
    "shape=text",
    "html=1",
    "whiteSpace=wrap",
    "strokeColor=none",
    "fillColor=none",
    `fontColor=${element.strokeColor || "#000000"}`,
    `fontSize=${formatNumber(Math.max(4, element.fontSize || 16), 16)}`,
    "fontFamily=Helvetica",
    `align=${element.textAlign || "left"}`,
    `verticalAlign=${element.verticalAlign || "top"}`,
    "spacingLeft=0",
    "spacingRight=0",
    "spacingTop=0",
    "spacingBottom=0",
  ];
  appendRotation(parts, element);
  return parts.join(";");
}

function mapArrowhead(value: unknown) {
  switch (value) {
    case "arrow":
    case "triangle":
      return { shape: "block", fill: 1 };
    case "triangle_outline":
      return { shape: "block", fill: 0 };
    case "diamond":
      return { shape: "diamond", fill: 1 };
    case "diamond_outline":
      return { shape: "diamond", fill: 0 };
    case "dot":
    case "circle":
      return { shape: "oval", fill: 1 };
    case "circle_outline":
      return { shape: "oval", fill: 0 };
    case "bar":
      return { shape: "open", fill: 0 };
    default:
      return { shape: "none", fill: 0 };
  }
}

function edgeStyle(element: any) {
  const start = mapArrowhead(element.startArrowhead);
  const end = mapArrowhead(element.endArrowhead ?? element.arrowhead);
  const parts = [
    "edgeStyle=none",
    "html=1",
    "rounded=0",
    `strokeColor=${element.strokeColor || "#000000"}`,
    "strokeWidth=2",
    "fillColor=none",
    `startArrow=${start.shape}`,
    `startFill=${start.fill}`,
    `endArrow=${end.shape}`,
    `endFill=${end.fill}`,
  ];
  return parts.join(";");
}

function resolveImageDataUrl(files: Record<string, any>, element: any) {
  const file = element.fileId ? files[element.fileId] : undefined;
  if (!file) return undefined;
  const normalize = (value: string) => value.replace(
    /^(data:image\/(?:png|jpe?g|gif|webp|svg\+xml));base64,/i,
    "$1,",
  );
  if (typeof file.dataURL === "string") return normalize(file.dataURL);
  if (typeof file.data === "string") return normalize(file.data);
  if (typeof file.base64 === "string") {
    return normalize(`data:${file.mimeType || "image/png"};base64,${file.base64}`);
  }
  return undefined;
}

function imageStyle(element: any, files: Record<string, any>) {
  const dataUrl = resolveImageDataUrl(files, element);
  const parts = dataUrl
    ? ["shape=image", "imageAspect=0", "aspect=fixed", `image=${dataUrl}`]
    : ["shape=rectangle", "dashed=1", "fillColor=#f5f5f5", "strokeColor=#999999"];
  appendOpacity(parts, element);
  appendRotation(parts, element);
  return parts.join(";");
}

function buildFreehandPayload(element: any) {
  const points = Array.isArray(element.points) ? element.points : [];
  if (points.length === 0) return undefined;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    const x = Number(point?.[0]);
    const y = Number(point?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return undefined;

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const path = points
    .map((point: any, index: number) => {
      const x = Number(point?.[0]) - minX;
      const y = Number(point?.[1]) - minY;
      return `${index === 0 ? "M" : "L"}${formatNumber(x)} ${formatNumber(y)}`;
    })
    .join(" ");
  const opacity = typeof element.opacity === "number" ? Math.max(0, Math.min(1, element.opacity / 100)) : 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(width)}" height="${formatNumber(height)}" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}"><path d="${path}" fill="none" stroke="${xmlEscape(element.strokeColor || "#000000")}" stroke-width="${formatNumber(Math.max(1, element.strokeWidth || 1), 1)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${formatNumber(opacity)}"/></svg>`;
  return {
    dataUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    offsetX: minX,
    offsetY: minY,
    width,
    height,
  };
}

function getElementBounds(element: any) {
  if ((EDGE_TYPES.has(element.type) || element.type === "freedraw") && Array.isArray(element.points)) {
    const points = element.points
      .map((point: any) => ({ x: Number(element.x || 0) + Number(point?.[0] || 0), y: Number(element.y || 0) + Number(point?.[1] || 0) }));
    if (points.length > 0) {
      return {
        minX: Math.min(...points.map((point: any) => point.x)),
        minY: Math.min(...points.map((point: any) => point.y)),
      };
    }
  }
  return { minX: Number(element.x || 0), minY: Number(element.y || 0) };
}

function isIgnored(element: any) {
  return Boolean(
    element?.isDeleted
    || element?.id === CAMERA_PREVIEW_ID
    || element?.customData?.type === "camera",
  );
}

function isBoundText(element: any, cellIds: Map<string, string>) {
  return element.type === "text"
    && typeof element.containerId === "string"
    && cellIds.has(element.containerId);
}

function geometryForVertex(element: any, shiftX: number, shiftY: number, files: Record<string, any>) {
  if (element.type === "freedraw") {
    const payload = buildFreehandPayload(element);
    if (payload) {
      return {
        style: `shape=image;imageAspect=0;aspect=fixed;image=${payload.dataUrl}`,
        geometry: {
          x: Number(element.x || 0) + payload.offsetX + shiftX,
          y: Number(element.y || 0) + payload.offsetY + shiftY,
          width: payload.width,
          height: payload.height,
        },
        value: "",
      };
    }
  }

  return {
    style: element.type === "text"
      ? textStyle(element)
      : element.type === "image"
        ? imageStyle(element, files)
        : shapeStyle(element),
    geometry: {
      x: Number(element.x || 0) + shiftX,
      y: Number(element.y || 0) + shiftY,
      width: Math.max(1, Number(element.width || (element.type === "text" ? 100 : 1))),
      height: Math.max(1, Number(element.height || (element.type === "text" ? 30 : 1))),
    },
    value: element.type === "text" ? textValue(element) : element.type === "image" && !resolveImageDataUrl(files, element) ? "Missing image" : "",
  };
}

function serializeCell(cell: DrawioCell) {
  if (cell.kind === "vertex") {
    return `<mxCell id="${cell.id}" value="${xmlEscape(cell.value)}" style="${xmlEscape(cell.style)}" vertex="1" parent="1"><mxGeometry x="${formatNumber(cell.geometry.x)}" y="${formatNumber(cell.geometry.y)}" width="${formatNumber(cell.geometry.width)}" height="${formatNumber(cell.geometry.height)}" as="geometry"/></mxCell>`;
  }

  const source = cell.source ? ` source="${cell.source}"` : "";
  const target = cell.target ? ` target="${cell.target}"` : "";
  const points = cell.waypoints.length > 0
    ? `<Array as="points">${cell.waypoints.map((point) => `<mxPoint x="${formatNumber(point.x)}" y="${formatNumber(point.y)}"/>`).join("")}</Array>`
    : "";
  return `<mxCell id="${cell.id}" value="${xmlEscape(cell.value)}" style="${xmlEscape(cell.style)}" edge="1" parent="1"${source}${target}><mxGeometry relative="1" as="geometry">${points}<mxPoint x="${formatNumber(cell.sourcePoint.x)}" y="${formatNumber(cell.sourcePoint.y)}" as="sourcePoint"/><mxPoint x="${formatNumber(cell.targetPoint.x)}" y="${formatNumber(cell.targetPoint.y)}" as="targetPoint"/></mxGeometry></mxCell>`;
}

export function convertExcalidrawToDrawio(
  scene: ExcalidrawDrawioScene,
  options: ExcalidrawToDrawioOptions = {},
): DrawioConversionResult {
  const files = scene.files ?? {};
  const visibleElements = scene.elements.filter((element) => !isIgnored(element));
  const supportedElements = visibleElements.filter((element) => SUPPORTED_TYPES.has(element?.type));
  const skippedElements = visibleElements.filter((element) => !SUPPORTED_TYPES.has(element?.type));
  const skippedTypes = [...new Set(skippedElements.map((element) => String(element?.type || "unknown")))].sort();

  let minX = 0;
  let minY = 0;
  for (const element of supportedElements) {
    const bounds = getElementBounds(element);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
  }
  const shiftX = -minX;
  const shiftY = -minY;

  const elementById = new Map(supportedElements.map((element) => [element.id, element]));
  const cellIds = new Map<string, string>();
  let nextId = 2;
  for (const element of supportedElements) {
    const isMergeableLabel = element.type === "text"
      && typeof element.containerId === "string"
      && elementById.has(element.containerId)
      && (VERTEX_TYPES.has(elementById.get(element.containerId)?.type) || EDGE_TYPES.has(elementById.get(element.containerId)?.type));
    if (!isMergeableLabel) {
      cellIds.set(element.id, String(nextId));
      nextId += 1;
    }
  }

  const cells: DrawioCell[] = [];
  const cellsById = new Map<string, DrawioCell>();
  for (const element of supportedElements) {
    if (isBoundText(element, cellIds)) continue;
    const id = cellIds.get(element.id);
    if (!id) continue;

    let cell: DrawioCell;
    if (EDGE_TYPES.has(element.type)) {
      const points = Array.isArray(element.points) && element.points.length > 0
        ? element.points
        : [[0, 0], [Number(element.width || 0), Number(element.height || 0)]];
      const absolutePoints = points.map((point: any) => ({
        x: Number(element.x || 0) + Number(point?.[0] || 0) + shiftX,
        y: Number(element.y || 0) + Number(point?.[1] || 0) + shiftY,
      }));
      cell = {
        kind: "edge",
        id,
        value: "",
        style: edgeStyle(element),
        source: element.startBinding?.elementId ? cellIds.get(element.startBinding.elementId) : undefined,
        target: element.endBinding?.elementId ? cellIds.get(element.endBinding.elementId) : undefined,
        sourcePoint: absolutePoints[0],
        targetPoint: absolutePoints[absolutePoints.length - 1],
        waypoints: absolutePoints.slice(1, -1),
      };
    } else {
      const projected = geometryForVertex(element, shiftX, shiftY, files);
      cell = {
        kind: "vertex",
        id,
        value: projected.value,
        style: projected.style,
        geometry: projected.geometry,
      };
    }
    cells.push(cell);
    cellsById.set(id, cell);
  }

  for (const element of supportedElements) {
    if (element.type !== "text" || typeof element.containerId !== "string") continue;
    const parentId = cellIds.get(element.containerId);
    if (!parentId) continue;
    const parent = cellsById.get(parentId);
    if (!parent) continue;
    parent.value = textValue(element);
    const additions = [
      "html=1",
      "whiteSpace=wrap",
      `fontColor=${element.strokeColor || "#000000"}`,
      `fontSize=${formatNumber(Math.max(4, element.fontSize || 16), 16)}`,
      "fontFamily=Helvetica",
      `align=${element.textAlign || "center"}`,
      `verticalAlign=${element.verticalAlign || "middle"}`,
    ];
    parent.style = `${parent.style};${additions.join(";")}`;
  }

  const modifiedAt = options.modifiedAt instanceof Date
    ? options.modifiedAt.toISOString()
    : options.modifiedAt ?? new Date().toISOString();
  const diagramName = options.diagramName?.trim() || "Page 1";
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<mxfile host="app.diagrams.net" modified="${xmlEscape(modifiedAt)}" agent="IdeaNote" version="24.7.17" type="device">`,
    `  <diagram id="page-1" name="${xmlEscape(diagramName)}">`,
    `    <mxGraphModel dx="1024" dy="768" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">`,
    `      <root>`,
    `        <mxCell id="0"/>`,
    `        <mxCell id="1" parent="0"/>`,
    ...cells.map((cell) => `        ${serializeCell(cell)}`),
    `      </root>`,
    `    </mxGraphModel>`,
    `  </diagram>`,
    `</mxfile>`,
  ];

  return {
    xml: lines.join("\n"),
    summary: {
      exported: supportedElements.length,
      skipped: skippedElements.length,
      skippedTypes,
    },
  };
}
