import React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
  checkSize?: "sm" | "md" | "lg";
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, onChange, checkSize = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-2.5 w-2.5",
      md: "h-4 w-4", 
      lg: "h-6 w-6"
    };
    
    const checkIconSizes = {
      sm: 8,
      md: 12,
      lg: 16
    };

    return (
      <div className={cn("relative flex items-center", sizeClasses[checkSize])}>
        <input
          type="checkbox"
          className={cn(
            "peer cursor-pointer appearance-none rounded-md border-2 border-gray-200 transition-all checked:border-primary checked:bg-primary hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
            sizeClasses[checkSize],
            className
          )}
          onChange={(e) => {
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
          }}
          ref={ref}
          {...props}
        />
        <Check 
          size={checkIconSizes[checkSize]}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" 
        />
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";
