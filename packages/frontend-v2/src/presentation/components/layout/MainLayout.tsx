import React, { ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  HandCoins,
  Wallet,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  X,
  Store
} from 'lucide-react';

interface LayoutProps {
  user: any;
  currentView: string;
  onChangeView: (view: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  user,
  currentView,
  onChangeView,
  onLogout,
  children
}) => {
  const isAdmin = user?.isAdmin || user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'ATTENDANT';
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Painel', Icon: LayoutDashboard },
    { id: 'invest', label: 'Participar', Icon: Users },
    { id: 'portfolio', label: 'Carteira', Icon: Briefcase },
    { id: 'loans', label: 'Ajuda', Icon: HandCoins },
    { id: 'withdraw', label: 'Resgates', Icon: Wallet },
    { id: 'pdv', label: 'Vendas (PDV)', Icon: Store },
    ...(isAdmin ? [{ id: 'admin', label: 'Gestão', Icon: ShieldCheck }] : []),
    { id: 'settings', label: 'Ajustes', Icon: Settings },
  ];

  // Itens que aparecem no Dock Inferior (Mobile)
  const dockItems = menuItems.filter(item =>
    ['dashboard', 'invest', 'portfolio', 'withdraw'].includes(item.id)
  );

  return (
    <div className="min-h-screen bg-background text-white selection:bg-primary-500/30">
      {/* Header Fixo */}
      <header className="sticky top-0 z-40 w-full glass border-b border-white/5 pt-safe">
        <div className="container-responsive h-16 sm:h-20 flex items-center justify-between">
          {/* Logo & Nome */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-2xl flex items-center justify-center text-black shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-float">
              <span className="font-black text-sm">C30</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black tracking-tighter">Cred<span className="text-primary-400">30</span></h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] -mt-1">Comunidade Mútua</p>
            </div>
          </div>

          {/* Nav Desktop */}
          <nav className="hidden md:flex items-center gap-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`relative px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 group ${currentView === item.id
                  ? 'text-primary-400 bg-white/5 border border-white/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
              >
                <item.Icon size={16} className={currentView === item.id ? "animate-pulse" : "group-hover:scale-110 transition-transform"} />
                {item.label}
                {currentView === item.id && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-400 rounded-full shadow-[0_0_10px_#06b6d4]" />
                )}
              </button>
            ))}
          </nav>

          {/* Ações / Perfil */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-xs font-black uppercase tracking-wider">{user?.name?.split(' ')[0] || 'Membro'}</span>
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{user?.role || 'CLIENTE'}</span>
            </div>

            <button
              onClick={onLogout}
              className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 transition-all active:scale-95"
              title="Sair"
            >
              <LogOut size={18} />
            </button>

            {/* Menu Hambúrguer (Apenas para itens que não estão no dock ou admin) */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-3 glass glass-hover rounded-2xl border border-white/10"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Menu Mobile Overlay (Hambúrguer) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-30 md:hidden animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
          <nav className="absolute top-20 right-4 w-64 glass-strong rounded-[2.5rem] p-4 border border-white/10 shadow-2xl animate-in slide-in-from-top-4 duration-500">
            <div className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onChangeView(item.id);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all ${currentView === item.id
                    ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20'
                    : 'text-zinc-400 hover:bg-white/5'
                    }`}
                >
                  <item.Icon size={20} />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}

      {/* Mobile Dock (Bottom Navigation) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-t border-white/5 pb-safe animate-in slide-in-from-bottom-full duration-700">
        <div className="flex items-center justify-around h-20 px-4">
          {dockItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative ${currentView === item.id ? 'text-primary-400 scale-110' : 'text-zinc-500'
                }`}
            >
              <div className={`p-2 rounded-xl transition-all ${currentView === item.id ? 'bg-primary-500/10' : 'bg-transparent'}`}>
                <item.Icon size={22} strokeWidth={currentView === item.id ? 2.5 : 2} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
              {currentView === item.id && (
                <div className="absolute -top-1 w-12 h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent blur-[2px]" />
              )}
            </button>
          ))}
          {/* Botão "Mais" que abre o admin ou configurações no mobile */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${isMenuOpen ? 'text-primary-400 scale-110' : 'text-zinc-500'
              }`}
          >
            <div className="p-2 rounded-xl">
              <Menu size={22} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">Mais</span>
          </button>
        </div>
      </nav>

      {/* Conteúdo Principal */}
      <main className="container-responsive py-6 sm:py-10 pb-32 md:pb-10 min-h-[calc(100vh-80px)]">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {children}
        </div>
      </main>

      {/* Overlay de carregamento global ou toasts poderiam ficar aqui */}
    </div>
  );
};
