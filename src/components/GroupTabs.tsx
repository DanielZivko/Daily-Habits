import React, { useState, useEffect, useRef } from "react";
import type { Group } from "../types";
import { cn } from "../lib/utils";
import { Plus } from "lucide-react";
import { getIconComponent } from "./ui/IconPicker";
import { db } from "../db/db";
import { Reorder, useDragControls } from "framer-motion";

// Função para determinar o nível de glow baseado na quantidade de tarefas pendentes
const getGlowLevel = (pendingCount: number): 'none' | 'low' | 'medium' | 'high' => {
  if (pendingCount === 0) return 'none';
  if (pendingCount <= 3) return 'low';      // 1-3: glow super fraco, piscando lento
  if (pendingCount <= 7) return 'medium';   // 4-7: glow fraco, piscando lento-médio
  return 'high';                             // 8+: glow médio-fraco, piscando médio
};

interface GroupTabItemProps {
  group: Group;
  isSelected: boolean;
  onClick: () => void;
  onDragEnd: () => void;
  pendingCount: number;
}

const GroupTabItem: React.FC<GroupTabItemProps> = ({ group, isSelected, onClick, onDragEnd, pendingCount }) => {
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
  const glowLevel = getGlowLevel(pendingCount);
  
  // Classes de animação de glow baseadas no nível
  const glowClasses = {
    none: '',
    low: 'animate-glow-slow',      // 1-3: super fraco, lento
    medium: 'animate-glow-medium', // 4-7: fraco, lento-médio
    high: 'animate-glow-fast'      // 8+: médio-fraco, médio
  };

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
        "flex min-w-fit items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors cursor-pointer select-none touch-manipulation rounded-t-lg", 
        isSelected
          ? "border-current"
          : "border-transparent text-gray-500 hover:text-gray-700",
        isPressing && "opacity-70 scale-95 duration-200",
        glowClasses[glowLevel]
      )}
      style={{
        color: isSelected ? group.color : undefined,
        borderColor: isSelected ? group.color : undefined,
        // Aplicar glow com a cor do grupo
        ...(glowLevel !== 'none' && {
          '--glow-color': group.color
        } as React.CSSProperties)
      }}
      whileDrag={{ scale: 1.05, cursor: "grabbing", zIndex: 50 }}
      title={group.title}
    >
      <Icon 
        size={20} 
        style={{ color: group.color }}
        className={glowClasses[glowLevel]}
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
  pendingCountByGroup: Record<string, number>;
}

export const GroupTabs: React.FC<GroupTabsProps> = ({ 
  groups, 
  selectedGroupId, 
  onSelectGroup,
  onNewGroup,
  pendingCountByGroup
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
            pendingCount={pendingCountByGroup[group.id] || 0}
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
