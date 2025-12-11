export interface Group {
  id: number;
  title: string;
  icon: string;
  color: string;
  order: number;
}

export type TaskType = 'immediate' | 'recurrent' | 'objective';

export interface Task {
  id: number;
  title: string;
  description?: string;
  groupId: number;
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
