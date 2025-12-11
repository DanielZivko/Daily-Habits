import { useEffect, useRef, useCallback } from 'react';
import Dexie from 'dexie';
import { db } from '../db/db';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Group, Task } from '../types';

export function useSync() {
  const { user } = useAuth();
  const isSyncingRef = useRef(false);
  const isProcessingQueueRef = useRef(false);

  // Função para enviar dados pendentes da fila para o Supabase
  const processSyncQueue = useCallback(async () => {
    if (!user || isProcessingQueueRef.current || !navigator.onLine) return;
    
    isProcessingQueueRef.current = true;
    try {
      // Pega todos os itens da fila ordenados por data
      const queueItems = await db.syncQueue.orderBy('date').toArray();
      
      if (queueItems.length > 0) {
        console.log(`Processando ${queueItems.length} itens da fila de sincronização...`);
      }

      for (const item of queueItems) {
        try {
          const tableName = item.table === 'tasks' ? 'cloud_tasks' : 'cloud_groups';
          const payload = { ...item.data, user_id: user.id };

          // Formata datas para ISO string compatível com Supabase
          if (payload.date && payload.date instanceof Date) payload.date = payload.date.toISOString();
          else if (payload.date && typeof payload.date === 'string') payload.date = payload.date; // Já é string?
          
          if (payload.lastCompletedDate && payload.lastCompletedDate instanceof Date) payload.lastCompletedDate = payload.lastCompletedDate.toISOString();
          if (payload.deadline && payload.deadline instanceof Date) payload.deadline = payload.deadline.toISOString();
          
          // Garante formatação correta das datas se vierem como string/number
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

          // Se sucesso, remove da fila
          await db.syncQueue.delete(item.id!);
        } catch (err) {
          console.error(`Erro ao processar item da fila ${item.id}:`, err);
          // Interrompe o processamento para manter a consistência da ordem das operações
          // (ex: não tentar atualizar algo que falhou ao ser criado)
          break; 
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, [user]);

  // Função para buscar dados do Supabase (Prioridade na abertura)
  const syncPull = useCallback(async () => {
    if (!user || isSyncingRef.current || !navigator.onLine) return;
    
    isSyncingRef.current = true;
    try {
      console.log('Iniciando Sync Pull do Supabase...');
      
      // 1. Pull Groups
      const { data: cloudGroups, error: groupsError } = await supabase
        .from('cloud_groups')
        .select('*');

      if (groupsError) throw groupsError;

      if (cloudGroups) {
        await db.transaction('rw', db.groups, async () => {
           // @ts-ignore
           Dexie.currentTransaction.source = 'sync';
           
           const groupsToSave = cloudGroups.map(g => ({
             id: Number(g.id),
             title: g.title,
             icon: g.icon,
             color: g.color,
             order: g.order
           }));
           await db.groups.bulkPut(groupsToSave as Group[]);
        });
      }

      // 2. Pull Tasks
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
      console.log('Sync Pull concluído com sucesso.');

    } catch (error) {
      console.error('Sync Pull Error:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [user]);

  // Efeito Principal: Inicialização e Monitoramento de Conexão
  useEffect(() => {
    if (!user) return;

    const initSync = async () => {
      // Prioridade na abertura: Ler do sistema de login
      if (navigator.onLine) {
        await syncPull();
        // Depois de atualizar o local com o remoto, processa pendências
        await processSyncQueue();
      }
    };

    initSync();

    const handleOnline = () => {
      console.log('Conexão restabelecida. Sincronizando...');
      // Ao voltar online: Tenta enviar pendências e depois atualiza
      processSyncQueue().then(() => syncPull());
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, syncPull, processSyncQueue]);

  // Efeito Secundário: Monitorar mudanças no DB Local
  useEffect(() => {
    if (!user) return;

    const handleLocalChange = async (table: 'tasks' | 'groups', type: 'create' | 'update' | 'delete', obj: any, key: any) => {
      // Adiciona na fila SEMPRE. A fila é a fonte da verdade das intenções do usuário.
      // Isso permite funcionamento offline e sync robusto em instabilidade.
      try {
        await db.syncQueue.add({
          table,
          type,
          data: type === 'delete' ? {} : obj, // Delete não precisa de data, só key
          primKey: key,
          date: Date.now()
        });

        // Se estiver online, tenta processar a fila imediatamente
        if (navigator.onLine) {
          processSyncQueue();
        }
      } catch (err) {
        console.error('Erro ao adicionar na fila de sync:', err);
      }
    };

    // Tasks Hooks
    const creatingTaskHook = (primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        handleLocalChange('tasks', 'create', { ...obj, id: primKey }, primKey);
    };
    const updatingTaskHook = (mods: any, primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        const newObj = { ...obj, ...mods };
        handleLocalChange('tasks', 'update', newObj, primKey);
    };
    const deletingTaskHook = (primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        handleLocalChange('tasks', 'delete', obj, primKey);
    };

    // Groups Hooks
    const creatingGroupHook = (primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        handleLocalChange('groups', 'create', { ...obj, id: primKey }, primKey);
    };
    const updatingGroupHook = (mods: any, primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        const newObj = { ...obj, ...mods };
        handleLocalChange('groups', 'update', newObj, primKey);
    };
    const deletingGroupHook = (primKey: any, obj: any, trans: any) => {
        if (trans.source === 'sync') return;
        handleLocalChange('groups', 'delete', obj, primKey);
    };

    // Registrar Hooks
    db.tasks.hook('creating', creatingTaskHook);
    db.tasks.hook('updating', updatingTaskHook);
    db.tasks.hook('deleting', deletingTaskHook);
    
    db.groups.hook('creating', creatingGroupHook);
    db.groups.hook('updating', updatingGroupHook);
    db.groups.hook('deleting', deletingGroupHook);

    return () => {
        // Cleanup Hooks
        db.tasks.hook('creating').unsubscribe(creatingTaskHook);
        db.tasks.hook('updating').unsubscribe(updatingTaskHook);
        db.tasks.hook('deleting').unsubscribe(deletingTaskHook);
        
        db.groups.hook('creating').unsubscribe(creatingGroupHook);
        db.groups.hook('updating').unsubscribe(updatingGroupHook);
        db.groups.hook('deleting').unsubscribe(deletingGroupHook);
    };

  }, [user, processSyncQueue]);
}
