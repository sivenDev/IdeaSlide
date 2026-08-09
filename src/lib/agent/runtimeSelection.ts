export interface RuntimeSelectionDescriptor {
  kind: "compatibility" | "codexAppServer" | "grokAcp";
  label: string;
  installed: boolean;
  compatible: boolean;
  experimental: boolean;
  capabilities: {
    editorTools: boolean;
  };
}

export interface AgentRuntimeSelectionOptions {
  requiresEditorTools: boolean;
}

export interface AgentRuntimeSelection<TDescriptor extends RuntimeSelectionDescriptor> {
  descriptor?: TDescriptor;
  reason: string;
}

export function selectAgentRuntime<TDescriptor extends RuntimeSelectionDescriptor>(
  descriptors: TDescriptor[],
  options: AgentRuntimeSelectionOptions,
): AgentRuntimeSelection<TDescriptor> {
  const compatibility = descriptors.find((descriptor) => descriptor.kind === "compatibility");
  const codex = descriptors.find((descriptor) => (
    descriptor.kind === "codexAppServer"
    && descriptor.installed
    && descriptor.compatible
    && (!options.requiresEditorTools || descriptor.capabilities.editorTools)
  ));
  if (codex) {
    return {
      descriptor: codex,
      reason: `${codex.label} was selected automatically because it passed the pinned compatibility and editor Tool gates.`,
    };
  }
  return {
    descriptor: compatibility,
    reason: options.requiresEditorTools
      ? "No compatible rich runtime passed the editor Tool safety gate; using Compatibility."
      : "No compatible rich runtime is available; using Compatibility.",
  };
}
