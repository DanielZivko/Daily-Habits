import React from 'react';
import { Undo2 } from 'lucide-react';
import { useUndo } from '../contexts/UndoContext';
import { cn } from '../lib/utils';

export const UndoButton: React.FC = () => {
  const { canUndo, undo } = useUndo();

  if (!canUndo) return null;

  return (
    <button
      onClick={undo}
      className={cn(
        "fixed bottom-6 left-6 flex h-12 w-12 items-center justify-center rounded-full",
        "bg-gray-800 text-white shadow-lg transition-all",
        "hover:bg-gray-700 hover:scale-105 active:scale-95",
        "z-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      )}
      aria-label="Desfazer última ação (Ctrl+Z)"
      title="Desfazer última ação (Ctrl+Z)"
    >
      <Undo2 size={20} />
    </button>
  );
};




