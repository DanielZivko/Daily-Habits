import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, Search, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "./ui/Input";
import { db } from "../db/db";
import { useLiveQuery } from "dexie-react-hooks";
import type { Task, Group } from "../types";

interface HeaderProps {
  onGroupSelect?: (groupId: number) => void;
}

export const Header: React.FC<HeaderProps> = ({ onGroupSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch all tasks and groups for search
  const allTasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const allGroups = useLiveQuery(() => db.groups.toArray()) || [];

  const filteredTasks = searchTerm.trim() 
    ? allTasks.filter(task => 
        task.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const getGroupColor = (groupId: number) => {
    return allGroups.find(g => g.id === groupId)?.color || '#e5e7eb';
  };

  const handleTaskClick = (groupId: number) => {
    if (onGroupSelect) {
      onGroupSelect(groupId);
    }
    setSearchTerm("");
    setIsSearchOpen(false);
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="flex items-center justify-between bg-white px-4 py-3 shadow-sm md:px-8">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-8 w-8 text-blue-500" />
        <h1 className="hidden text-xl font-bold text-gray-900 md:block">Daily Habits</h1>
      </div>

      <div className="mx-4 flex-1 max-w-md relative" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            placeholder="Buscar..." 
            className="h-10 w-full rounded-full bg-gray-100 pl-10 border-transparent focus:bg-white" 
          />
        </div>

        {/* Search Results Dropdown */}
        {isSearchOpen && searchTerm && (
          <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-100 bg-white py-2 shadow-lg z-50">
            {filteredTasks.length > 0 ? (
              filteredTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => handleTaskClick(task.groupId)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <div 
                    className="h-8 w-1 shrink-0 rounded-full" 
                    style={{ backgroundColor: getGroupColor(task.groupId) }}
                  />
                  <span className="truncate text-sm font-medium text-gray-700">
                    {task.title}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                Nenhuma tarefa encontrada
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Link to="/settings" className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
          <Settings className="h-6 w-6" />
        </Link>
        <div className="h-8 w-8 overflow-hidden rounded-full bg-yellow-200 ring-2 ring-white">
          <img 
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
            alt="Avatar" 
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </header>
  );
};
