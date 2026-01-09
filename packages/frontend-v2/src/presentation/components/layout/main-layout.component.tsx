import { LogOut, Home, PieChart, DollarSign, Settings, TrendingUp, ArrowUpFromLine, Gamepad2, ShoppingBag, HelpCircle, Play, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../../domain/types/common.types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  currentView: string;
  onChangeView: (view: any) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, currentView, onChangeView, onLogout }) => {
  const navigate = useNavigate();

  const handleNavigation = (view: string) => {
    onChangeView(view);
    navigate(`/app/${view}`);
  }

  if (!user) return <div className="min-h-screen bg-background text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">{children}</div>;

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'deposit', label: 'Aportar', icon: DollarSign },
    { id: 'marketplace', label: 'Clube', icon: ShoppingBag },
    { id: 'promo-videos', label: 'Views', icon: Play },
    { id: 'invest', label: 'Ativação', icon: TrendingUp },
    { id: 'games', label: 'Diversão', icon: Gamepad2 },
    { id: 'portfolio', label: 'Participações', icon: PieChart },
    { id: 'loans', label: 'Apoio', icon: DollarSign },
    { id: 'withdraw', label: 'Resgatar', icon: ArrowUpFromLine },
    { id: 'faq', label: 'Dúvidas', icon: HelpCircle },
  ];

  // Adicionar Admin ao menu se for staff
  const isAdmin = user.isAdmin || user.role?.toUpperCase() === 'ADMIN' || user.role?.toUpperCase() === 'ATTENDANT';
  if (isAdmin) {
    navItems.splice(1, 0, { id: 'admin', label: 'Admin', icon: ShieldCheck });
  }

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col md:flex-row font-sans overflow-x-hidden">
      {/* Mobile Top Bar - Ultra Clean */}
      <div className="md:hidden bg-background/80 backdrop-blur-xl border-b border-white/5 p-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-500/10 rounded-xl flex items-center justify-center border border-primary-500/20 shadow-lg shadow-primary-500/10">
            <img src="/pwa-192x192.png" alt="Cred30" className="w-7 h-7 rounded-lg" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tighter">Cred<span className="text-primary-400">30</span></h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest leading-none mb-1">Saldo</span>
            <span className="text-sm font-black text-emerald-400">
              {user.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <button
            onClick={() => handleNavigation('settings')}
            className={`p-2 rounded-xl transition-all ${currentView === 'settings' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' : 'bg-white/5 text-zinc-400 border border-white/5'}`}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-surface border-r border-surfaceHighlight h-screen sticky top-0">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 tracking-tighter">
            <img src="/pwa-192x192.png" alt="Cred30 Logo" className="w-10 h-10 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)]" />
            Cred<span className="text-primary-400">30</span>
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-4 text-sm font-medium rounded-xl transition-all duration-200 ${currentView === item.id
                ? 'bg-primary-400/10 text-primary-400 border border-primary-400/20'
                : 'text-zinc-400 hover:bg-surfaceHighlight hover:text-white group'
                }`}
            >
              <item.icon size={22} className={currentView === item.id ? 'stroke-[2.5px]' : 'group-hover:scale-110 transition-transform'} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-surfaceHighlight">
          <button
            onClick={() => handleNavigation('settings')}
            className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-medium rounded-xl transition-colors mb-4 ${currentView === 'settings' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Settings size={20} />
            Configurações
          </button>
          <div className="flex items-center gap-3 px-4 py-3 bg-surfaceHighlight/30 rounded-2xl border border-white/5 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/20 to-zinc-900 flex items-center justify-center font-black text-primary-400 border border-primary-500/20">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white truncate">{user.name}</p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
            <button onClick={onLogout} className="text-zinc-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-400/10" title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-y-auto bg-background no-scrollbar">
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-32 sm:pb-8">
          {children}

          <footer className="mt-16 pt-8 border-t border-white/5 text-center space-y-4">
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                Cred30 © 2024 • Sistema de Cooperação Mutuária
              </p>
              <div className="flex justify-center gap-6">
                <button onClick={() => navigate('/terms')} className="text-[10px] text-zinc-400 hover:text-primary-400 font-bold uppercase transition-colors">Termos</button>
                <button onClick={() => navigate('/privacy')} className="text-[10px] text-zinc-400 hover:text-primary-400 font-bold uppercase transition-colors">Privacidade</button>
              </div>
            </div>
            <p className="text-[9px] text-zinc-600 max-w-lg mx-auto leading-relaxed italic px-4">
              O Cred30 baseia-se no Código Civil Brasileiro (Artigos 991-996). Não realizamos intermediação financeira restrita a instituições bancárias.
            </p>
          </footer>
        </div>
      </main>

      {/* Mobile Bottom Nav - Premium Floating Dock */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50">
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] flex justify-between items-center px-2 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
          {[
            { id: 'dashboard', label: 'Início', icon: Home },
            { id: 'invest', label: 'Investir', icon: TrendingUp },
            { id: 'marketplace', label: 'Clube', icon: ShoppingBag },
            { id: 'earn', label: 'Ganhos', icon: DollarSign },
            { id: 'withdraw', label: 'Saque', icon: ArrowUpFromLine },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 transition-all duration-300 relative ${currentView === item.id
                ? 'text-primary-400'
                : 'text-zinc-500'
                }`}
            >
              <div className={`p-2 rounded-2xl transition-all duration-500 ${currentView === item.id
                ? 'bg-primary-500/15 shadow-[0_0_20px_rgba(34,211,238,0.15)] scale-110 active-scale'
                : 'hover:bg-white/5 active-scale'}`}>
                <item.icon size={20} strokeWidth={currentView === item.id ? 2.5 : 2} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-tighter transition-all duration-300 ${currentView === item.id ? 'opacity-100' : 'opacity-0 scale-75'}`}>
                {item.label}
              </span >
              {currentView === item.id && (
                <div className="absolute -bottom-1 w-1 h-1 bg-primary-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,1)] animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};