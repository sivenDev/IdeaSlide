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
  experimentalEnabled: boolean;
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
  if (!options.experimentalEnabled) {
    return {
      descriptor: compatibility,
      reason: "Compatibility remains the default until a rich runtime is explicitly enabled.",
    };
  }
  const eligible = descriptors.filter((descriptor) => (
    descriptor.kind !== "compatibility"
    && descriptor.installed
    && descriptor.compatible
    && (!options.requiresEditorTools || descriptor.capabilities.editorTools)
  ));
  const preferred = eligible.find((descriptor) => descriptor.kind === "codexAppServer")
    ?? eligible.find((descriptor) => descriptor.kind === "grokAcp");
  if (preferred) {
    return {
      descriptor: preferred,
      reason: `${preferred.label} satisfies the required normalized capabilities.`,
    };
  }
  return {
    descriptor: compatibility,
    reason: options.requiresEditorTools
      ? "No compatible rich runtime passed the editor Tool safety gate; using Compatibility."
      : "No compatible rich runtime is available; using Compatibility.",
  };
}
