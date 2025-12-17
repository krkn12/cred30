import React from 'react';
import { LogOut, Home, PieChart, DollarSign, Settings, TrendingUp, ArrowUpFromLine } from 'lucide-react';
import { User } from '../../../domain/types/common.types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  currentView: string;
  onChangeView: (view: string) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, currentView, onChangeView, onLogout }) => {
  if (!user) return <div className="min-h-screen bg-background text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">{children}</div>;

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'invest', label: 'Investir', icon: TrendingUp },
    { id: 'portfolio', label: 'Carteira', icon: PieChart },
    { id: 'loans', label: 'Empréstimos', icon: DollarSign },
    { id: 'withdraw', label: 'Sacar', icon: ArrowUpFromLine },
  ];

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <div className="md:hidden bg-surface border-b border-surfaceHighlight p-4 flex justify-between items-center sticky top-0 z-20">
        <h1 className="text-xl font-bold text-primary-400 tracking-tight">Cred30</h1>
        <button onClick={onLogout} className="text-zinc-400" title="Sair" aria-label="Sair"><LogOut size={20} /></button>
      </div>

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-surface border-r border-surfaceHighlight h-screen sticky top-0">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2 tracking-tighter">
            <div className="w-10 h-10 bg-gradient-to-tr from-primary-400 to-primary-600 rounded-xl flex items-center justify-center text-black font-bold text-xl shadow-[0_0_15px_rgba(34,211,238,0.5)]">
              C
            </div>
            Cred<span className="text-primary-400">30</span>
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-4 text-sm font-medium rounded-xl transition-all duration-200 ${
                currentView === item.id
                  ? 'bg-primary-400/10 text-primary-400 border border-primary-400/20'
                  : 'text-zinc-400 hover:bg-surfaceHighlight hover:text-white'
              }`}
            >
              <item.icon size={22} className={currentView === item.id ? 'stroke-[2.5px]' : ''} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-surfaceHighlight">
            <button
              onClick={() => onChangeView('settings')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-medium rounded-xl transition-colors mb-4 ${
                currentView === 'settings' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Settings size={20} />
              Configurações
            </button>
          <div className="flex items-center gap-3 px-4 py-3 bg-surfaceHighlight/50 rounded-xl border border-surfaceHighlight">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center font-bold text-primary-400 border border-zinc-700">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.name}</p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
            <button onClick={onLogout} className="text-zinc-500 hover:text-red-400 transition" title="Sair" aria-label="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto space-y-8 pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-lg border-t border-surfaceHighlight flex justify-around p-3 z-30 pb-6 pt-3 shadow-2xl">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
              currentView === item.id ? 'text-primary-400 scale-105' : 'text-zinc-500'
            }`}
          >
            <item.icon size={24} className={currentView === item.id ? 'drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : ''} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <button
             onClick={() => onChangeView('settings')}
             className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
                currentView === 'settings' ? 'text-white' : 'text-zinc-500'
             }`}
        >
            <Settings size={24} />
            <span className="text-[10px] font-medium">Ajustes</span>
        </button>
      </div>
    </div>
  );
};