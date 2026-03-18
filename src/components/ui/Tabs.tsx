import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";
import { cn } from "../../lib/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("inline-flex items-center", className)}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-t border border-transparent px-3 py-1 text-xs font-medium text-gray-600 transition-all outline-none",
        "hover:bg-white/70 hover:text-gray-800",
        "data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm",
        "focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn("outline-none", className)}
      {...props}
    />
  );
});
