import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { RichTextDisplay } from './ui/RichTextDisplay';
import { Trash2, PauseCircle, Calendar as CalendarIcon } from 'lucide-react';
import type { Task } from '../types';

interface TaskActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSuspend: (task: Task, until?: Date) => void;
  onDelete: (task: Task) => void;
}

export const TaskActionModal: React.FC<TaskActionModalProps> = ({
  isOpen,
  onClose,
  task,
  onSuspend,
  onDelete,
}) => {
  const [showSuspendOptions, setShowSuspendOptions] = useState(false);
  const [suspendUntilDate, setSuspendUntilDate] = useState<string>('');

  if (!task) return null;

  const handleSuspendClick = () => {
    setShowSuspendOptions(true);
  };

  const handleConfirmSuspend = () => {
    const until = suspendUntilDate ? new Date(suspendUntilDate) : undefined;
    onSuspend(task, until);
    resetAndClose();
  };

  const handleDeleteClick = () => {
    onDelete(task);
    resetAndClose();
  };

  const resetAndClose = () => {
    setShowSuspendOptions(false);
    setSuspendUntilDate('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={showSuspendOptions ? "Suspender Tarefa" : "Gerenciar Tarefa"}
      className="max-w-md"
    >
      {!showSuspendOptions ? (
        <div className="space-y-6">
          <div className="rounded-lg bg-gray-50 p-4">
            <h3 className="mb-1 font-medium text-gray-900">{task.title}</h3>
            {task.description && <RichTextDisplay content={task.description} className="text-sm text-gray-500" clamp />}
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-500">O que você deseja fazer com esta tarefa?</p>
            
            <Button
              variant="outline"
              className="w-full justify-start gap-3 border-gray-300 py-6 text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              onClick={handleSuspendClick}
            >
              <PauseCircle className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="font-semibold">Suspender</span>
                <span className="text-xs font-normal text-gray-500">Remove da lista ativa temporariamente</span>
              </div>
            </Button>

            <Button
              variant="danger"
              className="w-full justify-start gap-3 py-6"
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="font-semibold">Excluir Permanentemente</span>
                <span className="text-xs font-normal text-red-200">Esta ação não pode ser desfeita</span>
              </div>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <PauseCircle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Configurar Suspensão</h3>
            <p className="mt-2 text-sm text-gray-500">
              A tarefa ficará na lista de "Suspensas" e não gerará notificações até ser reativada.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Suspender até (opcional)
              </label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  type="date"
                  value={suspendUntilDate}
                  onChange={(e) => setSuspendUntilDate(e.target.value)}
                  className="pl-10"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Se deixar em branco, a tarefa ficará suspensa indefinidamente.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowSuspendOptions(false)}>
                Voltar
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleConfirmSuspend}>
                Confirmar Suspensão
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

