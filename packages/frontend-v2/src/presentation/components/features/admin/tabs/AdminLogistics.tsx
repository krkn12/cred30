import { useState, useEffect } from 'react';
import { Truck, Package, Clock, Search, MapPin, User, Store } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

export const AdminLogistics = () => {
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchDeliveries();
    }, []);

    const fetchDeliveries = async () => {
        setLoading(true);
        try {
            // Reutilizando endpoint de listagem, mas o admin verá todos
            // No futuro, criar um endpoint específico /admin/logistics
            const response = await apiService.get<any>('/logistics/my-deliveries');
            // Mocking some data for admin view if the above doesn't return all
            setDeliveries(response.data?.deliveries || []);
        } catch (error) {
            console.error('Error fetching logistics:', error);
        } finally {
            setLoading(false);
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Gestão de Logística</h2>
                    <p className="text-xs text-zinc-500 uppercase font-black tracking-widest mt-1">Monitoramento de Entregas da Comunidade</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar entrega..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
            ) : (
                <div className="grid gap-4">
                    {deliveries.length === 0 ? (
                        <div className="text-center py-20 bg-zinc-900/50 border border-zinc-800 rounded-3xl">
                            <Truck size={48} className="text-zinc-800 mx-auto mb-4" />
                            <p className="text-zinc-500">Nenhuma entrega registrada no sistema.</p>
                        </div>
                    ) : (
                        deliveries.filter(d =>
                            d.itemTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            d.sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            d.buyerName.toLowerCase().includes(searchTerm.toLowerCase())
                        ).map((delivery) => (
                            <div key={delivery.orderId} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-all">
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="w-16 h-16 bg-zinc-950 rounded-xl overflow-hidden shrink-0 border border-zinc-800">
                                        {delivery.imageUrl ? (
                                            <img src={delivery.imageUrl} alt={delivery.itemTitle} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-800">
                                                <Package size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h4 className="font-bold text-white text-lg">{delivery.itemTitle}</h4>
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Pedido #{delivery.orderId}</p>
                                            </div>
                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md border ${getStatusColor(delivery.deliveryStatus)}`}>
                                                {delivery.deliveryStatus}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                    <Store size={14} className="text-blue-400" />
                                                    <span className="font-bold text-zinc-500">De:</span> {delivery.sellerName}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-zinc-500 pl-6">
                                                    <MapPin size={10} /> {delivery.pickupAddress}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                    <User size={14} className="text-emerald-400" />
                                                    <span className="font-bold text-zinc-500">Para:</span> {delivery.buyerName}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-zinc-500 pl-6">
                                                    <MapPin size={10} /> {delivery.deliveryAddress}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end justify-between border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6 min-w-[120px]">
                                        <div className="text-right">
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Frete</p>
                                            <p className="text-xl font-black text-white">R$ {delivery.deliveryFee.toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                            <Clock size={12} />
                                            {new Date(delivery.createdAt).toLocaleDateString()}
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
