export interface Group {
  id: string;
  userId?: string;
  title: string;
  icon: string;
  color: string;
  order: number;
}

export interface TaskHistory {
  id: string;
  userId?: string;
  taskId: string;
  date: Date;
  value?: number; // Para tarefas com contagem (opcional, default 1)
}

export type TaskType = 'immediate' | 'recurrent' | 'objective';

export interface Task {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  groupId: string;
  status: boolean;
  date: Date;
  type: TaskType;
  
  // Recurrent fields
  frequency?: string; // 'daily', 'weekly', 'monthly'
  interval?: number; // e.g. 1 (every 1 day)
  lastCompletedDate?: Date; // To calculate the start of the current cycle
  
  // Measure fields (Medida)
  measures?: {
    description?: string;
    value?: string;
    unit?: string;
  }[];

  // Legacy/Seeding fields (Optional to prevent build errors)
  currentProgress?: number;
  targetProgress?: number;
  unit?: string;

  // Legacy Measure fields (kept for migration/compatibility if needed, but preferably unused)
  measureDescription?: string; 
  measureValue?: string;
  measureUnit?: string;

  // Objective fields
  // deadline removed for objectives, but kept for immediate tasks
  deadline?: Date;
  colorTag?: string; // e.g. 'green', 'yellow' (for the left border)
  
  // Immediate fields
  tags?: string[]; // e.g. ["Urgente"]
  
  // Deprecated/Legacy fields (kept for migration safety if needed, or removed if clean slate)
  // Removing to enforce new schema
  order?: number; // For manual ordering (e.g. objectives)
}

export interface TaskHistory {
  id: string;
  userId?: string;
  taskId: string;
  date: Date;
  value?: number;
}
