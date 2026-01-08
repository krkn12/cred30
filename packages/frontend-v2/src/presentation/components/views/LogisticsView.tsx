import { useState, useEffect } from 'react';
import {
    Truck, Package, Phone, Clock, CheckCircle, XCircle,
    ArrowRight, Loader2, DollarSign, Star, AlertCircle, RefreshCw,
    Navigation, User, Store, Map as MapIcon
} from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import { OrderTrackingMap } from '../features/marketplace/OrderTrackingMap';

interface Delivery {
    orderId: number;
    itemTitle: string;
    itemPrice: number;
    imageUrl?: string;
    deliveryFee: number;
    courierEarnings: string;
    deliveryAddress: string;
    pickupAddress: string;
    contactPhone?: string;
    sellerName: string;
    sellerId: number;
    buyerName: string;
    buyerId: number;
    createdAt: string;
    deliveryStatus?: string;
    orderStatus?: string;
    pickedUpAt?: string;
    deliveredAt?: string;
}

interface DeliveryStats {
    completedDeliveries: number;
    inProgressDeliveries: number;
    totalEarned: string;
    avgEarningPerDelivery: string;
}

type Tab = 'available' | 'active' | 'history';

export const LogisticsView = () => {
    const [activeTab, setActiveTab] = useState<Tab>('available');
    const [availableDeliveries, setAvailableDeliveries] = useState<Delivery[]>([]);
    const [myDeliveries, setMyDeliveries] = useState<Delivery[]>([]);
    const [stats, setStats] = useState<DeliveryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [trackingOrder, setTrackingOrder] = useState<Delivery | null>(null);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            if (activeTab === 'available') {
                const data = await apiService.getAvailableDeliveries();
                setAvailableDeliveries(data);
            } else {
                const status = activeTab === 'active' ? 'active' : 'completed';
                const result = await apiService.getMyDeliveries(status);
                setMyDeliveries(result.deliveries);
            }
            const statsData = await apiService.getDeliveryStats();
            setStats(statsData);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (orderId: number) => {
        setActionLoading(orderId);
        setError(null);
        try {
            const result = await apiService.acceptDelivery(orderId);
            if (result.success) {
                setSuccess(`Entrega aceita! Vá até ${result.data?.pickupAddress} para coletar.`);
                loadData();
            } else {
                setError(result.message || 'Erro ao aceitar entrega');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao aceitar entrega');
        } finally {
            setActionLoading(null);
        }
    };

    const handlePickup = async (orderId: number) => {
        setActionLoading(orderId);
        setError(null);
        try {
            const result = await apiService.confirmPickup(orderId);
            if (result.success) {
                setSuccess('Coleta confirmada! Agora leve até o comprador.');
                loadData();
            } else {
                setError(result.message || 'Erro ao confirmar coleta');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao confirmar coleta');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelivered = async (orderId: number) => {
        setActionLoading(orderId);
        setError(null);
        try {
            const result = await apiService.confirmDelivered(orderId);
            if (result.success) {
                setSuccess('Entrega marcada como concluída! Aguardando confirmação do comprador.');
                loadData();
            } else {
                setError(result.message || 'Erro ao marcar entrega');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao marcar entrega');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancel = async (orderId: number) => {
        if (!confirm('Tem certeza que deseja cancelar esta entrega?')) return;
        setActionLoading(orderId);
        setError(null);
        try {
            const result = await apiService.cancelDelivery(orderId);
            if (result.success) {
                setSuccess('Entrega cancelada.');
                loadData();
            } else {
                setError(result.message || 'Erro ao cancelar');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao cancelar');
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { color: string; label: string }> = {
            'AVAILABLE': { color: 'bg-yellow-500/20 text-yellow-400', label: 'Disponível' },
            'ACCEPTED': { color: 'bg-blue-500/20 text-blue-400', label: 'Aceita' },
            'IN_TRANSIT': { color: 'bg-purple-500/20 text-purple-400', label: 'Em Trânsito' },
            'DELIVERED': { color: 'bg-emerald-500/20 text-emerald-400', label: 'Entregue' },
            'COMPLETED': { color: 'bg-green-500/20 text-green-400', label: 'Concluído' },
        };
        const s = statusMap[status] || { color: 'bg-zinc-500/20 text-zinc-400', label: status };
        return <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${s.color}`}>{s.label}</span>;
    };

    const formatCurrency = (value: number | string) => {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center">
                        <Truck className="w-6 h-6 text-primary-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Entregas</h1>
                        <p className="text-zinc-500 text-sm">Ganhe dinheiro entregando para a comunidade</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="glass p-4 rounded-2xl text-center">
                        <Package size={20} className="text-zinc-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-white">{stats.inProgressDeliveries}</p>
                        <p className="text-xs text-zinc-500">Em Andamento</p>
                    </div>
                    <div className="glass p-4 rounded-2xl text-center">
                        <CheckCircle size={20} className="text-emerald-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-white">{stats.completedDeliveries}</p>
                        <p className="text-xs text-zinc-500">Concluídas</p>
                    </div>
                    <div className="glass p-4 rounded-2xl text-center">
                        <DollarSign size={20} className="text-primary-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-emerald-400">{formatCurrency(stats.totalEarned)}</p>
                        <p className="text-xs text-zinc-500">Total Ganho</p>
                    </div>
                    <div className="glass p-4 rounded-2xl text-center">
                        <Star size={20} className="text-yellow-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-white">{formatCurrency(stats.avgEarningPerDelivery)}</p>
                        <p className="text-xs text-zinc-500">Média/Entrega</p>
                    </div>
                </div>
            )}

            {/* Alerts */}
            {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
                    <p className="text-red-400 text-sm">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                        <XCircle size={18} />
                    </button>
                </div>
            )}
            {success && (
                <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3">
                    <CheckCircle className="text-emerald-400 flex-shrink-0" size={20} />
                    <p className="text-emerald-400 text-sm">{success}</p>
                    <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-300">
                        <XCircle size={18} />
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6 bg-surface p-1 rounded-xl">
                {[
                    { id: 'available' as Tab, label: 'Disponíveis', icon: Package },
                    { id: 'active' as Tab, label: 'Minhas Ativas', icon: Truck },
                    { id: 'history' as Tab, label: 'Histórico', icon: Clock },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                            ? 'bg-primary-500 text-black'
                            : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Refresh Button */}
            <div className="flex justify-end mb-4">
                <button
                    onClick={loadData}
                    disabled={loading}
                    className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
            ) : activeTab === 'available' ? (
                availableDeliveries.length === 0 ? (
                    <div className="text-center py-20">
                        <Package size={48} className="text-zinc-600 mx-auto mb-4" />
                        <p className="text-zinc-400">Nenhuma entrega disponível no momento</p>
                        <p className="text-zinc-600 text-sm mt-2">Volte em breve para ver novas oportunidades!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {availableDeliveries.map(delivery => (
                            <div key={delivery.orderId} className="glass p-5 rounded-2xl">
                                <div className="flex gap-4">
                                    {delivery.imageUrl ? (
                                        <img
                                            src={delivery.imageUrl}
                                            alt={delivery.itemTitle}
                                            className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-20 h-20 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <Package className="text-zinc-600" size={32} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-bold truncate">{delivery.itemTitle}</h3>
                                        <p className="text-zinc-500 text-sm">Valor: {formatCurrency(delivery.itemPrice)}</p>

                                        <div className="mt-3 space-y-1">
                                            <div className="flex items-start gap-2 text-sm">
                                                <Store size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                                                <span className="text-zinc-400">
                                                    <span className="text-zinc-500">Coletar em:</span> {delivery.pickupAddress}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-2 text-sm">
                                                <Navigation size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                                <span className="text-zinc-400">
                                                    <span className="text-zinc-500">Entregar em:</span> {delivery.deliveryAddress}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-zinc-500">Você ganha</p>
                                        <p className="text-xl font-bold text-emerald-400">{formatCurrency(delivery.courierEarnings)}</p>
                                        <p className="text-[10px] text-zinc-600">Taxa: {formatCurrency(delivery.deliveryFee)} (90% p/ você)</p>
                                    </div>
                                    <button
                                        onClick={() => handleAccept(delivery.orderId)}
                                        disabled={actionLoading === delivery.orderId}
                                        className="bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {actionLoading === delivery.orderId ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <>
                                                Aceitar
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                myDeliveries.length === 0 ? (
                    <div className="text-center py-20">
                        <Truck size={48} className="text-zinc-600 mx-auto mb-4" />
                        <p className="text-zinc-400">
                            {activeTab === 'active' ? 'Nenhuma entrega ativa' : 'Nenhuma entrega no histórico'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {myDeliveries.map(delivery => (
                            <div key={delivery.orderId} className="glass p-5 rounded-2xl">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-white font-bold">{delivery.itemTitle}</h3>
                                        <p className="text-xs text-zinc-500">Pedido #{delivery.orderId}</p>
                                    </div>
                                    {getStatusBadge(delivery.deliveryStatus || delivery.orderStatus || 'UNKNOWN')}
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Store size={14} className="text-blue-400" />
                                        <span className="text-zinc-500">Vendedor:</span>
                                        <span className="text-zinc-300">{delivery.sellerName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <User size={14} className="text-emerald-400" />
                                        <span className="text-zinc-500">Comprador:</span>
                                        <span className="text-zinc-300">{delivery.buyerName}</span>
                                    </div>
                                    {delivery.contactPhone && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone size={14} className="text-primary-400" />
                                            <span className="text-zinc-400">{delivery.contactPhone}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between">
                                    <p className="text-emerald-400 font-bold">{formatCurrency(delivery.courierEarnings)}</p>
                                    <div className="flex gap-2">
                                        {delivery.deliveryStatus === 'ACCEPTED' && (
                                            <>
                                                <button
                                                    onClick={() => setTrackingOrder(delivery)}
                                                    className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center"
                                                    title="Ver no Mapa"
                                                >
                                                    <MapIcon size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleCancel(delivery.orderId)}
                                                    disabled={actionLoading === delivery.orderId}
                                                    className="text-red-400 hover:text-red-300 text-sm font-bold py-2 px-4 rounded-lg border border-red-500/20 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={() => handlePickup(delivery.orderId)}
                                                    disabled={actionLoading === delivery.orderId}
                                                    className="bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                                                >
                                                    {actionLoading === delivery.orderId ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        'Coletei o Produto'
                                                    )}
                                                </button>
                                            </>
                                        )}
                                        {delivery.deliveryStatus === 'IN_TRANSIT' && (
                                            <>
                                                <button
                                                    onClick={() => setTrackingOrder(delivery)}
                                                    className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center mr-1"
                                                    title="Ver no Mapa"
                                                >
                                                    <MapIcon size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelivered(delivery.orderId)}
                                                    disabled={actionLoading === delivery.orderId}
                                                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                                                >
                                                    {actionLoading === delivery.orderId ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <>
                                                            <CheckCircle size={16} />
                                                            Entreguei
                                                        </>
                                                    )}
                                                </button>
                                            </>
                                        )}
                                        {delivery.deliveryStatus === 'DELIVERED' && (
                                            <span className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-lg">
                                                ⏳ Aguardando confirmação do comprador
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Info Box */}
            <div className="mt-8 bg-zinc-900 border border-white/5 rounded-2xl p-5">
                <h3 className="text-white font-bold mb-3">💡 Como funciona?</h3>
                <ul className="space-y-2 text-sm text-zinc-400">
                    <li className="flex items-start gap-2">
                        <span className="text-primary-400 font-bold">1.</span>
                        Escolha uma entrega disponível e clique em "Aceitar"
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-primary-400 font-bold">2.</span>
                        Vá até o vendedor e colete o produto
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-primary-400 font-bold">3.</span>
                        Leve até o endereço do comprador e marque como entregue
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-primary-400 font-bold">4.</span>
                        Quando o comprador confirmar, você recebe <span className="text-emerald-400 font-bold">90%</span> do valor do frete
                    </li>
                </ul>
            </div>
            {/* Tracking Modal */}
            {trackingOrder && (
                <OrderTrackingMap
                    orderId={trackingOrder.orderId.toString()}
                    onClose={() => setTrackingOrder(null)}
                    userRole="courier"
                />
            )}
        </div>
    );
};

export default LogisticsView;
