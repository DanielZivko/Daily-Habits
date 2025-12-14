import React, { useState, useEffect, useRef } from "react";
import type { Group } from "../types";
import { cn } from "../lib/utils";
import { Plus, ChevronsLeft, ChevronsRight } from "lucide-react";
import { getIconComponent } from "./ui/IconPicker";
import { db } from "../db/db";
import { Reorder, useDragControls } from "framer-motion";
import { CalendarTab, CalendarSubTabs, type CalendarPeriod } from "./CalendarTab";

// Função para determinar o nível de glow baseado na quantidade de tarefas pendentes
const getGlowLevel = (pendingCount: number): 'none' | 'low' | 'medium' | 'high' => {
  if (pendingCount === 0) return 'none';
  if (pendingCount <= 3) return 'low';      // 1-3: glow super fraco, piscando lento
  if (pendingCount <= 7) return 'medium';   // 4-7: glow fraco, piscando lento-médio
  return 'high';                             // 8+: glow médio-fraco, piscando médio
};

// Converte cor hex para RGB (para usar com rgba no CSS)
const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
  }
  return '59, 130, 246'; // Fallback azul padrão
};

interface GroupTabItemProps {
  group: Group;
  isSelected: boolean;
  onClick: () => void;
  onDragEnd: () => void;
  pendingCount: number;
}

const GroupTabItem: React.FC<GroupTabItemProps> = ({ group, isSelected, onClick, onDragEnd, pendingCount }) => {
  const controls = useDragControls();
  const [isPressing, setIsPressing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only process left click
    if (e.button !== 0) return;

    startPosRef.current = { x: e.clientX, y: e.clientY };
    setIsPressing(true);

    timeoutRef.current = setTimeout(() => {
      controls.start(e);
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50);
      setIsPressing(false);
    }, 1000); // 1 second hold
  };

  const cancelLongPress = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    startPosRef.current = null;
    setIsPressing(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPosRef.current) return;

    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);

    // Cancel if moved more than 10px (likely scrolling)
    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  };

  const Icon = getIconComponent(group.icon);
  const glowLevel = getGlowLevel(pendingCount);
  
  // Classes de animação de glow baseadas no nível
  const glowClasses = {
    none: '',
    low: 'animate-glow-slow',      // 1-3: super fraco, lento
    medium: 'animate-glow-medium', // 4-7: fraco, lento-médio
    high: 'animate-glow-fast'      // 8+: médio-fraco, médio
  };

  return (
    <Reorder.Item
      value={group}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onClick={onClick}
      className={cn(
        "flex min-w-fit items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors cursor-pointer select-none touch-manipulation rounded-t-lg relative", 
        isSelected
          ? "border-current"
          : "border-transparent text-gray-500 hover:text-gray-700",
        isPressing && "opacity-70 scale-95 duration-200"
      )}
      style={{
        color: isSelected ? group.color : undefined,
        borderColor: isSelected ? group.color : undefined,
        // Aplicar glow com a cor do grupo (RGB para usar com rgba)
        ...(glowLevel !== 'none' && {
          '--glow-color-rgb': hexToRgb(group.color)
        } as React.CSSProperties)
      }}
      whileDrag={{ scale: 1.05, cursor: "grabbing", zIndex: 50 }}
      title={group.title}
    >
      <div className={cn("relative flex items-center justify-center", glowLevel !== 'none' && "glow-container", glowClasses[glowLevel])}>
        <Icon 
            size={20} 
            style={{ color: group.color }}
        />
      </div>
      <span className="hidden md:block">
        {group.title}
      </span>
    </Reorder.Item>
  );
};

interface GroupTabsProps {
  groups: Group[];
  selectedGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
  onNewGroup: () => void;
  pendingCountByGroup: Record<string, number>;
  isCalendarSelected: boolean;
  onSelectCalendar: () => void;
  selectedCalendarPeriod: CalendarPeriod;
  onSelectCalendarPeriod: (period: CalendarPeriod) => void;
  customStartDate?: Date;
  customEndDate?: Date;
  onCustomDateChange?: (startDate: Date | null, endDate: Date | null) => void;
}

export const GroupTabs: React.FC<GroupTabsProps> = ({ 
  groups, 
  selectedGroupId, 
  onSelectGroup,
  onNewGroup,
  pendingCountByGroup,
  isCalendarSelected,
  onSelectCalendar,
  selectedCalendarPeriod,
  onSelectCalendarPeriod,
  customStartDate,
  customEndDate,
  onCustomDateChange
}) => {
  const [localGroups, setLocalGroups] = useState<Group[]>(groups);
  
  // Refs e states para drag-to-scroll e setas
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);

  // Verificar estado do scroll
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1); // -1 para evitar falsos negativos por arredondamento
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [localGroups]);

  const handleReorder = (newOrder: Group[]) => {
    setLocalGroups(newOrder);
  };

  const handleDragEnd = async () => {
    // Update order in DB for ALL groups to ensure consistency
    await db.transaction('rw', db.groups, async () => {
        for (let i = 0; i < localGroups.length; i++) {
            if (localGroups[i].order !== i) {
                await db.groups.update(localGroups[i].id, { order: i });
            }
        }
    });
  };

  // Drag-to-Scroll Handlers
  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const onMouseLeave = () => {
    setIsDragging(false);
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Multiplicador para velocidade do scroll
    scrollRef.current.scrollLeft = scrollLeft - walk;
    checkScroll(); // Atualizar setas durante o drag
  };

  const scrollByAmount = (amount: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
      // O evento de scroll cuidará de atualizar as setas, mas podemos forçar check após delay
      setTimeout(checkScroll, 300);
    }
  };

  return (
    <div className="bg-white group-tabs-container shadow-sm">
      <div className="flex border-b border-gray-200">
        {/* Guia Calendário Fixa */}
        <div className="flex-shrink-0 z-20 bg-white">
          <CalendarTab
            isSelected={isCalendarSelected}
            onSelect={onSelectCalendar}
          />
        </div>

        {/* Área scrollável com grupos */}
        <div className="relative flex-1 min-w-0">
          {/* Seta Esquerda com Degradê - Estilo Clean */}
          <div 
            className={cn(
              "pointer-events-none absolute left-0 top-0 z-10 flex h-full w-20 items-center justify-start bg-gradient-to-r from-white via-white/90 to-transparent pl-1 transition-opacity duration-300",
              canScrollLeft ? "opacity-100" : "opacity-0"
            )}
          >
            <button
              onClick={() => scrollByAmount(-200)}
              className="pointer-events-auto text-gray-300 hover:text-gray-500 transition-colors"
              aria-label="Scroll left"
            >
              <ChevronsLeft size={24} strokeWidth={1.5} />
            </button>
          </div>

          {/* Um único scroll horizontal: tabs + botão Novo no mesmo fluxo */}
          <div 
            ref={scrollRef}
            className={cn(
              "overflow-x-auto pb-1 scrollbar-hide h-full flex items-end", // Adicionado items-end e h-full
              isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Forçar ocultação via style inline também
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            onScroll={checkScroll} // Monitorar scroll nativo
          >
            <div className="flex min-w-max items-center gap-6 px-4"> 
              <Reorder.Group 
                axis="x" 
                values={localGroups} 
                onReorder={handleReorder}
                className="flex items-center gap-6"
              >
                {localGroups.map((group) => (
                  <GroupTabItem
                    key={group.id}
                    group={group}
                    isSelected={selectedGroupId === group.id}
                    onClick={() => {
                        // Evita clique acidental se estiver arrastando (pequeno threshold)
                        if (!isDragging) onSelectGroup(group.id);
                    }}
                    onDragEnd={handleDragEnd}
                    pendingCount={pendingCountByGroup[group.id] || 0}
                  />
                ))}
              </Reorder.Group>

              <button
                onClick={onNewGroup}
                className="flex shrink-0 min-w-fit items-center gap-1 py-4 text-sm font-medium text-gray-400 hover:text-blue-500"
                // Impedir que o clique no botão dispare o drag
                onMouseDown={(e) => e.stopPropagation()} 
              >
                <Plus size={16} />
                <span className="hidden md:inline">Novo</span>
              </button>
              
              {/* Espaçador final para garantir que o último item não fique colado no final */}
              <div className="w-8"></div>
            </div>
          </div>

          {/* Seta Direita com Degradê - Estilo Clean */}
          <div 
            className={cn(
              "pointer-events-none absolute right-0 top-0 z-10 flex h-full w-20 items-center justify-end bg-gradient-to-l from-white via-white/90 to-transparent pr-1 transition-opacity duration-300",
              canScrollRight ? "opacity-100" : "opacity-0"
            )}
          >
            <button
              onClick={() => scrollByAmount(200)}
              className="pointer-events-auto text-gray-300 hover:text-gray-500 transition-colors"
              aria-label="Scroll right"
            >
              <ChevronsRight size={24} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Sub-guias do Calendário (Linha separada) */}
      {isCalendarSelected && (
        <CalendarSubTabs 
            selectedPeriod={selectedCalendarPeriod}
            onSelectPeriod={onSelectCalendarPeriod}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomDateChange={onCustomDateChange}
        />
      )}
    </div>
  );
};
