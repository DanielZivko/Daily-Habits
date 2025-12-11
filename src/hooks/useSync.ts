import { useEffect, useRef, useCallback } from 'react';
import Dexie from 'dexie';
import { db } from '../db/db';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Group, Task } from '../types';

// Mappers para converter dados do Supabase para o formato local
const mapGroupFromSupabase = (g: any): Group => ({
  id: Number(g.id),
  title: g.title,
  icon: g.icon,
  color: g.color,
  order: g.order
});

const mapTaskFromSupabase = (t: any): Task => ({
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
      const queueItems = await db.syncQueue.orderBy('date').toArray();
      
      if (queueItems.length > 0) {
        console.log(`[Sync] Processando ${queueItems.length} itens da fila...`);
      }

      for (const item of queueItems) {
        try {
          const tableName = item.table === 'tasks' ? 'cloud_tasks' : 'cloud_groups';
          const payload = { ...item.data, user_id: user.id };

          // Formata datas
          if (item.table === 'tasks') {
             if (payload.date) payload.date = new Date(payload.date).toISOString();
             if (payload.lastCompletedDate) payload.lastCompletedDate = new Date(payload.lastCompletedDate).toISOString();
             if (payload.deadline) payload.deadline = new Date(payload.deadline).toISOString();
          }

          if (item.type === 'create' || item.type === 'update') {
            const { error } = await supabase.from(tableName).upsert(payload);
            if (error) throw error;
          } else if (item.type === 'delete') {
            const { error } = await supabase.from(tableName).delete().match({ id: item.primKey, user_id: user.id });
            if (error) throw error;
          }

          await db.syncQueue.delete(item.id!);
        } catch (err) {
          console.error(`[Sync] Erro no item ${item.id}:`, err);
          // Break para manter ordem cronológica em caso de erro
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
         
         if (groupsRes.data) {
           await db.groups.bulkPut(groupsRes.data.map(mapGroupFromSupabase));
         }
         if (tasksRes.data) {
           await db.tasks.bulkPut(tasksRes.data.map(mapTaskFromSupabase));
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
          if (isSyncingRef.current) return; // Evita conflito se estiver fazendo pull inicial

          await db.transaction('rw', db.tasks, async () => {
            // @ts-ignore
            Dexie.currentTransaction.source = 'sync';
            
            if (payload.eventType === 'DELETE') {
              await db.tasks.delete(Number(payload.old.id));
            } else {
              await db.tasks.put(mapTaskFromSupabase(payload.new));
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
              await db.groups.delete(Number(payload.old.id));
            } else {
              await db.groups.put(mapGroupFromSupabase(payload.new));
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
    }, 15000); // Tenta processar a fila a cada 15s se houver algo pendente

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

    const handleLocalChange = async (table: 'tasks' | 'groups', type: 'create' | 'update' | 'delete', obj: any, key: any) => {
      try {
        await db.syncQueue.add({
          table,
          type,
          data: type === 'delete' ? {} : obj,
          primKey: key,
          date: Date.now()
        });

        if (navigator.onLine) {
          // Pequeno delay para agrupar mudanças rápidas se necessário, ou enviar logo
          processSyncQueue();
        }
      } catch (err) {
        console.error('[Sync] Erro ao enfileirar:', err);
      }
    };

    const creatingHook = (table: 'tasks' | 'groups') => (primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
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
