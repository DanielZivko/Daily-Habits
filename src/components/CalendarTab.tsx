import React from "react";
import { Calendar } from "lucide-react";
import { cn } from "../lib/utils";
import { format, startOfDay } from "date-fns";
import { Input } from "./ui/Input";

export type CalendarPeriod = 'today' | 'tomorrow' | 'custom';

interface CalendarTabProps {
  isSelected: boolean;
  onSelect: () => void;
}

interface CalendarSubTabsProps {
  selectedPeriod: CalendarPeriod;
  onSelectPeriod: (period: CalendarPeriod) => void;
  customStartDate?: Date;
  customEndDate?: Date;
  onCustomDateChange?: (startDate: Date | null, endDate: Date | null) => void;
}

export const CalendarTab: React.FC<CalendarTabProps> = ({
  isSelected,
  onSelect,
}) => {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex min-w-fit items-center gap-2 border-b-2 px-4 py-4 text-sm font-medium transition-colors cursor-pointer select-none rounded-t-lg",
        isSelected
          ? "border-blue-500 text-blue-500"
          : "border-transparent text-gray-500 hover:text-gray-700"
      )}
      title="Calendário"
    >
      <Calendar size={20} style={{ color: isSelected ? '#3b82f6' : undefined }} />
      <span className="hidden md:block">Calendário</span>
    </button>
  );
};

export const CalendarSubTabs: React.FC<CalendarSubTabsProps> = ({
  selectedPeriod,
  onSelectPeriod,
  customStartDate,
  customEndDate,
  onCustomDateChange
}) => {
  const periods: { id: CalendarPeriod; label: string }[] = [
    { id: 'today', label: 'Hoje' },
    { id: 'tomorrow', label: 'Amanhã' },
    { id: 'custom', label: 'Período Personalizado' }
  ];

  // Criar data local a partir de string YYYY-MM-DD sem problemas de timezone
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return startOfDay(new Date(year, month - 1, day));
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? parseLocalDate(e.target.value) : null;
    onCustomDateChange?.(date, customEndDate || null);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? parseLocalDate(e.target.value) : null;
    onCustomDateChange?.(customStartDate || null, date);
  };

  // Formatar datas para input type="date" (YYYY-MM-DD)
  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    // Usar startOfDay para garantir que estamos trabalhando com a data local correta
    const localDate = startOfDay(date);
    return format(localDate, 'yyyy-MM-dd');
  };

  // Inicializar datas padrão se não existirem
  React.useEffect(() => {
    if (selectedPeriod === 'custom' && !customStartDate && !customEndDate && onCustomDateChange) {
      const today = startOfDay(new Date());
      const endDate = startOfDay(new Date());
      endDate.setDate(today.getDate() + 7); // Default: próximos 7 dias
      onCustomDateChange(today, endDate);
    }
  }, [selectedPeriod, customStartDate, customEndDate, onCustomDateChange]);

  return (
    <div className="border-b border-gray-100 bg-white">
      <div className="flex w-full gap-1 px-4 py-2">
        {periods.map((period) => (
          <button
            key={period.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPeriod(period.id);
            }}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              selectedPeriod === period.id
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            {period.label}
          </button>
        ))}
      </div>
      
      {/* Seletor de datas para período personalizado */}
      {selectedPeriod === 'custom' && (
        <div className="flex items-center gap-3 px-4 pb-3 border-t border-gray-100 pt-2">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-gray-600 whitespace-nowrap font-medium">De:</label>
            <div className="relative flex-1 max-w-[200px]">
              <Input
                type="date"
                value={formatDateForInput(customStartDate)}
                onChange={handleStartDateChange}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="h-9 text-xs cursor-pointer pl-9"
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-gray-600 whitespace-nowrap font-medium">Até:</label>
            <div className="relative flex-1 max-w-[200px]">
              <Input
                type="date"
                value={formatDateForInput(customEndDate)}
                onChange={handleEndDateChange}
                onClick={(e) => e.currentTarget.showPicker?.()}
                min={formatDateForInput(customStartDate)}
                className="h-9 text-xs cursor-pointer pl-9"
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
