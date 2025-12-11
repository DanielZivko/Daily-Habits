import React, { useRef } from "react";
import { cn } from "../../lib/utils";
import { Check, Plus } from "lucide-react";

const AVAILABLE_COLORS = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#eab308", // yellow-500
  "#22c55e", // green-500
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#d946ef", // fuchsia-500
  "#f43f5e", // rose-500
  "#64748b", // slate-500
];

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Limit to first 7 colors
  const visibleColors = AVAILABLE_COLORS.slice(0, 7);
  const isCustomColor = !AVAILABLE_COLORS.includes(selectedColor);

  return (
    <div className="flex flex-wrap gap-3">
      {visibleColors.map((color) => {
        const isSelected = selectedColor === color;

        return (
          <button
            key={color}
            onClick={() => onSelect(color)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2",
              isSelected ? "scale-110 ring-2 ring-offset-2" : ""
            )}
            style={{ backgroundColor: color, "--tw-ring-color": color } as React.CSSProperties}
            type="button"
          >
            {isSelected && <Check className="h-5 w-5 text-white" strokeWidth={3} />}
          </button>
        );
      })}

      {/* Custom Color Button */}
      <div className="relative">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-white text-gray-500 transition-transform hover:border-blue-500 hover:text-blue-500 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 overflow-hidden",
               isCustomColor ? "border-solid border-white ring-2 ring-gray-200 ring-offset-1 p-0.5" : ""
            )}
            type="button"
            title="Cor personalizada"
          >
            {isCustomColor ? (
                 <div 
                    className="h-full w-full rounded-full flex items-center justify-center shadow-sm" 
                    style={{ backgroundColor: selectedColor }}
                 >
                    <Check className="h-4 w-4 text-white mix-blend-difference" strokeWidth={3} />
                 </div>
            ) : (
                <Plus size={20} />
            )}
          </button>
          <input 
            ref={fileInputRef}
            type="color" 
            className="absolute opacity-0 pointer-events-none h-0 w-0"
            value={selectedColor}
            onChange={(e) => onSelect(e.target.value)}
          />
      </div>
    </div>
  );
};

