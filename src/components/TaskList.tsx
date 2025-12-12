import React, { useState, useEffect, useRef } from "react";
import type { Task } from "../types";
import { TaskItem } from "./TaskItem";
import { AlertCircle, RotateCw, Flag, CheckCircle2, ChevronDown } from "lucide-react";
import { db } from "../db/db";
import { Reorder, useDragControls } from "framer-motion";
import { cn } from "../lib/utils";

interface TaskListProps {
  tasks: Task[];
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onDelete: (task: Task) => void;
}

interface SortableObjectiveItemProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onDelete: (task: Task) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDragEnd: () => void;
}

const SortableObjectiveItem: React.FC<SortableObjectiveItemProps> = ({ 
    task, onToggle, onEdit, onDuplicate, onDelete, isExpanded, onToggleExpand, onDragEnd 
}) => {
  const controls = useDragControls();
  const [isPressing, setIsPressing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // Prevent drag start on interactive elements
    if (target.closest('button') || target.closest('input') || target.closest('a') || target.closest('[role="checkbox"]')) {
        return;
    }
    
    if (e.button !== 0) return;

    startPosRef.current = { x: e.clientX, y: e.clientY };
    setIsPressing(true);

    timeoutRef.current = setTimeout(() => {
      controls.start(e);
      if (navigator.vibrate) navigator.vibrate(50);
      setIsPressing(false);
    }, 1000);
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

    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  };

  return (
    <Reorder.Item 
      value={task}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onPointerLeave={cancelLongPress}
      style={{ touchAction: 'manipulation' }}
      className="relative"
    >
      <div className={cn("transition-transform duration-200", isPressing && "scale-[0.98] opacity-80")}>
        <TaskItem 
          task={task} 
          onToggle={onToggle} 
          onEdit={onEdit} 
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
        />
      </div>
    </Reorder.Item>
  );
};

const sortTasksByUrgency = (tasks: Task[], type: 'immediate' | 'recurrent' | 'objective') => {
  return [...tasks].sort((a, b) => {
    // For objectives, use manual order
    if (type === 'objective') {
        const orderA = a.order !== undefined ? a.order : Infinity;
        const orderB = b.order !== undefined ? b.order : Infinity;
        if (orderA !== orderB) return orderA - orderB;
        // Fallback to creation order (id string compare)
        return a.id.localeCompare(b.id);
    }

    // Helper to get comparison date based on type
    const getDate = (task: Task) => {
      if (type === 'recurrent') return task.date ? new Date(task.date).getTime() : Infinity;
      // For immediate, prioritize deadline
      if (type === 'immediate' && task.deadline) return new Date(task.deadline).getTime();
      return Infinity; // No deadline -> last priority
    };

    const dateA = getDate(a);
    const dateB = getDate(b);

    if (dateA !== dateB) return dateA - dateB;

    // Tie-breaker: creation order (ID) or Title
    return a.id.localeCompare(b.id);
  });
};

export const TaskList: React.FC<TaskListProps> = ({ tasks, onToggle, onEdit, onDuplicate, onDelete }) => {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [localObjectives, setLocalObjectives] = useState<Task[]>([]);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  
  const allImmediateTasks = tasks.filter(t => t.type === 'immediate');
  const immediateTasks = sortTasksByUrgency(allImmediateTasks.filter(t => !t.status), 'immediate');
  const completedImmediateTasks = sortTasksByUrgency(allImmediateTasks.filter(t => t.status), 'immediate');
  const recurrentTasks = sortTasksByUrgency(tasks.filter(t => t.type === 'recurrent'), 'recurrent');

  useEffect(() => {
    const objectives = sortTasksByUrgency(tasks.filter(t => t.type === 'objective'), 'objective');
    setLocalObjectives(objectives);
  }, [tasks]);

  const handleToggleExpand = (taskId: string) => {
      setExpandedTaskId(prev => prev === taskId ? null : taskId);
  };

  const handleReorder = (newOrder: Task[]) => {
      setLocalObjectives(newOrder);
  };

  const handleDragEnd = async () => {
    // Update order in DB for ALL items in the list to ensure consistency
    // We use localObjectives which has the new order
    await db.transaction('rw', db.tasks, async () => {
        for (let i = 0; i < localObjectives.length; i++) {
            // Only update if order actually changed to avoid unnecessary writes
            if (localObjectives[i].order !== i) {
                await db.tasks.update(localObjectives[i].id, { order: i });
            }
        }
    });
  };

  return (
    <div className="space-y-6 pb-20"> {/* Reduced vertical space */}
      {(immediateTasks.length > 0 || completedImmediateTasks.length > 0) && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-gray-800">
            <AlertCircle className="text-orange-500" size={18} />
            Tarefas Imediatas
          </h2>
          <div className="space-y-2">
            {immediateTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onToggle={onToggle} 
                onEdit={onEdit} 
                onDuplicate={onDuplicate}
                onDelete={onDelete} 
                isExpanded={expandedTaskId === task.id}
                onToggleExpand={() => handleToggleExpand(task.id)}
              />
            ))}
          </div>

          {/* Seção de Tarefas Concluídas - Recolhível */}
          {completedImmediateTasks.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                className="flex w-full items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                <CheckCircle2 className="text-green-500" size={16} />
                <span>Concluídas ({completedImmediateTasks.length})</span>
                <ChevronDown 
                  size={16} 
                  className={cn(
                    "ml-auto transition-transform duration-200",
                    isCompletedExpanded && "rotate-180"
                  )} 
                />
              </button>
              
              <div className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isCompletedExpanded ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0"
              )}>
                <div className="space-y-2">
                  {completedImmediateTasks.map(task => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      onToggle={onToggle} 
                      onEdit={onEdit} 
                      onDuplicate={onDuplicate}
                      onDelete={onDelete} 
                      isExpanded={expandedTaskId === task.id}
                      onToggleExpand={() => handleToggleExpand(task.id)}
                      isInCompletedList={true}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {recurrentTasks.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-gray-800">
            <RotateCw className="text-blue-500" size={18} />
            Tarefas Recorrentes
          </h2>
          <div className="space-y-2">
            {recurrentTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onToggle={onToggle} 
                onEdit={onEdit} 
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isExpanded={expandedTaskId === task.id}
                onToggleExpand={() => handleToggleExpand(task.id)}
              />
            ))}
          </div>
        </section>
      )}

      {localObjectives.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-gray-800">
            <Flag className="text-emerald-500" size={18} />
            Objetivos Diários
          </h2>
          <Reorder.Group 
            axis="y" 
            values={localObjectives} 
            onReorder={handleReorder}
            className="space-y-2"
          >
            {localObjectives.map(task => (
              <SortableObjectiveItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isExpanded={expandedTaskId === task.id}
                onToggleExpand={() => handleToggleExpand(task.id)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </Reorder.Group>
        </section>
      )}

      {tasks.length === 0 && (
         <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="mb-4 rounded-full bg-gray-100 p-6">
                <Flag className="h-10 w-10 text-gray-300" />
            </div>
            <p>Nenhuma tarefa encontrada neste grupo.</p>
         </div>
      )}
    </div>
  );
};
