import Dexie, { type EntityTable } from 'dexie';
import type { Group, Task } from '../types';

export interface SyncQueueItem {
  id?: number;
  userId?: string;
  table: 'tasks' | 'groups';
  type: 'create' | 'update' | 'delete';
  data: any;
  primKey: string; // UUID string
  date: number;
}

export class DailyHabitsDatabase extends Dexie {
  groups!: EntityTable<Group, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('DailyHabitsDB');
    
    // Versões anteriores (necessárias para migração do Dexie)
    this.version(1).stores({
      groups: '++id, title, order',
      tasks: '++id, groupId, status, date, type'
    });
    
    this.version(2).stores({
      groups: '++id, title, order',
      tasks: '++id, groupId, status, date, type',
      syncQueue: '++id, table, type, date'
    });

    this.version(5).stores({
      groups: '++id, userId, title, order',
      tasks: '++id, userId, groupId, status, date, type',
      syncQueue: '++id, userId, table, type, date'
    });

    // Versão 7: Mudança para UUIDs (strings) - LIMPA DADOS ANTIGOS
    // Removido '++' de id para tasks e groups.
    this.version(7).stores({
      groups: 'id, userId, title, order',
      tasks: 'id, userId, groupId, status, date, type',
      syncQueue: '++id, userId, table, type, date'
    }).upgrade(async tx => {
      // Limpa todos os dados antigos pois IDs numéricos são incompatíveis com UUIDs
      console.log('[DB] Migrando para UUID. Limpando dados antigos incompatíveis...');
      await tx.table('groups').clear();
      await tx.table('tasks').clear();
      await tx.table('syncQueue').clear();
      console.log('[DB] Migração concluída. Dados limpos.');
    });
  }
}

export const db = new DailyHabitsDatabase();

// Função para forçar reset do banco se necessário
export async function resetDatabase() {
  console.log('[DB] Forçando reset completo do banco de dados...');
  await db.delete();
  // Recarrega a página para recriar o banco
  window.location.reload();
}
