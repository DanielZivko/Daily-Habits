import React, { useState } from "react";
import type { Group } from "../types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { IconPicker } from "./ui/IconPicker";
import { ColorPicker } from "./ui/ColorPicker";

interface GroupFormProps {
  initialGroup?: Group | null;
  onSave: (groupData: Partial<Group>) => void;
  onCancel: () => void;
}

export const GroupForm: React.FC<GroupFormProps> = ({ initialGroup, onSave, onCancel }) => {
  const [title, setTitle] = useState(initialGroup?.title || "");
  const [icon, setIcon] = useState<string>(initialGroup?.icon || "Briefcase");
  const [color, setColor] = useState<string>(initialGroup?.color || "#3b82f6");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    onSave({
      title,
      icon,
      color,
      order: initialGroup?.order, // Preserve order if editing
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="mb-2 block text-xs font-medium text-gray-500 uppercase">Nome do Grupo</label>
        <Input
          placeholder="Ex: Estudos"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-500 uppercase">Descrição (Opcional)</label>
        <textarea
          placeholder="Adicione detalhes, links ou sub-tarefas..."
          className="flex min-h-[80px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium text-gray-900">Aparência</h3>
        <p className="mb-4 text-xs text-gray-500">Escolha um ícone e cor.</p>
        
        <div className="space-y-4">
          <IconPicker selectedIcon={icon} onSelect={setIcon} />
          <ColorPicker selectedColor={color} onSelect={setColor} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">
          {initialGroup ? "Salvar Grupo" : "Criar Grupo"}
        </Button>
      </div>
    </form>
  );
};
