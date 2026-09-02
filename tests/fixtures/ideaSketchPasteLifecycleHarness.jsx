import React from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw } from "@excalidraw/excalidraw";

window.__pasteLifecycleEvents = [];

function record(event) {
  window.__pasteLifecycleEvents.push(event);
}

function Harness() {
  return (
    <Excalidraw
      excalidrawAPI={(api) => {
        window.__pasteHarnessReady = Boolean(api);
      }}
      onChange={(elements) => {
        record({
          phase: "change",
          text: elements
            .filter((element) => element.type === "text")
            .map((element) => element.originalText ?? element.text)
            .join("\n"),
        });
      }}
      onPasteLifecycle={(payload) => {
        if (payload.phase === "start") {
          record({ phase: "start" });
          return "paste-lifecycle-token";
        }
        record({
          phase: "end",
          tokenMatches: payload.token === "paste-lifecycle-token",
        });
        return undefined;
      }}
    />
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
