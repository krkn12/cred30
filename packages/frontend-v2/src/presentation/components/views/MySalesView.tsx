import { useState, useEffect } from 'react';
import {
    Package,
    ArrowLeft,
    Clock,
    CheckCircle,
    Bike,
    Store,
    ShoppingBag,
    ChefHat,
    RefreshCw,
    Settings
} from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import { LoadingScreen } from '../ui/LoadingScreen';

interface MySalesViewProps {
    onBack: () => void;
    formatCurrency: (value: number) => string;
    onOpenSettings: () => void;
}

export const MySalesView = ({ onBack, formatCurrency, onOpenSettings }: MySalesViewProps) => {
    const [sales, setSales] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'preparing' | 'ready' | 'shipped' | 'completed'>('pending');
    const [isPaused, setIsPaused] = useState(false);
    const [isTogglingPause, setIsTogglingPause] = useState(false);
    const [lastOrdersCount, setLastOrdersCount] = useState<number | null>(null);

    const playNotificationSound = () => {
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => console.log('Audio playback blocked by browser'));
        } catch (e) {
            console.error('Error playing sound', e);
        }
    };

    const fetchSales = async () => {
        setIsLoading(true);
        try {
            const res = await apiService.marketplace.getMySales();
            if (res.success) {
                const currentSales = res.data || [];

                // Se o número de pedidos pendentes aumentou, toca o som
                const currentPending = currentSales.filter((s: any) => s.delivery_status === 'AVAILABLE' || s.status === 'PENDING').length;
                if (lastOrdersCount !== null && currentPending > lastOrdersCount) {
                    playNotificationSound();
                }

                console.log('DEBUG: MySalesView sales data:', currentSales); // DEBUG LOG
                setSales(currentSales);
                setLastOrdersCount(currentPending);
            }
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSales();
        fetchSellerStatus();

        // Polling para novos pedidos (a cada 30 segundos)
        const interval = setInterval(() => {
            fetchSales();
        }, 30000);

        return () => clearInterval(interval);
    }, [lastOrdersCount]);

    const fetchSellerStatus = async () => {
        try {
            const status = await apiService.marketplace.getSellerStatus();
            if (status.success) {
                setIsPaused(status.isPaused);
            }
        } catch (error) {
            console.error('Error fetching seller status:', error);
        }
    };

    const handleTogglePause = async () => {
        try {
            setIsTogglingPause(true);
            const nextState = !isPaused;
            const res = await apiService.marketplace.toggleStorePause(nextState);
            if (res.success) {
                setIsPaused(nextState);
            }
        } catch (error) {
            console.error('Error toggling store pause:', error);
        } finally {
            setIsTogglingPause(false);
        }
    };

    const handleUpdateStatus = async (orderId: number, status: 'PREPARING' | 'READY_FOR_PICKUP') => {
        try {
            setIsLoading(true);
            const res = await apiService.marketplace.updateFoodOrderStatus(orderId, status);
            if (res.success) {
                await fetchSales();
            }
        } catch (error) {
            console.error('Error updating status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getTabCount = (tabId: string) => {
        return sales.filter(s => {
            if (tabId === 'pending') return s.status === 'PAYMENT_CONFIRMED' && !s.delivery_status;
            if (tabId === 'preparing') return s.status === 'PREPARING';
            if (tabId === 'ready') return s.status === 'WAITING_SHIPPING' && s.delivery_status === 'AVAILABLE';
            if (tabId === 'shipped') return s.status === 'SHIPPED';
            if (tabId === 'completed') return s.status === 'DELIVERED';
            return false;
        }).length;
    };

    const filteredSales = sales.filter(sale => {
        if (filter === 'pending') return sale.status === 'PAYMENT_CONFIRMED' && !sale.delivery_status;
        if (filter === 'preparing') return sale.status === 'PREPARING';
        if (filter === 'ready') return sale.status === 'WAITING_SHIPPING' && sale.delivery_status === 'AVAILABLE';
        if (filter === 'shipped') return sale.status === 'SHIPPED';
        if (filter === 'completed') return sale.status === 'DELIVERED';
        return true;
    });

    if (isLoading && sales.length === 0) return <LoadingScreen message="Carregando suas vendas..." />;

    return (
        <div className="flex flex-col min-h-screen bg-black animate-in fade-in duration-300">
            {/* Header Estilo Dashboard */}
            <div className="p-4 bg-zinc-900/50 border-b border-zinc-800 sticky top-0 z-20 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-800/50 rounded-xl">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tighter">GESTÃO DE VENDAS</h2>
                            <button
                                onClick={handleTogglePause}
                                disabled={isTogglingPause}
                                className={`flex items-center gap-2 mt-1 px-2 py-0.5 rounded-full border transition-all active:scale-95 ${isPaused
                                    ? 'bg-red-500/10 border-red-500/20 text-red-500'
                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                                <span className="text-[9px] font-black uppercase tracking-widest">
                                    {isPaused ? 'Loja Pausada' : 'Loja Aberta'}
                                </span>
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onOpenSettings} className="p-2 text-zinc-400 hover:text-white transition-all bg-zinc-800/50 rounded-xl flex items-center gap-2 border border-zinc-700/50">
                            <Settings size={18} />
                            <span className="text-[10px] font-black uppercase">Configurar</span>
                        </button>
                        <button onClick={fetchSales} className="p-2 text-primary-400 hover:bg-primary-500/10 rounded-xl transition-all active:rotate-180 duration-500">
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {[
                        { id: 'pending', label: 'Novos', icon: ShoppingBag, color: 'text-blue-400' },
                        { id: 'preparing', label: 'Cozinha', icon: ChefHat, color: 'text-orange-400' },
                        { id: 'ready', label: 'Prontos', icon: Bike, color: 'text-primary-400' },
                        { id: 'shipped', label: 'Em Rota', icon: Package, color: 'text-purple-400' },
                        { id: 'completed', label: 'Finalizados', icon: CheckCircle, color: 'text-emerald-400' },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = filter === tab.id;
                        const count = getTabCount(tab.id);

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${isActive
                                    ? 'bg-primary-500 border-primary-500 text-black shadow-xl shadow-primary-500/20 scale-105'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:border-zinc-700'}`}
                            >
                                <Icon size={14} className={isActive ? 'text-black' : tab.color} />
                                {tab.label}
                                {count > 0 && (
                                    <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-black text-white' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="p-4 space-y-4 pb-32">
                {filteredSales.length === 0 ? (
                    <div className="text-center py-24 bg-zinc-900/20 rounded-[3rem] border border-dashed border-zinc-800">
                        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-800">
                            <Package size={40} className="text-zinc-700" />
                        </div>
                        <h3 className="text-white font-black text-lg">TUDO LIMPO POR AQUI!</h3>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2 px-10">Nenhum pedido encontrado nesta categoria no momento.</p>
                    </div>
                ) : (
                    filteredSales.map(order => (
                        <div key={order.id} className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-6 space-y-5 hover:bg-zinc-900/60 transition-all group">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-white font-black text-xl tracking-tighter">Pedido #{order.id}</h3>
                                        <span className="bg-zinc-800 text-zinc-500 text-[8px] font-black px-2 py-0.5 rounded-full border border-zinc-700 uppercase tracking-widest">
                                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                        Comprador ID: {order.buyer_id}
                                    </p>
                                </div>
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-black text-[9px] uppercase tracking-wider ${order.status === 'PREPARING' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                                    order.status === 'WAITING_SHIPPING' ? 'bg-primary-500/10 border-primary-500/20 text-primary-500' :
                                        order.status === 'SHIPPED' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                                            order.status === 'DELIVERED' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                                'bg-zinc-800 border-zinc-700 text-zinc-500'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${order.status === 'PREPARING' ? 'bg-orange-500' :
                                        order.status === 'WAITING_SHIPPING' ? 'bg-primary-500' :
                                            'bg-zinc-500'
                                        }`} />
                                    {order.status === 'PAYMENT_CONFIRMED' ? 'Aguardando Início' : order.status}
                                </div>
                            </div>

                            <div className="flex gap-4 p-4 bg-black/40 rounded-3xl border border-zinc-800/50 group-hover:bg-black/60 transition-all">
                                <div className="w-16 h-16 bg-zinc-800 rounded-2xl overflow-hidden flex-shrink-0 border border-zinc-700">
                                    <img src={order.listing_image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200"} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <h4 className="text-white text-base font-bold truncate tracking-tight">{order.listing_title}</h4>
                                    <div className="flex items-center gap-3">
                                        <span className="text-primary-400 text-xs font-black">{formatCurrency(order.amount)}</span>
                                        <span className="text-zinc-500 text-[10px] font-bold">Qtd: {order.quantity || 1}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Detalhes da Entrega */}
                            <div className="flex flex-wrap gap-4 pt-2">
                                <div className="flex items-center gap-2 bg-zinc-800/30 px-3 py-1.5 rounded-full border border-zinc-800">
                                    {order.delivery_type === 'COURIER_REQUEST' ? <Bike size={14} className="text-primary-500" /> : <Store size={14} className="text-orange-400" />}
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                        {order.delivery_type === 'COURIER_REQUEST' ? 'Delivery Parceiro' : 'Retirada no Local'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 bg-zinc-800/30 px-3 py-1.5 rounded-full border border-zinc-800">
                                    <Clock size={14} className="text-blue-400" />
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                        Hoje às {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>

                            {/* Ações Dinâmicas */}
                            <div className="grid grid-cols-1 gap-3 pt-2">
                                {order.status === 'PAYMENT_CONFIRMED' && order.is_food && (
                                    <button
                                        onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                                        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-orange-600/10 flex items-center justify-center gap-2"
                                    >
                                        <ChefHat size={16} />
                                        Começar Preparo
                                    </button>
                                )}
                                {order.status === 'PREPARING' && (
                                    <button
                                        onClick={() => handleUpdateStatus(order.id, 'READY_FOR_PICKUP')}
                                        className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-primary-500/20 flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle size={16} />
                                        Pronto para Retirada
                                    </button>
                                )}
                                {order.status === 'WAITING_SHIPPING' && order.delivery_status === 'AVAILABLE' && (
                                    <div className="w-full bg-zinc-800/50 border border-zinc-700 py-4 rounded-2xl flex items-center justify-center gap-3">
                                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-ping"></div>
                                        <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest italic">Aguardando Entregador...</span>
                                    </div>
                                )}
                            </div>

                            {order.courier_id && (
                                <div className="mt-4 p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-700 border border-zinc-600">
                                            <img
                                                src={order.courier_photo || `https://ui-avatars.com/api/?name=${order.courier_name}&background=random`}
                                                alt={order.courier_name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Entregador Responsável</p>
                                            <h5 className="text-white font-bold text-sm truncate">{order.courier_name}</h5>
                                        </div>
                                        <a
                                            href={`https://wa.me/${order.courier_phone?.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all active:scale-95"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                        </a>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-zinc-900/50 rounded-xl p-2 border border-zinc-800/50">
                                            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Veículo</p>
                                            <div className="flex items-center gap-2">
                                                <Bike size={12} className="text-primary-500" />
                                                <span className="text-xs text-zinc-300 font-bold truncate">{order.courier_vehicle_model || 'Não informado'}</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 bg-zinc-900/50 rounded-xl p-2 border border-zinc-800/50">
                                            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Placa</p>
                                            <span className="text-xs text-zinc-300 font-mono font-bold">{order.courier_vehicle_plate || '---'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
