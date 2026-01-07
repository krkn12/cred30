import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCircle2, AlertTriangle, Info, Trash2 } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    read: boolean;
    date: number;
}

export const NotificationBell: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasUnread, setHasUnread] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Carregar do localStorage ao iniciar
    useEffect(() => {
        const saved = localStorage.getItem('user_notifications');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setNotifications(parsed);
                setHasUnread(parsed.some((n: Notification) => !n.read));
            } catch (e) { console.error('Error loading notifications', e); }
        }

        // Conectar ao SSE
        const cleanup = apiService.listenToNotifications((data) => {
            const newNotif: Notification = {
                id: Date.now().toString(),
                title: data.title || 'Nova Notificação',
                message: data.body || data.message || '',
                type: data.type === 'ALERT' ? 'WARNING' : (data.type === 'SUCCESS' ? 'SUCCESS' : 'INFO'),
                read: false,
                date: Date.now()
            };

            setNotifications(prev => {
                const updated = [newNotif, ...prev].slice(0, 50); // Manter ultimas 50
                localStorage.setItem('user_notifications', JSON.stringify(updated));
                return updated;
            });
            setHasUnread(true);

            // Tocar som suave
            try { new Audio('/notification.mp3').play().catch(() => { }); } catch { }
        });

        return cleanup;
    }, []);

    // Fechar ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAllRead = () => {
        const updated = notifications.map(n => ({ ...n, read: true }));
        setNotifications(updated);
        setHasUnread(false);
        localStorage.setItem('user_notifications', JSON.stringify(updated));
    };

    const clearAll = () => {
        setNotifications([]);
        setHasUnread(false);
        localStorage.removeItem('user_notifications');
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'SUCCESS': return <CheckCircle2 size={16} className="text-emerald-400" />;
            case 'WARNING': return <AlertTriangle size={16} className="text-amber-400" />;
            case 'ERROR': return <X size={16} className="text-red-400" />;
            default: return <Info size={16} className="text-blue-400" />;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative w-10 h-10 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/5 flex items-center justify-center transition-all active:scale-95 text-zinc-400 hover:text-white"
            >
                <Bell size={20} />
                {hasUnread && (
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-12 w-80 sm:w-96 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                        <h3 className="text-sm font-bold text-white">Notificações</h3>
                        <div className="flex gap-3">
                            {notifications.length > 0 && (
                                <button onClick={clearAll} className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1">
                                    <Trash2 size={12} /> Limpar
                                </button>
                            )}
                            {hasUnread && (
                                <button onClick={markAllRead} className="text-[10px] text-primary-400 hover:text-primary-300 transition-colors font-bold">
                                    Marcar lidas
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500 flex flex-col items-center">
                                <Bell size={32} className="opacity-20 mb-3" />
                                <p className="text-xs">Nenhuma notificação por enquanto.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {notifications.map(notif => (
                                    <div key={notif.id} className={`p-4 hover:bg-white/5 transition-colors ${!notif.read ? 'bg-primary-500/5' : ''}`}>
                                        <div className="flex gap-3 items-start">
                                            <div className="mt-0.5 shrink-0">
                                                {getIcon(notif.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2 mb-0.5">
                                                    <h4 className={`text-xs font-bold ${!notif.read ? 'text-white' : 'text-zinc-400'}`}>
                                                        {notif.title}
                                                    </h4>
                                                    <span className="text-[9px] text-zinc-600 shrink-0">
                                                        {new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-zinc-500 leading-relaxed break-words">
                                                    {notif.message}
                                                </p>
                                            </div>
                                            {!notif.read && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0 mt-1.5" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
