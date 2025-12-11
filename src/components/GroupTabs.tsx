import React, { useState, useEffect, useRef } from "react";
import type { Group } from "../types";
import { cn } from "../lib/utils";
import { Plus } from "lucide-react";
import { getIconComponent } from "./ui/IconPicker";
import { db } from "../db/db";
import { Reorder, useDragControls } from "framer-motion";

interface GroupTabItemProps {
  group: Group;
  isSelected: boolean;
  onClick: () => void;
  onDragEnd: () => void;
}

const GroupTabItem: React.FC<GroupTabItemProps> = ({ group, isSelected, onClick, onDragEnd }) => {
  const controls = useDragControls();
  const [isPressing, setIsPressing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only process left click
    if (e.button !== 0) return;

    startPosRef.current = { x: e.clientX, y: e.clientY };
    setIsPressing(true);

    timeoutRef.current = setTimeout(() => {
      controls.start(e);
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50);
      setIsPressing(false);
    }, 1000); // 1 second hold
  };

  const cancelLongPress = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    startPosRef.current = null;
    setIsPressing(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPosRef.current) return;

    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);

    // Cancel if moved more than 10px (likely scrolling)
    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  };

  const Icon = getIconComponent(group.icon);

  return (
    <Reorder.Item
      value={group}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onClick={onClick}
      className={cn(
        "flex min-w-fit items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors cursor-pointer select-none touch-manipulation", 
        isSelected
          ? "border-current"
          : "border-transparent text-gray-500 hover:text-gray-700",
        isPressing && "opacity-70 scale-95 duration-200"
      )}
      style={{
        color: isSelected ? group.color : undefined,
        borderColor: isSelected ? group.color : undefined
      }}
      whileDrag={{ scale: 1.05, cursor: "grabbing", zIndex: 50 }}
      title={group.title}
    >
      <Icon 
        size={20} 
        style={{ color: group.color }}
      />
      <span className="hidden md:block">
        {group.title}
      </span>
    </Reorder.Item>
  );
};

interface GroupTabsProps {
  groups: Group[];
  selectedGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
  onNewGroup: () => void;
}

export const GroupTabs: React.FC<GroupTabsProps> = ({ 
  groups, 
  selectedGroupId, 
  onSelectGroup,
  onNewGroup
}) => {
  const [localGroups, setLocalGroups] = useState<Group[]>(groups);

  useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);

  const handleReorder = (newOrder: Group[]) => {
    setLocalGroups(newOrder);
  };

  const handleDragEnd = async () => {
    // Update order in DB for ALL groups to ensure consistency
    await db.transaction('rw', db.groups, async () => {
        for (let i = 0; i < localGroups.length; i++) {
            if (localGroups[i].order !== i) {
                await db.groups.update(localGroups[i].id, { order: i });
            }
        }
    });
  };

  return (
    <div className="flex items-center overflow-x-auto border-b border-gray-200 bg-white px-4 py-0 scrollbar-hide">
      <Reorder.Group 
        axis="x" 
        values={localGroups} 
        onReorder={handleReorder}
        className="flex items-center gap-6"
      >
        {localGroups.map((group) => (
          <GroupTabItem
            key={group.id}
            group={group}
            isSelected={selectedGroupId === group.id}
            onClick={() => onSelectGroup(group.id)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </Reorder.Group>

      <button
        onClick={onNewGroup}
        className="ml-6 flex min-w-fit items-center gap-1 py-4 text-sm font-medium text-gray-400 hover:text-blue-500"
      >
        <Plus size={16} />
        <span className="hidden md:inline">Novo</span>
      </button>
    </div>
  );
};
