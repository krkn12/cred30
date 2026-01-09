import React, { ReactNode } from 'react';

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

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'invest', label: 'Participar', icon: '🤝' },
    { id: 'portfolio', label: 'Participação', icon: '💼' },
    { id: 'loans', label: 'Apoio Mútuo', icon: '💸' },
    { id: 'withdraw', label: 'Resgates', icon: '💳' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: '🛡️' }] : []),
    { id: 'settings', label: 'Configurações', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-surfaceHighlight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-black font-bold">
                C30
              </div>
              <span className="ml-3 text-xl font-bold text-white">Cred30</span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-8">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onChangeView(item.id)}
                  className={`px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center gap-2 ${currentView === item.id
                    ? 'bg-zinc-800 text-primary-400 shadow-2xl shadow-black border border-white/5 scale-[1.05]'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    }`}
                >
                  <span className={currentView === item.id ? "animate-pulse" : ""}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-zinc-300">
                {user?.name || 'Usuário'}
              </span>
              <button
                onClick={onLogout}
                className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 border border-red-500/20 active:scale-95 flex items-center gap-2"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <div className="md:hidden border-b border-surfaceHighlight">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`block w-full text-left px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-3 mb-2 ${currentView === item.id
                ? 'bg-zinc-800 text-primary-400 border border-white/5 shadow-xl'
                : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
            >
              <span className={currentView === item.id ? "animate-pulse" : ""}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};