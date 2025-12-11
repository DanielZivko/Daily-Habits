import React, { useState, useRef, useEffect } from "react";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import { Plus, Check } from "lucide-react";

const AVAILABLE_ICONS = [
  "Briefcase",
  "Home",
  "Heart",
  "GraduationCap",
  "Dumbbell",
  "Book",
  "ShoppingCart",
  "Laptop",
  "Flower",
  "DollarSign",
  "Pill",
  "Star",
  "Sun",
  "Moon",
  "Music",
  "Coffee",
  "Utensils",
  "Car",
  "Plane",
  "Zap",
  "Smile",
  "Camera",
  "Globe",
  "Anchor",
  "PawPrint"
] as const;

export type IconName = typeof AVAILABLE_ICONS[number];

interface IconPickerProps {
  selectedIcon: string;
  onSelect: (icon: string) => void;
}

export const IconPicker: React.FC<IconPickerProps> = ({ selectedIcon, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const visibleIcons = AVAILABLE_ICONS.slice(0, 7);
  const hiddenIcons = AVAILABLE_ICONS.slice(7);
  
  // Check if selected icon is in the hidden list to show active state on "+" button
  const isCustomIconSelected = hiddenIcons.some(icon => icon === selectedIcon);

  const handleOpen = () => {
    if (isOpen) {
        setIsOpen(false);
        return;
    }
    
    // Calculate position
    if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        // Center popover below button
        // Popover width approx 256px (w-64)
        const popoverWidth = 256;
        const left = rect.left + (rect.width / 2) - (popoverWidth / 2);
        const top = rect.bottom + 12; // 12px gap

        // Basic viewport boundary check (optional, but good)
        // If left < 0, set to 10. If right overflow, adjust.
        
        setPopoverPosition({ top, left });
        setIsOpen(true);
    }
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside button (to prevent double toggle) or popover
      if (
        buttonRef.current && buttonRef.current.contains(event.target as Node)
      ) {
         return; 
      }

      if (
        popoverRef.current && !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Recalculate position on scroll/resize if needed, but for now fixed on open is okay.
  // Actually, if user scrolls the modal, fixed position might drift if we don't update.
  // But usually modal disables background scroll.
  // Let's stick to simple fixed positioning calculated on open.

  return (
    <div className="flex flex-wrap gap-3">
      {visibleIcons.map((iconName) => {
        const Icon = (Icons as any)[iconName];
        if (!Icon) return null;

        const isSelected = selectedIcon === iconName;

        return (
          <button
            key={iconName}
            onClick={() => onSelect(iconName)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2",
              isSelected
                ? "bg-blue-500 border-blue-500 text-white ring-2 ring-blue-500 ring-offset-2"
                : "bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-500"
            )}
            type="button"
          >
            <Icon size={18} />
          </button>
        );
      })}

      {/* More Icons Button */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleOpen}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-white text-gray-500 transition-transform hover:border-blue-500 hover:text-blue-500 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
             isCustomIconSelected ? "border-blue-500 text-blue-500 ring-2 ring-blue-500 ring-offset-2" : ""
          )}
          type="button"
          title="Mais ícones"
        >
           {isCustomIconSelected ? (
             (() => {
                const SelectedIcon = (Icons as any)[selectedIcon];
                return SelectedIcon ? <SelectedIcon size={18} /> : <Check size={18} />;
             })()
           ) : (
             <Plus size={20} />
           )}
        </button>

        {/* Popover Bubble - Fixed Position via Portal Strategy (Manual Fixed Coords) */}
        {isOpen && popoverPosition && (
            <div 
                ref={popoverRef}
                className="fixed z-[9999] w-64 mt-3"
                style={{ 
                    top: popoverPosition.top, 
                    left: popoverPosition.left 
                }}
            >
                {/* Arrow - Pseudo visual approximation since real arrow is hard with fixed pos relative to floating content */}
                <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-gray-100 bg-white" />
                
                {/* Content */}
                <div className="relative rounded-xl border border-gray-100 bg-white p-3 shadow-xl">
                    <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {hiddenIcons.map((iconName) => {
                            const Icon = (Icons as any)[iconName];
                            if (!Icon) return null;
                            const isSelected = selectedIcon === iconName;

                            return (
                                <button
                                    key={iconName}
                                    onClick={() => {
                                        onSelect(iconName);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                                        isSelected
                                            ? "bg-blue-100 text-blue-600"
                                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                    )}
                                    type="button"
                                >
                                    <Icon size={16} />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export const getIconComponent = (iconName: string) => {
  const Icon = (Icons as any)[iconName];
  return Icon || Icons.HelpCircle;
};

