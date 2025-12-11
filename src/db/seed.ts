import { db } from './db';
import { subDays, addDays } from 'date-fns';

export async function seedDatabase() {
  // Clear existing database to fix ID conflicts
  console.log('Clearing database for fresh start...');
  await db.groups.clear();
  await db.tasks.clear();
  await db.syncQueue.clear();

  const groupCount = await db.groups.count();
  if (groupCount > 0) return; // Already seeded (double check)

  // UUIDs for Groups
  const workGroupId = crypto.randomUUID();
  const healthGroupId = crypto.randomUUID();
  const studyGroupId = crypto.randomUUID();

  // Create Groups
  await db.groups.add({
    id: workGroupId,
    title: 'Trabalho',
    icon: 'Briefcase',
    color: '#3b82f6', // blue-500
    order: 1
  });

  await db.groups.add({
    id: healthGroupId,
    title: 'Saúde',
    icon: 'Heart',
    color: '#ef4444', // red-500
    order: 3
  });
  
  await db.groups.add({
    id: studyGroupId,
    title: 'Estudos',
    icon: 'GraduationCap',
    color: '#8b5cf6', // violet-500
    order: 4
  });

  const today = new Date();

  // Tasks for Work Group
  await db.tasks.bulkAdd([
    {
      id: crypto.randomUUID(),
      title: 'Enviar relatório financeiro trimestral',
      description: 'Vence hoje, 17:00',
      groupId: workGroupId,
      status: false,
      date: today,
      type: 'immediate',
      tags: []
    },
    {
      id: crypto.randomUUID(),
      title: 'Responder e-mail do cliente Alpha',
      description: 'Vence em 2h',
      groupId: workGroupId,
      status: false,
      date: today,
      type: 'immediate',
      tags: ['Urgente']
    },
    {
      id: crypto.randomUUID(),
      title: 'Agendar reunião de alinhamento',
      description: 'Concluído às 10:30',
      groupId: workGroupId,
      status: true,
      date: today,
      type: 'immediate',
    }
  ]);

  // Tasks for Personal/Health (Recurrent)
  await db.tasks.add({
    id: crypto.randomUUID(),
    title: 'Beber Água',
    groupId: healthGroupId,
    status: false,
    date: today,
    type: 'recurrent',
    currentProgress: 1.5,
    targetProgress: 2.5,
    unit: 'L',
    frequency: 'daily'
  });
  
  await db.tasks.add({
    id: crypto.randomUUID(),
    title: 'Leitura Técnica',
    groupId: studyGroupId,
    status: false,
    date: today,
    type: 'recurrent',
    currentProgress: 10,
    targetProgress: 30,
    unit: 'min',
    frequency: 'daily'
  });

  // Tasks for Objectives
  await db.tasks.add({
    id: crypto.randomUUID(),
    title: 'Programar o novo site',
    groupId: workGroupId,
    status: false,
    date: subDays(today, 4), // Last updated
    type: 'objective',
    colorTag: 'green',
    deadline: addDays(today, 30)
  });

  await db.tasks.add({
    id: crypto.randomUUID(),
    title: 'Estudo de Marketing',
    description: 'Otimizar campanhas de ADS e landing page.',
    groupId: studyGroupId,
    status: false,
    date: subDays(today, 1),
    type: 'objective',
    colorTag: 'yellow',
    deadline: addDays(today, 60)
  });
  
  console.log('Database seeded successfully!');
}
