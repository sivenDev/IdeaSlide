import { ChevronDown } from "lucide-react";
import type { AgentReasoningEffort } from "../../lib/agent/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/DropdownMenu";

export function AgentModelSelector({
  models,
  selectedModel,
  reasoningEffort,
  disabled,
  onModelChange,
}: {
  models: string[];
  selectedModel: string;
  reasoningEffort: AgentReasoningEffort;
  disabled: boolean;
  onModelChange: (model: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="ideanote-agent-model-trigger" disabled={disabled} aria-label="Model and reasoning">
          <span>{selectedModel || "No model"}</span>
          <span aria-hidden>·</span>
          <span>{reasoningEffort}</span>
          <ChevronDown aria-hidden size={11} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={7} className="ideanote-agent-model-menu">
        <div className="ideanote-agent-model-menu__label">Model</div>
        <DropdownMenuRadioGroup value={selectedModel} onValueChange={onModelChange}>
          {models.map((model) => (
            <DropdownMenuRadioItem key={model} value={model} className="ideanote-agent-model-menu__item">
              {model}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <div className="ideanote-agent-model-menu__fixed">Reasoning · Standard</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
