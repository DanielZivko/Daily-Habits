import { db } from './db';
import { subDays, addDays } from 'date-fns';

export async function seedDatabase() {
  const groupCount = await db.groups.count();
  if (groupCount > 0) return; // Already seeded

  // Create Groups
  const workGroupId = await db.groups.add({
    title: 'Trabalho',
    icon: 'Briefcase',
    color: '#3b82f6', // blue-500
    order: 1
  });

  // Removed personalGroupId as unused variable

  const healthGroupId = await db.groups.add({
    title: 'Saúde',
    icon: 'Heart',
    color: '#ef4444', // red-500
    order: 3
  });
  
  const studyGroupId = await db.groups.add({
    title: 'Estudos',
    icon: 'GraduationCap',
    color: '#8b5cf6', // violet-500
    order: 4
  });

  const today = new Date();

  // Tasks for Work Group
  await db.tasks.bulkAdd([
    {
      title: 'Enviar relatório financeiro trimestral',
      description: 'Vence hoje, 17:00',
      groupId: workGroupId,
      status: false,
      date: today,
      type: 'immediate',
      tags: []
    },
    {
      title: 'Responder e-mail do cliente Alpha',
      description: 'Vence em 2h',
      groupId: workGroupId,
      status: false,
      date: today,
      type: 'immediate',
      tags: ['Urgente']
    },
    {
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
    title: 'Programar o novo site',
    groupId: workGroupId,
    status: false,
    date: subDays(today, 4), // Last updated
    type: 'objective',
    colorTag: 'green',
    deadline: addDays(today, 30)
  });

  await db.tasks.add({
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
