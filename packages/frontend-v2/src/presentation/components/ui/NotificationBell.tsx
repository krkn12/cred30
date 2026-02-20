import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCircle2, AlertTriangle, Info, Trash2, Package, DollarSign, CreditCard } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'PAYMENT' | 'ORDER' | 'DELIVERY';
    read: boolean;
    date: number;
}

export const NotificationBell: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasUnread, setHasUnread] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Carregar do localStorage ao iniciar
    // Carregar do localStorage e API ao iniciar
    useEffect(() => {
        console.info('[🔔 Sino] Componente montado no DOM.');

        // 1. Carregar cache local primeiro (Instantâneo)
        const saved = localStorage.getItem('user_notifications');
        if (saved) {
            try {
                const parsed = JSON.parse(saved) || [];
                setNotifications(parsed);
                setUnreadCount(parsed.filter((n: Notification) => !n.read).length);
            } catch (e) { /* ignore */ }
        }

        // 2. Buscar histórico fresquinho do servidor
        apiService.getNotifications()
            .then(response => {
                if (response.success && response.data) {
                    setNotifications(prev => {
                        // Mesclar: Prioriza o que veio do servidor, mas mantém novos SSE que chegaram nesse meio tempo
                        const serveIds = new Set(response.data.map((n: any) => n.id));
                        const uniqueLocal = prev.filter(n => !serveIds.has(n.id));
                        const merged = [...uniqueLocal, ...response.data]
                            .sort((a, b) => b.date - a.date)
                            .slice(0, 50);

                        localStorage.setItem('user_notifications', JSON.stringify(merged));

                        const unread = merged.filter((n: Notification) => !n.read).length;
                        setHasUnread(unread > 0);
                        setUnreadCount(unread);
                        return merged;
                    });
                    console.info('[🔔 Sino] Histórico do servidor sincronizado.');
                }
            })
            .catch(err => console.error('[🔔 Sino] Erro ao buscar histórico:', err));

        // 3. Conectar ao SSE
        console.info('[🔔 Sino] Iniciando escuta de notificações via SSE...');
        const cleanup = apiService.listenToNotifications((data) => {
            console.log('🚀 [🔔 Sino] EVENTO RECEBIDO:', data);

            const newNotif: Notification = {
                id: Date.now().toString(), // Temp ID até persistir
                title: data.title || 'Nova Notificação',
                message: data.body || data.message || '',
                type: data.type === 'PAYMENT' ? 'PAYMENT' :
                    data.type === 'ORDER' ? 'ORDER' :
                        data.type === 'DELIVERY' ? 'DELIVERY' :
                            data.type === 'ALERT' ? 'WARNING' :
                                data.type === 'SUCCESS' ? 'SUCCESS' : 'INFO',
                read: false,
                date: Date.now()
            };

            setNotifications(prev => {
                const updated = [newNotif, ...prev].slice(0, 50);
                localStorage.setItem('user_notifications', JSON.stringify(updated));
                return updated;
            });
            setHasUnread(true);
            setUnreadCount(prev => prev + 1);

            // Vibração e Som
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            try { new Audio('/notification.mp3').play().catch((e) => { console.debug('Audio play blocked:', e); }); } catch (e) { console.debug('Audio init failed:', e); }
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
        setUnreadCount(0);
        localStorage.setItem('user_notifications', JSON.stringify(updated));

        // Sincronizar com Backend
        apiService.markNotificationRead('all').catch(console.error);
    };

    const clearAll = () => {
        setNotifications([]);
        setHasUnread(false);
        setUnreadCount(0);
        localStorage.removeItem('user_notifications');

        // Deletar permanentemente do banco
        apiService.deleteNotification('all').then(() => {
            console.info('[🔔 Sino] Lixeira esvaziada no servidor.');
        }).catch(err => {
            console.error('[🔔 Sino] Falha ao limpar notificações:', err);
        });
    };

    const markAsRead = (id: string) => {
        const updated = notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
        );
        setNotifications(updated);
        const unread = updated.filter((n: Notification) => !n.read).length;
        setHasUnread(unread > 0);
        setUnreadCount(unread);
        localStorage.setItem('user_notifications', JSON.stringify(updated));

        // Sincronizar com Backend
        apiService.markNotificationRead(id).catch(console.error);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'SUCCESS': return <CheckCircle2 size={20} className="text-emerald-400" />;
            case 'WARNING': return <AlertTriangle size={20} className="text-amber-400" />;
            case 'ERROR': return <X size={20} className="text-red-400" />;
            case 'PAYMENT': return <DollarSign size={20} className="text-green-400" />;
            case 'ORDER': return <Package size={20} className="text-primary-400" />;
            case 'DELIVERY': return <CreditCard size={20} className="text-blue-400" />;
            default: return <Info size={20} className="text-blue-400" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'SUCCESS': return 'bg-emerald-500/10 border-emerald-500/20';
            case 'WARNING': return 'bg-amber-500/10 border-amber-500/20';
            case 'ERROR': return 'bg-red-500/10 border-red-500/20';
            case 'PAYMENT': return 'bg-green-500/10 border-green-500/20';
            case 'ORDER': return 'bg-primary-500/10 border-primary-500/20';
            case 'DELIVERY': return 'bg-blue-500/10 border-blue-500/20';
            default: return 'bg-blue-500/10 border-blue-500/20';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    relative w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95
                    ${hasUnread
                        ? 'bg-primary-500/20 border border-primary-500/30 text-primary-400 shadow-lg shadow-primary-500/20'
                        : 'bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/5 text-zinc-400 hover:text-white'}
                `}
            >
                <Bell size={24} />
                {hasUnread && (
                    <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 animate-bounce">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] md:bg-transparent md:backdrop-blur-none"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="absolute bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-4 md:top-20 w-full md:w-[400px] max-h-[85vh] md:max-h-[70vh] bg-[#0A0A0A] border-t md:border border-white/10 rounded-t-[2rem] md:rounded-2xl shadow-2xl overflow-hidden flex flex-col pb-[var(--safe-bottom)] md:pb-0 animate-in slide-in-from-bottom-full md:slide-in-from-top-2 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle for Mobile */}
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto my-3 md:hidden opacity-50" />

                        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-10">
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-white">Notificações</h3>
                                {hasUnread && (
                                    <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 text-[10px] font-bold rounded-full">
                                        {unreadCount}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {notifications.length > 0 && (
                                    <button
                                        onClick={clearAll}
                                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Limpar tudo"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 text-zinc-500 hover:text-white bg-white/5 rounded-lg md:hidden"
                                >
                                    <X size={20} />
                                </button>
                                {hasUnread && (
                                    <button
                                        onClick={markAllRead}
                                        className="hidden md:block px-3 py-1.5 text-[11px] bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg transition-colors font-bold"
                                    >
                                        Marcar lidas
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-16 text-center text-zinc-500 flex flex-col items-center">
                                    <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                                        <Bell size={32} className="opacity-30" />
                                    </div>
                                    <p className="text-sm font-bold">Tudo limpo por aqui!</p>
                                    <p className="text-[11px] text-zinc-600 mt-1 max-w-[200px] mx-auto">Você não tem notificações no momento.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5 pb-20 md:pb-0">
                                    {notifications.map(notif => (
                                        <div
                                            key={notif.id}
                                            onClick={() => {
                                                markAsRead(notif.id);
                                                // setIsOpen(false); // Manter aberto para ler outras?
                                            }}
                                            className={`
                                                p-4 cursor-pointer transition-all duration-200
                                                ${!notif.read ? 'bg-primary-500/5 hover:bg-primary-500/10' : 'hover:bg-white/5'}
                                            `}
                                        >
                                            <div className="flex gap-4 items-start">
                                                <div className={`
                                                    w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-lg
                                                    ${getTypeColor(notif.type)}
                                                `}>
                                                    {getIcon(notif.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <h4 className={`text-sm font-extrabold tracking-tight ${!notif.read ? 'text-white' : 'text-zinc-500'}`}>
                                                            {notif.title}
                                                        </h4>
                                                        <span className="text-[10px] text-zinc-600 font-bold shrink-0">
                                                            {new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className={`text-[11px] leading-relaxed ${!notif.read ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                                        {notif.message}
                                                    </p>
                                                </div>
                                                {!notif.read && (
                                                    <div className="w-2.5 h-2.5 rounded-full bg-primary-500 shrink-0 mt-1.5 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {hasUnread && (
                                        <div className="p-4 md:hidden">
                                            <button
                                                onClick={markAllRead}
                                                className="w-full py-4 bg-primary-500 text-black font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-primary-500/20 active:scale-95 transition-all"
                                            >
                                                Marcar Todas como Lidas
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
