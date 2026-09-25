import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-white",
      secondary: "border-transparent bg-indigo-50 text-indigo-700",
      outline: "border-slate-200 bg-white text-slate-600",
      success: "border-transparent bg-emerald-50 text-emerald-700",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
