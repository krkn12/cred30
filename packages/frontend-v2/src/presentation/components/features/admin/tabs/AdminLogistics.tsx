import { useState, useEffect } from 'react';
import { Truck, Package, Clock, Search, MapPin, User, Store } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminLogisticsProps {
    state: any;
    onRefresh: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminLogistics = ({ state, onRefresh, onSuccess, onError }: AdminLogisticsProps) => {
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Monitoramento</h2>
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
                            d.itemTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            d.sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            d.buyerName.toLowerCase().includes(searchTerm.toLowerCase())
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
                                                <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-1">Cod: {delivery.orderId.substring(0, 8)}...</p>
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
        </div>
    );
};
