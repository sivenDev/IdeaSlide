import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { useRef } from "react";
import type {
  UnsavedChangesDecision,
  UnsavedChangesIntent,
} from "../hooks/useUnsavedChangesDialog";

interface UnsavedChangesDialogProps {
  open: boolean;
  fileName: string;
  intent: UnsavedChangesIntent;
  onDecision: (decision: UnsavedChangesDecision) => void;
}

export function UnsavedChangesDialog({
  open,
  fileName,
  intent,
  onDecision,
}: UnsavedChangesDialogProps) {
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const title = intent === "closing"
    ? "Save changes before closing?"
    : "Save changes before leaving?";

  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) onDecision("cancel");
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="ideanote-unsaved-dialog__overlay" />
        <AlertDialogPrimitive.Content
          className="ideanote-unsaved-dialog__content"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            saveButtonRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            onDecision("cancel");
          }}
        >
          <AlertDialogPrimitive.Title className="ideanote-unsaved-dialog__title">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="ideanote-unsaved-dialog__description">
            <span className="ideanote-unsaved-dialog__filename">“{fileName || "Untitled.is"}”</span>
            {" has unsaved changes."}
          </AlertDialogPrimitive.Description>
          <div className="ideanote-unsaved-dialog__actions">
            <AlertDialogPrimitive.Action asChild>
              <button ref={saveButtonRef} type="button" className="ideanote-unsaved-dialog__action is-save" onClick={() => onDecision("save")}>Save</button>
            </AlertDialogPrimitive.Action>
            <AlertDialogPrimitive.Action asChild>
              <button type="button" className="ideanote-unsaved-dialog__action is-discard" onClick={() => onDecision("discard")}>Discard Changes</button>
            </AlertDialogPrimitive.Action>
            <AlertDialogPrimitive.Cancel asChild>
              <button type="button" className="ideanote-unsaved-dialog__action is-cancel" onClick={() => onDecision("cancel")}>Cancel</button>
            </AlertDialogPrimitive.Cancel>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
