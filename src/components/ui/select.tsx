import * as React from "react";

import { cn } from "@/lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, ...props }, ref) => {
  return (
    <select
      className={cn(
        // py-0, not py-2: a native select centres its own label within the
        // content box, so padding only pushed it off-centre at fixed height
        // (the same fix the loyalty ModeSelect needed at h-8).
        "flex h-10 w-full rounded-md border border-input bg-card px-3 py-0 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Select.displayName = "Select";

export { Select };
