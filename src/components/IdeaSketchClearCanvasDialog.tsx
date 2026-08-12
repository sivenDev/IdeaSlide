import * as AlertDialog from "@radix-ui/react-alert-dialog";

interface IdeaSketchClearCanvasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function IdeaSketchClearCanvasDialog({
  open,
  onOpenChange,
  onConfirm,
}: IdeaSketchClearCanvasDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="ideanote-ideasketch-clear-dialog__overlay" />
        <AlertDialog.Content className="ideanote-ideasketch-clear-dialog__content">
          <AlertDialog.Title>Clear canvas?</AlertDialog.Title>
          <AlertDialog.Description>
            All elements on the current Page will be removed. You can undo this action from the Canvas.
          </AlertDialog.Description>
          <div className="ideanote-ideasketch-clear-dialog__actions">
            <AlertDialog.Cancel asChild>
              <button type="button">Cancel</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button type="button" className="is-danger" onClick={onConfirm}>Clear canvas</button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
