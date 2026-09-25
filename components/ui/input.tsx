import * as React from "react";
import { cn } from "../../lib/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn("flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition placeholder:text-slate-400 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50", className)}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
