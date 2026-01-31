import { useState, useEffect } from 'react';
import {
    Truck, Package, Phone, Clock, CheckCircle, XCircle,
    Loader2, DollarSign, Star, AlertCircle, AlertTriangle,
    Map as MapIcon, ShieldCheck, MapPin, Navigation, ArrowRight
} from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import { useNavigate } from 'react-router-dom';
import { OrderTrackingMap } from '../features/marketplace/OrderTrackingMap';
import { AvailableDeliveriesMap } from '../features/logistics/AvailableDeliveriesMap';
import { User } from '../../../domain/types/common.types';
import { SwipeButton } from '../ui/SwipeButton';
import { getDistance, correctStoredAddress } from '../../../application/utils/location_corrections';
import { ReportProblemModal } from '../ui/ReportProblemModal';

interface LogisticsViewProps {
    currentUser: User | null;
}

interface Delivery {
    orderId: number;
    itemTitle: string;
    itemPrice: number;
    imageUrl?: string;
    deliveryFee: number;
    courierEarnings: string;
    deliveryAddress: string;
    pickupAddress: string;
    pickupLat?: number | null;
    pickupLng?: number | null;
    deliveryLat?: number | null;
    deliveryLng?: number | null;
    contactPhone?: string;
    sellerName: string;
    sellerId: number;
    sellerPhone?: string;
    buyerName: string;
    buyerId: number;
    buyerPhone?: string;
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

export const LogisticsView = ({ currentUser }: LogisticsViewProps) => {
    const navigate = useNavigate();
    const isQualified = currentUser?.is_verified || (currentUser?.score || 0) >= 500 || (currentUser as any)?.isAdmin || (currentUser as any)?.role === 'ADMIN';
    const [activeTab, setActiveTab] = useState<Tab>('available');
    const [availableDeliveries, setAvailableDeliveries] = useState<Delivery[]>([]);
    const [myDeliveries, setMyDeliveries] = useState<Delivery[]>([]);
    const [activeMission, setActiveMission] = useState<Delivery | null>(null);
    const [stats, setStats] = useState<DeliveryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [userCoords, setUserCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportOrderId, setReportOrderId] = useState<number | null>(null);

    // Monitorar localização do usuário
    useEffect(() => {
        if (!navigator.geolocation) return;

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            (err) => console.error('GPS Error:', err),
            { enableHighAccuracy: true }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Filtro de ignorados (Local Storage)
    const [ignoredOrders, setIgnoredOrders] = useState<number[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('ignoredLogisticsOrders') || '[]');
        } catch { return []; }
    });

    const visibleDeliveries = availableDeliveries.filter(d => !ignoredOrders.includes(d.orderId));

    const handleIgnore = (orderId: number) => {
        const newIgnored = [...ignoredOrders, orderId];
        setIgnoredOrders(newIgnored);
        localStorage.setItem('ignoredLogisticsOrders', JSON.stringify(newIgnored));
        setSuccess('Entrega ocultada do mapa.');
    };

    // Estado para controlar a última localização processada e evitar spam
    const [lastFetchCoords, setLastFetchCoords] = useState<{ lat: number, lng: number } | null>(null);

    useEffect(() => {
        const shouldFetch = !lastFetchCoords ||
            (userCoords && getDistance(userCoords.lat, userCoords.lng, lastFetchCoords.lat, lastFetchCoords.lng) > 100); // 100 metros

        if (shouldFetch) {
            loadData();
            if (userCoords) setLastFetchCoords(userCoords);
        }
    }, [activeTab, userCoords?.lat, userCoords?.lng]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            if (activeTab === 'available') {
                const response = await apiService.getAvailableDeliveries(userCoords?.lat, userCoords?.lng);
                setAvailableDeliveries(response.data || []);

                // Checar se tem entrega ativa
                const activeResponse = await apiService.getMyDeliveries('active');
                if (activeResponse.data?.deliveries?.length > 0) {
                    setActiveMission(activeResponse.data.deliveries[0]);
                    if (activeTab === 'available') setActiveTab('active');
                } else {
                    setActiveMission(null);
                }
            } else {
                const statusQuery = activeTab === 'active' ? 'active' : 'completed';
                const response = await apiService.getMyDeliveries(statusQuery);
                // O backend retorna { success: true, data: { deliveries: [], total_earnings: ... } } ou direto o array
                const deliveriesData = response.data?.deliveries || response.data || [];
                const deliveries = Array.isArray(deliveriesData) ? deliveriesData : [];
                setMyDeliveries(deliveries);

                if (activeTab === 'active' && deliveries.length > 0) {
                    setActiveMission(deliveries[0]);
                } else if (activeTab === 'active') {
                    setActiveMission(null);
                }
            }
            const statsResponse = await apiService.getDeliveryStats();
            setStats(statsResponse.data);
        } catch (err: any) {
            console.error('Logistics load error:', err);
            setError(err.message || 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (orderId: number): Promise<boolean> => {
        // setActionLoading(orderId);
        setError(null);
        try {
            const result = await apiService.acceptDelivery(orderId);
            if (result.success) {
                setSuccess(`Entrega aceita! Inicie a missão.`);
                return true;
            } else {
                setError(result.message || 'Erro ao aceitar entrega');
                return false;
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao aceitar entrega');
            return false;
        } finally {
            // setActionLoading(null);
        }
    };

    const handlePickup = async (orderId: number) => {
        // setActionLoading(orderId);
        setError(null);
        try {
            const result = await apiService.confirmPickup(orderId);
            if (result.success) {
                setSuccess('Coleta confirmada! Rumo à entrega.');
                loadData();
            } else {
                setError(result.message || 'Erro ao confirmar coleta');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao confirmar coleta');
        } finally {
            // setActionLoading(null);
        }
    };

    const handleDelivered = async (orderId: number) => {
        // setActionLoading(orderId);
        setError(null);
        try {
            const result = await apiService.confirmDelivered(orderId);
            if (result.success) {
                setSuccess('Entrega finalizada! Bom trabalho.');
                loadData();
                setActiveMission(null); // Sai do modo missão
            } else {
                setError(result.message || 'Erro ao marcar entrega');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao marcar entrega');
        } finally {
            // setActionLoading(null);
        }
    };

    const handleCancel = async (orderId: number) => {
        if (!confirm('Tem certeza que deseja cancelar esta entrega? Isso afetará sua reputação.')) return;
        // setActionLoading(orderId);
        setError(null);
        try {
            const result = await apiService.cancelDelivery(orderId);
            if (result.success) {
                setSuccess('Entrega cancelada.');
                setActiveMission(null);
                setActiveTab('available'); // Volta pra busca
                loadData();
            } else {
                setError(result.message || 'Erro ao cancelar');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao cancelar');
        } finally {
            // setActionLoading(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { color: string; label: string }> = {
            'AVAILABLE': { color: 'bg-yellow-500/20 text-yellow-400', label: 'Disponível' },
            'ACCEPTED': { color: 'bg-blue-500/20 text-blue-400', label: 'Aceita' },
            'IN_TRANSIT': { color: 'bg-purple-500/20 text-purple-400', label: 'Em Trânsito' },
            'DELIVERED': { color: 'bg-emerald-500/20 text-emerald-400', label: 'Entregue' },
            'COMPLETED': { color: 'bg-green-500/20 text-green-400', label: 'Concluído' },
            'CANCELLED': { color: 'bg-red-500/20 text-red-400', label: 'Cancelado' },
        };
        const s = statusMap[status] || { color: 'bg-zinc-500/20 text-zinc-400', label: status };
        return <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${s.color}`}>{s.label}</span>;
    };

    const formatCurrency = (value: number | string | null | undefined) => {
        if (value === null || value === undefined) return 'R$ 0,00';
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(num) || num === null) return 'R$ 0,00';
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // --- MODO MISSÃO (FULL SCREEN) ---
    if (activeMission && activeTab === 'active') {
        const isPickup = activeMission.deliveryStatus === 'ACCEPTED';
        const isDelivery = activeMission.deliveryStatus === 'IN_TRANSIT';
        // const isWaiting = activeMission.deliveryStatus === 'DELIVERED';

        return (
            <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col h-[100dvh]">
                {/* 1. Header de Navegação */}
                <div className="bg-zinc-900 border-b border-white/5 p-4 pt-safe-top">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isPickup ? 'bg-amber-500 animate-pulse' : 'bg-zinc-700'}`} />
                            <span className="text-xs text-zinc-400 font-bold uppercase">Coleta</span>
                            <div className="w-8 h-[1px] bg-zinc-700" />
                            <span className={`w-2 h-2 rounded-full ${isDelivery ? 'bg-purple-500 animate-pulse' : 'bg-zinc-700'}`} />
                            <span className="text-xs text-zinc-400 font-bold uppercase">Entrega</span>
                        </div>
                        <button
                            onClick={() => handleCancel(activeMission.orderId)}
                            className="text-red-400 text-xs font-bold uppercase hover:text-red-300"
                        >
                            Cancelar
                        </button>
                    </div>

                    <h2 className="text-xl font-bold text-white leading-tight flex items-center gap-2">
                        {isPickup ? (
                            <><MapPin className="text-amber-500 shrink-0" /> Ir para Coleta</>
                        ) : isDelivery ? (
                            <><Navigation className="text-purple-500 shrink-0" /> Levar ao Cliente</>
                        ) : (
                            <><CheckCircle className="text-emerald-500 shrink-0" /> Agaurdando...</>
                        )}
                    </h2>
                    <div className="flex flex-col gap-1 mt-2">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isPickup ? 'bg-amber-500' : 'bg-zinc-700'}`} />
                            <p className="text-zinc-400 text-xs">
                                <span className="font-bold text-zinc-500">COLETA:</span> {correctStoredAddress(activeMission.pickupLat || null, activeMission.pickupLng || null, activeMission.pickupAddress)}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isDelivery ? 'bg-purple-500' : 'bg-zinc-700'}`} />
                            <p className="text-zinc-400 text-xs">
                                <span className="font-bold text-zinc-500">ENTREGA:</span> {correctStoredAddress(activeMission.deliveryLat || null, activeMission.deliveryLng || null, activeMission.deliveryAddress)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Área do Mapa (Ocupa o resto) */}
                <div className="flex-1 relative bg-zinc-900 w-full overflow-hidden">
                    <OrderTrackingMap
                        orderId={(activeMission.orderId || (activeMission as any).id || '').toString()}
                        onClose={() => { }} // Não fecha, é a view principal
                        userRole="courier"
                        embedded={true} // Nova prop para remover header/footer do mapa se necessário
                    />

                    {/* Floating Info Card */}
                    <div className="absolute top-4 left-4 right-4 bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/10 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                            <Package className="text-white" size={20} />
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm">{activeMission.itemTitle}</p>
                            <p className="text-emerald-400 text-xs font-bold">Ganhos: {formatCurrency(activeMission.courierEarnings)}</p>
                        </div>
                        <div className="ml-auto flex gap-2">
                            {isPickup && activeMission.sellerPhone && (
                                <a href={`https://wa.me/55${activeMission.sellerPhone.replace(/\D/g, '')}`} target="_blank" className="p-2 bg-green-500/20 text-green-400 rounded-lg">
                                    <Phone size={18} />
                                </a>
                            )}
                            {isDelivery && activeMission.buyerPhone && (
                                <a href={`https://wa.me/55${activeMission.buyerPhone.replace(/\D/g, '')}`} target="_blank" className="p-2 bg-green-500/20 text-green-400 rounded-lg">
                                    <Phone size={18} />
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Footer de Ação (Slide) */}
                <div className="bg-zinc-900 border-t border-white/5 p-4 pb-safe-bottom">
                    {activeMission.deliveryStatus === 'ACCEPTED' && (
                        <SwipeButton
                            onComplete={() => handlePickup(activeMission.orderId)}
                            text="Deslize para Coletar"
                            completedText="Coletado!"
                            color="bg-amber-500"
                        />
                    )}
                    {activeMission.deliveryStatus === 'IN_TRANSIT' && (
                        <SwipeButton
                            onComplete={() => handleDelivered(activeMission.orderId)}
                            text="Deslize para Finalizar"
                            completedText="Entregue!"
                            color="bg-emerald-500"
                        />
                    )}
                    {activeMission.deliveryStatus === 'DELIVERED' && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-center">
                            <Clock className="w-8 h-8 text-yellow-500 mx-auto mb-2 animate-bounce" />
                            <h3 className="text-yellow-500 font-bold">Aguardando Cliente</h3>
                            <p className="text-yellow-500/70 text-sm">O cliente precisa confirmar o recebimento no app dele.</p>
                            <button onClick={loadData} className="mt-4 text-sm text-yellow-500 underline">Verificar novamente</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- MODO PADRÃO (LISTA/BUSCA) ---

    // viewMode já declarado no topo

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
            {!isQualified ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                        <ShieldCheck size={48} className="text-red-500" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">Área Restrita a Parceiros</h2>
                    <p className="text-zinc-400 max-w-md mb-8">
                        Para garantir a segurança das entregas, apenas membros verificados ou com alta reputação podem atuar como entregadores.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center">
                            <Star size={32} className="text-yellow-400 mb-3" />
                            <h3 className="font-bold text-white mb-1">Score Alto</h3>
                            <p className="text-xs text-zinc-500 mb-4">Alcance 500 pontos de reputação</p>
                            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-yellow-400 h-full transition-all duration-1000"
                                    style={{ width: `${Math.min(100, ((currentUser?.score || 0) / 500) * 100)}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-2 font-mono">
                                {currentUser?.score || 0}/500 PONTOS
                            </p>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center">
                            <CheckCircle size={32} className="text-emerald-400 mb-3" />
                            <h3 className="font-bold text-white mb-1">Selo Verificado</h3>
                            <p className="text-xs text-zinc-500 mb-4">Adquira sua verificação de identidade</p>
                            <button
                                onClick={() => navigate('/app/courier-registration')}
                                className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-2 rounded-lg text-xs font-bold uppercase hover:bg-emerald-500 hover:text-white transition-all"
                            >
                                Tornar-se Entregador
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center">
                                    <Truck className="w-6 h-6 text-primary-400" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-white">Central de Entregas</h1>
                                    <p className="text-zinc-500 text-sm">Conecte-se e ganhe</p>
                                </div>
                            </div>

                            {activeTab === 'available' && (
                                <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/5">
                                    <button
                                        onClick={() => setViewMode('map')}
                                        className={`p-2 rounded-lg transition ${viewMode === 'map' ? 'bg-zinc-800 text-primary-400' : 'text-zinc-500'}`}
                                        title="Ver Mapa"
                                    >
                                        <MapIcon size={18} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-zinc-800 text-primary-400' : 'text-zinc-500'}`}
                                        title="Ver Lista"
                                    >
                                        <Package size={18} />
                                    </button>
                                </div>
                            )}
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
                    <div className="flex gap-2 mb-8 bg-zinc-900/50 p-2 rounded-[2rem] border border-white/5 backdrop-blur-xl">
                        {[
                            { id: 'available' as Tab, label: 'Disponíveis', icon: Package },
                            { id: 'active' as Tab, label: 'Missão Atual', icon: Navigation },
                            { id: 'history' as Tab, label: 'Histórico', icon: Clock },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${activeTab === tab.id
                                    ? 'bg-zinc-800 text-primary-400 shadow-2xl shadow-black border border-white/5 scale-[1.02]'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                                    }`}
                            >
                                <tab.icon size={16} className={activeTab === tab.id ? "animate-pulse" : ""} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                        </div>
                    ) : activeTab === 'available' ? (
                        viewMode === 'map' ? (
                            <div className="h-[70vh] w-full rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl bg-zinc-900">
                                <AvailableDeliveriesMap
                                    deliveries={visibleDeliveries.map(d => ({
                                        id: (d.orderId || (d as any).id || '').toString(),
                                        order_id: (d.orderId || (d as any).id || '').toString(),
                                        delivery_fee: d.deliveryFee || 0,
                                        delivery_address: d.deliveryAddress || 'Endereço não informado',
                                        pickup_address: d.pickupAddress || 'Endereço não informado',
                                        pickup_lat: d.pickupLat || null,
                                        pickup_lng: d.pickupLng || null,
                                        delivery_lat: d.deliveryLat || null,
                                        delivery_lng: d.deliveryLng || null,
                                        item_title: d.itemTitle || 'Produto',
                                        image_url: d.imageUrl || null,
                                        seller_name: d.sellerName || 'Vendedor',
                                        buyer_name: d.buyerName || 'Comprador',
                                        buyer_phone: d.contactPhone || '',
                                        seller_phone: ''
                                    }))}
                                    onAccept={async (deliveryId) => {
                                        const deliveryToTrack = visibleDeliveries.find(d => d.orderId.toString() === deliveryId);
                                        const success = await handleAccept(parseInt(deliveryId));
                                        if (success) {
                                            setActiveTab('active');
                                            if (deliveryToTrack) {
                                                setActiveMission({
                                                    ...deliveryToTrack,
                                                    deliveryStatus: 'ACCEPTED'
                                                });
                                            }
                                            await loadData();
                                        }
                                    }}
                                    onIgnore={(id) => handleIgnore(parseInt(id))}
                                    onClose={() => { }}
                                    isEmbedded={true}
                                />
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in slide-in-from-bottom-5 duration-500">
                                {visibleDeliveries.length === 0 ? (
                                    <div className="text-center py-20">
                                        <Package size={48} className="text-zinc-800 mx-auto mb-4" />
                                        <p className="text-zinc-500">Nenhuma entrega disponível no momento.</p>
                                    </div>
                                ) : (
                                    visibleDeliveries.map((delivery, index) => (
                                        <div key={`${delivery.orderId}-${index}`} className="glass p-5 rounded-3xl border border-white/5 hover:border-primary-500/30 transition-all group">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex gap-4">
                                                    <div className="w-16 h-16 bg-zinc-950 rounded-2xl overflow-hidden border border-white/5 shrink-0">
                                                        {delivery.imageUrl ? (
                                                            <img src={delivery.imageUrl} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Package className="w-full h-full p-4 text-zinc-800" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white group-hover:text-primary-400 transition-colors">{delivery.itemTitle}</h3>
                                                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">De: {delivery.sellerName}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                                {formatCurrency(delivery.courierEarnings)} GANHO
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-black text-white">{formatCurrency(delivery.deliveryFee)}</p>
                                                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Frete Total</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                                <div className="bg-zinc-950/50 p-3 rounded-2xl border border-white/5">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <MapPin size={12} className="text-amber-500" />
                                                        <span className="text-[10px] text-zinc-500 font-black uppercase">Coleta</span>
                                                    </div>
                                                    <p className="text-xs text-zinc-300 line-clamp-1">{correctStoredAddress(delivery.pickupLat || null, delivery.pickupLng || null, delivery.pickupAddress)}</p>
                                                </div>
                                                <div className="bg-zinc-950/50 p-3 rounded-2xl border border-white/5">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Navigation size={12} className="text-primary-500" />
                                                        <span className="text-[10px] text-zinc-500 font-black uppercase">Entrega</span>
                                                    </div>
                                                    <p className="text-xs text-zinc-300 line-clamp-1">{correctStoredAddress(delivery.deliveryLat || null, delivery.deliveryLng || null, delivery.deliveryAddress)}</p>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleIgnore(delivery.orderId)}
                                                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
                                                >
                                                    Ignorar
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const success = await handleAccept(delivery.orderId);
                                                        if (success) {
                                                            setActiveTab('active');
                                                            setActiveMission({ ...delivery, deliveryStatus: 'ACCEPTED' });
                                                            await loadData();
                                                        }
                                                    }}
                                                    className="flex-[2] bg-primary-500 hover:bg-primary-400 text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20 transition-all active:scale-95"
                                                >
                                                    Aceitar Entrega
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )
                    ) : (
                        myDeliveries.length === 0 ? (
                            <div className="text-center py-20">
                                <MapIcon size={48} className="text-zinc-600 mx-auto mb-4" />
                                <h3 className="text-zinc-400 font-bold mb-2">Nada por aqui</h3>
                                <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                                    {activeTab === 'active'
                                        ? 'Você não tem nenhuma missão ativa no momento. Vá em "Disponíveis" para pegar uma!'
                                        : 'Seu histórico está vazio. Comece a entregar para ver seus ganhos.'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {myDeliveries.map(delivery => (
                                    <div key={delivery.orderId} className={`glass p-5 rounded-2xl ${delivery.deliveryStatus === 'CANCELLED' ? 'opacity-50 grayscale' : ''}`}>
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="text-white font-bold">{delivery.itemTitle}</h3>
                                                <p className="text-xs text-zinc-500">Pedido #{delivery.orderId}</p>
                                            </div>
                                            {getStatusBadge(delivery.deliveryStatus || delivery.orderStatus || 'UNKNOWN')}
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            <div className="flex items-start gap-2 text-sm">
                                                <MapPin size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase text-zinc-600 font-bold">Origem/Destino</span>
                                                    <span className="text-zinc-400">
                                                        {correctStoredAddress(delivery.pickupLat || null, delivery.pickupLng || null, delivery.pickupAddress || '').split(',')[0]}
                                                        <ArrowRight className="inline w-3 h-3 mx-1" />
                                                        {correctStoredAddress(delivery.deliveryLat || null, delivery.deliveryLng || null, delivery.deliveryAddress || '').split(',')[0]}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm mt-2">
                                                <Clock size={14} className="text-zinc-500" />
                                                <span className="text-zinc-400 text-xs">
                                                    {delivery.deliveredAt
                                                        ? `Entregue em ${new Date(delivery.deliveredAt).toLocaleDateString()}`
                                                        : `Criado em ${new Date(delivery.createdAt).toLocaleDateString()}`}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                            <div>
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold">Ganhos</p>
                                                <p className="text-emerald-400 font-bold">{formatCurrency(delivery.courierEarnings)}</p>
                                            </div>
                                            {delivery.deliveryStatus === 'CANCELLED' && (
                                                <span className="text-xs font-bold text-red-500">Cancelado</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </>
            )}

            {/* Botão Flutuante de Emergência - Aparece quando há missão ativa */}
            {activeMission && activeTab === 'active' && (
                <button
                    onClick={() => {
                        setReportOrderId(activeMission.orderId);
                        setShowReportModal(true);
                    }}
                    className="fixed bottom-20 right-4 z-50 bg-red-500/90 hover:bg-red-600 text-white p-4 rounded-full 
                               shadow-lg shadow-red-500/30 flex items-center gap-2 transition-all hover:scale-105
                               animate-pulse hover:animate-none"
                    title="Relatar Problema"
                >
                    <AlertTriangle size={24} />
                </button>
            )}

            {/* Modal de Reportar Problema */}
            {showReportModal && reportOrderId && (
                <ReportProblemModal
                    isOpen={showReportModal}
                    onClose={() => {
                        setShowReportModal(false);
                        setReportOrderId(null);
                    }}
                    orderId={reportOrderId}
                    onSuccess={() => {
                        setSuccess('Incidente reportado com sucesso! Nossa equipe irá analisar.');
                        loadData();
                    }}
                />
            )}
        </div>
    );
};
export default LogisticsView;
