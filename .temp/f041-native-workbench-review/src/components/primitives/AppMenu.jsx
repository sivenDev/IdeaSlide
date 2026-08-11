import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";

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
