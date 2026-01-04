import { useState, useEffect } from 'react';
import {
    Truck, Package, Phone, Clock, CheckCircle, XCircle,
    Loader2, DollarSign, Star, AlertCircle, RefreshCw,
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

type Tab = 'available' | 'active' | 'history' | 'profile';

export const LogisticsView = () => {
    const [activeTab, setActiveTab] = useState<Tab>('available');
    const [availableDeliveries, setAvailableDeliveries] = useState<Delivery[]>([]);
    const [myDeliveries, setMyDeliveries] = useState<Delivery[]>([]);
    const [stats, setStats] = useState<DeliveryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showTerms, setShowTerms] = useState(false);
    const [isAgreed, setIsAgreed] = useState(localStorage.getItem('logistics_terms_agreed') === 'true');
    const [trackingOrder, setTrackingOrder] = useState<any>(null);

    useEffect(() => {
        if (!isAgreed && activeTab === 'available') {
            setShowTerms(true);
        }
        loadData();
    }, [activeTab, isAgreed]);

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
        const code = prompt('Digite o CÓDIGO DE COLETA fornecido pelo vendedor:');
        if (!code) return;

        setActionLoading(orderId);
        setError(null);
        try {
            const result = await apiService.confirmPickup(orderId, code);
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
        const code = prompt('Digite o CÓDIGO DE CONFIRMAÇÃO fornecido pelo comprador:');
        if (!code) return;

        setActionLoading(orderId);
        setError(null);
        try {
            const result = await apiService.confirmDelivered(orderId, code);
            if (result.success) {
                setSuccess('Entrega marcada como concluída! Saldo liberado.');
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

    const handleAgreeTerms = () => {
        localStorage.setItem('logistics_terms_agreed', 'true');
        setIsAgreed(true);
        setShowTerms(false);
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
                    { id: 'profile' as Tab, label: 'Meu Perfil', icon: User },
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
                                        <p className="text-[10px] text-zinc-600">Taxa: {(100 - ((delivery as any).courierFeeRate * 100))}% p/ você</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setTrackingOrder(delivery)}
                                            className="bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-xl transition-all"
                                            title="Ver no Mapa"
                                        >
                                            <MapIcon size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleAccept(delivery.orderId)}
                                            disabled={actionLoading === delivery.orderId}
                                            className="bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {actionLoading === delivery.orderId ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <>
                                                    <CheckCircle size={18} />
                                                    Aceitar
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : activeTab === 'profile' ? (
                <div className="animate-in fade-in duration-300">
                    <div className="glass p-6 rounded-3xl">
                        <h3 className="text-xl font-bold text-white mb-6">Identificação do Entregador</h3>
                        <p className="text-zinc-400 text-sm mb-8">
                            Complete seu perfil para que vendedores e compradores possam te identificar facilmente.
                            Isso aumenta sua credibilidade e segurança.
                        </p>

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const data = {
                                vehicleType: formData.get('vehicleType'),
                                vehicleModel: formData.get('vehicleModel'),
                                vehiclePlate: formData.get('vehiclePlate'),
                                photoUrl: (e.currentTarget as any).photoPreview || ''
                            };

                            try {
                                setActionLoading(999);
                                await apiService.put('/logistics/profile', data);
                                setSuccess('Perfil atualizado com sucesso!');
                                loadData();
                            } catch (err: any) {
                                setError(err.message || 'Erro ao atualizar perfil');
                            } finally {
                                setActionLoading(null);
                            }
                        }} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-1">Tipo de Veículo</label>
                                    <select
                                        name="vehicleType"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                                        required
                                    >
                                        <option value="BICYCLE">Bicicleta</option>
                                        <option value="MOTORCYCLE">Moto</option>
                                        <option value="CAR">Carro</option>
                                        <option value="VAN">Van</option>
                                        <option value="TRUCK">Caminhão</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-1">Modelo / Cor</label>
                                    <input
                                        name="vehicleModel"
                                        type="text"
                                        placeholder="Ex: Honda CG 160 Vermelha"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-1">Placa (Opcional)</label>
                                    <input
                                        name="vehiclePlate"
                                        type="text"
                                        placeholder="ABC-1234"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50 uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-1">Foto de Perfil</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => {
                                                    const form = (e.target as any).closest('form');
                                                    form.photoPreview = ev.target?.result;
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-primary-500/10 file:text-primary-400 hover:file:bg-primary-500/20"
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={actionLoading === 999}
                                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl transition shadow-lg shadow-primary-500/20 uppercase tracking-widest text-[11px] disabled:opacity-50"
                                >
                                    {actionLoading === 999 ? 'Salvando...' : 'Salvar Dados do Entregador'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
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
                                        <button
                                            onClick={() => setTrackingOrder(delivery)}
                                            className="bg-indigo-500/10 text-indigo-400 p-2 rounded-lg border border-indigo-500/20"
                                            title="Ver no Mapa"
                                        >
                                            <MapIcon size={16} />
                                        </button>
                                        {delivery.deliveryStatus === 'ACCEPTED' && (
                                            <>
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
                        Quando o comprador confirmar, você recebe até <span className="text-emerald-400 font-bold">96%</span> do valor do frete
                    </li>
                    <li className="flex items-start gap-2 bg-primary-500/5 p-2 rounded-lg border border-primary-500/10 mt-2">
                        <Star size={16} className="text-primary-400 shrink-0 mt-0.5" />
                        <span className="text-[10px] text-zinc-300">
                            <strong>Níveis de Ganhos:</strong> Comece ganhando 90%. Após 10 entregas, ganhe 93%. Após 50 entregas, você fica com 96% do frete!
                        </span>
                    </li>
                </ul>
            </div>
            {/* Modal de Blindagem Jurídica */}
            {showTerms && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl space-y-6">
                        <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center mx-auto text-primary-400">
                            <CheckCircle size={48} />
                        </div>

                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-black text-white">Termo de Adesão ao Ato Cooperativo</h2>
                            <p className="text-zinc-400 text-sm">Para continuar, você precisa aceitar os termos da nossa comunidade.</p>
                        </div>

                        <div className="bg-black/40 rounded-2xl p-4 text-xs text-zinc-500 leading-relaxed max-h-48 overflow-y-auto space-y-4 border border-zinc-800">
                            <p>
                                Ao aceitar este termo, você declara estar ciente de que a atividade de entrega no ecossistema Cred30 é um <strong>Ato Cooperativo (Lei 5.764/71)</strong>, realizado de forma voluntária entre membros da associação.
                            </p>
                            <p>
                                📍 <strong>Sem Vínculo Empregatício:</strong> Você tem total autonomia sobre seus horários, sem subordinação e sem obrigatoriedade de frequência.
                            </p>
                            <p>
                                💰 <strong>Ajuda de Custo:</strong> O valor recebido é uma ajuda de custo pela tarefa realizada, e como membro, você também participa dos excedentes do sistema através das suas cotas.
                            </p>
                            <p>
                                🤝 <strong>Natureza Associativa:</strong> Esta é uma plataforma de colaboração mútua, não uma empresa de logística tradicional.
                            </p>
                        </div>

                        <button
                            onClick={handleAgreeTerms}
                            className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl transition-all shadow-lg shadow-primary-500/20"
                        >
                            Compreendo e Aceito
                        </button>
                    </div>
                </div>
            )}
            {/* Modal de Rastreio */}
            {trackingOrder && (
                <OrderTrackingMap
                    orderId={trackingOrder.orderId}
                    onClose={() => setTrackingOrder(null)}
                    userRole="courier"
                />
            )}
        </div>
    );
};

export default LogisticsView;
