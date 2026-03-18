import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";
import { cn } from "../../lib/cn";

export function TooltipProvider({
  delayDuration = 250,
  skipDelayDuration = 150,
  ...props
}: ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent(
  { className, sideOffset = 8, collisionPadding = 8, ...props },
  ref,
) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 max-w-56 select-none overflow-hidden rounded-md border border-gray-800/80 bg-gray-950 px-2.5 py-1.5 text-[11px] font-medium leading-none text-white shadow-lg outline-none",
          "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95",
          "data-[side=top]:slide-in-from-bottom-1 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
          className,
        )}
        {...props}
      >
        {props.children}
        <TooltipPrimitive.Arrow className="fill-gray-950" width={9} height={5} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});
