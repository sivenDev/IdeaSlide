import { CaptureUpdateAction, Excalidraw, exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import { ChevronDown, ChevronUp, Copy, Download, Eye, FileImage, Focus, MonitorPlay, PanelRightClose, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { describeSketch, ensureIdeaSketchModel, moveItem } from "./ideaSketchModel.js";

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PresentationMode({ model, laserEnabled, onClose }) {
  const cameras = model.cameras.length ? model.cameras : [{ id: "page", name: "Full page", pageId: model.activePageId }];
  const [index, setIndex] = useState(0);
  const [trail, setTrail] = useState([]);
  const camera = cameras[index];
  const page = model.pages.find((item) => item.id === camera.pageId) ?? model.pages[0];

  useEffect(() => {
    const key = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); setIndex((value) => Math.min(cameras.length - 1, value + 1)); }
      if (event.key === "ArrowLeft") { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [cameras.length, onClose]);

  return (
    <div className="presentation-mode" onPointerMove={(event) => laserEnabled && setTrail((items) => [...items.slice(-16), { x: event.clientX, y: event.clientY, id: performance.now() }])}>
      <div className="presentation-stage"><Excalidraw key={`${page.id}-${index}`} initialData={{ elements: page.elements, appState: { viewBackgroundColor: "#ffffff" } }} viewModeEnabled zenModeEnabled gridModeEnabled={false} /></div>
      {trail.map((point, pointIndex) => <span key={point.id} className="laser-point" style={{ left: point.x, top: point.y, opacity: (pointIndex + 1) / trail.length }} />)}
      <div className="presentation-controls"><button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))}>Previous</button><span>{camera.name} · {index + 1}/{cameras.length}</span><button type="button" onClick={() => setIndex((value) => Math.min(cameras.length - 1, value + 1))}>Next</button><button type="button" onClick={onClose}>Exit</button></div>
    </div>
  );
}

function Navigator({ model, setModel, activePage, setActivePage, apiRef, readOnly, open, setOpen, onPresent }) {
  const [tab, setTab] = useState("pages");
  if (!open) return null;
  const update = (next) => { setModel(next); };
  const addPage = () => {
    const page = { id: crypto.randomUUID(), name: `Page ${model.pages.length + 1}`, elements: [] };
    update({ ...model, pages: [...model.pages, page], activePageId: page.id });
    setActivePage(page.id);
  };
  const duplicatePage = (page) => {
    const copy = { ...structuredClone(page), id: crypto.randomUUID(), name: `${page.name} copy` };
    const index = model.pages.findIndex((item) => item.id === page.id);
    const pages = [...model.pages]; pages.splice(index + 1, 0, copy);
    update({ ...model, pages, activePageId: copy.id }); setActivePage(copy.id);
  };
  const deletePage = (page) => {
    if (model.pages.length <= 1) return;
    const pages = model.pages.filter((item) => item.id !== page.id);
    const activePageId = activePage === page.id ? pages[0].id : activePage;
    update({ ...model, pages, cameras: model.cameras.filter((camera) => camera.pageId !== page.id), activePageId }); setActivePage(activePageId);
  };
  const addCamera = () => {
    const appState = apiRef.current?.getAppState?.() ?? {};
    const camera = { id: crypto.randomUUID(), name: `Camera ${model.cameras.length + 1}`, pageId: activePage, x: appState.scrollX ?? 0, y: appState.scrollY ?? 0, zoom: appState.zoom?.value ?? 1 };
    update({ ...model, cameras: [...model.cameras, camera] });
  };
  return (
    <aside className="ideasketch-navigator">
      <header><div className="navigator-tabs"><button className={tab === "pages" ? "is-active" : ""} type="button" onClick={() => setTab("pages")}>Pages</button><button className={tab === "cameras" ? "is-active" : ""} type="button" onClick={() => setTab("cameras")}>Cameras</button></div><button type="button" title="Close Navigator" onClick={() => setOpen(false)}><PanelRightClose size={14} /></button></header>
      {tab === "pages" ? <div className="navigator-list">{model.pages.map((page, index) => <div className={`navigator-row ${activePage === page.id ? "is-active" : ""}`} key={page.id}><button className="navigator-main" type="button" onClick={() => setActivePage(page.id)}><span>{String(index + 1).padStart(2, "0")}</span><input aria-label={`Page name ${index + 1}`} value={page.name} readOnly={readOnly} onChange={(event) => update({ ...model, pages: model.pages.map((item) => item.id === page.id ? { ...item, name: event.target.value } : item) })} /></button><div className="navigator-row-actions"><button type="button" title="Move up" onClick={() => update({ ...model, pages: moveItem(model.pages, index, -1) })}><ChevronUp size={12} /></button><button type="button" title="Move down" onClick={() => update({ ...model, pages: moveItem(model.pages, index, 1) })}><ChevronDown size={12} /></button><button type="button" title="Duplicate Page" onClick={() => duplicatePage(page)}><Copy size={12} /></button><button type="button" title="Delete Page" onClick={() => deletePage(page)}><Trash2 size={12} /></button></div></div>)}<button className="navigator-add" type="button" onClick={addPage} disabled={readOnly}><Plus size={13} />Add Page</button></div>
        : <div className="navigator-list">{model.cameras.map((camera, index) => <div className="navigator-row camera-row" key={camera.id}><button className="navigator-main" type="button" onClick={() => { setActivePage(camera.pageId); window.setTimeout(() => apiRef.current?.scrollToContent?.(apiRef.current.getSceneElements(), { fitToContent: true, animate: true }), 80); }}><Focus size={13} /><input aria-label={`Camera name ${index + 1}`} value={camera.name} readOnly={readOnly} onChange={(event) => update({ ...model, cameras: model.cameras.map((item) => item.id === camera.id ? { ...item, name: event.target.value } : item) })} /></button><div className="navigator-row-actions"><button type="button" title="Move up" onClick={() => update({ ...model, cameras: moveItem(model.cameras, index, -1) })}><ChevronUp size={12} /></button><button type="button" title="Move down" onClick={() => update({ ...model, cameras: moveItem(model.cameras, index, 1) })}><ChevronDown size={12} /></button><button type="button" title="Delete Camera" onClick={() => update({ ...model, cameras: model.cameras.filter((item) => item.id !== camera.id) })}><Trash2 size={12} /></button></div></div>)}{!model.cameras.length && <p className="navigator-empty">Capture the current viewport to define a presentation step.</p>}<button className="navigator-add" type="button" onClick={addCamera} disabled={readOnly}><Plus size={13} />Add Camera</button><button className="navigator-present" type="button" onClick={onPresent}><MonitorPlay size={13} />Present from first Camera</button></div>}
    </aside>
  );
}

export function IdeaSketchEditor({ document, onChange, onRegisterAdapter, laserEnabled = true }) {
  const [model, setModelState] = useState(() => ensureIdeaSketchModel(document.content));
  const [activePage, setActivePageState] = useState(() => ensureIdeaSketchModel(document.content).activePageId);
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [toast, setToast] = useState("");
  const apiRef = useRef(null);
  const modelRef = useRef(model);
  const ignoreFirstChange = useRef(true);
  const activePageModel = useMemo(() => model.pages.find((page) => page.id === activePage) ?? model.pages[0], [model, activePage]);
  modelRef.current = model;

  const publish = (next) => { modelRef.current = next; setModelState(next); onChange(next); };
  const setActivePage = (pageId) => { setActivePageState(pageId); publish({ ...modelRef.current, activePageId: pageId }); ignoreFirstChange.current = true; };
  const setModel = (next) => { publish(next); if (next.activePageId !== activePage) { setActivePageState(next.activePageId); ignoreFirstChange.current = true; } };

  useEffect(() => {
    onRegisterAdapter?.({
      type: "ideasketch",
      getContext: () => ({ ...describeSketch(modelRef.current), selection: Object.keys(apiRef.current?.getAppState?.().selectedElementIds ?? {}) }),
      applyTransaction: (label) => {
        const api = apiRef.current;
        if (!api || document.readOnly) return false;
        const elements = api.getSceneElements();
        const newElement = { id: crypto.randomUUID(), type: "text", x: 120, y: 120 + elements.length * 16, width: 220, height: 24, angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 0, opacity: 100, groupIds: [], frameId: null, index: null, roundness: null, seed: Math.floor(Math.random() * 100000), version: 1, versionNonce: Math.floor(Math.random() * 100000), isDeleted: false, boundElements: null, updated: Date.now(), link: null, locked: false, text: label, fontSize: 20, fontFamily: 5, textAlign: "left", verticalAlign: "top", containerId: null, originalText: label, autoResize: true, lineHeight: 1.25 };
        api.updateScene({ elements: [...elements, newElement], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
        return true;
      },
      undo: () => { apiRef.current?.history?.undo?.(); return true; },
    });
    return () => onRegisterAdapter?.(null);
  }, [document.sessionId, document.readOnly, onRegisterAdapter]);

  const handleSceneChange = (elements) => {
    if (ignoreFirstChange.current) { ignoreFirstChange.current = false; return; }
    const current = modelRef.current.pages.find((page) => page.id === activePage);
    if (!current || JSON.stringify(current.elements) === JSON.stringify(elements)) return;
    publish({ ...modelRef.current, pages: modelRef.current.pages.map((page) => page.id === activePage ? { ...page, elements } : page) });
  };
  const convertSelection = () => {
    const api = apiRef.current;
    if (!api) return;
    const selected = api.getAppState().selectedElementIds;
    const next = api.getSceneElements().map((element) => selected[element.id] ? { ...element, roughness: 0, strokeWidth: 1, strokeStyle: "solid", opacity: 100 } : element);
    api.updateScene({ elements: next, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
    setToast(Object.keys(selected).length ? "Selection converted to clean diagram style." : "Select one or more elements first.");
  };
  const exportCurrent = async (kind) => {
    try {
      const elements = apiRef.current?.getSceneElements() ?? activePageModel.elements;
      if (kind === "png") {
        const blob = await exportToBlob({ elements, appState: { exportBackground: true, viewBackgroundColor: "#ffffff" }, files: apiRef.current?.getFiles?.() ?? {}, mimeType: "image/png" });
        downloadBlob(blob, `${activePageModel.name}.png`);
      } else if (kind === "svg") {
        const svg = await exportToSvg({ elements, appState: { exportBackground: true, viewBackgroundColor: "#ffffff" }, files: apiRef.current?.getFiles?.() ?? {} });
        downloadBlob(new Blob([svg.outerHTML], { type: "image/svg+xml" }), `${activePageModel.name}.svg`);
      } else {
        const cells = elements.map((element, index) => `<mxCell id="${index + 2}" value="${element.type}" vertex="1" parent="1"><mxGeometry x="${Math.round(element.x)}" y="${Math.round(element.y)}" width="${Math.round(element.width)}" height="${Math.round(element.height)}" as="geometry"/></mxCell>`).join("");
        downloadBlob(new Blob([`<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`], { type: "application/xml" }), `${activePageModel.name}.drawio`);
      }
      setToast(`${kind.toUpperCase()} export prepared in the browser.`);
    } catch (error) { setToast(`Export failed: ${error.message}`); }
  };

  return (
    <div className="ideasketch-editor">
      <div className="editor-native-toolbar">
        <span className="toolbar-meta">Page {model.pages.findIndex((page) => page.id === activePage) + 1} of {model.pages.length}</span>
        <button type="button" title="Convert selection" onClick={convertSelection}><Sparkles size={14} />Clean diagram</button>
        <button type="button" title="Present" onClick={() => setPresenting(true)}><Eye size={14} />Present</button>
        <div className="toolbar-menu"><Download size={14} /><button type="button" onClick={() => exportCurrent("png")}>PNG</button><button type="button" onClick={() => exportCurrent("svg")}>SVG</button><button type="button" onClick={() => exportCurrent("drawio")}>draw.io</button></div>
        <span className="toolbar-spacer" />
        {!navigatorOpen && <button type="button" onClick={() => setNavigatorOpen(true)}><FileImage size={14} />Navigator</button>}
      </div>
      {toast && <button className="editor-toast" type="button" onClick={() => setToast("")}>{toast}</button>}
      <div className="ideasketch-workspace">
        <main className="ideasketch-canvas"><Excalidraw key={activePage} excalidrawAPI={(api) => { apiRef.current = api; }} initialData={{ elements: activePageModel.elements, appState: { viewBackgroundColor: "#ffffff" } }} onChange={handleSceneChange} viewModeEnabled={document.readOnly} /></main>
        <Navigator model={model} setModel={setModel} activePage={activePage} setActivePage={setActivePage} apiRef={apiRef} readOnly={document.readOnly} open={navigatorOpen} setOpen={setNavigatorOpen} onPresent={() => setPresenting(true)} />
      </div>
      {presenting && <PresentationMode model={{ ...model, activePageId: activePage }} laserEnabled={laserEnabled} onClose={() => setPresenting(false)} />}
    </div>
  );
}
