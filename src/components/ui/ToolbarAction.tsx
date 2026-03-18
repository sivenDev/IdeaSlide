import {
  type ButtonHTMLAttributes,
  type ElementRef,
  forwardRef,
} from "react";
import { cn } from "../../lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";

type ToolbarActionVariant = "icon" | "secondary" | "primary";

interface ToolbarActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip?: string;
  variant?: ToolbarActionVariant;
}

const toolbarActionVariants: Record<ToolbarActionVariant, string> = {
  icon: cn(
    "p-1.5 text-gray-500",
    "hover:bg-gray-100 hover:text-gray-700",
  ),
  secondary: cn(
    "px-2.5 py-1 border border-blue-500 bg-blue-50 text-blue-600 text-sm font-medium",
    "hover:bg-blue-100",
  ),
  primary: cn(
    "px-3 py-1 bg-blue-500 text-white text-sm font-medium",
    "hover:bg-blue-600",
  ),
};

export const ToolbarAction = forwardRef<
  ElementRef<"button">,
  ToolbarActionProps
>(function ToolbarAction(
  {
    tooltip,
    variant = "icon",
    className,
    type = "button",
    children,
    ...props
  },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-50",
        toolbarActionVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
});
