import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Task, Group } from "../types";
import { Header } from "../components/Header";
import { GroupTabs } from "../components/GroupTabs";
import { TaskList } from "../components/TaskList";
import { format, addDays, addWeeks, addMonths, addHours, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { TaskForm } from "../components/TaskForm";
import { GroupForm } from "../components/GroupForm";
import { getIconComponent } from "../components/ui/IconPicker";

export const Dashboard: React.FC = () => {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [copyTask, setCopyTask] = useState<Task | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const groups = useLiveQuery(() => db.groups.orderBy('order').toArray());
  const tasks = useLiveQuery(
    () => {
      if (!selectedGroupId && groups && groups.length > 0) {
          // Default to first group if none selected
          return db.tasks.where('groupId').equals(groups[0].id).toArray();
      }
      if (selectedGroupId) {
        return db.tasks.where('groupId').equals(selectedGroupId).toArray();
      }
      return [];
    },
    [selectedGroupId, groups]
  );

  // Set initial group selection
  React.useEffect(() => {
      if (!selectedGroupId && groups && groups.length > 0) {
          setSelectedGroupId(groups[0].id);
      }
  }, [groups, selectedGroupId]);

  const selectedGroup = groups?.find(g => g.id === selectedGroupId);
  const pendingCount = tasks?.filter(t => !t.status).length || 0;

  const handleToggleTask = async (task: Task) => {
    if (task.type === 'recurrent') {
        const currentDueDate = new Date(task.date);
        const interval = task.interval || 1;
        let nextDate = new Date(currentDueDate);

        if (task.frequency === 'daily') nextDate = addDays(currentDueDate, interval);
        else if (task.frequency === 'weekly') nextDate = addWeeks(currentDueDate, interval);
        else if (task.frequency === 'monthly') nextDate = addMonths(currentDueDate, interval);
        else if (task.frequency === 'hours') nextDate = addHours(currentDueDate, interval);
        else if (task.frequency === 'minutes') nextDate = addMinutes(currentDueDate, interval);
        else nextDate = addDays(currentDueDate, 1);

        if (nextDate < new Date()) {
             if (task.frequency === 'daily') nextDate = addDays(new Date(), interval);
             else if (task.frequency === 'weekly') nextDate = addWeeks(new Date(), interval);
             else if (task.frequency === 'monthly') nextDate = addMonths(new Date(), interval);
             else if (task.frequency === 'hours') nextDate = addHours(new Date(), interval);
             else if (task.frequency === 'minutes') nextDate = addMinutes(new Date(), interval);
        }
        
        await db.tasks.update(task.id, {
            lastCompletedDate: new Date(),
            date: nextDate,
            status: false
        });
        
    } else {
        // Toggle Logic for Immediate and Objective tasks
        
        if (task.type === 'objective') {
            // Objective logic: Save lastCompletedDate if marking as done
            // Also supports daily reset via checkDailyReset (to be implemented/called)
            
            const newStatus = !task.status;
            await db.tasks.update(task.id, { 
                status: newStatus,
                lastCompletedDate: newStatus ? new Date() : task.lastCompletedDate // Keep history if unchecking? Or update? Standard is update on completion.
            });
        } else {
            await db.tasks.update(task.id, { status: !task.status });
        }
    }
  };

  // Effect to handle daily reset for objectives
  React.useEffect(() => {
      const checkDailyReset = async () => {
          if (!tasks) return;
          
          const objectives = tasks.filter(t => t.type === 'objective' && t.status && t.lastCompletedDate);
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

          for (const task of objectives) {
              if (task.lastCompletedDate) {
                  const lastCompleted = new Date(task.lastCompletedDate);
                  const lastDate = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth(), lastCompleted.getDate()).getTime();
                  
                  if (lastDate < today) {
                      // Reset status if completed on a previous day
                      await db.tasks.update(task.id, { status: false });
                  }
              }
          }
      };
      
      checkDailyReset();
      // Optional: Set an interval to check periodically if app is left open overnight
      const interval = setInterval(checkDailyReset, 60000); // Check every minute
      return () => clearInterval(interval);
  }, [tasks]);

  const handleDeleteTask = async (task: Task) => {
      if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
          await db.tasks.delete(task.id);
      }
  };
  
  const handleCreateTask = () => {
      setEditingTask(null);
      setCopyTask(null);
      setIsTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
      setEditingTask(task);
      setCopyTask(null);
      setIsTaskModalOpen(true);
  };

  const handleDuplicateTask = (task: Task) => {
      setCopyTask(task);
      setEditingTask(null);
      setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
      // Check for duplicate names (case insensitive) within the same group
      const targetGroupId = taskData.groupId || editingTask?.groupId || selectedGroupId || 0;
      
      const existingTasks = await db.tasks
        .where('groupId')
        .equals(Number(targetGroupId))
        .toArray();

      const isDuplicateName = existingTasks.some(t => 
        t.title.trim().toLowerCase() === (taskData.title || "").trim().toLowerCase() && 
        t.id !== editingTask?.id // Allow saving same name if it's the same task being edited
      );

      if (isDuplicateName) {
        alert("Já existe uma tarefa com este nome neste grupo. Por favor, escolha um nome diferente.");
        return;
      }

      if (editingTask) {
          // If editing recurrence, recalculate next date based on last completion or now
          // This ensures changing interval from 1h to 10m applies immediately
          let updateData = { ...taskData };
          
          if (editingTask.type === 'recurrent' && taskData.type === 'recurrent') {
              const frequencyChanged = editingTask.frequency !== taskData.frequency;
              const intervalChanged = editingTask.interval !== taskData.interval;
              
              if (frequencyChanged || intervalChanged) {
                  // Re-calculate next due date based on last completion (or creation) + new interval
                  const baseDate = editingTask.lastCompletedDate 
                      ? new Date(editingTask.lastCompletedDate) 
                      : new Date(); // Or date - oldInterval if strict
                  
                  // If never completed, reset start to now so new interval applies from now?
                  // Or assume it started at 'date' - oldInterval?
                  // Let's use 'lastCompletedDate' if available, otherwise reset 'date' to now + newInterval
                  // to avoid confusion with old long intervals.
                  
                  const interval = Number(taskData.interval) || 1;
                  let newNextDate = new Date(); // Placeholder

                  if (editingTask.lastCompletedDate) {
                      // Add new interval to last completion
                      if (taskData.frequency === 'daily') newNextDate = addDays(baseDate, interval);
                      else if (taskData.frequency === 'weekly') newNextDate = addWeeks(baseDate, interval);
                      else if (taskData.frequency === 'monthly') newNextDate = addMonths(baseDate, interval);
                      else if (taskData.frequency === 'hours') newNextDate = addHours(baseDate, interval);
                      else if (taskData.frequency === 'minutes') newNextDate = addMinutes(baseDate, interval);
                  } else {
                      // Never completed. Reset start time to NOW.
                      // This effectively restarts the timer with the new interval.
                      const now = new Date();
                      if (taskData.frequency === 'daily') newNextDate = addDays(now, interval);
                      else if (taskData.frequency === 'weekly') newNextDate = addWeeks(now, interval);
                      else if (taskData.frequency === 'monthly') newNextDate = addMonths(now, interval);
                      else if (taskData.frequency === 'hours') newNextDate = addHours(now, interval);
                      else if (taskData.frequency === 'minutes') newNextDate = addMinutes(now, interval);
                  }
                  
                  updateData.date = newNextDate;
              }
          }

          await db.tasks.update(editingTask.id, updateData);
      } else {
          // Creating new task (or duplicating)
          // If duplicating, we might want to reset some fields like status
          
          await db.tasks.add({
              ...taskData,
              status: false,
              date: new Date(), // Reset date to now for new copies? Or keep original date? Usually new tasks start fresh.
              lastCompletedDate: undefined, // Reset completion history
              type: taskData.type || 'immediate',
              groupId: taskData.groupId || selectedGroupId || 0
          } as Task);
      }
      setIsTaskModalOpen(false);
      setCopyTask(null);
  };

  const handleCreateGroup = () => {
      setEditingGroup(null);
      setIsGroupModalOpen(true);
  };

  const handleEditGroup = (group: Group) => {
      setEditingGroup(group);
      setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async (groupData: Partial<Group>) => {
      if (editingGroup) {
          await db.groups.update(editingGroup.id, groupData);
      } else {
          const lastGroup = await db.groups.orderBy('order').last();
          const newOrder = (lastGroup?.order || 0) + 1;
          
          await db.groups.add({
              ...groupData,
              order: newOrder
          } as Group);
      }
      setIsGroupModalOpen(false);
  };

  const handleDeleteGroup = async (group: Group) => {
      if (confirm(`Tem certeza que deseja excluir o grupo "${group.title}" e todas as suas tarefas?`)) {
          await db.transaction('rw', db.groups, db.tasks, async () => {
              await db.tasks.where('groupId').equals(group.id).delete();
              await db.groups.delete(group.id);
          });
      }
  };

  if (!groups) return <div>Carregando...</div>;

  const SelectedGroupIcon = selectedGroup ? getIconComponent(selectedGroup.icon) : Plus;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header onGroupSelect={setSelectedGroupId} />
      
      <GroupTabs 
        groups={groups} 
        selectedGroupId={selectedGroupId} 
        onSelectGroup={setSelectedGroupId}
        onNewGroup={handleCreateGroup}
      />

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        {/* Group Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
                <button 
                    onClick={handleCreateTask}
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-md transition-transform hover:scale-105 active:scale-95"
                    style={{ backgroundColor: selectedGroup?.color || '#3b82f6' }}
                    aria-label="Criar nova tarefa"
                >
                     <SelectedGroupIcon className="h-6 w-6" /> 
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                    {selectedGroup?.title} - {format(new Date(), "d 'de' MMMM", { locale: ptBR })}
                    </h2>
                    <p className="text-gray-500">
                    Você tem <span className="font-medium text-blue-600">{pendingCount} tarefas pendentes</span>
                    </p>
                </div>
            </div>
          </div>
          
          <div className="flex gap-3">
             <Button 
                variant="ghost" 
                className="text-gray-500 gap-2"
                onClick={() => selectedGroup && handleEditGroup(selectedGroup)}
                disabled={!selectedGroup}
             >
                <Pencil size={16} />
                <span className="hidden md:inline">Editar</span>
             </Button>
             <Button 
                variant="danger" 
                className="bg-red-50 text-red-600 hover:bg-red-100 gap-2"
                onClick={() => selectedGroup && handleDeleteGroup(selectedGroup)}
                disabled={!selectedGroup}
             >
                <Trash2 size={16} />
                <span className="hidden md:inline">Excluir</span>
             </Button>
          </div>
        </div>

        <TaskList 
            tasks={tasks || []} 
            onToggle={handleToggleTask}
            onEdit={handleEditTask}
            onDuplicate={handleDuplicateTask}
            onDelete={handleDeleteTask}
        />
        
      </main>
      
        {/* Floating Action Button for Mobile */}
        <button 
            onClick={handleCreateTask}
            className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-blue-600 active:scale-95 md:hidden"
        >
            <Plus size={24} />
        </button>

        {/* Modais */}
        <Modal 
            isOpen={isTaskModalOpen} 
            onClose={() => setIsTaskModalOpen(false)} 
            title={editingTask ? "Editar Tarefa" : (copyTask ? "Duplicar Tarefa" : "Criar Nova Tarefa")}
            className="max-w-2xl"
        >
            <TaskForm 
                initialTask={editingTask || copyTask} 
                initialGroupId={selectedGroupId}
                onSave={handleSaveTask}
                onCancel={() => setIsTaskModalOpen(false)}
            />
        </Modal>

        <Modal 
            isOpen={isGroupModalOpen} 
            onClose={() => setIsGroupModalOpen(false)} 
            title={editingGroup ? "Editar Grupo" : "Criar Novo Grupo"}
        >
            <GroupForm 
                initialGroup={editingGroup}
                onSave={handleSaveGroup}
                onCancel={() => setIsGroupModalOpen(false)}
            />
        </Modal>
    </div>
  );
};
