import { useEffect, useRef, useCallback } from 'react';
import Dexie from 'dexie';
import { db } from '../db/db';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Group, Task } from '../types';

// Mappers para converter dados do Supabase (snake_case) para o formato local (camelCase)
const mapGroupFromSupabase = (g: any, userId: string): Group => ({
  id: g.id,
  userId: userId,
  title: g.title,
  icon: g.icon,
  color: g.color,
  order: g.order
});

const mapTaskFromSupabase = (t: any, userId: string): Task => ({
  id: t.id,
  userId: userId,
  title: t.title,
  description: t.description,
  groupId: t.group_id, // snake_case -> camelCase
  status: t.status,
  date: t.date ? new Date(t.date) : new Date(),
  type: t.type as any,
  frequency: t.frequency,
  interval: t.interval,
  lastCompletedDate: t.last_completed_date ? new Date(t.last_completed_date) : undefined,
  measures: t.measures,
  currentProgress: t.current_progress, // snake_case -> camelCase
  targetProgress: t.target_progress, // snake_case -> camelCase
  unit: t.unit,
  deadline: t.deadline ? new Date(t.deadline) : undefined,
  colorTag: t.color_tag, // snake_case -> camelCase
  tags: t.tags
});

export function useSync() {
  const { user } = useAuth();
  const isSyncingRef = useRef(false);
  const isProcessingQueueRef = useRef(false);

  // Função para enviar dados pendentes da fila para o Supabase
  const processSyncQueue = useCallback(async () => {
    if (!user || isProcessingQueueRef.current || !navigator.onLine) return;
    
    isProcessingQueueRef.current = true;
    try {
      // Processa apenas itens do usuário logado
      const queueItems = await db.syncQueue
        .where('userId').equals(user.id)
        .sortBy('date');
      
      if (queueItems.length > 0) {
        console.log(`[Sync] Processando ${queueItems.length} itens da fila para usuário ${user.email}...`);
      }

      for (const item of queueItems) {
        try {
          const tableName = item.table === 'tasks' ? 'cloud_tasks' : 'cloud_groups';
          const { userId: _, ...cleanData } = item.data; 

          // Formata datas para ISO string
          let dateFields: any = {};
          if (item.table === 'tasks') {
             if (cleanData.date) dateFields.date = new Date(cleanData.date).toISOString();
             if (cleanData.lastCompletedDate) dateFields.last_completed_date = new Date(cleanData.lastCompletedDate).toISOString();
             if (cleanData.deadline) dateFields.deadline = new Date(cleanData.deadline).toISOString();
          }

          // Mapeamento camelCase (local) -> snake_case (Supabase)
          let finalPayload: any = {};
          if (tableName === 'cloud_groups') {
              finalPayload = {
                  user_id: user.id,
                  id: cleanData.id,
                  title: cleanData.title,
                  icon: cleanData.icon,
                  color: cleanData.color,
                  order: cleanData.order
              };
          } else if (tableName === 'cloud_tasks') {
              finalPayload = {
                  user_id: user.id,
                  id: cleanData.id,
                  title: cleanData.title,
                  description: cleanData.description,
                  group_id: cleanData.groupId, // camelCase -> snake_case
                  status: cleanData.status,
                  date: dateFields.date || null,
                  type: cleanData.type,
                  frequency: cleanData.frequency,
                  interval: cleanData.interval,
                  last_completed_date: dateFields.last_completed_date || null, // camelCase -> snake_case
                  measures: cleanData.measures,
                  current_progress: cleanData.currentProgress, // camelCase -> snake_case
                  target_progress: cleanData.targetProgress, // camelCase -> snake_case
                  unit: cleanData.unit,
                  deadline: dateFields.deadline || null,
                  color_tag: cleanData.colorTag, // camelCase -> snake_case
                  tags: cleanData.tags
              };
          }

          if (item.type === 'create' || item.type === 'update') {
            const { error } = await supabase.from(tableName).upsert(finalPayload);
            if (error) throw error;
          } else if (item.type === 'delete') {
            const { error } = await supabase.from(tableName).delete().match({ id: item.primKey, user_id: user.id });
            if (error) throw error;
          }

          await db.syncQueue.delete(item.id!);
        } catch (err) {
          console.error(`[Sync] Erro no item ${item.id}:`, err);
          break; 
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, [user]);

  // Busca inicial (Pull)
  const syncPull = useCallback(async () => {
    if (!user || isSyncingRef.current || !navigator.onLine) return;
    
    isSyncingRef.current = true;
    try {
      console.log('[Sync] Iniciando Pull...');
      
      const [groupsRes, tasksRes] = await Promise.all([
        supabase.from('cloud_groups').select('*'),
        supabase.from('cloud_tasks').select('*')
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (tasksRes.error) throw tasksRes.error;

      await db.transaction('rw', db.groups, db.tasks, async () => {
         // @ts-ignore
         Dexie.currentTransaction.source = 'sync';
         
         // REMOVIDO: Delete agressivo que apagava dados locais pendentes
         // await db.groups.where('userId').equals(user.id).delete();
         // await db.tasks.where('userId').equals(user.id).delete();

         if (groupsRes.data) {
           await db.groups.bulkPut(groupsRes.data.map(g => mapGroupFromSupabase(g, user.id)));
         }
         if (tasksRes.data) {
           await db.tasks.bulkPut(tasksRes.data.map(t => mapTaskFromSupabase(t, user.id)));
         }
      });
      console.log('[Sync] Pull concluído.');

    } catch (error) {
      console.error('[Sync] Erro no Pull:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [user]);

  // Setup Realtime Subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`sync:${user.id}`)
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'cloud_tasks', filter: `user_id=eq.${user.id}` }, 
        async (payload) => {
          console.log('[Realtime] Task change:', payload.eventType);
          if (isSyncingRef.current) return;

          await db.transaction('rw', db.tasks, async () => {
            // @ts-ignore
            Dexie.currentTransaction.source = 'sync';
            
            if (payload.eventType === 'DELETE') {
              await db.tasks.delete(payload.old.id);
            } else {
              await db.tasks.put(mapTaskFromSupabase(payload.new, user.id));
            }
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cloud_groups', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          console.log('[Realtime] Group change:', payload.eventType);
          if (isSyncingRef.current) return;

          await db.transaction('rw', db.groups, async () => {
            // @ts-ignore
            Dexie.currentTransaction.source = 'sync';
            
            if (payload.eventType === 'DELETE') {
              await db.groups.delete(payload.old.id);
            } else {
              await db.groups.put(mapGroupFromSupabase(payload.new, user.id));
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Polling para garantir envio de pendências
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      if (navigator.onLine) {
        processSyncQueue();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [user, processSyncQueue]);

  // Inicialização e Monitoramento Online
  useEffect(() => {
    if (!user) return;

    const initSync = async () => {
      if (navigator.onLine) {
        await syncPull();
        await processSyncQueue();
      }
    };

    initSync();

    const handleOnline = () => {
      console.log('[Sync] Online detectado. Retomando sync...');
      processSyncQueue().then(() => syncPull());
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, syncPull, processSyncQueue]);

  // Monitorar mudanças locais (Dexie Hooks)
  useEffect(() => {
    if (!user) return;

    const handleLocalChange = (table: 'tasks' | 'groups', type: 'create' | 'update' | 'delete', obj: any, key: any) => {
      if (type !== 'delete' && obj.userId !== user.id) return;

      setTimeout(async () => {
        try {
          if (!db.syncQueue) {
              console.warn('[Sync] Tabela syncQueue não encontrada. Tentando recarregar...');
              return;
          }

          await db.syncQueue.add({
            table,
            type,
            data: type === 'delete' ? {} : obj,
            primKey: key,
            userId: user.id,
            date: Date.now()
          });

          if (navigator.onLine) {
            processSyncQueue();
          }
        } catch (err: any) {
          console.error('[Sync] Erro ao enfileirar:', err);
          
          if (err.name === 'NotFoundError') {
              console.error('[Sync] Erro crítico de esquema detectado. Tabela syncQueue inacessível.');
          }
        }
      }, 0);
    };

    const creatingHook = (table: 'tasks' | 'groups') => (primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        if (!obj.userId) obj.userId = user.id; 
        handleLocalChange(table, 'create', { ...obj, id: primKey }, primKey);
    };
    const updatingHook = (table: 'tasks' | 'groups') => (mods: any, primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        const newObj = { ...obj, ...mods };
        handleLocalChange(table, 'update', newObj, primKey);
    };
    const deletingHook = (table: 'tasks' | 'groups') => (primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        handleLocalChange(table, 'delete', obj, primKey);
    };

    db.tasks.hook('creating', creatingHook('tasks'));
    db.tasks.hook('updating', updatingHook('tasks'));
    db.tasks.hook('deleting', deletingHook('tasks'));
    
    db.groups.hook('creating', creatingHook('groups'));
    db.groups.hook('updating', updatingHook('groups'));
    db.groups.hook('deleting', deletingHook('groups'));

    return () => {
        db.tasks.hook('creating').unsubscribe(creatingHook('tasks'));
        db.tasks.hook('updating').unsubscribe(updatingHook('tasks'));
        db.tasks.hook('deleting').unsubscribe(deletingHook('tasks'));
        
        db.groups.hook('creating').unsubscribe(creatingHook('groups'));
        db.groups.hook('updating').unsubscribe(updatingHook('groups'));
        db.groups.hook('deleting').unsubscribe(deletingHook('groups'));
    };

  }, [user, processSyncQueue]);
}


