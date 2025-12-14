import React, { useState, useEffect } from "react";
import type { Task } from "../types";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface MeasurementInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onConfirm: (measurements: Record<string, number>) => void;
}

export const MeasurementInputModal: React.FC<MeasurementInputModalProps> = ({
  isOpen,
  onClose,
  task,
  onConfirm
}) => {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && task && task.measures) {
      const initialValues: Record<string, string> = {};
      task.measures.forEach(m => {
        // Use default value from definition if available, otherwise empty
        // Clean numeric value
        const val = m.value ? m.value.replace(/[^0-9.,]/g, '') : "";
        if (m.description) {
            initialValues[m.description] = val;
        }
      });
      setValues(initialValues);
    }
  }, [isOpen, task]);

  const handleChange = (description: string, value: string) => {
    // Allow decimals
    const cleanValue = value.replace(/[^0-9.,]/g, '');
    setValues(prev => ({ ...prev, [description]: cleanValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert strings to numbers
    const numericValues: Record<string, number> = {};
    let hasError = false;

    Object.entries(values).forEach(([desc, val]) => {
      if (!val) {
          // If empty, maybe assume 0? Or require it? 
          // Let's require it if it has a target.
          const measure = task?.measures?.find(m => m.description === desc);
          if (measure?.target) {
               // hasError = true; // Optional: enforce input?
          }
          numericValues[desc] = 0;
      } else {
          // Replace comma with dot for parsing
          const num = parseFloat(val.replace(',', '.'));
          if (isNaN(num)) {
              hasError = true;
          } else {
              numericValues[desc] = num;
          }
      }
    });

    if (hasError) {
        alert("Por favor, insira valores válidos.");
        return;
    }

    onConfirm(numericValues);
    onClose();
  };

  if (!task) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Medições">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Insira os valores realizados para esta atividade.
        </p>

        <div className="space-y-3">
          {task.measures?.map((measure, index) => {
            if (!measure.description) return null;
            const hasTarget = measure.target !== undefined && measure.target !== "";
            
            return (
              <div key={index} className="grid grid-cols-2 items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {measure.description}
                  </label>
                  {hasTarget && (
                    <span className="text-xs text-gray-500">
                      Meta: {measure.target} {measure.unit}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={values[measure.description] || ""}
                    onChange={(e) => handleChange(measure.description || "", e.target.value)}
                    placeholder="0"
                    className="text-right"
                    autoFocus={index === 0}
                  />
                  <span className="text-sm text-gray-500 w-8">
                    {measure.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">
            Confirmar Conclusão
          </Button>
        </div>
      </form>
    </Modal>
  );
};






