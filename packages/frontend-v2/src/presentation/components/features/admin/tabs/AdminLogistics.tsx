import { useState, useEffect } from 'react';
import { Truck, Package, Clock, Search, User, Store, Check, X, Eye, UserCheck, Bike, Car, Zap } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminLogisticsProps {
    state: any;
    onRefresh: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminLogistics = ({ state, onRefresh, onSuccess, onError }: AdminLogisticsProps) => {
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [pendingCouriers, setPendingCouriers] = useState<any[]>([]);
    const [activeSubTab, setActiveSubTab] = useState<'monitor' | 'pending'>('monitor');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [selectedPhotos, setSelectedPhotos] = useState<any | null>(null);

    // Configurações Locais
    const [globalKmPrice, setGlobalKmPrice] = useState(state.stats?.systemConfig?.courier_price_per_km?.toString() || '2.50');
    const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

    useEffect(() => {
        fetchDeliveries();
    }, []);

    const fetchDeliveries = async () => {
        setLoading(true);
        try {
            const response = await apiService.get<any>('/logistics/my-deliveries');
            setDeliveries(response.data?.deliveries || []);
        } catch (error) {
            console.error('Error fetching logistics:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingCouriers = async () => {
        setLoading(true);
        try {
            const response = await apiService.listPendingCouriers();
            setPendingCouriers(response.data || []);
        } catch (error) {
            console.error('Error fetching pending couriers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeSubTab === 'monitor') fetchDeliveries();
        else fetchPendingCouriers();
    }, [activeSubTab]);

    const handleApprove = async (userId: number) => {
        setProcessingId(userId);
        try {
            const res = await apiService.approveCourier(userId);
            if (res.success) {
                onSuccess("Aprovado", res.message);
                fetchPendingCouriers();
            } else {
                onError("Erro", res.message);
            }
        } catch (e: any) {
            onError("Erro", e.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (userId: number) => {
        const reason = window.prompt("Motivo da rejeição:");
        if (reason === null) return;

        setProcessingId(userId);
        try {
            const res = await apiService.rejectCourier(userId, reason);
            if (res.success) {
                onSuccess("Rejeitado", res.message);
                fetchPendingCouriers();
            } else {
                onError("Erro", res.message);
            }
        } catch (e: any) {
            onError("Erro", e.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleUpdateConfig = async () => {
        const price = parseFloat(globalKmPrice);
        if (isNaN(price) || price <= 0) {
            onError("Erro", "Insira um preço por KM válido.");
            return;
        }

        setIsUpdatingConfig(true);
        try {
            const res = await apiService.patch<any>('/admin/config', {
                courier_price_per_km: price
            });
            if (res.success) {
                onSuccess("Configuração Atualizada", "O preço base por KM foi alterado para toda a plataforma.");
                onRefresh();
            } else {
                onError("Erro", res.message);
            }
        } catch (e: any) {
            onError("Erro ao salvar", e.message);
        } finally {
            setIsUpdatingConfig(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'AVAILABLE': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            case 'ACCEPTED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'IN_TRANSIT': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'DELIVERED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'COMPLETED': return 'bg-green-500/10 text-green-400 border-green-500/20';
            default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Seção de Configurações Globais */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-2xl -mr-16 -mt-16"></div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center border border-primary-500/20">
                            <Truck className="text-primary-400" size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Configuração Global de Frete</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Define o custo base do quilômetro para toda a plataforma</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-black/40 p-2 rounded-2xl border border-zinc-800">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs">R$</span>
                            <input
                                type="number"
                                step="0.10"
                                value={globalKmPrice}
                                onChange={(e) => setGlobalKmPrice(e.target.value)}
                                className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl pl-10 pr-4 py-3 text-white font-black text-sm outline-none focus:border-primary-500/50 transition-all w-32"
                            />
                        </div>
                        <span className="text-zinc-600 font-bold">/ KM</span>
                        <button
                            onClick={handleUpdateConfig}
                            disabled={isUpdatingConfig}
                            className="bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-black font-black px-6 py-3 rounded-xl transition-all uppercase tracking-widest text-[10px]"
                        >
                            {isUpdatingConfig ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Sub-Tabs */}
            <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800 w-fit">
                <button
                    onClick={() => setActiveSubTab('monitor')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'monitor' ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Monitoramento
                </button>
                <button
                    onClick={() => setActiveSubTab('pending')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative ${activeSubTab === 'pending' ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Pendentes
                    {pendingCouriers.length > 0 && activeSubTab !== 'pending' && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full border-2 border-zinc-900 animate-bounce">
                            {pendingCouriers.length}
                        </span>
                    )}
                </button>
            </div>

            {activeSubTab === 'monitor' ? (
                <>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">Entregas em Andamento</h2>
                            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">Status em tempo real das entregas</p>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar entrega..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]"></div>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {deliveries.length === 0 ? (
                                <div className="text-center py-20 bg-zinc-900/50 border border-zinc-800 rounded-3xl">
                                    <Truck size={48} className="text-zinc-800 mx-auto mb-4 opacity-20" />
                                    <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Nenhuma entrega registrada no sistema.</p>
                                </div>
                            ) : (
                                deliveries.filter(d =>
                                    d.itemTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    d.sellerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    d.buyerName?.toLowerCase().includes(searchTerm.toLowerCase())
                                ).map((delivery) => (
                                    <div key={delivery.orderId} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 hover:border-zinc-700 hover:bg-zinc-900 transition-all group">
                                        <div className="flex flex-col md:flex-row gap-6">
                                            <div className="w-16 h-16 bg-black rounded-2xl overflow-hidden shrink-0 border border-zinc-800/50 group-hover:scale-105 transition-transform">
                                                {delivery.imageUrl ? (
                                                    <img src={delivery.imageUrl} alt={delivery.itemTitle} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-zinc-800">
                                                        <Package size={24} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div>
                                                        <h4 className="font-bold text-white text-lg group-hover:text-primary-400 transition-colors">{delivery.itemTitle}</h4>
                                                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-1">Status: {delivery.deliveryStatus}</p>
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border shadow-sm ${getStatusColor(delivery.deliveryStatus)}`}>
                                                        {delivery.deliveryStatus}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="bg-black/20 p-3 rounded-xl border border-zinc-800/30">
                                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-1">
                                                            <Store size={12} className="text-blue-400" />
                                                            <span className="font-black uppercase tracking-tighter">Retirada:</span> {delivery.sellerName}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-400 pl-5 line-clamp-1 italic">
                                                            {delivery.pickupAddress}
                                                        </div>
                                                    </div>
                                                    <div className="bg-black/20 p-3 rounded-xl border border-zinc-800/30">
                                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-1">
                                                            <User size={12} className="text-emerald-400" />
                                                            <span className="font-black uppercase tracking-tighter">Entrega:</span> {delivery.buyerName}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-400 pl-5 line-clamp-1 italic">
                                                            {delivery.deliveryAddress}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end justify-between border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6 min-w-[140px]">
                                                <div className="text-right">
                                                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Frete Acordado</p>
                                                    <p className="text-2xl font-black text-white tracking-tighter">R$ {parseFloat(delivery.deliveryFee).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-bold uppercase">
                                                    <Clock size={12} />
                                                    {new Date(delivery.createdAt).toLocaleDateString('pt-BR')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div>
                        <h2 className="text-xl font-bold text-white">Cadastros Pendentes</h2>
                        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">Análise de novos entregadores</p>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {pendingCouriers.length === 0 ? (
                                <div className="text-center py-20 bg-zinc-900/50 border border-zinc-800 rounded-3xl">
                                    <UserCheck size={48} className="text-zinc-800 mx-auto mb-4 opacity-20" />
                                    <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Nenhum cadastro pendente.</p>
                                </div>
                            ) : (
                                pendingCouriers.map((courier) => (
                                    <div key={courier.id} className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 hover:bg-zinc-900 transition-all">
                                        <div className="flex flex-col lg:flex-row gap-8">
                                            {/* Info */}
                                            <div className="flex-1 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-xl font-black text-white">{courier.name}</h4>
                                                        <p className="text-zinc-500 text-xs">{courier.email}</p>
                                                    </div>
                                                    <span className="bg-primary-500/10 text-primary-400 border border-primary-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                        {courier.vehicle === 'BIKE' ? <Bike size={12} /> : courier.vehicle === 'MOTO' ? <Zap size={12} /> : <Car size={12} />}
                                                        {courier.vehicle}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-zinc-800/50">
                                                    <div>
                                                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">Telefone</p>
                                                        <p className="text-white font-bold text-xs">{courier.phone}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">CPF</p>
                                                        <p className="text-white font-bold text-xs">{courier.cpf}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">Cidade</p>
                                                        <p className="text-white font-bold text-xs">{courier.city} - {courier.state}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">Score</p>
                                                        <p className="text-white font-bold text-xs">{courier.score} pts</p>
                                                    </div>
                                                </div>

                                                {/* Photos Grid */}
                                                <div className="grid grid-cols-3 gap-3 pt-2">
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">RG / CNH</p>
                                                        <div
                                                            className="aspect-square bg-black rounded-xl border border-zinc-800 overflow-hidden cursor-pointer group relative"
                                                            onClick={() => setSelectedPhotos({ title: 'RG / CNH', url: courier.idPhoto })}
                                                        >
                                                            <img src={courier.idPhoto} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <Eye size={20} className="text-white" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Veículo</p>
                                                        <div
                                                            className="aspect-square bg-black rounded-xl border border-zinc-800 overflow-hidden cursor-pointer group relative"
                                                            onClick={() => setSelectedPhotos({ title: 'Veículo', url: courier.vehiclePhoto })}
                                                        >
                                                            <img src={courier.vehiclePhoto} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <Eye size={20} className="text-white" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Documento</p>
                                                        <div
                                                            className="aspect-square bg-black rounded-xl border border-zinc-800 overflow-hidden cursor-pointer group relative"
                                                            onClick={() => setSelectedPhotos({ title: 'Documento', url: courier.docPhoto })}
                                                        >
                                                            <img src={courier.docPhoto} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <Eye size={20} className="text-white" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="lg:w-48 flex lg:flex-col gap-3 justify-end lg:justify-start">
                                                <button
                                                    onClick={() => handleApprove(courier.id)}
                                                    disabled={processingId === courier.id}
                                                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group"
                                                >
                                                    <Check size={18} className="group-hover:scale-110 transition-transform" />
                                                    Aprovar
                                                </button>
                                                <button
                                                    onClick={() => handleReject(courier.id)}
                                                    disabled={processingId === courier.id}
                                                    className="flex-1 bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-500/40 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group"
                                                >
                                                    <X size={18} className="group-hover:scale-110 transition-transform" />
                                                    Rejeitar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Photo Preview Modal */}
            {selectedPhotos && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 animate-in fade-in duration-300">
                    <div className="relative max-w-4xl w-full h-[80vh] bg-zinc-900 rounded-[2rem] overflow-hidden border border-zinc-800 flex flex-col shadow-2xl">
                        <div className="p-6 flex items-center justify-between border-b border-zinc-800">
                            <h3 className="text-white font-black uppercase tracking-widest">{selectedPhotos.title}</h3>
                            <button
                                onClick={() => setSelectedPhotos(null)}
                                className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 p-4 bg-black/50 flex items-center justify-center overflow-auto">
                            <img src={selectedPhotos.url} className="max-w-full max-h-full object-contain shadow-2xl" alt="Preview" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
