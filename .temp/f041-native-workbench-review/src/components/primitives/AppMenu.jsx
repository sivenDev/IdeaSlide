import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronRight } from "lucide-react";

export function AppMenu({ trigger, children, align = "start", side = "bottom", sideOffset = 4, alignOffset = 0, modal = false, contentClassName = "" }) {
  return (
    <DropdownMenu.Root modal={modal}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={`app-menu ${contentClassName}`} align={align} side={side} sideOffset={sideOffset} alignOffset={alignOffset} collisionPadding={8}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AppMenuItem({ children, icon: Icon, danger = false, disabled = false, onSelect }) {
  return (
    <DropdownMenu.Item className={`app-menu__item ${danger ? "is-danger" : ""}`} disabled={disabled} onSelect={onSelect}>
      {Icon && <Icon size={14} aria-hidden="true" />}
      {children}
    </DropdownMenu.Item>
  );
}

export function AppMenuSeparator() {
  return <DropdownMenu.Separator className="app-menu__separator" />;
}

export function AppMenuRadioGroup({ value, onValueChange, children }) {
  return <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>{children}</DropdownMenu.RadioGroup>;
}

export function AppMenuRadioItem({ value, children }) {
  return (
    <DropdownMenu.RadioItem className="app-menu__item app-menu__radio" value={value}>
      <DropdownMenu.ItemIndicator className="app-menu__indicator"><Check size={13} /></DropdownMenu.ItemIndicator>
      <span>{children}</span>
    </DropdownMenu.RadioItem>
  );
}

export function AppMenuSub({ label, children }) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="app-menu__item app-menu__sub-trigger">
        <span>{label}</span><ChevronRight size={13} />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className="app-menu app-menu--compact" sideOffset={4} alignOffset={-4} collisionPadding={8}>
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

export function AppPopover({ open, onOpenChange, trigger, children, align = "start", side = "bottom", sideOffset = 6, alignOffset = 0, contentClassName = "" }) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={`app-popover ${contentClassName}`} align={align} side={side} sideOffset={sideOffset} alignOffset={alignOffset} collisionPadding={8}>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
