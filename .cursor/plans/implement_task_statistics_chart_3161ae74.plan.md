---
name: Implement Task Statistics Chart
overview: Implement a clean, organic statistics chart in the task expansion view showing completion history, with a vertical zoom slider. Includes backend updates for history tracking and sync logic.
todos:
  - id: install-deps
    content: Install recharts dependency
    status: completed
  - id: update-db-schema
    content: Update Dexie schema in db.ts with task_history table
    status: completed
  - id: create-supabase-table
    content: Create Supabase SQL migration for cloud_task_history
    status: completed
  - id: update-sync-logic
    content: Update useSync.ts to handle task_history synchronization
    status: completed
  - id: create-chart-component
    content: Create TaskStatisticsChart component with zoom logic
    status: completed
  - id: integrate-chart
    content: Integrate Chart into TaskItem and update completion logic to save history
    status: completed
---

# Implement Task Statistics Chart

This plan outlines the steps to implement a completion history chart for tasks, including the necessary backend and synchronization updates.

## 1. Preparation & Dependencies

- Install `recharts` for the visualization.
- Ensure `lucide-react` is available for icons (already present).

## 2. Database Layer (History Tracking)

Currently, the app only tracks the *last* completion. To show a graph over time, we must track *every* completion event.

### Local Database (Dexie - `src/db/db.ts`)

- Add a new table `task_history` to the Dexie schema.
- Schema: `++id, userId, taskId, date, value` (value is optional, for counter tasks).
- Increment database version.

### Remote Database (Supabase)

- Create a new table `cloud_task_history` in Supabase.
- Fields:
- `id` (bigint, PK)
- `user_id` (uuid, FK)
- `task_id` (bigint, FK)
- `date` (timestamp)
- `value` (numeric, default 1)
- Enable RLS policies similar to existing tables.

## 3. Synchronization Logic (`src/hooks/useSync.ts`)

- Update `SyncQueueItem` type to include `task_history`.
- Add synchronization logic for the `task_history` table:
- Map local `task_history` objects to remote `cloud_task_history` (camelCase <-> snake_case).
- Add Dexie hooks (`creating`, `deleting`) for `task_history` to capture local changes.
- Add Realtime subscription for `cloud_task_history` to update local state on remote changes.
- Update `processSyncQueue` and `syncPull` to handle the new table.

## 4. UI Implementation: Statistics Chart

- Create `src/components/TaskStatisticsChart.tsx`.
- **Visual Style:** Use `recharts` `<AreaChart>` with `type="monotone"` for the smooth, organic look. Use a gradient fill (opacity fade).
- **Data Handling:**
- Fetch history for the `taskId` from `db.task_history`.
- Aggregation: Group data by day/week dynamically or show raw data points depending on density.
- **Zoom Feature:**
- Implement a vertical range slider on the right side.
- Logic: The slider controls the `startIndex` of the data array displayed. 
- "Zoom In" (slider up) -> Show fewer, more recent data points.
- "Zoom Out" (slider down) -> Show full history.

## 5. Integration

- Modify `src/components/TaskItem.tsx`.
- Inside the expansion area (where description is), render `<TaskStatisticsChart taskId={task.id} />`.
- Ensure it only loads data when the card is expanded to save resources.

## 6. Logic Update (Task Completion)

- When a user checks a task (in `TaskItem` or `TaskList`), besides updating `task.lastCompletedDate`, we must now also **insert a record** into `task_history`.