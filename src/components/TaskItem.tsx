import React, { useEffect, useState } from "react";
import type { Task } from "../types";
import { cn } from "../lib/utils";
import { Checkbox } from "./ui/Checkbox";
import { ProgressBar } from "./ui/ProgressBar";
import { TaskStatisticsChart } from "./TaskStatisticsChart";
import { Pencil, Trash2, Flag, Copy } from "lucide-react";
import { format, differenceInMilliseconds, formatDistanceToNow, differenceInDays, addMinutes, addHours, addDays, addWeeks, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

// Função para determinar se o card deve estar no estado compacto (encolhido)
const shouldBeCompact = (task: Task, progress: number): boolean => {
  // 1. Tarefas imediatas concluídas
  if (task.type === 'immediate' && task.status) {
    return true;
  }
  
  // 2. Tarefas imediatas com prazo definido e prazo a 3+ dias de distância
  if (task.type === 'immediate' && task.deadline && !task.status) {
    const daysUntilDeadline = differenceInDays(new Date(task.deadline), new Date());
    if (daysUntilDeadline >= 3) {
      return true;
    }
  }
  
  // 3. Tarefas recorrentes com barra de 0% a 70% (exceto nunca completadas)
  if (task.type === 'recurrent' && task.lastCompletedDate && progress <= 70) {
    return true;
  }
  
  // 4. Objetivos diários completados hoje (status = true)
  if (task.type === 'objective' && task.status) {
    return true;
  }
  
  return false;
};

interface TaskItemProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onDelete: (task: Task) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isInCompletedList?: boolean; // Se está na lista de tarefas concluídas
  occurrenceCount?: number; // Quantidade de ocorrências no período (para tarefas recorrentes)
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onEdit, onDuplicate, onDelete, isExpanded, onToggleExpand, isInCompletedList = false, occurrenceCount }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [progress, setProgress] = useState(0);
  
  // Determina se o card deve estar compacto (calculado após o progress ser definido)
  // Se o card está expandido, não fica compacto para melhor visualização
  const isCompact = !isExpanded && shouldBeCompact(task, progress);
  
  // Determina o tamanho do checkbox:
  // - Cards na lista de concluídas: sm
  // - Cards encolhidos: md
  // - Cards normais: lg
  const checkboxSize = isInCompletedList ? "sm" : (isCompact ? "md" : "lg");

  // Calcula a duração fixa do intervalo de recorrência em milissegundos
  const getRecurrenceIntervalMs = (frequency: string, interval: number): number => {
    switch (frequency) {
      case 'minutes': return interval * 60 * 1000;
      case 'hours': return interval * 60 * 60 * 1000;
      case 'daily': return interval * 24 * 60 * 60 * 1000;
      case 'weekly': return interval * 7 * 24 * 60 * 60 * 1000;
      case 'monthly': return interval * 30 * 24 * 60 * 60 * 1000; // aproximado
      default: return interval * 24 * 60 * 60 * 1000;
    }
  };

  // Calcular progresso baseado no tempo para tarefas recorrentes
  useEffect(() => {
    if (task.type !== 'recurrent' || !task.frequency) return;

    // Se nunca foi completada, progresso é 0 e não calculamos nada
    if (!task.lastCompletedDate) {
        setProgress(0);
        return;
    }

    const calculateProgress = () => {
      const now = new Date();
      const lastCompleted = new Date(task.lastCompletedDate!);
      
      // Usa a duração FIXA do intervalo de recorrência (não a diferença entre datas)
      const totalDuration = getRecurrenceIntervalMs(task.frequency!, task.interval || 1);
      const elapsed = differenceInMilliseconds(now, lastCompleted);
      
      // Se elapsed > totalDuration, significa que está atrasado (100% preenchido)
      const percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
      setProgress(percent);
    };

    calculateProgress();
    const timer = setInterval(calculateProgress, 1000); // Atualiza a cada segundo

    return () => clearInterval(timer);
  }, [task]);

  const renderActions = () => (
    <div className={cn("flex gap-0.5 transition-opacity", isHovered ? "opacity-100" : "opacity-0 md:opacity-0")}>
      <button 
        onClick={(e) => { e.stopPropagation(); onEdit(task); }}
        className={cn("text-gray-400 hover:text-blue-500 rounded hover:bg-gray-100", isCompact ? "p-0.5" : "p-1")}
      >
        <Pencil size={isCompact ? 12 : 14} />
      </button>
      <button 
        onClick={(e) => { e.stopPropagation(); onDuplicate(task); }}
        className={cn("text-gray-400 hover:text-green-500 rounded hover:bg-gray-100", isCompact ? "p-0.5" : "p-1")}
        title="Duplicar"
      >
        <Copy size={isCompact ? 12 : 14} />
      </button>
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(task); }}
        className={cn("text-gray-400 hover:text-red-500 rounded hover:bg-gray-100", isCompact ? "p-0.5" : "p-1")}
      >
        <Trash2 size={isCompact ? 12 : 14} />
      </button>
    </div>
  );

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-red-900 animate-pulse shadow-[0_0_10px_rgba(153,27,27,0.7)]"; // Vermelho escuro pulsante
    if (percent > 90) return "bg-red-500";
    if (percent > 60) return "bg-orange-500";
    if (percent > 30) return "bg-emerald-500"; // Verde (emerald é melhor que green padrão)
    return "bg-blue-500"; // Azul
  };

  const getStatusText = () => {
      // Se não tem lastCompletedDate, é "A fazer" sempre
      if (!task.lastCompletedDate) {
          return "A fazer";
      }

      const lastCompleted = new Date(task.lastCompletedDate);
      const interval = task.interval || 1;
      let nextDueDate = new Date();

      if (task.frequency === 'minutes') nextDueDate = addMinutes(lastCompleted, interval);
      else if (task.frequency === 'hours') nextDueDate = addHours(lastCompleted, interval);
      else if (task.frequency === 'daily') nextDueDate = addDays(lastCompleted, interval);
      else if (task.frequency === 'weekly') nextDueDate = addWeeks(lastCompleted, interval);
      else if (task.frequency === 'monthly') nextDueDate = addMonths(lastCompleted, interval);
      else nextDueDate = addDays(lastCompleted, interval);

      if (progress >= 100) {
          // Calcular ciclos expirados
          const now = new Date();
          const recurrenceMs = getRecurrenceIntervalMs(task.frequency || 'daily', interval);
          
          // Tempo que passou ALÉM do prazo
          const timeOverdue = now.getTime() - nextDueDate.getTime();
          
          // Quantos ciclos inteiros cabem nesse tempo extra?
          // +1 porque o ciclo atual já expirou
          const cycles = Math.floor(timeOverdue / recurrenceMs) + 1;

          return (
             <span className={cn("text-red-600 font-medium", isCompact ? "text-[8px]" : "text-[10px]")}>
                Expirado há {formatDistanceToNow(nextDueDate, { locale: ptBR }).replace('cerca de ', '')}
                {cycles > 1 ? ` (${cycles} ciclos)` : ''}
             </span>
          );
      }
      
      return (
        <span className={isCompact ? "text-[8px]" : "text-[10px]"}>
            Repetir em {formatDistanceToNow(nextDueDate, { locale: ptBR }).replace('cerca de ', '')}
        </span>
      );
  };

  const renderMeasures = () => {
      if (task.measures && task.measures.length > 0) {
          return (
              <div className={cn("flex flex-wrap gap-x-2 gap-y-0.5 w-full", isCompact ? "mt-0.5" : "mt-1")}>
                {task.measures.map((m, idx) => (
                    <div key={idx} className={cn(
                      "font-medium text-blue-600 bg-blue-50 rounded border border-blue-100 inline-block",
                      isCompact ? "text-[8px] px-1 py-0" : "text-[10px] px-1.5 py-0.5"
                    )}>
                         {[
                            m.description, 
                            m.value, 
                            m.unit, 
                            m.target ? `(Meta: ${m.target})` : null
                         ].filter(Boolean).join(" ")}
                    </div>
                ))}
              </div>
          );
      } 
      
      if (task.measureValue || task.measureDescription) {
         // Legacy fallback
        return (
            <div className={cn(
              "font-medium text-blue-600 bg-blue-50 rounded border border-blue-100 inline-block",
              isCompact ? "mt-0.5 text-[8px] px-1 py-0" : "mt-1 text-[10px] px-1.5 py-0.5"
            )}>
              {[task.measureDescription, task.measureValue, task.measureUnit].filter(Boolean).join(" ")}
            </div>
        );
      }
      return null;
  };

  // 1. Tarefas Imediatas
  if (task.type === 'immediate') {
    return (
      <div 
        onClick={onToggleExpand}
        className={cn(
          "group flex flex-col rounded-lg border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md cursor-pointer",
          isCompact ? "px-2 py-1.5 border-l-[3px]" : "px-3 py-2.5 border-l-[4px]",
          "border-l-yellow-500",
          task.status && "opacity-60 bg-gray-50"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between w-full">
            <div className={cn("flex items-center", isCompact ? "gap-2" : "gap-3")}>
            <div onClick={(e) => e.stopPropagation()}>
                <Checkbox 
                    checked={task.status} 
                    onCheckedChange={() => onToggle(task)}
                    checkSize={checkboxSize}
                />
            </div>
            <div>
                <div className="flex items-center gap-2">
                  <h3 className={cn(
                    "font-medium text-gray-900",
                    isCompact ? "text-xs" : "text-sm",
                    task.status && "line-through text-gray-500"
                  )}>
                    {task.title}
                  </h3>
                  {occurrenceCount !== undefined && occurrenceCount > 1 && (
                    <span className={cn(
                      "rounded-full bg-blue-100 text-blue-700 font-semibold",
                      isCompact ? "text-[8px] px-1.5 py-0" : "text-[10px] px-2 py-0.5"
                    )}>
                      {occurrenceCount}x
                    </span>
                  )}
                </div>
                <div className={cn(
                  "flex flex-wrap gap-1.5 items-center",
                  isCompact ? "text-[8px] mt-0" : "text-[10px] mt-0.5"
                )}>
                {task.deadline && (
                    <span className={cn(
                        "flex items-center gap-0.5 rounded font-medium border",
                        isCompact ? "px-1 py-0" : "px-1.5 py-0.5",
                        new Date(task.deadline) < new Date() && !task.status
                            ? "text-red-700 bg-red-100 border-red-200" // Vencido
                            : "text-gray-600 bg-gray-50 border-gray-200" // Normal
                    )}>
                        <Flag size={isCompact ? 8 : 10} />
                        {new Date(task.deadline) < new Date() && !task.status
                            ? `Vencido há ${formatDistanceToNow(new Date(task.deadline), { locale: ptBR })}`
                            : format(new Date(task.deadline), "d MMM", { locale: ptBR })
                        }
                    </span>
                )}

                {task.tags?.map(tag => (
                    <span key={tag} className={cn(
                    "rounded font-medium",
                    isCompact ? "px-1 py-0" : "px-1.5 py-0.5",
                    tag === 'Urgente' ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"
                    )}>
                    {tag}
                    </span>
                ))}
                </div>
            </div>
            </div>
            {renderActions()}
        </div>
        
        {/* Description Accordion */}
        <div className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0"
        )}>
             {task.description && <p className="text-xs text-gray-500 border-t border-gray-100 pt-2 whitespace-pre-wrap">{task.description}</p>}
             <TaskStatisticsChart taskId={task.id} enabled={isExpanded} />
        </div>
      </div>
    );
  }

  // 2. Tarefas Recorrentes
  if (task.type === 'recurrent') {
    return (
      <div 
        onClick={onToggleExpand}
        className={cn(
          "group relative rounded-lg border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md cursor-pointer",
          isCompact ? "px-2 py-1.5 border-l-[3px]" : "px-3 py-2.5 border-l-[4px]",
          "border-l-blue-500"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col w-full">
            {/* Linha 1: Checkbox + Título + Status + Ações */}
            <div className="flex items-center justify-between w-full">
                <div className={cn("flex items-center", isCompact ? "gap-2" : "gap-3")}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                            checked={false} 
                            onCheckedChange={() => onToggle(task)}
                            checkSize={checkboxSize}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className={cn("font-medium text-gray-900", isCompact ? "text-xs" : "text-sm")}>{task.title}</h3>
                      {occurrenceCount !== undefined && occurrenceCount > 1 && (
                        <span className={cn(
                          "rounded-full bg-blue-100 text-blue-700 font-semibold",
                          isCompact ? "text-[8px] px-1.5 py-0" : "text-[10px] px-2 py-0.5"
                        )}>
                          {occurrenceCount}x
                        </span>
                      )}
                    </div>
                </div>
                
                <div className={cn("flex items-center", isCompact ? "gap-2" : "gap-3")}>
                    <span className={cn("text-gray-400 whitespace-nowrap", isCompact ? "text-[8px]" : "text-[10px]")}>
                    {getStatusText()}
                    </span>
                    {renderActions()}
                </div>
            </div>

            {/* Linha 2: Medições */}
            {renderMeasures()}
        </div>

        <ProgressBar 
            current={progress} 
            max={100} 
            className={cn("mt-1.5", isCompact ? "h-0.5" : "h-1")}
            colorClass={getProgressColor(progress)}
        />
        
        {/* Description Accordion */}
        <div className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0"
        )}>
             {task.description && <div className="text-xs text-gray-500 border-t border-gray-100 pt-2 whitespace-pre-wrap">{task.description}</div>}
             <TaskStatisticsChart taskId={task.id} enabled={isExpanded} />
        </div>
      </div>
    );
  }

  // 3. Objetivos Diários
  if (task.type === 'objective') {
    const borderColor = {
      green: 'border-l-emerald-500',
      yellow: 'border-l-yellow-500',
      red: 'border-l-red-500',
      blue: 'border-l-blue-500'
    }[task.colorTag || 'green'] || 'border-l-emerald-500';

    return (
      <div 
        onClick={onToggleExpand}
        className={cn(
          "group relative flex flex-col rounded-lg border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md cursor-pointer",
          isCompact ? "px-2 py-1.5 border-l-[3px]" : "px-3 py-2.5 border-l-[4px]",
          borderColor
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col w-full">
             {/* Linha 1: Checkbox + Título + Status + Ações */}
            <div className="flex items-center justify-between w-full">
                <div className={cn("flex items-center", isCompact ? "gap-2" : "gap-3")}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                            checked={task.status} 
                            onCheckedChange={() => onToggle(task)}
                            checkSize={checkboxSize}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className={cn("font-medium text-gray-900", isCompact ? "text-xs" : "text-sm")}>{task.title}</h3>
                      {occurrenceCount !== undefined && occurrenceCount > 1 && (
                        <span className={cn(
                          "rounded-full bg-blue-100 text-blue-700 font-semibold",
                          isCompact ? "text-[8px] px-1.5 py-0" : "text-[10px] px-2 py-0.5"
                        )}>
                          {occurrenceCount}x
                        </span>
                      )}
                    </div>
                </div>

                <div className={cn("flex items-center", isCompact ? "gap-2" : "gap-3")}>
                    {task.lastCompletedDate && (
                        <div className={cn("text-gray-400 whitespace-nowrap", isCompact ? "text-[8px]" : "text-[10px]")}>
                            Última: {formatDistanceToNow(new Date(task.lastCompletedDate), { addSuffix: true, locale: ptBR })}
                        </div>
                    )}
                    {renderActions()}
                </div>
            </div>

            {/* Linha 2: Medições */}
            {renderMeasures()}
        </div>

        {/* Description Accordion */}
        <div className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0"
        )}>
             {task.description && <p className="text-xs text-gray-500 border-t border-gray-100 pt-2 whitespace-pre-wrap">{task.description}</p>}
             <TaskStatisticsChart taskId={task.id} enabled={isExpanded} />
        </div>
      </div>
    );
  }

  return null;
};
