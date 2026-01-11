import * as React from "react";

import { cn } from "../../lib/utils";

const Input = React.forwardRef(({ className, type, onWheel, ...props }, ref) => {
  // Prevent scroll wheel from changing number input values
  const handleWheel = (e) => {
    if (type === "number") {
      e.target.blur();
    }
    onWheel?.(e);
  };

  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border-2 border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:bg-card disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 md:text-sm",
        className,
      )}
      ref={ref}
      onWheel={handleWheel}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
