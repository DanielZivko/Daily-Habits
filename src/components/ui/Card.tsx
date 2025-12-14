import React from "react";
import { cn } from "../../lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";



















