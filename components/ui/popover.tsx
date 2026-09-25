"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "../../lib/cn";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = ({ className, align = "center", sideOffset = 4, onMouseDown, onPointerDown, ...props }: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      align={align}
      sideOffset={sideOffset}
      className={cn("z-50 w-72 rounded-md border bg-white p-4 text-slate-900 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out", className)}
      {...props}
      onMouseDown={(event) => { event.stopPropagation(); onMouseDown?.(event); }}
      onPointerDown={(event) => { event.stopPropagation(); onPointerDown?.(event); }}
    />
  </PopoverPrimitive.Portal>
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
