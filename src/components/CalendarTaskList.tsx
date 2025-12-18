import React, { useState, useMemo } from "react";
import type { Task, Group } from "../types";
import { TaskItem } from "./TaskItem";
import { Calendar } from "lucide-react";
import { addMinutes, addHours, addDays, addWeeks, addMonths, startOfDay, endOfDay, isSameDay, isBefore, isAfter } from "date-fns";
import type { CalendarPeriod } from "./CalendarTab";

interface TaskWithOccurrences extends Task {
  occurrenceCount?: number;
  nextDueDate?: Date;
  urgencyScore?: number; // Para ordenação
}

interface CalendarTaskListProps {
  tasks: Task[];
  groups: Group[];
  period: CalendarPeriod;
  customStartDate?: Date;
  customEndDate?: Date;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onDelete: (task: Task) => void;
  onUpdate?: (task: Task) => void;
}

// Função auxiliar para adicionar intervalo baseado na frequência
const addInterval = (date: Date, frequency: string, interval: number): Date => {
  switch (frequency) {
    case 'minutes': return addMinutes(date, interval);
    case 'hours': return addHours(date, interval);
    case 'daily': return addDays(date, interval);
    case 'weekly': return addWeeks(date, interval);
    case 'monthly': return addMonths(date, interval);
    default: return addDays(date, interval);
  }
};

// Calcula a próxima data de vencimento de uma tarefa recorrente
const getNextDueDate = (task: Task): Date | null => {
  if (task.type !== 'recurrent' || !task.frequency) return null;
  
  const interval = task.interval || 1;
  const baseDate = task.lastCompletedDate 
    ? new Date(task.lastCompletedDate)
    : new Date(task.date);
  
  return addInterval(baseDate, task.frequency, interval);
};

// Calcula quantas vezes uma tarefa recorrente se repete em um período
const getRecurrenceOccurrences = (
  task: Task,
  startDate: Date,
  endDate: Date,
  period: CalendarPeriod
): number => {
  if (task.type !== 'recurrent' || !task.frequency) return 0;
  
  const interval = task.interval || 1;
  const now = new Date();
  
  // Determinar a data inicial para começar a contar
  // Baseado na última conclusão ou na data de criação
  let baseDate = task.lastCompletedDate 
    ? new Date(task.lastCompletedDate)
    : new Date(task.date);
    
  // A primeira ocorrência a verificar é base + intervalo
  let checkDate = addInterval(baseDate, task.frequency, interval);
  
  // Verificar se é intra-day (horas/minutos)
  const isIntraDay = ['minutes', 'hours'].includes(task.frequency);
  
  // Normalizar checkDate se não for intra-day
  if (!isIntraDay) {
    checkDate = startOfDay(checkDate);
  }

  // Definir datas de comparação normalizadas
  // Se intra-day, usamos precisão total. Se dias, usamos startOfDay/endOfDay.
  const compareStartDate = isIntraDay ? startDate : startOfDay(startDate);
  // endOfDay garante até 23:59:59.999
  const compareEndDate = isIntraDay ? endDate : endOfDay(endDate);
  const compareNow = isIntraDay ? now : startOfDay(now);
  
  let count = 0;
  const maxIterations = 1000; // Limite de segurança
  let iterations = 0;
  let hasOverdue = false;
  
  // Verifica atrasos e ocorrências futuras mantendo a fase correta
  while (iterations < maxIterations) {
    // Parar se passamos do fim do período de visualização
    if (isIntraDay) {
      if (checkDate.getTime() > compareEndDate.getTime()) break;
    } else {
      if (isAfter(checkDate, compareEndDate) && !isSameDay(checkDate, compareEndDate)) break;
    }

    // Verificar se está atrasada (antes de agora)
    let isOverdue = false;
    if (isIntraDay) {
      isOverdue = checkDate.getTime() < compareNow.getTime();
    } else {
      isOverdue = isBefore(checkDate, compareNow);
    }
    
    if (isOverdue) {
      // Marcamos que existe pendência, mas não somamos ao count imediatamente
      // para evitar acumular 1000 pendências. Contaremos como 1 pendência no final.
      hasOverdue = true;
    } else {
      // Se não é atrasada, verificar se está dentro do período de visualização
      // (Já sabemos que checkDate <= compareEndDate pelo while condition)
      let isAfterStart = false;
      if (isIntraDay) {
        isAfterStart = checkDate.getTime() >= compareStartDate.getTime();
      } else {
        isAfterStart = isAfter(checkDate, compareStartDate) || isSameDay(checkDate, compareStartDate);
      }
      
      if (isAfterStart) {
        count++;
      }
    }
    
    // Avançar para a próxima ocorrência
    checkDate = addInterval(checkDate, task.frequency, interval);
    if (!isIntraDay) {
      checkDate = startOfDay(checkDate);
    }
    iterations++;
  }
  
  // Se tem tarefas atrasadas e estamos vendo "Hoje", adiciona 1 ao contador
  // Isso garante que tarefas atrasadas apareçam, mas não polui com "100x"
  if (hasOverdue && period === 'today') {
    count++;
  }
  
  return count;
};

// Filtra tarefas por período temporal
const filterTasksByPeriod = (
  tasks: Task[],
  period: CalendarPeriod,
  customStartDate?: Date,
  customEndDate?: Date
): TaskWithOccurrences[] => {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = startOfDay(addDays(now, 1));
  const endOfTomorrow = endOfDay(addDays(now, 1));
  
  let startDate: Date;
  let endDate: Date;
  
  switch (period) {
    case 'today':
      startDate = today;
      endDate = endOfDay(today);
      break;
    case 'tomorrow':
      startDate = tomorrow;
      endDate = endOfTomorrow;
      break;
    case 'custom':
      if (customStartDate && customEndDate) {
        startDate = startOfDay(customStartDate);
        endDate = endOfDay(customEndDate);
      } else {
        // Fallback para hoje se não houver datas customizadas
        startDate = today;
        endDate = endOfDay(today);
      }
      break;
    default:
      startDate = today;
      endDate = endOfDay(today);
  }
  
  const filtered: TaskWithOccurrences[] = [];
  
  for (const task of tasks) {
    // Ignorar tarefas suspensas
    if (task.isSuspended) continue;

    // Objetivos diários só aparecem em "Hoje"
    if (task.type === 'objective') {
      if (period === 'today') {
        filtered.push({
          ...task,
          occurrenceCount: 1,
          nextDueDate: today
        });
      }
      continue;
    }
    
    // Tarefas imediatas
    if (task.type === 'immediate') {
      // Ignorar tarefas concluídas
      if (task.status) continue;
      
      if (task.deadline) {
        const deadline = new Date(task.deadline);
        const isOverdue = isBefore(deadline, now);
        const isInPeriod = (isBefore(deadline, endDate) || isSameDay(deadline, endDate)) &&
                          (isAfter(deadline, startDate) || isSameDay(deadline, startDate));
        
        // Tarefas vencidas só aparecem na sub-guia "Hoje"
        if (isOverdue && period !== 'today') {
          continue;
        }
        
        // Incluir se está dentro do período OU se está vencida (mas só se for "Hoje")
        if (isInPeriod || (isOverdue && period === 'today')) {
          filtered.push({
            ...task,
            occurrenceCount: 1,
            nextDueDate: deadline
          });
        }
      }
      continue;
    }
    
    // Tarefas recorrentes
    if (task.type === 'recurrent') {
      const occurrences = getRecurrenceOccurrences(task, startDate, endDate, period);
      if (occurrences > 0) {
        const nextDue = getNextDueDate(task);
        // Se a tarefa está vencida e não é "Hoje", não incluir
        if (nextDue && isBefore(nextDue, now) && period !== 'today') {
          continue;
        }
        filtered.push({
          ...task,
          occurrenceCount: occurrences,
          nextDueDate: nextDue || undefined
        });
      }
    }
  }
  
  return filtered;
};

// Calcula score de urgência para ordenação
const calculateUrgencyScore = (task: TaskWithOccurrences, now: Date): number => {
  if (!task.nextDueDate) return Infinity;
  
  const dueDate = new Date(task.nextDueDate);
  const diffMs = dueDate.getTime() - now.getTime();
  
  // Tarefas vencidas têm score negativo (mais negativo = mais urgente)
  if (diffMs < 0) {
    return diffMs; // Quanto mais negativo, mais vencida
  }
  
  // Tarefas futuras têm score positivo (menor = mais urgente)
  return diffMs;
};

// Ordena tarefas por urgência e grupo
const sortTasksByUrgency = (
  tasks: TaskWithOccurrences[]
): TaskWithOccurrences[] => {
  const now = new Date();
  
  // Calcular scores de urgência
  const tasksWithScores = tasks.map(task => ({
    ...task,
    urgencyScore: calculateUrgencyScore(task, now)
  }));
  
  // Ordenar por urgência
  tasksWithScores.sort((a, b) => {
    const scoreA = a.urgencyScore ?? Infinity;
    const scoreB = b.urgencyScore ?? Infinity;
    
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    
    // Se mesma urgência, ordenar por título
    return a.title.localeCompare(b.title);
  });
  
  return tasksWithScores;
};

// Agrupa tarefas por grupo
const groupTasksByGroup = (
  tasks: TaskWithOccurrences[],
  groups: Group[]
): Map<string, TaskWithOccurrences[]> => {
  const grouped = new Map<string, TaskWithOccurrences[]>();
  
  // Inicializar map com todos os grupos
  groups.forEach(group => {
    grouped.set(group.id, []);
  });
  
  // Adicionar tarefas aos grupos
  tasks.forEach(task => {
    const groupTasks = grouped.get(task.groupId) || [];
    groupTasks.push(task);
    grouped.set(task.groupId, groupTasks);
  });
  
  return grouped;
};

export const CalendarTaskList: React.FC<CalendarTaskListProps> = ({
  tasks,
  groups,
  period,
  customStartDate,
  customEndDate,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onUpdate
}) => {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  
  const filteredAndSortedTasks = useMemo(() => {
    const filtered = filterTasksByPeriod(tasks, period, customStartDate, customEndDate);
    const sorted = sortTasksByUrgency(filtered);
    return sorted;
  }, [tasks, period, customStartDate, customEndDate]);
  
  const groupedTasks = useMemo(() => {
    return groupTasksByGroup(filteredAndSortedTasks, groups);
  }, [filteredAndSortedTasks, groups]);
  
  // Ordenar grupos pela tarefa mais urgente de cada grupo
  const sortedGroups = useMemo(() => {
    const groupsWithUrgency = groups.map(group => {
      const groupTasks = groupedTasks.get(group.id) || [];
      const mostUrgentTask = groupTasks[0]; // Já está ordenado por urgência
      return {
        group,
        urgencyScore: mostUrgentTask?.urgencyScore ?? Infinity
      };
    });
    
    groupsWithUrgency.sort((a, b) => {
      if (a.urgencyScore !== b.urgencyScore) {
        return a.urgencyScore - b.urgencyScore;
      }
      // Se mesma urgência, manter ordem original do grupo
      return a.group.order - b.group.order;
    });
    
    return groupsWithUrgency.map(g => g.group);
  }, [groups, groupedTasks]);
  
  const handleToggleExpand = (taskId: string) => {
    setExpandedTaskId(prev => prev === taskId ? null : taskId);
  };
  
  if (filteredAndSortedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <div className="mb-4 rounded-full bg-gray-100 p-6">
          <Calendar className="h-10 w-10 text-gray-300" />
        </div>
        <p>Nenhuma tarefa encontrada para este período.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 pb-20">
      {sortedGroups.map((group) => {
        const groupTasks = groupedTasks.get(group.id) || [];
        if (groupTasks.length === 0) return null;
        
        return (
          <div key={group.id} className="space-y-2">
            {/* Cabeçalho do grupo */}
            <div className="flex items-center gap-2 pt-2">
              <h3 className="text-sm font-semibold text-gray-700">{group.title}</h3>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
            
            {/* Tarefas do grupo */}
            {groupTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onUpdate={onUpdate}
                isExpanded={expandedTaskId === task.id}
                onToggleExpand={() => handleToggleExpand(task.id)}
                occurrenceCount={task.occurrenceCount}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

