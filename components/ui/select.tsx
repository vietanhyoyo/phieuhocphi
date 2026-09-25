"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/cn";

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger ref={ref} data-ui="select-trigger" className={cn("flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 hover:bg-white data-[placeholder]:text-slate-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10", className)} {...props}>
    {children}<SelectPrimitive.Icon asChild><ChevronDown className="h-4 w-4 text-slate-400" /></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Content>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content ref={ref} position={position} className={cn("relative z-[70] max-h-80 max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xl", position === "popper" && "w-[var(--radix-select-trigger-width)] data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1", className)} {...props}>
      <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center"><ChevronUp className="h-4 w-4" /></SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="w-full p-1">{children}</SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center"><ChevronDown className="h-4 w-4" /></SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Item>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item ref={ref} className={cn("relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none focus:bg-indigo-50 focus:text-indigo-800 data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)} {...props}>
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center"><SelectPrimitive.ItemIndicator><Check className="h-4 w-4 text-primary" /></SelectPrimitive.ItemIndicator></span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
