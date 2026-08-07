import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react";
import type { AgentMessage } from "./types";

export function toAssistantUiMessage(message: AgentMessage, running: boolean): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt),
    status: message.role === "assistant"
      ? running
        ? { type: "running" }
        : { type: "complete", reason: "stop" }
      : undefined,
  };
}

export function promptFromAssistantUiMessage(message: AppendMessage): string {
  if (message.role !== "user") return "";
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}
