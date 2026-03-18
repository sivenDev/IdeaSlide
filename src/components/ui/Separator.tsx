import * as SeparatorPrimitive from "@radix-ui/react-separator";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";
import { cn } from "../../lib/cn";

export const Separator = forwardRef<
  ElementRef<typeof SeparatorPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(function Separator({ className, orientation = "horizontal", ...props }, ref) {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative
      orientation={orientation}
      className={cn(
        "shrink-0 bg-gray-200",
        orientation === "horizontal" ? "h-px w-full" : "h-6 w-px",
        className,
      )}
      {...props}
    />
  );
});
