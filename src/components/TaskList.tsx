import React, { useState, useEffect } from "react";
import type { Task } from "../types";
import { TaskItem } from "./TaskItem";
import { AlertCircle, RotateCw, Flag } from "lucide-react";
import { db } from "../db/db";
import { Reorder } from "framer-motion";

interface TaskListProps {
  tasks: Task[];
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onDelete: (task: Task) => void;
}

const sortTasksByUrgency = (tasks: Task[], type: 'immediate' | 'recurrent' | 'objective') => {
  return [...tasks].sort((a, b) => {
    // For objectives, use manual order
    if (type === 'objective') {
        const orderA = a.order !== undefined ? a.order : Infinity;
        const orderB = b.order !== undefined ? b.order : Infinity;
        if (orderA !== orderB) return orderA - orderB;
        // Fallback to creation order (id)
        return a.id - b.id;
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
    return a.id - b.id;
  });
};

export const TaskList: React.FC<TaskListProps> = ({ tasks, onToggle, onEdit, onDuplicate, onDelete }) => {
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [localObjectives, setLocalObjectives] = useState<Task[]>([]);
  
  const immediateTasks = sortTasksByUrgency(tasks.filter(t => t.type === 'immediate'), 'immediate');
  const recurrentTasks = sortTasksByUrgency(tasks.filter(t => t.type === 'recurrent'), 'recurrent');

  useEffect(() => {
    const objectives = sortTasksByUrgency(tasks.filter(t => t.type === 'objective'), 'objective');
    setLocalObjectives(objectives);
  }, [tasks]);

  const handleToggleExpand = (taskId: number) => {
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
    <div className="space-y-8 pb-20">
      {immediateTasks.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
            <AlertCircle className="text-orange-500" size={20} />
            Tarefas Imediatas
          </h2>
          <div className="space-y-3">
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
        </section>
      )}

      {recurrentTasks.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
            <RotateCw className="text-blue-500" size={20} />
            Tarefas Recorrentes
          </h2>
          <div className="space-y-3">
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
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
            <Flag className="text-emerald-500" size={20} />
            Objetivos Principais
          </h2>
          <Reorder.Group 
            axis="y" 
            values={localObjectives} 
            onReorder={handleReorder}
            className="space-y-3"
          >
            {localObjectives.map(task => (
              <Reorder.Item 
                key={task.id} 
                value={task}
                onDragEnd={handleDragEnd}
                // Removing default touch-action blocking might help with scrolling on mobile if dragged by a handle, 
                // but here we drag the whole card, so we keep defaults or adjust if needed.
                // Framer motion defaults are usually good.
              >
                  <TaskItem 
                    task={task} 
                    onToggle={onToggle} 
                    onEdit={onEdit} 
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                    isExpanded={expandedTaskId === task.id}
                    onToggleExpand={() => handleToggleExpand(task.id)}
                  />
              </Reorder.Item>
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
