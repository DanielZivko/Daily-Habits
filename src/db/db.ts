import Dexie, { type EntityTable } from 'dexie';
import type { Group, Task } from '../types';

export interface SyncQueueItem {
  id?: number;
  table: 'tasks' | 'groups';
  type: 'create' | 'update' | 'delete';
  data: any; // Dados para create/update
  primKey: any; // ID do registro original
  date: number; // Timestamp da alteração
}

export class DailyHabitsDatabase extends Dexie {
  groups!: EntityTable<Group, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('DailyHabitsDB');
    this.version(1).stores({
      groups: '++id, title, order',
      tasks: '++id, groupId, status, date, type'
    });
    
    // Versão 2: Adiciona tabela de fila de sincronização
    this.version(2).stores({
      groups: '++id, title, order',
      tasks: '++id, groupId, status, date, type',
      syncQueue: '++id, table, type, date'
    });
  }
}

export const db = new DailyHabitsDatabase();
