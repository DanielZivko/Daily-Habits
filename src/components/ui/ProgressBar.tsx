import React from "react";
import { cn } from "../../lib/utils";

interface ProgressBarProps {
  current: number;
  max: number;
  className?: string;
  colorClass?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, max, className, colorClass = "bg-primary" }) => {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));

  return (
    <div className={cn("h-2.5 w-full rounded-full bg-secondary overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500 ease-out", colorClass)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};









