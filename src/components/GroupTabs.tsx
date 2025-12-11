import React, { useState, useEffect } from "react";
import type { Group } from "../types";
import { cn } from "../lib/utils";
import { Plus } from "lucide-react";
import { getIconComponent } from "./ui/IconPicker";
import { db } from "../db/db";
import { Reorder } from "framer-motion";

interface GroupTabsProps {
  groups: Group[];
  selectedGroupId: number | null;
  onSelectGroup: (id: number | null) => void;
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
        {localGroups.map((group) => {
          const Icon = getIconComponent(group.icon);
          const isSelected = selectedGroupId === group.id;

          return (
            <Reorder.Item
              key={group.id}
              value={group}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectGroup(group.id)}
              className={cn(
                "flex min-w-fit items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors cursor-grab active:cursor-grabbing select-none",
                isSelected 
                  ? "border-blue-500 text-blue-600" 
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
              whileDrag={{ scale: 1.05 }}
            >
              <Icon size={18} className={isSelected ? "text-blue-500" : "text-gray-400"} />
              {group.title}
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      <button
        onClick={onNewGroup}
        className="ml-6 flex min-w-fit items-center gap-1 py-4 text-sm font-medium text-gray-400 hover:text-blue-500"
      >
        <Plus size={16} />
        Novo
      </button>
    </div>
  );
};
