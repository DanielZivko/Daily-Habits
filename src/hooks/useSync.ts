import { useEffect, useRef } from 'react';
import Dexie from 'dexie';
import { db } from '../db/db';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Group, Task } from '../types';

export function useSync() {
  const { user } = useAuth();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const syncPull = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      try {
        // Pull Groups
        const { data: cloudGroups, error: groupsError } = await supabase
          .from('cloud_groups')
          .select('*');

        if (groupsError) throw groupsError;

        if (cloudGroups) {
          await db.transaction('rw', db.groups, async () => {
             // @ts-ignore - Marking transaction source
             Dexie.currentTransaction.source = 'sync';
             
             const groupsToSave = cloudGroups.map(g => ({
               id: Number(g.id), // Ensure number
               title: g.title,
               icon: g.icon,
               color: g.color,
               order: g.order
             }));
             await db.groups.bulkPut(groupsToSave as Group[]);
          });
        }

        // Pull Tasks
        const { data: cloudTasks, error: tasksError } = await supabase
          .from('cloud_tasks')
          .select('*');

        if (tasksError) throw tasksError;

        if (cloudTasks) {
          await db.transaction('rw', db.tasks, async () => {
             // @ts-ignore
             Dexie.currentTransaction.source = 'sync';

             const tasksToSave = cloudTasks.map(t => ({
               id: Number(t.id),
               title: t.title,
               description: t.description,
               groupId: Number(t.groupId),
               status: t.status,
               date: new Date(t.date),
               type: t.type as any,
               frequency: t.frequency,
               interval: t.interval,
               lastCompletedDate: t.lastCompletedDate ? new Date(t.lastCompletedDate) : undefined,
               measures: t.measures,
               currentProgress: t.currentProgress,
               targetProgress: t.targetProgress,
               unit: t.unit,
               deadline: t.deadline ? new Date(t.deadline) : undefined,
               colorTag: t.colorTag,
               tags: t.tags
             }));
             await db.tasks.bulkPut(tasksToSave as Task[]);
          });
        }

      } catch (error) {
        console.error('Sync Pull Error:', error);
      } finally {
        isSyncingRef.current = false;
      }
    };

    syncPull();

    // Setup Dexie Hooks for Push
    
    const handleTaskChange = async (type: 'create' | 'update' | 'delete', obj: any, key: any) => {
      if (!navigator.onLine || !user || isSyncingRef.current) return;
      
      try {
        const payload = { ...obj, user_id: user.id };
        // Ensure dates are ISO strings
        if (payload.date) payload.date = payload.date.toISOString();
        if (payload.lastCompletedDate) payload.lastCompletedDate = payload.lastCompletedDate.toISOString();
        if (payload.deadline) payload.deadline = payload.deadline.toISOString();
        
        if (type === 'create' || type === 'update') {
           await supabase.from('cloud_tasks').upsert(payload);
        } else if (type === 'delete') {
           await supabase.from('cloud_tasks').delete().match({ id: key, user_id: user.id });
        }
      } catch (err) {
        console.error('Sync Push Error (Task):', err);
      }
    };

    const handleGroupChange = async (type: 'create' | 'update' | 'delete', obj: any, key: any) => {
      if (!navigator.onLine || !user || isSyncingRef.current) return;

      try {
        const payload = { ...obj, user_id: user.id };
        if (type === 'create' || type === 'update') {
           await supabase.from('cloud_groups').upsert(payload);
        } else if (type === 'delete') {
           await supabase.from('cloud_groups').delete().match({ id: key, user_id: user.id });
        }
      } catch (err) {
        console.error('Sync Push Error (Group):', err);
      }
    };

    const creatingTaskHook = (primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        handleTaskChange('create', { ...obj, id: primKey }, primKey);
    };
    const updatingTaskHook = (mods: any, primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        const newObj = { ...obj, ...mods };
        handleTaskChange('update', newObj, primKey);
    };
    const deletingTaskHook = (primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        handleTaskChange('delete', obj, primKey);
    };

    // Groups hooks
    const creatingGroupHook = (primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        handleGroupChange('create', { ...obj, id: primKey }, primKey);
    };
    const updatingGroupHook = (mods: any, primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        const newObj = { ...obj, ...mods };
        handleGroupChange('update', newObj, primKey);
    };
    const deletingGroupHook = (primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        handleGroupChange('delete', obj, primKey);
    };

    db.tasks.hook('creating', creatingTaskHook);
    db.tasks.hook('updating', updatingTaskHook);
    db.tasks.hook('deleting', deletingTaskHook);
    
    db.groups.hook('creating', creatingGroupHook);
    db.groups.hook('updating', updatingGroupHook);
    db.groups.hook('deleting', deletingGroupHook);

    return () => {
        // Cleanup hooks
        db.tasks.hook('creating').unsubscribe(creatingTaskHook);
        db.tasks.hook('updating').unsubscribe(updatingTaskHook);
        db.tasks.hook('deleting').unsubscribe(deletingTaskHook);
        
        db.groups.hook('creating').unsubscribe(creatingGroupHook);
        db.groups.hook('updating').unsubscribe(updatingGroupHook);
        db.groups.hook('deleting').unsubscribe(deletingGroupHook);
    };

  }, [user]); 
}
