import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { db } from '../db/db';
import type { Task, Group, TaskHistory } from '../types';

export type UndoActionType = 
  | 'complete_task'
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'create_group'
  | 'update_group'
  | 'delete_group'
  | 'reorder_groups';

export interface UndoAction {
  id: string;
  type: UndoActionType;
  timestamp: number;
  // Estado anterior necessário para desfazer
  previousState: {
    task?: Task;
    tasks?: Task[]; // Para restaurar tarefas de um grupo deletado
    group?: Group;
    taskHistory?: TaskHistory[];
    groupsOrder?: Array<{ id: string; order: number }>;
  };
  // Informações adicionais para desfazer
  metadata?: {
    taskId?: string;
    groupId?: string;
    deletedTaskHistoryIds?: string[];
  };
}

interface UndoContextType {
  canUndo: boolean;
  undo: () => Promise<void>;
  pushAction: (action: Omit<UndoAction, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

const MAX_HISTORY_SIZE = 50; // Limitar histórico para não consumir muita memória

export const UndoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<UndoAction[]>([]);

  const pushAction = useCallback((action: Omit<UndoAction, 'id' | 'timestamp'>) => {
    setHistory(prev => {
      const newAction: UndoAction = {
        ...action,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      // Adiciona no início e limita o tamanho
      const updated = [newAction, ...prev].slice(0, MAX_HISTORY_SIZE);
      return updated;
    });
  }, []);

  const undo = useCallback(async () => {
    if (history.length === 0) return;

    const lastAction = history[0];
    
    try {
      await db.transaction('rw', db.tasks, db.groups, db.taskHistory, async () => {
        switch (lastAction.type) {
          case 'complete_task': {
            // Restaura o estado anterior da tarefa e remove o histórico criado
            if (lastAction.previousState.task) {
              await db.tasks.update(lastAction.previousState.task.id, {
                status: lastAction.previousState.task.status,
                lastCompletedDate: lastAction.previousState.task.lastCompletedDate,
                date: lastAction.previousState.task.date,
                measures: lastAction.previousState.task.measures,
              });
            }
            
            // Remove o histórico criado pela conclusão
            if (lastAction.metadata?.deletedTaskHistoryIds) {
              for (const historyId of lastAction.metadata.deletedTaskHistoryIds) {
                await db.taskHistory.delete(historyId);
              }
            }
            break;
          }

          case 'create_task': {
            // Remove a tarefa criada
            if (lastAction.metadata?.taskId) {
              await db.tasks.delete(lastAction.metadata.taskId);
            }
            break;
          }

          case 'update_task': {
            // Restaura o estado anterior da tarefa
            if (lastAction.previousState.task) {
              const previousTask = lastAction.previousState.task;
              await db.tasks.update(previousTask.id, previousTask as Partial<Task>);
            }
            break;
          }

          case 'delete_task': {
            // Restaura a tarefa deletada
            if (lastAction.previousState.task) {
              await db.tasks.add(lastAction.previousState.task);
            }
            
            // Restaura o histórico da tarefa se existir
            if (lastAction.previousState.taskHistory) {
              await db.taskHistory.bulkAdd(lastAction.previousState.taskHistory);
            }
            break;
          }

          case 'create_group': {
            // Remove o grupo criado
            if (lastAction.metadata?.groupId) {
              // Também remove todas as tarefas do grupo
              await db.tasks.where('groupId').equals(lastAction.metadata.groupId).delete();
              await db.groups.delete(lastAction.metadata.groupId);
            }
            break;
          }

          case 'update_group': {
            // Restaura o estado anterior do grupo
            if (lastAction.previousState.group) {
              await db.groups.update(lastAction.previousState.group.id, lastAction.previousState.group);
            }
            break;
          }

          case 'delete_group': {
            // Restaura o grupo deletado
            if (lastAction.previousState.group) {
              await db.groups.add(lastAction.previousState.group);
            }
            
            // Restaura todas as tarefas do grupo
            if (lastAction.previousState.tasks && lastAction.previousState.tasks.length > 0) {
              await db.tasks.bulkAdd(lastAction.previousState.tasks);
            }
            break;
          }

          case 'reorder_groups': {
            // Restaura a ordem anterior dos grupos
            if (lastAction.previousState.groupsOrder) {
              for (const groupOrder of lastAction.previousState.groupsOrder) {
                await db.groups.update(groupOrder.id, { order: groupOrder.order });
              }
            }
            break;
          }
        }
      });

      // Remove a ação do histórico após desfazer
      setHistory(prev => prev.slice(1));
    } catch (error) {
      console.error('Erro ao desfazer ação:', error);
    }
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Suporte a Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (history.length > 0) {
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, undo]);

  return (
    <UndoContext.Provider value={{ canUndo: history.length > 0, undo, pushAction, clearHistory }}>
      {children}
    </UndoContext.Provider>
  );
};

export const useUndo = () => {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo deve ser usado dentro de UndoProvider');
  }
  return context;
};

