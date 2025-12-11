import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Task, TaskType } from "../types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Zap, RotateCw, Flag, Plus, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";

interface Measure {
  description: string;
  value: string;
  unit: string;
}

interface TaskFormProps {
  initialTask?: Task | null;
  initialGroupId?: number | null;
  onSave: (taskData: Partial<Task>) => void;
  onCancel: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ initialTask, initialGroupId, onSave, onCancel }) => {
  const groups = useLiveQuery(() => db.groups.toArray()) || [];
  
  const [title, setTitle] = useState(initialTask?.title || "");
  const [description, setDescription] = useState(initialTask?.description || "");
  const [groupId, setGroupId] = useState<number>(initialTask?.groupId || initialGroupId || 0);
  const [type, setType] = useState<TaskType>(initialTask?.type || "immediate");
  
  // Recurrent fields
  const [interval, setInterval] = useState(initialTask?.interval || 1);
  const [frequency, setFrequency] = useState(initialTask?.frequency || "daily");
  
  // Measure fields - Array
  const [measures, setMeasures] = useState<Measure[]>([]);

  // Objective fields
  const [deadline, setDeadline] = useState(initialTask?.deadline ? new Date(initialTask.deadline).toISOString().split('T')[0] : "");

  // Effect to update form fields when initialTask changes (for editing)
  useEffect(() => {
    if (initialTask) {
        setTitle(initialTask.title);
        setDescription(initialTask.description || "");
        setGroupId(initialTask.groupId);
        setType(initialTask.type);
        setInterval(initialTask.interval || 1);
        setFrequency(initialTask.frequency || "daily");
        setDeadline(initialTask.deadline ? new Date(initialTask.deadline).toISOString().split('T')[0] : "");
        
        // Load measures from new array structure or migrate legacy fields
        if (initialTask.measures && initialTask.measures.length > 0) {
            setMeasures(initialTask.measures.map(m => ({
                description: m.description || "",
                value: m.value || "",
                unit: m.unit || ""
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
        setGroupId(initialGroupId || (groups.length > 0 ? groups[0].id : 0));
        setType("immediate");
        setInterval(1);
        setFrequency("daily");
        setDeadline("");
        setMeasures([]);
    }
  }, [initialTask, initialGroupId, groups]);

  const addMeasure = () => {
    setMeasures([...measures, { description: "", value: "", unit: "" }]);
  };

  const removeMeasure = (index: number) => {
    setMeasures(measures.filter((_, i) => i !== index));
  };

  const updateMeasure = (index: number, field: keyof Measure, value: string) => {
    const newMeasures = [...measures];
    newMeasures[index] = { ...newMeasures[index], [field]: value };
    setMeasures(newMeasures);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !groupId) return;

    const taskData: Partial<Task> = {
      title,
      description,
      groupId: Number(groupId),
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
      taskData.deadline = deadline ? new Date(deadline) : undefined;
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
              onChange={(e) => setGroupId(Number(e.target.value))}
              className="flex h-12 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
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
          {renderTypeCard('objective', <Flag size={20} />, "Objetivo", "Meta de longo prazo.")}
        </div>

        {type === 'immediate' && (
           <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-4">
               <div className="flex items-center gap-2 mb-2">
                <Flag size={16} className="text-orange-500" />
                <span className="text-sm font-semibold text-gray-700">DEFINIÇÃO DE PRAZO (Opcional)</span>
             </div>
             <div>
                 <label className="mb-1 block text-xs font-medium text-gray-500">Prazo Final</label>
                 <Input 
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                 />
             </div>
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
                    {measures.map((measure, index) => (
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

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-500">Valor</label>
                                    <Input 
                                        type="text" 
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
                        </div>
                    ))}
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
