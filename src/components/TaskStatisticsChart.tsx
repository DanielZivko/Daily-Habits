import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Minus } from 'lucide-react';

interface TaskStatisticsChartProps {
  taskId: string;
  enabled?: boolean;
}

interface ChartDataPoint {
  label: string;
  timestamp: number;
  count: number;
  periodStart: Date;
  periodEnd: Date;
}

// Intervalos de tempo em milissegundos (do menor para o maior)
const TIME_INTERVALS = [
  { ms: 60 * 1000, label: '1 min', format: 'HH:mm' },
  { ms: 2 * 60 * 1000, label: '2 min', format: 'HH:mm' },
  { ms: 5 * 60 * 1000, label: '5 min', format: 'HH:mm' },
  { ms: 10 * 60 * 1000, label: '10 min', format: 'HH:mm' },
  { ms: 15 * 60 * 1000, label: '15 min', format: 'HH:mm' },
  { ms: 30 * 60 * 1000, label: '30 min', format: 'HH:mm' },
  { ms: 60 * 60 * 1000, label: '1 hora', format: 'HH:mm' },
  { ms: 2 * 60 * 60 * 1000, label: '2 horas', format: 'HH:mm' },
  { ms: 4 * 60 * 60 * 1000, label: '4 horas', format: 'dd/MM HH:mm' },
  { ms: 8 * 60 * 60 * 1000, label: '8 horas', format: 'dd/MM HH:mm' },
  { ms: 12 * 60 * 60 * 1000, label: '12 horas', format: 'dd/MM HH:mm' },
  { ms: 24 * 60 * 60 * 1000, label: '1 dia', format: 'dd/MM' },
  { ms: 2 * 24 * 60 * 60 * 1000, label: '2 dias', format: 'dd/MM' },
  { ms: 7 * 24 * 60 * 60 * 1000, label: '1 sem', format: 'dd/MM' },
  { ms: 14 * 24 * 60 * 60 * 1000, label: '2 sem', format: 'dd/MM' },
  { ms: 30 * 24 * 60 * 60 * 1000, label: '1 mês', format: 'MMM yyyy' },
];

const TARGET_POINTS = 7; // Número ideal de pontos no gráfico

// Encontra o melhor intervalo para ~TARGET_POINTS pontos
function findBestInterval(totalDurationMs: number): typeof TIME_INTERVALS[0] {
  const idealInterval = totalDurationMs / TARGET_POINTS;
  
  // Encontra o intervalo mais próximo do ideal
  let bestInterval = TIME_INTERVALS[0];
  let minDiff = Infinity;
  
  for (const interval of TIME_INTERVALS) {
    const diff = Math.abs(interval.ms - idealInterval);
    if (diff < minDiff) {
      minDiff = diff;
      bestInterval = interval;
    }
  }
  
  return bestInterval;
}

// Formata o label do período baseado no intervalo
function formatPeriodLabel(date: Date, intervalMs: number): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  // Para intervalos pequenos (< 1 hora), mostra hora:minuto
  if (intervalMs < 60 * 60 * 1000) {
    return format(date, 'HH:mm');
  }
  
  // Para intervalos médios (< 1 dia), mostra dia/mês hora:minuto
  if (intervalMs < 24 * 60 * 60 * 1000) {
    // Se for hoje, mostra só a hora
    if (diffMs < 24 * 60 * 60 * 1000) {
      return format(date, 'HH:mm');
    }
    return format(date, 'dd/MM HH:mm');
  }
  
  // Para intervalos grandes (>= 1 dia)
  if (intervalMs < 30 * 24 * 60 * 60 * 1000) {
    return format(date, 'dd/MM');
  }
  
  return format(date, 'MMM yy', { locale: ptBR });
}

// Formata tooltip com período completo
function formatTooltipLabel(start: Date, end: Date, intervalMs: number): string {
  if (intervalMs < 60 * 60 * 1000) {
    // Minutos
    return `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;
  }
  if (intervalMs < 24 * 60 * 60 * 1000) {
    // Horas
    return `${format(start, "dd/MM HH:mm")} - ${format(end, "HH:mm")}`;
  }
  if (intervalMs < 7 * 24 * 60 * 60 * 1000) {
    // Dias
    return `${format(start, "dd/MM")} - ${format(end, "dd/MM")}`;
  }
  // Semanas/Meses
  return `${format(start, "dd MMM", { locale: ptBR })} - ${format(end, "dd MMM", { locale: ptBR })}`;
}

export const TaskStatisticsChart: React.FC<TaskStatisticsChartProps> = ({ taskId, enabled = true }) => {
  const [zoomLevel, setZoomLevel] = useState(0); // 0 = full view, 100 = most zoomed

  // Busca histórico da tarefa
  const history = useLiveQuery(
    () => enabled ? db.taskHistory.where('taskId').equals(taskId).sortBy('date') : [],
    [taskId, enabled]
  );

  // Calcula o intervalo de tempo visível baseado no zoom
  const timeRange = useMemo(() => {
    if (!history || history.length === 0) return null;

    const dates = history.map(h => new Date(h.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const totalDuration = maxDate - minDate;

    // Duração mínima para zoom máximo: ~2 minutos ou 1/50 do total, o que for maior
    const minZoomDuration = Math.max(2 * 60 * 1000, totalDuration / 50);
    
    // Interpola entre duração total (zoom 0) e duração mínima (zoom 100)
    const zoomFactor = zoomLevel / 100;
    const visibleDuration = totalDuration - (totalDuration - minZoomDuration) * zoomFactor;
    
    // O período visível sempre termina no momento mais recente
    const visibleEnd = maxDate;
    const visibleStart = visibleEnd - visibleDuration;

    return {
      totalStart: minDate,
      totalEnd: maxDate,
      totalDuration,
      visibleStart,
      visibleEnd,
      visibleDuration,
    };
  }, [history, zoomLevel]);

  // Agrupa os dados dinamicamente baseado no intervalo visível
  const { chartData, intervalInfo } = useMemo(() => {
    if (!history || history.length === 0 || !timeRange) {
      return { chartData: [], intervalInfo: null };
    }

    const { visibleStart, visibleEnd, visibleDuration } = timeRange;
    
    // Encontra o melhor intervalo para a duração visível
    const interval = findBestInterval(visibleDuration);
    
    // Filtra apenas os registros no período visível
    const visibleHistory = history.filter(h => {
      const t = new Date(h.date).getTime();
      return t >= visibleStart && t <= visibleEnd;
    });

    if (visibleHistory.length === 0) {
      return { chartData: [], intervalInfo: interval };
    }

    // Agrupa por período
    const buckets = new Map<number, { count: number; periodStart: Date; periodEnd: Date }>();
    
    visibleHistory.forEach(entry => {
      const entryTime = new Date(entry.date).getTime();
      const bucketStart = Math.floor(entryTime / interval.ms) * interval.ms;
      
      if (buckets.has(bucketStart)) {
        buckets.get(bucketStart)!.count += entry.value ?? 1;
      } else {
        buckets.set(bucketStart, {
          count: entry.value ?? 1,
          periodStart: new Date(bucketStart),
          periodEnd: new Date(bucketStart + interval.ms),
        });
      }
    });

    // Converte para array e ordena
    const data: ChartDataPoint[] = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, bucket]) => ({
        label: formatPeriodLabel(bucket.periodStart, interval.ms),
        timestamp,
        count: bucket.count,
        periodStart: bucket.periodStart,
        periodEnd: bucket.periodEnd,
      }));

    return { chartData: data, intervalInfo: interval };
  }, [history, timeRange]);

  // Custom ticks para Y axis
  const yAxisTicks = useMemo(() => {
    if (chartData.length === 0) return [1];
    
    const maxCount = Math.max(...chartData.map(d => d.count));
    
    if (maxCount <= 5) {
      return Array.from({ length: maxCount + 1 }, (_, i) => i).filter(n => n > 0);
    }
    
    const step = Math.ceil(maxCount / 5);
    const ticks: number[] = [1];
    for (let i = step; i <= maxCount; i += step) {
      ticks.push(i);
    }
    if (!ticks.includes(maxCount)) ticks.push(maxCount);
    return ticks;
  }, [chartData]);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.min(100, prev + 10));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.max(0, prev - 10));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setZoomLevel(Number(e.target.value));
  };

  const handleSliderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Não renderiza se não está habilitado
  if (!enabled) return null;

  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-gray-400">
        Nenhum histórico registrado ainda
      </div>
    );
  }

  return (
    <div 
      className="relative flex mt-3 pt-3 border-t border-gray-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Gráfico */}
      <div className="flex-1 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <defs>
              <linearGradient id={`gradient-${taskId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9CA3AF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#9CA3AF" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#9CA3AF' }}
              interval="preserveStartEnd"
            />
            
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              ticks={yAxisTicks}
              domain={[0, 'auto']}
              width={30}
              allowDecimals={false}
            />
            
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value} ${value === 1 ? 'vez' : 'vezes'}`, 'Completado']}
              labelFormatter={(_, payload) => {
                if (payload && payload[0] && intervalInfo) {
                  const item = payload[0].payload as ChartDataPoint;
                  return formatTooltipLabel(item.periodStart, item.periodEnd, intervalInfo.ms);
                }
                return '';
              }}
            />
            
            <Area
              type="monotone"
              dataKey="count"
              stroke="#9CA3AF"
              strokeWidth={2}
              fill={`url(#gradient-${taskId})`}
              dot={{
                r: 4,
                fill: '#9CA3AF',
                stroke: 'white',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: '#6B7280',
                stroke: 'white',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Controle de Zoom Vertical */}
      <div className="flex flex-col items-center justify-center gap-1 ml-2 w-6">
        <button
          onClick={handleZoomIn}
          disabled={zoomLevel >= 100}
          className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Zoom In (dados recentes)"
        >
          <Plus size={14} className="text-gray-500" />
        </button>
        
        {/* Slider vertical */}
        <div 
          className="relative h-24 w-1 bg-gray-200 rounded-full"
          onClick={handleSliderClick}
        >
          <div
            className="absolute bottom-0 w-full bg-gray-400 rounded-full transition-all duration-200"
            style={{ height: `${100 - zoomLevel}%` }}
          />
          <input
            type="range"
            min="0"
            max="100"
            value={zoomLevel}
            onChange={handleSliderChange}
            onClick={handleSliderClick}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ 
              writingMode: 'vertical-lr',
              direction: 'rtl',
            }}
          />
        </div>
        
        <button
          onClick={handleZoomOut}
          disabled={zoomLevel <= 0}
          className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Zoom Out (todos os dados)"
        >
          <Minus size={14} className="text-gray-500" />
        </button>
      </div>
    </div>
  );
};
