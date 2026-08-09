import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AgentTextPresentationController,
  type AgentPresentationSnapshot,
} from "../lib/agent/agentTextPresentation";
import type { AgentThreadState } from "../lib/agent/protocol";

const EMPTY_SNAPSHOT: AgentPresentationSnapshot = {
  items: {},
  revealing: false,
  revision: 0,
};

function initialReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useAgentPresentation(state: AgentThreadState): AgentPresentationSnapshot {
  const [snapshot, setSnapshot] = useState<AgentPresentationSnapshot>(EMPTY_SNAPSHOT);
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const controllerRef = useRef<AgentTextPresentationController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new AgentTextPresentationController({
      onChange: () => {
        const controller = controllerRef.current;
        if (controller) setSnapshot(controller.getSnapshot());
      },
    });
  }
  const controller = controllerRef.current;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    setReducedMotion(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useLayoutEffect(() => {
    controller.setReducedMotion(reducedMotion);
    controller.sync(state);
  }, [controller, reducedMotion, state]);

  useEffect(() => () => controller.reset(false), [controller]);

  return snapshot;
}
