import Dexie, { type EntityTable } from 'dexie';
import type { Group, Task } from '../types';

export class DailyHabitsDatabase extends Dexie {
  groups!: EntityTable<Group, 'id'>;
  tasks!: EntityTable<Task, 'id'>;

  constructor() {
    super('DailyHabitsDB');
    this.version(1).stores({
      groups: '++id, title, order',
      tasks: '++id, groupId, status, date, type'
    });
  }
}

export const db = new DailyHabitsDatabase();
