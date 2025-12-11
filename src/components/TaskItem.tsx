import React, { useEffect, useState } from "react";
import type { Task } from "../types";
import { cn } from "../lib/utils";
import { Checkbox } from "./ui/Checkbox";
import { ProgressBar } from "./ui/ProgressBar";
import { Pencil, Trash2, Flag, Copy } from "lucide-react";
import { format, addDays, addWeeks, addMonths, addHours, addMinutes, differenceInMilliseconds, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskItemProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onDelete: (task: Task) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onEdit, onDuplicate, onDelete, isExpanded, onToggleExpand }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [progress, setProgress] = useState(0);

  // Calcular progresso baseado no tempo para tarefas recorrentes
  useEffect(() => {
    if (task.type !== 'recurrent' || !task.frequency || !task.date) return;

    // Se nunca foi completada, progresso é 0 e não calculamos nada
    if (!task.lastCompletedDate) {
        setProgress(0);
        return;
    }

    const calculateProgress = () => {
      const now = new Date();
      const dueDate = new Date(task.date);
      const interval = task.interval || 1;
      
      // Estimar data de início do ciclo (Last Completed)
      // Garantido que existe pelo check acima
      let startDate = new Date(task.lastCompletedDate!);

      const totalDuration = differenceInMilliseconds(dueDate, startDate);
      const elapsed = differenceInMilliseconds(now, startDate);
      
      // Se elapsed > totalDuration, significa que está atrasado (100% preenchido)
      const percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
      setProgress(percent);
    };

    calculateProgress();
    const timer = setInterval(calculateProgress, 1000); // Atualiza a cada segundo para minutos/horas

    return () => clearInterval(timer);
  }, [task]);

  const renderActions = () => (
    <div className={cn("flex gap-2 transition-opacity", isHovered ? "opacity-100" : "opacity-0 md:opacity-0")}>
      <button 
        onClick={(e) => { e.stopPropagation(); onEdit(task); }}
        className="text-gray-400 hover:text-blue-500"
      >
        <Pencil size={16} />
      </button>
      <button 
        onClick={(e) => { e.stopPropagation(); onDuplicate(task); }}
        className="text-gray-400 hover:text-green-500"
        title="Duplicar"
      >
        <Copy size={16} />
      </button>
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(task); }}
        className="text-gray-400 hover:text-red-500"
      >
        <Trash2 size={16} />
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

      if (progress >= 100) {
          // Calcular tempo de atraso
          // O vencimento (data limite) é task.date
          // Se task.date está no futuro, não deveria estar 100% (exceto erro de lógica, mas assumimos que 100% = atrasado)
          // Na verdade o calculo de progresso usa dueDate vs now. Se elapsed > totalDuration, é pq now > dueDate.
          
          const dueDate = new Date(task.date);
          const diff = differenceInMilliseconds(new Date(), dueDate);
          
          // Se diff > 0, está vencido.
          if (diff > 0) {
             return <span className="text-red-600 font-medium">Vencido há {formatDistanceToNow(dueDate, { locale: ptBR })}</span>;
          }
          return <span className="text-red-600 font-medium">Vencido</span>;
      }
      
      return (
        <span>
            Última: {formatDistanceToNow(new Date(task.lastCompletedDate), { addSuffix: true, locale: ptBR })}
        </span>
      );
  };

  // 1. Tarefas Imediatas
  if (task.type === 'immediate') {
    return (
      <div 
        onClick={onToggleExpand}
        className={cn(
          "group flex flex-col rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md cursor-pointer",
          task.status && "opacity-60 bg-gray-50"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
            <div onClick={(e) => e.stopPropagation()}>
                <Checkbox 
                    checked={task.status} 
                    onCheckedChange={() => onToggle(task)}
                />
            </div>
            <div>
                <h3 className={cn("font-medium text-gray-900", task.status && "line-through text-gray-500")}>
                {task.title}
                </h3>
                <div className="flex flex-wrap gap-2 text-xs items-center mt-1">
                {task.deadline && (
                    <span className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded font-medium border",
                        new Date(task.deadline) < new Date() && !task.status
                            ? "text-red-700 bg-red-100 border-red-200" // Vencido
                            : "text-gray-600 bg-gray-50 border-gray-200" // Normal
                    )}>
                        <Flag size={10} />
                        {new Date(task.deadline) < new Date() && !task.status
                            ? `Vencido há ${formatDistanceToNow(new Date(task.deadline), { locale: ptBR })}`
                            : format(new Date(task.deadline), "d MMM", { locale: ptBR })
                        }
                    </span>
                )}

                {task.tags?.map(tag => (
                    <span key={tag} className={cn(
                    "rounded px-1.5 py-0.5 font-medium",
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
             {task.description && <p className="text-sm text-gray-500 border-t border-gray-100 pt-2 whitespace-pre-wrap">{task.description}</p>}
        </div>
      </div>
    );
  }

  // 2. Tarefas Recorrentes
  if (task.type === 'recurrent') {
    return (
      <div 
        onClick={onToggleExpand}
        className="group relative rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
             <div onClick={(e) => e.stopPropagation()}>
                 <Checkbox 
                    checked={false} // Recorrente nunca fica "checado" visualmente pois reseta, mas a ação dispara o reset
                    onCheckedChange={() => onToggle(task)}
                    className="h-5 w-5 rounded border-gray-300"
                />
             </div>
            <div>
              <h3 className="font-medium text-gray-900">{task.title}</h3>
              
              {/* Render measures array if exists */}
              {task.measures && task.measures.length > 0 ? (
                  <div className="mb-1 flex flex-col gap-0.5">
                    {task.measures.map((m, idx) => (
                        <p key={idx} className="text-xs font-medium text-blue-600">
                             {[m.description, m.value, m.unit].filter(Boolean).join(" ")}
                        </p>
                    ))}
                  </div>
              ) : (task.measureValue || task.measureDescription) ? (
                 // Legacy fallback
                <p className="text-xs font-medium text-blue-600">
                  {[task.measureDescription, task.measureValue, task.measureUnit].filter(Boolean).join(" ")}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">
               {getStatusText()}
            </span>
            {renderActions()}
          </div>
        </div>
        <ProgressBar 
            current={progress} 
            max={100} 
            className="h-1.5" 
            colorClass={getProgressColor(progress)}
        />
        
        {/* Description Accordion */}
        <div className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[2000px] opacity-100 mt-4" : "max-h-0 opacity-0"
        )}>
             {task.description && <div className="text-sm text-gray-500 border-t border-gray-100 pt-2 whitespace-pre-wrap">{task.description}</div>}
        </div>
      </div>
    );
  }

  // 3. Objetivos Principais
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
          "group relative flex flex-col rounded-lg border border-gray-100 border-l-[6px] bg-white p-4 shadow-sm transition-all hover:shadow-md cursor-pointer",
          borderColor
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
            <div onClick={(e) => e.stopPropagation()}>
                <Checkbox 
                    checked={task.status} 
                    onCheckedChange={() => onToggle(task)}
                />
            </div>
            <div>
                <h3 className="font-medium text-gray-900">{task.title}</h3>
                
                {/* Render measures array if exists */}
                {task.measures && task.measures.length > 0 ? (
                    <div className="mb-1 flex flex-col gap-0.5">
                        {task.measures.map((m, idx) => (
                            <p key={idx} className="text-xs font-medium text-blue-600">
                                {[m.description, m.value, m.unit].filter(Boolean).join(" ")}
                            </p>
                        ))}
                    </div>
                ) : (task.measureValue || task.measureDescription) ? (
                    // Legacy fallback
                    <p className="text-xs font-medium text-blue-600 mb-1">
                    {[task.measureDescription, task.measureValue, task.measureUnit].filter(Boolean).join(" ")}
                    </p>
                ) : null}
                
                {/* Objective doesn't have deadline anymore in UI as requested */}
                {task.lastCompletedDate && (
                    <div className="mt-1 text-xs text-gray-400">
                        Última: {formatDistanceToNow(new Date(task.lastCompletedDate), { addSuffix: true, locale: ptBR })}
                    </div>
                )}
            </div>
            </div>
            {renderActions()}
        </div>

        {/* Description Accordion */}
        <div className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0"
        )}>
             {task.description && <p className="text-sm text-gray-500 border-t border-gray-100 pt-2 whitespace-pre-wrap">{task.description}</p>}
        </div>
      </div>
    );
  }

  return null;
};
