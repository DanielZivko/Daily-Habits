import React, { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Task, Group } from "../types";
import { Header } from "../components/Header";
import { GroupTabs } from "../components/GroupTabs";
import { TaskList } from "../components/TaskList";
import { CalendarTaskList } from "../components/CalendarTaskList";
import { addDays, addWeeks, addMonths, addHours, addMinutes } from "date-fns";
import type { CalendarPeriod } from "../components/CalendarTab";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { TaskForm } from "../components/TaskForm";
import { GroupForm } from "../components/GroupForm";
import { getIconComponent } from "../components/ui/IconPicker";
import { useAuth } from "../contexts/AuthContext";
import { MeasurementInputModal } from "../components/MeasurementInputModal";

// Função para verificar se uma tarefa está "pendente" (vencida)
// Apenas tarefas imediatas e recorrentes, nunca objetivos
const isTaskOverdue = (task: Task): boolean => {
  const now = new Date();
  
  // Ignorar objetivos
  if (task.type === 'objective') return false;
  
  // Tarefas imediatas: vencida se tem deadline e já passou
  if (task.type === 'immediate') {
    if (task.status) return false; // Já completada
    if (!task.deadline) return false; // Sem prazo definido
    return new Date(task.deadline) < now;
  }
  
  // Tarefas recorrentes:
  // Critério de "pendente" deve ser consistente com a barrinha (TaskItem):
  // - Só conta como pendente se já foi completada ao menos 1 vez (lastCompletedDate existe)
  // - E se estourou o prazo do próximo ciclo (now > lastCompletedDate + intervalo)
  if (task.type === 'recurrent') {
    if (!task.lastCompletedDate) return false;
    const lastCompleted = new Date(task.lastCompletedDate);
    const interval = task.interval || 1;
    let nextDueDate = new Date(lastCompleted);

    if (task.frequency === 'minutes') nextDueDate = addMinutes(lastCompleted, interval);
    else if (task.frequency === 'hours') nextDueDate = addHours(lastCompleted, interval);
    else if (task.frequency === 'daily') nextDueDate = addDays(lastCompleted, interval);
    else if (task.frequency === 'weekly') nextDueDate = addWeeks(lastCompleted, interval);
    else if (task.frequency === 'monthly') nextDueDate = addMonths(lastCompleted, interval);
    else nextDueDate = addDays(lastCompleted, interval);

    return nextDueDate < now;
  }
  
  return false;
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const currentUserId = user ? user.id : 'guest';

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isCalendarSelected, setIsCalendarSelected] = useState(true);
  const [selectedCalendarPeriod, setSelectedCalendarPeriod] = useState<CalendarPeriod>('today');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [copyTask, setCopyTask] = useState<Task | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // Estados para modal de medição
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false);

  const groups = useLiveQuery(
    () => db.groups.where('userId').equals(currentUserId).sortBy('order'),
    [currentUserId]
  );

  // Buscar TODAS as tarefas do usuário para calcular pending counts por grupo
  const allTasks = useLiveQuery(
    () => db.tasks.where('userId').equals(currentUserId).toArray(),
    [currentUserId]
  );

  // Calcular contagem de tarefas pendentes (vencidas) por grupo
  const pendingCountByGroup = useMemo(() => {
    const countMap: Record<string, number> = {};
    if (!allTasks) return countMap;
    
    allTasks.forEach(task => {
      if (isTaskOverdue(task)) {
        countMap[task.groupId] = (countMap[task.groupId] || 0) + 1;
      }
    });
    
    return countMap;
  }, [allTasks]);
  
  const tasks = useLiveQuery(
    () => {
      if (!selectedGroupId && groups && groups.length > 0) {
          // Default to first group if none selected
          return db.tasks
            .where('userId').equals(currentUserId)
            .and(t => t.groupId === groups[0].id)
            .toArray();
      }
      if (selectedGroupId) {
        return db.tasks
            .where('userId').equals(currentUserId)
            .and(t => t.groupId === selectedGroupId)
            .toArray();
      }
      return [];
    },
    [selectedGroupId, groups, currentUserId]
  );

  // Set initial group selection (only if calendar is not selected)
  React.useEffect(() => {
      // Se calendário está selecionado, não selecionar grupo automaticamente
      if (isCalendarSelected) {
        return;
      }
      
      if (!selectedGroupId && groups && groups.length > 0) {
          setSelectedGroupId(groups[0].id);
      } else if (groups && groups.length === 0) {
        setSelectedGroupId(null);
      }
  }, [groups, selectedGroupId, isCalendarSelected]);

  // Handlers para seleção de guia
  const handleSelectGroup = (id: string | null) => {
    setSelectedGroupId(id);
    setIsCalendarSelected(false);
  };

  const handleSelectCalendar = () => {
    setIsCalendarSelected(true);
    setSelectedGroupId(null);
  };

  const selectedGroup = groups?.find(g => g.id === selectedGroupId);
  // Contagem de pendentes do grupo selecionado (apenas tarefas vencidas de imediatas/recorrentes)
  const pendingCount = selectedGroupId ? (pendingCountByGroup[selectedGroupId] || 0) : 0;

  const performTaskCompletion = async (task: Task, measurements: Record<string, number> = {}) => {
    if (task.type === 'recurrent') {
        // Mantém `date` como "próxima execução" consistente com a barrinha:
        // nextDueDate = now + intervalo
        const now = new Date();
        const interval = task.interval || 1;
        let nextDate = new Date(now);

        if (task.frequency === 'daily') nextDate = addDays(now, interval);
        else if (task.frequency === 'weekly') nextDate = addWeeks(now, interval);
        else if (task.frequency === 'monthly') nextDate = addMonths(now, interval);
        else if (task.frequency === 'hours') nextDate = addHours(now, interval);
        else if (task.frequency === 'minutes') nextDate = addMinutes(now, interval);
        else nextDate = addDays(now, interval);
        
        await db.transaction('rw', db.tasks, db.taskHistory, async () => {
            await db.tasks.update(task.id, {
                lastCompletedDate: now,
                date: nextDate,
                status: false
            });
            
            // Add history
            await db.taskHistory.add({
                id: crypto.randomUUID(),
                userId: currentUserId,
                taskId: task.id,
                date: now,
                value: 1,
                measurements // Salva medições
            });

            // Atualiza os valores da medição na definição da tarefa
            if (Object.keys(measurements).length > 0 && task.measures) {
                const updatedMeasures = task.measures.map(m => {
                    if (m.description && measurements[m.description] !== undefined) {
                        return { ...m, value: String(measurements[m.description]) };
                    }
                    return m;
                });
                await db.tasks.update(task.id, { measures: updatedMeasures });
            }
        });
        
    } else {
        // Toggle Logic for Immediate and Objective tasks
        const isCompleting = !task.status;
        
        await db.transaction('rw', db.tasks, db.taskHistory, async () => {
             if (task.type === 'objective') {
                await db.tasks.update(task.id, { 
                    status: isCompleting,
                    lastCompletedDate: isCompleting ? new Date() : task.lastCompletedDate
                });
            } else {
                await db.tasks.update(task.id, { status: isCompleting });
            }

            if (isCompleting) {
                await db.taskHistory.add({
                    id: crypto.randomUUID(),
                    userId: currentUserId,
                    taskId: task.id,
                    date: new Date(),
                    value: 1,
                    measurements // Salva medições
                });

                // Atualiza os valores da medição na definição da tarefa
                if (Object.keys(measurements).length > 0 && task.measures) {
                    const updatedMeasures = task.measures.map(m => {
                        if (m.description && measurements[m.description] !== undefined) {
                            return { ...m, value: String(measurements[m.description]) };
                        }
                        return m;
                    });
                    await db.tasks.update(task.id, { measures: updatedMeasures });
                }
            }
        });
    }
  };

  const handleToggleTask = async (task: Task) => {
    const hasMeasures = task.measures && task.measures.length > 0;
    
    // Check if we are completing the task
    const isCompleting = task.type === 'recurrent' || !task.status;

    // If completing and has measures, open modal first
    if (isCompleting && hasMeasures) {
        setCompletingTask(task);
        setIsMeasurementModalOpen(true);
        return;
    }

    // Otherwise standard completion (no measures recorded)
    await performTaskCompletion(task, {});
  };

  const handleConfirmMeasurement = async (measurements: Record<string, number>) => {
      if (completingTask) {
          await performTaskCompletion(completingTask, measurements);
          setCompletingTask(null);
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
      const targetGroupId = taskData.groupId || editingTask?.groupId || selectedGroupId || "";
      
      if (!targetGroupId) {
          alert("Erro: Nenhum grupo selecionado.");
          return;
      }

      const existingTasks = await db.tasks
        .where('groupId')
        .equals(targetGroupId)
        .filter(t => t.userId === currentUserId) // Ensure we only check current user tasks
        .toArray();

      const isDuplicateName = existingTasks.some(t => 
        t.title.trim().toLowerCase() === (taskData.title || "").trim().toLowerCase() && 
        t.id !== editingTask?.id
      );

      if (isDuplicateName) {
        alert("Já existe uma tarefa com este nome neste grupo. Por favor, escolha um nome diferente.");
        return;
      }

      if (editingTask) {
          // Editing existing task
          let updateData = { ...taskData };
          
          if (editingTask.type === 'recurrent' && taskData.type === 'recurrent') {
              const frequencyChanged = editingTask.frequency !== taskData.frequency;
              const intervalChanged = editingTask.interval !== taskData.interval;
              
              if (frequencyChanged || intervalChanged) {
                  const baseDate = editingTask.lastCompletedDate 
                      ? new Date(editingTask.lastCompletedDate) 
                      : new Date();
                  
                  const interval = Number(taskData.interval) || 1;
                  let newNextDate = new Date();

                  if (editingTask.lastCompletedDate) {
                      if (taskData.frequency === 'daily') newNextDate = addDays(baseDate, interval);
                      else if (taskData.frequency === 'weekly') newNextDate = addWeeks(baseDate, interval);
                      else if (taskData.frequency === 'monthly') newNextDate = addMonths(baseDate, interval);
                      else if (taskData.frequency === 'hours') newNextDate = addHours(baseDate, interval);
                      else if (taskData.frequency === 'minutes') newNextDate = addMinutes(baseDate, interval);
                  } else {
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

          // Ensure userId is preserved or set if missing
          if (!updateData.userId) updateData.userId = currentUserId;

          await db.tasks.update(editingTask.id, updateData);
      } else {
          // Creating new task
          await db.tasks.add({
              ...taskData,
              userId: currentUserId, // Explicitly set user context
              status: false,
              date: new Date(),
              lastCompletedDate: undefined,
              type: taskData.type || 'immediate',
              groupId: taskData.groupId || selectedGroupId || targetGroupId,
              id: crypto.randomUUID() // Force new UUID for duplicated tasks to avoid collision
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
          // Ensure userId is preserved
          const updatePayload = { ...groupData };
          if (!updatePayload.userId) updatePayload.userId = currentUserId;
          await db.groups.update(editingGroup.id, updatePayload);
      } else {
          const lastGroup = await db.groups.where('userId').equals(currentUserId).sortBy('order').then(g => g[g.length-1]);
          const newOrder = (lastGroup?.order || 0) + 1;
          
          await db.groups.add({
              ...groupData,
              userId: currentUserId, // Explicitly set user context
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

  // Se não houver grupos para o usuário atual, mostra mensagem ou loader
  // Importante: groups pode ser vazio [] se o usuário não tiver nada, então não deve travar em "Carregando"
  if (groups === undefined) return <div>Carregando...</div>;

  const SelectedGroupIcon = selectedGroup ? getIconComponent(selectedGroup.icon) : Plus;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header onGroupSelect={setSelectedGroupId} />
      
      <GroupTabs 
        groups={groups || []} 
        selectedGroupId={selectedGroupId} 
        onSelectGroup={handleSelectGroup}
        onNewGroup={handleCreateGroup}
        pendingCountByGroup={pendingCountByGroup}
        isCalendarSelected={isCalendarSelected}
        onSelectCalendar={handleSelectCalendar}
        selectedCalendarPeriod={selectedCalendarPeriod}
        onSelectCalendarPeriod={setSelectedCalendarPeriod}
        customStartDate={customStartDate || undefined}
        customEndDate={customEndDate || undefined}
        onCustomDateChange={(start, end) => {
          setCustomStartDate(start);
          setCustomEndDate(end);
        }}
      />

      <main className="mx-auto max-w-5xl px-4 py-4 md:px-8">
        {isCalendarSelected ? (
          /* Vista Calendário */
          <>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Calendário</h2>
              <p className="text-gray-500">Tarefas organizadas por período</p>
            </div>
            <CalendarTaskList
              tasks={allTasks || []}
              groups={groups || []}
              period={selectedCalendarPeriod}
              customStartDate={customStartDate || undefined}
              customEndDate={customEndDate || undefined}
              onToggle={handleToggleTask}
              onEdit={handleEditTask}
              onDuplicate={handleDuplicateTask}
              onDelete={handleDeleteTask}
            />
          </>
        ) : (
          /* Vista de Grupo */
          <>
            {/* Group Header */}
            <div className="mb-4 flex items-start justify-between">
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
                        {selectedGroup ? selectedGroup.title : 'Bem-vindo'}
                        </h2>
                        <p className="text-gray-500">
                        {selectedGroup ? (
                            <><span className="font-medium text-blue-600">{pendingCount} tarefas pendentes</span></>
                        ) : (
                            "Selecione ou crie um grupo para começar"
                        )}
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

            {selectedGroup && (
                <TaskList 
                    tasks={tasks || []} 
                    onToggle={handleToggleTask}
                    onEdit={handleEditTask}
                    onDuplicate={handleDuplicateTask}
                    onDelete={handleDeleteTask}
                />
            )}
          </>
        )}
        
      </main>
      
        {/* Floating Action Button */}
        <button 
            onClick={handleCreateTask}
            className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-blue-600 active:scale-95"
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

        <MeasurementInputModal
            isOpen={isMeasurementModalOpen}
            onClose={() => {
                setIsMeasurementModalOpen(false);
                setCompletingTask(null);
            }}
            task={completingTask}
            onConfirm={handleConfirmMeasurement}
        />
    </div>
  );
};
