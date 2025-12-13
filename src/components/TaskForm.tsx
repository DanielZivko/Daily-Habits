import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Task, TaskType } from "../types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Zap, RotateCw, Flag, Plus, Trash2, Clock, Calendar, Target } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { addMinutes, addHours, addDays, differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import { Checkbox } from "./ui/Checkbox";

interface Measure {
  description: string;
  value: string;
  unit: string;
  target?: string;
}

interface TaskFormProps {
  initialTask?: Task | null;
  initialGroupId?: string | null;
  onSave: (taskData: Partial<Task>) => void;
  onCancel: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ initialTask, initialGroupId, onSave, onCancel }) => {
  const { user } = useAuth();
  const currentUserId = user ? user.id : 'guest';

  const groups = useLiveQuery(() => db.groups.where('userId').equals(currentUserId).toArray(), [currentUserId]) || [];
  
  const [title, setTitle] = useState(initialTask?.title || "");
  const [description, setDescription] = useState(initialTask?.description || "");
  const [groupId, setGroupId] = useState<string>(initialTask?.groupId || initialGroupId || "");
  const [type, setType] = useState<TaskType>(initialTask?.type || "immediate");
  
  // Recurrent fields
  const [interval, setInterval] = useState(initialTask?.interval || 1);
  const [frequency, setFrequency] = useState(initialTask?.frequency || "daily");
  
  // Measure fields - Array
  const [measures, setMeasures] = useState<Measure[]>([]);
  
  // Timer fields for Immediate tasks
  const [deadlineMode, setDeadlineMode] = useState<'date' | 'timer'>('date');
  const [datePart, setDatePart] = useState("");
  const [timePart, setTimePart] = useState("");
  
  const [timerDays, setTimerDays] = useState(0);
  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(0);

  // Effect to update form fields when initialTask changes (for editing)
  useEffect(() => {
    if (initialTask) {
        setTitle(initialTask.title);
        setDescription(initialTask.description || "");
        setGroupId(initialTask.groupId);
        setType(initialTask.type);
        setInterval(initialTask.interval || 1);
        setFrequency(initialTask.frequency || "daily");
        
        // Split deadline into date and time parts
        if (initialTask.deadline) {
            const d = new Date(initialTask.deadline);
            setDatePart(d.toISOString().split('T')[0]); // YYYY-MM-DD
            setTimePart(d.toTimeString().slice(0, 5)); // HH:mm
        } else {
            setDatePart("");
            setTimePart("");
        }
        
        // Load measures from new array structure or migrate legacy fields
        if (initialTask.measures && initialTask.measures.length > 0) {
            setMeasures(initialTask.measures.map(m => ({
                description: m.description || "",
                value: m.value || "",
                unit: m.unit || "",
                target: m.target
            })));
        } else if (initialTask.measureValue || initialTask.measureDescription) {
            // Migration for edit: convert old single fields to array
            setMeasures([{
                description: initialTask.measureDescription || "",
                value: initialTask.measureValue || "",
                unit: initialTask.measureUnit || ""
            }]);
        } else {
            setMeasures([]);
        }

    } else {
        // Reset to defaults if creating new task
        setTitle("");
        setDescription("");
        // If initialGroupId is provided, use it. Otherwise, if groups are loaded, use the first one.
        if (initialGroupId) {
            setGroupId(initialGroupId);
        } else if (groups.length > 0 && !groupId) {
             setGroupId(groups[0].id);
        }
        
        setType("immediate");
        setInterval(1);
        setFrequency("daily");
        setDatePart("");
        setTimePart("");
        setMeasures([]);
    }
  }, [initialTask, initialGroupId, groups]);

  // Ensure groupId is selected if groups load later
  useEffect(() => {
      if (!groupId && groups.length > 0 && !initialTask) {
          setGroupId(groups[0].id);
      }
  }, [groups, groupId, initialTask]);


  const addMeasure = () => {
    setMeasures([...measures, { description: "", value: "", unit: "" }]);
  };

  const removeMeasure = (index: number) => {
    setMeasures(measures.filter((_, i) => i !== index));
  };

  const updateMeasure = (index: number, field: keyof Measure, value: string | undefined) => {
    const newMeasures = [...measures];
    
    // Validação de número para value e target SEMPRE (agora que o usuário pediu)
    if (field === 'value' || field === 'target') {
        if (value === undefined && field === 'target') {
             // Caso especial para remover meta
             const m = { ...newMeasures[index] };
             delete m.target;
             newMeasures[index] = m;
        } else {
             // Permite números, vírgula e ponto. Remove outros caracteres.
            const cleanValue = (value || "").replace(/[^0-9.,]/g, '');
            newMeasures[index] = { ...newMeasures[index], [field]: cleanValue };
        }
    } else {
         newMeasures[index] = { ...newMeasures[index], [field]: value };
    }
    
    setMeasures(newMeasures);
  };
  
  const toggleTarget = (index: number) => {
      const measure = measures[index];
      if (measure.target !== undefined) {
          // Remover meta
          updateMeasure(index, 'target', undefined);
      } else {
          // Adicionar meta (inicia vazio)
          updateMeasure(index, 'target', "");
      }
  };

  const handleModeChange = (newMode: 'date' | 'timer') => {
      if (newMode === deadlineMode) return;

      const now = new Date();

      if (newMode === 'timer') {
          // Converter Data -> Timer
          if (datePart) {
              const time = timePart || "23:59";
              const targetDate = new Date(`${datePart}T${time}`);
              
              if (targetDate > now) {
                  const diffDays = differenceInDays(targetDate, now);
                  
                  // Calcular diferença de horas restante
                  const targetMinusDays = addDays(now, diffDays);
                  let diffHours = differenceInHours(targetDate, targetMinusDays);
                  
                  // Calcular diferença de minutos restante
                  const targetMinusHours = addHours(targetMinusDays, diffHours);
                  let diffMinutes = differenceInMinutes(targetDate, targetMinusHours);
                  
                  // Pequeno ajuste para arredondamento ou segundos
                  if (diffMinutes < 0) { diffMinutes = 0; }
                  if (diffHours < 0) { diffHours = 0; }

                  setTimerDays(diffDays);
                  setTimerHours(diffHours);
                  setTimerMinutes(diffMinutes);
              } else {
                  setTimerDays(0);
                  setTimerHours(0);
                  setTimerMinutes(0);
              }
          }
      } else {
          // Converter Timer -> Data
          if (timerDays > 0 || timerHours > 0 || timerMinutes > 0) {
              let targetDate = new Date();
              targetDate = addDays(targetDate, timerDays);
              targetDate = addHours(targetDate, timerHours);
              targetDate = addMinutes(targetDate, timerMinutes);
              
              // Arredondar para o minuto seguinte para evitar passado imediato
              targetDate = addMinutes(targetDate, 1);
              
              setDatePart(targetDate.toISOString().split('T')[0]);
              setTimePart(targetDate.toTimeString().slice(0, 5));
          } else if (!datePart) {
              // Se timer zerado e data vazia, inicia com agora
              const d = new Date();
              setDatePart(d.toISOString().split('T')[0]);
              setTimePart(d.toTimeString().slice(0, 5));
          }
      }

      setDeadlineMode(newMode);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !groupId) return;

    const taskData: Partial<Task> = {
      // If it's a new task (no initialTask), generate UUID
      id: initialTask?.id || crypto.randomUUID(),
      title,
      description,
      groupId: groupId,
      type,
      date: initialTask?.date || new Date(),
      status: initialTask?.status || false,
    };

    if (type === 'recurrent' || type === 'objective') {
        // Clean up empty measures
        const validMeasures = measures.filter(m => m.description || m.value || m.unit);
        taskData.measures = validMeasures;
    }

    if (type === 'recurrent') {
      taskData.interval = Number(interval);
      taskData.frequency = frequency;
    }

    // Only immediate tasks keep deadline
    if (type === 'immediate') {
      if (deadlineMode === 'timer' && (timerDays > 0 || timerHours > 0 || timerMinutes > 0)) {
          let targetDate = new Date();
          if (timerDays > 0) targetDate = addDays(targetDate, timerDays);
          if (timerHours > 0) targetDate = addHours(targetDate, timerHours);
          if (timerMinutes > 0) targetDate = addMinutes(targetDate, timerMinutes);
          taskData.deadline = targetDate;
      } else {
          if (datePart) {
             const time = timePart || "23:59";
             taskData.deadline = new Date(`${datePart}T${time}`);
          } else {
             taskData.deadline = undefined;
          }
      }
    }

    if (type === 'objective') {
      taskData.colorTag = 'green'; // Default color
      taskData.deadline = undefined; // Explicitly remove deadline for objectives
    }

    onSave(taskData);
  };

  const renderTypeCard = (cardType: TaskType, icon: React.ReactNode, label: string, subtext: string) => {
    const isSelected = type === cardType;
    return (
      <button
        type="button"
        onClick={() => setType(cardType)}
        className={cn(
          "flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
          isSelected
            ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
            : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-gray-50"
        )}
      >
        <div className={cn("rounded-full p-2", isSelected ? "bg-white" : "bg-gray-100")}>
          {icon}
        </div>
        <div>
          <div className="font-semibold text-sm">{label}</div>
          <div className="text-xs opacity-80">{subtext}</div>
        </div>
      </button>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Detalhes Gerais</label>
        <p className="mb-4 text-xs text-gray-500">Defina o nome, grupo e descreva o que precisa ser feito.</p>
        
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Grupo</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="flex h-12 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>Selecione um grupo</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                   {g.title}
                </option>
              ))}
            </select>
          </div>

          <div>
             <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Nome da Tarefa</label>
            <Input
              placeholder="Ex: Ler 30 minutos de ficção"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Descrição (Opcional)</label>
            <textarea
              placeholder="Adicione detalhes, links ou sub-tarefas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex min-h-[80px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Tipo e Frequência</label>
        <p className="mb-4 text-xs text-gray-500">Como esta tarefa deve se comportar no seu dia?</p>
        
        <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
          {renderTypeCard('immediate', <Zap size={20} />, "Imediata", "Para fazer agora.")}
          {renderTypeCard('recurrent', <RotateCw size={20} />, "Recorrente", "Repete em dias específicos.")}
          {renderTypeCard('objective', <Flag size={20} />, "Objetivo", "Repete diariamente.")}
        </div>

        {type === 'immediate' && (
           <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-4">
               <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2">
                    <Flag size={16} className="text-orange-500" />
                    <span className="text-sm font-semibold text-gray-700">DEFINIÇÃO DE PRAZO (Opcional)</span>
                 </div>
                 
                 <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
                    <button
                        type="button"
                        onClick={() => handleModeChange('date')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                            deadlineMode === 'date' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <Calendar size={14} /> Data Fixa
                    </button>
                    <button
                        type="button"
                        onClick={() => handleModeChange('timer')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                            deadlineMode === 'timer' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <Clock size={14} /> Timer
                    </button>
                 </div>
             </div>
             
             {deadlineMode === 'date' ? (
                 <div className="grid grid-cols-2 gap-3">
                     <div>
                         <label className="mb-1 block text-xs font-medium text-gray-500">Data</label>
                         <div className="relative">
                             <Input 
                                type="date"
                                value={datePart}
                                onChange={(e) => setDatePart(e.target.value)}
                                onClick={(e) => e.currentTarget.showPicker?.()}
                                className="pl-9 cursor-pointer" // Espaço para o ícone
                             />
                             <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                         </div>
                     </div>
                     <div>
                         <label className="mb-1 block text-xs font-medium text-gray-500">Hora</label>
                         <div className="relative">
                             <Input 
                                type="time"
                                value={timePart}
                                onChange={(e) => setTimePart(e.target.value)}
                                onClick={(e) => e.currentTarget.showPicker?.()}
                                className="pl-9 cursor-pointer" // Espaço para o ícone
                             />
                             <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                         </div>
                     </div>
                 </div>
             ) : (
                 <div className="space-y-3">
                     <p className="text-xs text-gray-500">Defina quanto tempo você tem para concluir esta tarefa.</p>
                     <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-500 text-center">Dias</label>
                            <Input 
                                type="number"
                                min={0}
                                value={timerDays}
                                onChange={(e) => setTimerDays(Math.max(0, Number(e.target.value)))}
                                className="text-center"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-500 text-center">Horas</label>
                            <Input 
                                type="number"
                                min={0}
                                value={timerHours}
                                onChange={(e) => setTimerHours(Math.max(0, Number(e.target.value)))}
                                className="text-center"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-500 text-center">Minutos</label>
                            <Input 
                                type="number"
                                min={0}
                                value={timerMinutes}
                                onChange={(e) => setTimerMinutes(Math.max(0, Number(e.target.value)))}
                                className="text-center"
                            />
                        </div>
                     </div>
                 </div>
             )}
           </div>
        )}

        {type === 'recurrent' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                  <RotateCw size={16} className="text-blue-500" />
                  <span className="text-sm font-semibold text-gray-700">CONFIGURAÇÃO DE RECORRÊNCIA</span>
              </div>
              
              <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Repetir a cada</label>
                  <div className="flex gap-2">
                      <Input 
                          type="number" 
                          value={interval} 
                          onChange={(e) => setInterval(Number(e.target.value))}
                          className="w-20 text-center" 
                          min={1} 
                      />
                      <select 
                          value={frequency} 
                          onChange={(e) => setFrequency(e.target.value)}
                          className="flex-1 rounded-lg border border-gray-200 px-3 text-sm"
                      >
                          <option value="daily">Dias</option>
                          <option value="weekly">Semanas</option>
                          <option value="monthly">Meses</option>
                          <option value="hours">Horas</option>
                          <option value="minutes">Minutos</option>
                      </select>
                  </div>
              </div>
            </div>
          </div>
        )}

        {(type === 'recurrent' || type === 'objective') && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">MEDIÇÕES</span>
                    </div>
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={addMeasure}
                        className="h-8 px-2 text-blue-600 hover:bg-blue-50"
                    >
                        <Plus size={16} className="mr-1" /> Adicionar
                    </Button>
                </div>
                
                {measures.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">Nenhuma medição configurada.</p>
                )}

                <div className="space-y-4">
                    {measures.map((measure, index) => {
                        const hasTarget = measure.target !== undefined;
                        
                        return (
                            <div key={index} className="relative rounded-md border border-gray-200 bg-white p-3">
                                <button
                                    type="button"
                                    onClick={() => removeMeasure(index)}
                                    className="absolute right-2 top-2 text-gray-300 hover:text-red-500"
                                >
                                    <Trash2 size={14} />
                                </button>
                                
                                <div className="mb-3 pr-6">
                                    <label className="mb-1 block text-xs font-medium text-gray-500">Descrição</label>
                                    <Input 
                                        value={measure.description} 
                                        onChange={(e) => updateMeasure(index, 'description', e.target.value)} 
                                        placeholder="Ex: Ler, Beber, Correr"
                                        className="h-8 text-sm"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-gray-500">Valor</label>
                                        <Input 
                                            type="text" 
                                            inputMode="decimal"
                                            value={measure.value} 
                                            onChange={(e) => updateMeasure(index, 'value', e.target.value)}
                                            placeholder="Ex: 10" 
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-gray-500">Unidade</label>
                                        <Input 
                                            value={measure.unit} 
                                            onChange={(e) => updateMeasure(index, 'unit', e.target.value)} 
                                            placeholder="Ex: páginas"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                </div>
                                
                                <div className="mt-3 pt-2 border-t border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Checkbox 
                                            checked={hasTarget}
                                            onCheckedChange={() => toggleTarget(index)}
                                            id={`has-target-${index}`}
                                        />
                                        <label htmlFor={`has-target-${index}`} className="text-xs text-gray-600 font-medium cursor-pointer">
                                            Definir Meta
                                        </label>
                                    </div>
                                    
                                    {hasTarget && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                            <label className="mb-1 block text-xs font-medium text-gray-500">Meta (Numérica)</label>
                                            <div className="relative">
                                                <Target size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <Input 
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={measure.target || ""} 
                                                    onChange={(e) => updateMeasure(index, 'target', e.target.value)} 
                                                    placeholder="Ex: 15"
                                                    className="h-8 text-sm pl-8"
                                                />
                                            </div>
                                            <p className="mt-1 text-[10px] text-gray-400">
                                                Ao ativar a meta, o gráfico mostrará a evolução deste valor.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">
            {initialTask ? "Salvar Alterações" : "Criar Tarefa"}
        </Button>
      </div>
    </form>
  );
};
