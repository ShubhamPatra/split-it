import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20",
        secondary: "bg-secondary text-secondary-foreground border-secondary hover:bg-secondary/80",
        destructive: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
        success: "bg-success/10 text-success border-success/20 hover:bg-success/20",
        warning: "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20",
        info: "bg-info/10 text-info border-info/20 hover:bg-info/20",
        outline: "text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
