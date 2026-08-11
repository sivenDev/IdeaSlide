import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export function AppDialog({ open, onOpenChange, title, description, children, footer, size = "small", closeLabel = "Close dialog" }) {
  const returnFocusRef = useRef(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) returnFocusRef.current = document.activeElement;
    if (!open && wasOpenRef.current) window.requestAnimationFrame(() => returnFocusRef.current?.focus?.());
    wasOpenRef.current = open;
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="app-dialog__overlay" onClick={() => onOpenChange(false)} />
        <Dialog.Content className={`app-dialog app-dialog--${size}`} onPointerDownOutside={() => onOpenChange(false)}>
          <header className="app-dialog__header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && <Dialog.Description>{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="icon-button" aria-label={closeLabel}><X size={15} /></Dialog.Close>
          </header>
          <div className="app-dialog__body">{children}</div>
          {footer && <footer className="app-dialog__footer">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
