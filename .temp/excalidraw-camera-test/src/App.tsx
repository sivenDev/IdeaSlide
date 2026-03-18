import { useEffect, useMemo, useState } from "react";
import { CameraPlayground } from "./components/CameraPlayground";
import { ControlPanel } from "./components/ControlPanel";
import { demoCameras } from "./data/demoCameras";
import { demoSceneAppState, demoSceneElements } from "./data/demoScene";
import type { EasingMode } from "./lib/animateViewport";
import { extractCameras } from "./lib/cameraUtils";
import { sanitizeDurationMs, sanitizePaddingFactor } from "./lib/settings";
import type { CameraSourceMode, ViewportTarget } from "./lib/types";

export default function App() {
  const [cameraSourceMode, setCameraSourceMode] = useState<CameraSourceMode>("hardcoded");
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [durationMs, setDurationMs] = useState(1000);
  const [paddingFactor, setPaddingFactor] = useState(0.9);
  const [easing, setEasing] = useState<EasingMode>("ease-in-out");
  const [showCameraBorders, setShowCameraBorders] = useState(true);
  const [replayToken, setReplayToken] = useState(0);
  const [targetViewport, setTargetViewport] = useState<ViewportTarget | null>(null);
  const [actualViewport, setActualViewport] = useState<ViewportTarget | null>(null);

  const derivedCameras = useMemo(() => extractCameras(demoSceneElements), []);
  const cameras = cameraSourceMode === "hardcoded" ? demoCameras : derivedCameras;
  const selectedCamera = cameras[selectedCameraIndex] ?? null;

  useEffect(() => {
    if (selectedCameraIndex >= cameras.length) {
      setSelectedCameraIndex(Math.max(0, cameras.length - 1));
    }
  }, [cameras.length, selectedCameraIndex]);

  const deltas = useMemo(() => {
    if (!targetViewport || !actualViewport) {
      return null;
    }

    return {
      scrollX: Math.abs(actualViewport.scrollX - targetViewport.scrollX),
      scrollY: Math.abs(actualViewport.scrollY - targetViewport.scrollY),
      zoom: Math.abs(actualViewport.zoom - targetViewport.zoom),
    };
  }, [actualViewport, targetViewport]);

  return (
    <main className="app-shell">
      <section className="canvas-shell">
        <div className="panel-title">Canvas</div>
        <CameraPlayground
          sceneElements={demoSceneElements}
          sceneAppState={demoSceneAppState}
          cameras={cameras}
          selectedCamera={selectedCamera}
          durationMs={durationMs}
          paddingFactor={paddingFactor}
          easing={easing}
          showCameraBorders={showCameraBorders}
          replayToken={replayToken}
          onTargetViewportChange={setTargetViewport}
          onActualViewportChange={setActualViewport}
        />
      </section>
      <aside className="control-shell">
        <div className="panel-title">Controls</div>
        <ControlPanel
          cameraSourceMode={cameraSourceMode}
          cameras={cameras}
          selectedCameraIndex={selectedCameraIndex}
          durationMs={durationMs}
          paddingFactor={paddingFactor}
          easing={easing}
          showCameraBorders={showCameraBorders}
          targetViewport={targetViewport}
          actualViewport={actualViewport}
          deltas={deltas}
          onSourceModeChange={(mode) => {
            setCameraSourceMode(mode);
            setSelectedCameraIndex(0);
            setReplayToken((value) => value + 1);
          }}
          onSelectCamera={setSelectedCameraIndex}
          onPrevious={() => {
            setSelectedCameraIndex((value) => (value > 0 ? value - 1 : Math.max(0, cameras.length - 1)));
          }}
          onNext={() => {
            setSelectedCameraIndex((value) => (value + 1) % Math.max(cameras.length, 1));
          }}
          onReplay={() => setReplayToken((value) => value + 1)}
          onDurationChange={(value) => setDurationMs((current) => sanitizeDurationMs(value, current))}
          onPaddingFactorChange={(value) =>
            setPaddingFactor((current) => sanitizePaddingFactor(value, current))
          }
          onEasingChange={setEasing}
          onToggleCameraBorders={() => setShowCameraBorders((value) => !value)}
        />
      </aside>
    </main>
  );
}
