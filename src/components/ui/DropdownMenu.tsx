import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";
import { cn } from "../../lib/cn";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent(
  { className, sideOffset = 8, collisionPadding = 8, ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 min-w-[11rem] overflow-hidden rounded-md border border-gray-200/80 bg-white/95 p-1 shadow-xl backdrop-blur outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=top]:slide-in-from-bottom-1 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(function DropdownMenuItem({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 outline-none transition-colors",
        "focus:bg-gray-100 focus:text-gray-950 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-950 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-gray-200/80", className)}
      {...props}
    />
  );
});
