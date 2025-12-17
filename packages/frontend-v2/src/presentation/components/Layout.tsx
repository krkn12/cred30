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
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'invest', label: 'Investir', icon: '💰' },
    { id: 'portfolio', label: 'Carteira', icon: '💼' },
    { id: 'loans', label: 'Empréstimos', icon: '💸' },
    { id: 'withdraw', label: 'Saques', icon: '💳' },
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
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === item.id
                      ? 'bg-primary-500 text-black'
                      : 'text-zinc-300 hover:text-white hover:bg-surfaceHighlight'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
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
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
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
              className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium transition-colors ${
                currentView === item.id
                  ? 'bg-primary-500 text-black'
                  : 'text-zinc-300 hover:text-white hover:bg-surfaceHighlight'
              }`}
            >
              <span className="mr-2">{item.icon}</span>
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