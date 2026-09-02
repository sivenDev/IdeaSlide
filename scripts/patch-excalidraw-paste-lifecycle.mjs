import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_EXCALIDRAW_VERSION = "0.18.0";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const excalidrawRoot = resolve(repositoryRoot, "node_modules/@excalidraw/excalidraw");
const viteDependencyCache = resolve(repositoryRoot, "node_modules/.vite");

async function replaceAllRequired(filePath, replacements) {
  let source = await readFile(filePath, "utf8");
  let changed = false;

  for (const { before, after } of replacements) {
    if (source.includes(after)) continue;
    const anchors = Array.isArray(before) ? before : [before];
    const matches = anchors.flatMap((anchor) => {
      const first = source.indexOf(anchor);
      if (first < 0) return [];
      if (source.indexOf(anchor, first + anchor.length) >= 0) return [anchor, anchor];
      return [anchor];
    });
    if (matches.length !== 1) {
      throw new Error(`Expected one Excalidraw patch anchor in ${filePath}: ${anchors[0].slice(0, 100)}`);
    }
    const anchor = matches[0];
    const first = source.indexOf(anchor);
    source = `${source.slice(0, first)}${after}${source.slice(first + anchor.length)}`;
    changed = true;
  }

  if (changed) await writeFile(filePath, source);
  return changed;
}

const packageJsonPath = resolve(excalidrawRoot, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
if (packageJson.version !== EXPECTED_EXCALIDRAW_VERSION) {
  throw new Error(
    `Unsupported @excalidraw/excalidraw version ${packageJson.version}; expected ${EXPECTED_EXCALIDRAW_VERSION}.`,
  );
}

const lifecycleType = `    onPasteLifecycle?: (payload: {
        phase: "start";
        event: ClipboardEvent | null;
    } | {
        phase: "end";
        event: ClipboardEvent | null;
        token: unknown;
    }) => unknown;`;

const typesChanged = await replaceAllRequired(
  resolve(excalidrawRoot, "dist/types/excalidraw/types.d.ts"),
  [
    {
      before: "    onPaste?: (data: ClipboardData, event: ClipboardEvent | null) => Promise<boolean> | boolean;",
      after: `    onPaste?: (data: ClipboardData, event: ClipboardEvent | null) => Promise<boolean> | boolean;\n${lifecycleType}`,
    },
    {
      before: "    captureUpdate?: CaptureUpdateActionType;",
      after: "    captureUpdate?: CaptureUpdateActionType;\n    onCommit?: () => void;",
    },
  ],
);

const developmentChanged = await replaceAllRequired(
  resolve(excalidrawRoot, "dist/dev/index.js"),
  [
    {
      before: [
        `var withBatchedUpdates = (func) => (event) => {
  unstable_batchedUpdates2(func, event);
};`,
        `var withBatchedUpdates = (func) => (event, ...args) => {
  return unstable_batchedUpdates2(func, event, ...args);
};`,
      ],
      after: `var withBatchedUpdates = (func) => (event, ...args) => {
  return unstable_batchedUpdates2(() => func(event, ...args));
};`,
    },
    {
      before: `var actionPaste = register({
  name: "paste",
  label: "labels.paste",
  trackEvent: { category: "element" },
  perform: async (elements, appState, data, app) => {
    let types;`,
      after: `var actionPaste = register({
  name: "paste",
  label: "labels.paste",
  trackEvent: { category: "element" },
  perform: async (elements, appState, data, app) => {
    const pasteLifecycleToken = app.beginPasteLifecycle(null);
    try {
    let types;`,
    },
    {
      before: `    try {
      app.pasteFromClipboard(createPasteEvent({ types }));
    } catch (error) {`,
      after: `    try {
      await app.pasteFromClipboard(createPasteEvent({ types }), {
        event: null,
        token: pasteLifecycleToken
      });
    } catch (error) {`,
    },
    {
      before: `    return {
      captureUpdate: CaptureUpdateAction.EVENTUALLY
    };
  },
  // don't supply a shortcut since we handle this conditionally via onCopy event
  keyTest: void 0
});
var actionCut = register({`,
      after: `    return {
      captureUpdate: CaptureUpdateAction.EVENTUALLY
    };
    } finally {
      await app.endPasteLifecycle(null, pasteLifecycleToken);
    }
  },
  // don't supply a shortcut since we handle this conditionally via onCopy event
  keyTest: void 0
});
var actionCut = register({`,
    },
    {
      before: "    onPaste,\n    detectScroll = true,",
      after: "    onPaste,\n    onPasteLifecycle,\n    detectScroll = true,",
    },
    {
      before: "      onPaste,\n      detectScroll,",
      after: "      onPaste,\n      onPasteLifecycle,\n      detectScroll,",
    },
    {
      before: `    __publicField(this, "pasteFromClipboard", withBatchedUpdates(
      async (event) => {`,
      after: `    __publicField(this, "pasteFromClipboard", withBatchedUpdates(
      async (event, inheritedPasteLifecycle) => {`,
    },
    {
      before: `    __publicField(this, "onRemoveEventListenersEmitter", new Emitter());
    /**
     * Returns gridSize taking into account \`gridModeEnabled\`.`,
      after: `    __publicField(this, "onRemoveEventListenersEmitter", new Emitter());
    __publicField(this, "pasteLifecycleCommitResolvers", /* @__PURE__ */ new Set());
    __publicField(this, "waitForPasteCommit", () => {
      if (this.unmounted) return Promise.resolve();
      return new Promise((resolve) => {
        const settle = () => {
          this.pasteLifecycleCommitResolvers.delete(settle);
          resolve();
        };
        this.pasteLifecycleCommitResolvers.add(settle);
        this.setState({}, settle);
      });
    });
    __publicField(this, "beginPasteLifecycle", (event) => this.props.onPasteLifecycle?.({
      phase: "start",
      event
    }));
    __publicField(this, "endPasteLifecycle", async (event, token) => {
      if (!this.props.onPasteLifecycle) return;
      await this.waitForPasteCommit();
      this.props.onPasteLifecycle({ phase: "end", event, token });
    });
    /**
     * Returns gridSize taking into account \`gridModeEnabled\`.`,
    },
    {
      before: [
        `        if (event && (!(elementUnderCursor instanceof HTMLCanvasElement) || isWritableElement(target))) {
          return;
        }
        const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(`,
        `        if (event && (!(elementUnderCursor instanceof HTMLCanvasElement) || isWritableElement(target))) {
          return;
        }
        if (this.state.viewModeEnabled) {
          return;
        }
        let pasteLifecycleToken;
        try {
          pasteLifecycleToken = this.props.onPasteLifecycle?.({ phase: "start", event });
          const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(`,
        `        if (event && (!(elementUnderCursor instanceof HTMLCanvasElement) || isWritableElement(target))) {
          return;
        }
        if (this.state.viewModeEnabled) {
          return;
        }
        const inheritedPasteLifecycle = arguments[1];
        const ownsPasteLifecycle = !inheritedPasteLifecycle;
        const pasteLifecycleEvent = inheritedPasteLifecycle?.event ?? event;
        let pasteLifecycleToken = inheritedPasteLifecycle?.token;
        try {
          if (ownsPasteLifecycle) {
            pasteLifecycleToken = this.beginPasteLifecycle(pasteLifecycleEvent);
          }
          const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(`,
      ],
      after: `        if (event && (!(elementUnderCursor instanceof HTMLCanvasElement) || isWritableElement(target))) {
          return;
        }
        if (this.state.viewModeEnabled) {
          return;
        }
        const ownsPasteLifecycle = !inheritedPasteLifecycle;
        const pasteLifecycleEvent = inheritedPasteLifecycle?.event ?? event;
        let pasteLifecycleToken = inheritedPasteLifecycle?.token;
        try {
          if (ownsPasteLifecycle) {
            pasteLifecycleToken = this.beginPasteLifecycle(pasteLifecycleEvent);
          }
          const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(`,
    },
    {
      before: "            return this.addElementsFromMixedContentPaste(data.mixedContent, {",
      after: "            return await this.addElementsFromMixedContentPaste(data.mixedContent, {",
    },
    {
      before: `        if (isSupportedImageFile(file) && !data.spreadsheet) {
          if (!this.isToolSupported("image")) {
            this.setState({ errorMessage: t("errors.imageToolNotSupported") });
            return;
          }
          const imageElement = this.createImageElement({ sceneX, sceneY });
          this.insertImageElement(imageElement, file);
          this.initializeImageDimensions(imageElement);`,
      after: `        if (isSupportedImageFile(file) && !data.spreadsheet) {
          if (!this.isToolSupported("image")) {
            this.setState({ errorMessage: t("errors.imageToolNotSupported") });
            return;
          }
          const imageElement = this.createImageElement({ sceneX, sceneY });
          await this.insertImageElement(imageElement, file);
          this.initializeImageDimensions(imageElement);`,
    },
    {
      before: `          this.addElementsFromPasteOrLibrary({
            elements,
            files: data.files || null,
            position: "cursor",
            retainSeed: isPlainPaste
          });`,
      after: `          await this.addElementsFromPasteOrLibrary({
            elements,
            files: data.files || null,
            position: "cursor",
            retainSeed: isPlainPaste
          });`,
    },
    {
      before: `              this.addElementsFromPasteOrLibrary({
                elements,
                files,
                position: "cursor"
              });`,
      after: `              await this.addElementsFromPasteOrLibrary({
                elements,
                files,
                position: "cursor"
              });`,
    },
    {
      before: [
        `        this.setActiveTool({ type: "selection" });
        event?.preventDefault();
      }
    ));
    __publicField(this, "addElementsFromPasteOrLibrary", (opts) => {`,
        `        this.setActiveTool({ type: "selection" });
        event?.preventDefault();
        } finally {
          this.props.onPasteLifecycle?.({
            phase: "end",
            event,
            token: pasteLifecycleToken
          });
        }
      }
    ));
    __publicField(this, "addElementsFromPasteOrLibrary", async (opts) => {`,
      ],
      after: `        this.setActiveTool({ type: "selection" });
        event?.preventDefault();
        } finally {
          if (ownsPasteLifecycle) {
            await this.endPasteLifecycle(pasteLifecycleEvent, pasteLifecycleToken);
          }
        }
      }
    ));
    __publicField(this, "addElementsFromPasteOrLibrary", async (opts) => {`,
    },
    {
      before: `      const nextElementsToSelect = excludeElementsInFramesFromSelection(newElements);
      this.setState(`,
      after: `      const nextElementsToSelect = excludeElementsInFramesFromSelection(newElements);
      const imageCacheReady = new Promise((resolve, reject) => {
        this.setState(`,
    },
    {
      before: `        () => {
          if (opts.files) {
            this.addNewImagesToImageCache();
          }
        }
      );
      this.setActiveTool({ type: "selection" });`,
      after: `        () => {
          if (!opts.files) {
            resolve();
            return;
          }
          Promise.resolve(this.addNewImagesToImageCache()).then(resolve, (error) => {
            console.error(error);
            resolve();
          });
        }
        );
      });
      this.setActiveTool({ type: "selection" });`,
    },
    {
      before: `      if (opts.fitToContent) {
        this.scrollToContent(newElements, {
          fitToContent: true,
          canvasOffsets: this.getEditorUIOffsets()
        });
      }
    });
    __publicField(this, "setAppState",`,
      after: `      if (opts.fitToContent) {
        this.scrollToContent(newElements, {
          fitToContent: true,
          canvasOffsets: this.getEditorUIOffsets()
        });
      }
      await imageCacheReady;
    });
    __publicField(this, "setAppState",`,
    },
    {
      before: `        if (sceneData.collaborators) {
          this.setState({ collaborators: sceneData.collaborators });
        }
      }
    ));`,
      after: `        if (sceneData.collaborators) {
          this.setState({ collaborators: sceneData.collaborators });
        }
        if (sceneData.onCommit) {
          this.setState({}, sceneData.onCommit);
        }
      }
    ));`,
    },
    {
      before: `    this.resizeObserver?.disconnect();
    this.unmounted = true;
    this.removeEventListeners();`,
      after: `    this.resizeObserver?.disconnect();
    this.unmounted = true;
    for (const settle of this.pasteLifecycleCommitResolvers) settle();
    this.pasteLifecycleCommitResolvers.clear();
    this.removeEventListeners();`,
    },
  ],
);

const productionChanged = await replaceAllRequired(
  resolve(excalidrawRoot, "dist/prod/index.js"),
  [
    {
      before: [
        "var Fe=e=>o=>{H1(e,o)},Ad=",
        "var Fe=e=>(o,...t)=>H1(e,o,...t),Ad=",
      ],
      after: "var Fe=e=>(o,...t)=>H1(()=>e(o,...t)),Ad=",
    },
    {
      before: 'Qp=D({name:"paste",label:"labels.paste",trackEvent:{category:"element"},perform:async(e,o,t,r)=>{let n;',
      after: 'Qp=D({name:"paste",label:"labels.paste",trackEvent:{category:"element"},perform:async(e,o,t,r)=>{let pasteLifecycleToken=r.beginPasteLifecycle(null);try{let n;',
    },
    {
      before: "try{r.pasteFromClipboard(jx({types:n}))}catch(i){",
      after: "try{await r.pasteFromClipboard(jx({types:n}),{event:null,token:pasteLifecycleToken})}catch(i){",
    },
    {
      before: 'return{captureUpdate:L.EVENTUALLY}},keyTest:void 0}),yc=D({name:"cut"',
      after: 'return{captureUpdate:L.EVENTUALLY}}finally{await r.endPasteLifecycle(null,pasteLifecycleToken)}},keyTest:void 0}),yc=D({name:"cut"',
    },
    {
      before: "renderCustomStats:h,onPaste:f,detectScroll:b=!0,",
      after: "renderCustomStats:h,onPaste:f,onPasteLifecycle:pasteLifecycle,detectScroll:b=!0,",
    },
    {
      before: "renderCustomStats:h,UIOptions:j,onPaste:f,detectScroll:b,",
      after: "renderCustomStats:h,UIOptions:j,onPaste:f,onPasteLifecycle:pasteLifecycle,detectScroll:b,",
    },
    {
      before: 'C(this,"pasteFromClipboard",Fe(async t=>{',
      after: 'C(this,"pasteFromClipboard",Fe(async(t,inheritedPasteLifecycle)=>{',
    },
    {
      before: 'C(this,"onRemoveEventListenersEmitter",new qt);C(this,"getEffectiveGridSize"',
      after: 'C(this,"onRemoveEventListenersEmitter",new qt);C(this,"pasteLifecycleCommitResolvers",new Set);C(this,"waitForPasteCommit",()=>this.unmounted?Promise.resolve():new Promise(t=>{let r=()=>{this.pasteLifecycleCommitResolvers.delete(r),t()};this.pasteLifecycleCommitResolvers.add(r),this.setState({},r)}));C(this,"beginPasteLifecycle",t=>this.props.onPasteLifecycle?.({phase:"start",event:t}));C(this,"endPasteLifecycle",async(t,r)=>{this.props.onPasteLifecycle&&(await this.waitForPasteCommit(),this.props.onPasteLifecycle({phase:"end",event:t,token:r}))});C(this,"getEffectiveGridSize"',
    },
    {
      before: [
        "if(t&&(!(a instanceof HTMLCanvasElement)||Co(n)))return;let{x:l,y:s}=Re(",
        "if(t&&(!(a instanceof HTMLCanvasElement)||Co(n)))return;if(this.state.viewModeEnabled)return;let pasteLifecycleToken;try{pasteLifecycleToken=this.props.onPasteLifecycle?.({phase:\"start\",event:t});let{x:l,y:s}=Re(",
        "if(t&&(!(a instanceof HTMLCanvasElement)||Co(n)))return;if(this.state.viewModeEnabled)return;let inheritedPasteLifecycle=arguments[1],ownsPasteLifecycle=!inheritedPasteLifecycle,pasteLifecycleEvent=inheritedPasteLifecycle?.event??t,pasteLifecycleToken=inheritedPasteLifecycle?.token;try{ownsPasteLifecycle&&(pasteLifecycleToken=this.beginPasteLifecycle(pasteLifecycleEvent));let{x:l,y:s}=Re(",
      ],
      after: "if(t&&(!(a instanceof HTMLCanvasElement)||Co(n)))return;if(this.state.viewModeEnabled)return;let ownsPasteLifecycle=!inheritedPasteLifecycle,pasteLifecycleEvent=inheritedPasteLifecycle?.event??t,pasteLifecycleToken=inheritedPasteLifecycle?.token;try{ownsPasteLifecycle&&(pasteLifecycleToken=this.beginPasteLifecycle(pasteLifecycleEvent));let{x:l,y:s}=Re(",
    },
    {
      before: "if(m.mixedContent)return this.addElementsFromMixedContentPaste(m.mixedContent,{",
      after: "if(m.mixedContent)return await this.addElementsFromMixedContentPaste(m.mixedContent,{",
    },
    {
      before: "this.insertImageElement(d,c),this.initializeImageDimensions(d)",
      after: "await this.insertImageElement(d,c),this.initializeImageDimensions(d)",
    },
    {
      before: "this.addElementsFromPasteOrLibrary({elements:d,files:m.files||null,position:\"cursor\",retainSeed:r})",
      after: "await this.addElementsFromPasteOrLibrary({elements:d,files:m.files||null,position:\"cursor\",retainSeed:r})",
    },
    {
      before: "this.addElementsFromPasteOrLibrary({elements:b,files:f,position:\"cursor\"});return",
      after: "await this.addElementsFromPasteOrLibrary({elements:b,files:f,position:\"cursor\"});return",
    },
    {
      before: [
        "this.setActiveTool({type:\"selection\"}),t?.preventDefault()}));C(this,\"addElementsFromPasteOrLibrary\",t=>{",
        "this.setActiveTool({type:\"selection\"}),t?.preventDefault()}finally{this.props.onPasteLifecycle?.({phase:\"end\",event:t,token:pasteLifecycleToken})}}));C(this,\"addElementsFromPasteOrLibrary\",async t=>{",
      ],
      after: "this.setActiveTool({type:\"selection\"}),t?.preventDefault()}finally{ownsPasteLifecycle&&await this.endPasteLifecycle(pasteLifecycleEvent,pasteLifecycleToken)}}));C(this,\"addElementsFromPasteOrLibrary\",async t=>{",
    },
    {
      before: "this.store.shouldCaptureIncrement();let _=Ys(T);this.setState(",
      after: "this.store.shouldCaptureIncrement();let _=Ys(T),pasteImageCacheReady=new Promise((resolve,reject)=>{this.setState(",
    },
    {
      before: [
        "},()=>{t.files&&this.addNewImagesToImageCache()}),this.setActiveTool({type:\"selection\"})",
        "},()=>{t.files?Promise.resolve(this.addNewImagesToImageCache()).then(resolve,e=>{console.error(e),resolve()}):resolve()})}),this.setActiveTool({type:\"selection\"})",
      ],
      after: "},()=>{t.files?Promise.resolve(this.addNewImagesToImageCache()).then(resolve,e=>{console.error(e),resolve()}):resolve()})});this.setActiveTool({type:\"selection\"})",
    },
    {
      before: "t.fitToContent&&this.scrollToContent(T,{fitToContent:!0,canvasOffsets:this.getEditorUIOffsets()})});C(this,\"setAppState\"",
      after: "t.fitToContent&&this.scrollToContent(T,{fitToContent:!0,canvasOffsets:this.getEditorUIOffsets()}),await pasteImageCacheReady});C(this,\"setAppState\"",
    },
    {
      before: "t.appState&&this.setState(t.appState),t.elements&&this.scene.replaceAllElements(r),t.collaborators&&this.setState({collaborators:t.collaborators})}));C(this,\"triggerRender\"",
      after: "t.appState&&this.setState(t.appState),t.elements&&this.scene.replaceAllElements(r),t.collaborators&&this.setState({collaborators:t.collaborators}),t.onCommit&&this.setState({},t.onCommit)}));C(this,\"triggerRender\"",
    },
    {
      before: "this.resizeObserver?.disconnect(),this.unmounted=!0,this.removeEventListeners()",
      after: "this.resizeObserver?.disconnect(),this.unmounted=!0,this.pasteLifecycleCommitResolvers.forEach(t=>t()),this.pasteLifecycleCommitResolvers.clear(),this.removeEventListeners()",
    },
  ],
);

await rm(viteDependencyCache, { recursive: true, force: true });

if (typesChanged || developmentChanged || productionChanged) {
  console.log("Patched @excalidraw/excalidraw paste lifecycle support.");
}
