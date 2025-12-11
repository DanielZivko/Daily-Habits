import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, Search, Settings, LogIn, LogOut, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "./ui/Input";
import { db } from "../db/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "../contexts/AuthContext";

interface HeaderProps {
  onGroupSelect?: (groupId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onGroupSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  
  const { user, signOut } = useAuth();
  const currentUserId = user ? user.id : 'guest';
  const navigate = useNavigate();

  // Fetch all tasks and groups for search
  const allTasks = useLiveQuery(() => db.tasks.where('userId').equals(currentUserId).toArray(), [currentUserId]) || [];
  const allGroups = useLiveQuery(() => db.groups.where('userId').equals(currentUserId).toArray(), [currentUserId]) || [];

  const filteredTasks = searchTerm.trim() 
    ? allTasks.filter(task => 
        task.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const getGroupColor = (groupId: string) => {
    return allGroups.find(g => g.id === groupId)?.color || '#e5e7eb';
    
  };

  const handleTaskClick = (groupId: string) => {
    if (onGroupSelect) {
      onGroupSelect(groupId);
    }
    setSearchTerm("");
    setIsSearchOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setIsProfileOpen(false);
    navigate('/login');
  };

  // Close search and profile menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
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
        
        {user ? (
          <div className="relative" ref={profileRef}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="h-8 w-8 overflow-hidden rounded-full bg-blue-100 ring-2 ring-white flex items-center justify-center text-blue-600 hover:ring-blue-100 transition-all"
            >
               {/* Use first letter of email or a generic user icon */}
               <User className="h-5 w-5" />
            </button>
            
            {isProfileOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 rounded-lg border border-gray-100 bg-white py-1 shadow-lg z-50">
                <div className="px-4 py-2 border-b border-gray-50">
                  <p className="text-xs text-gray-500">Logado como</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                </div>
                <button 
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link 
            to="/login" 
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Entrar / Sync</span>
          </Link>
        )}
      </div>
    </header>
  );
};
