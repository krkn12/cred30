import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Check, X, User, Store, Package, Info, Loader2, Scale } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminDisputesProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminDisputes = ({ onSuccess, onError }: AdminDisputesProps) => {
    const [disputes, setDisputes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);

    const fetchDisputes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiService.admin.getMarketplaceDisputes();
            if (res.success) {
                setDisputes(res.data || []);
            }
        } catch (error: any) {
            console.error('Erro ao buscar disputas:', error);
            onError('Erro', 'Não foi possível carregar as disputas.');
        } finally {
            setLoading(false);
        }
    }, [onError]);

    useEffect(() => {
        fetchDisputes();
    }, [fetchDisputes]);

    const handleResolve = async (orderId: number, resolution: 'REFUND_BUYER' | 'RELEASE_TO_SELLER', penaltyUserId?: number) => {
        const confirmMsg = resolution === 'REFUND_BUYER'
            ? "Você está prestes a DEVOLVER o dinheiro para o comprador. O vendedor não receberá nada. Confirmar?"
            : "Você está prestes a LIBERAR o dinheiro para o vendedor. O comprador não poderá mais reclamar. Confirmar?";

        if (!window.confirm(confirmMsg)) return;

        setProcessingId(orderId);
        try {
            const res = await apiService.admin.resolveMarketplaceDispute(orderId, resolution, penaltyUserId);
            if (res.success) {
                onSuccess("Disputa Resolvida", res.message || "A decisão foi aplicada com sucesso.");
                fetchDisputes();
            } else {
                onError("Erro", res.message || "Falha ao resolver disputa.");
            }
        } catch (error: any) {
            onError("Erro", error.message);
        } finally {
            setProcessingId(null);
        }
    };

    const formatCurrency = (val: any) => {
        return parseFloat(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Estratégico */}
            <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                            <Scale size={32} className="text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Tribunal do Marketplace</h2>
                            <p className="text-sm text-zinc-500 font-bold mt-1 uppercase tracking-widest italic">Poder de Mediação do Juiz Supremo Cred30</p>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="text-primary-500 animate-spin" size={48} />
                    <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">Analisando evidências...</p>
                </div>
            ) : disputes.length === 0 ? (
                <div className="text-center py-24 bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] border-dashed">
                    <div className="inline-flex p-6 bg-zinc-800/50 rounded-full mb-6 text-zinc-700">
                        <Scale size={48} opacity={0.2} />
                    </div>
                    <p className="text-zinc-500 font-black uppercase text-xs tracking-[0.2em]">Paz no ecossistema: Nenhuma disputa ativa.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {disputes.map((order) => (
                        <div key={order.id} className="bg-zinc-900/80 border border-zinc-800 rounded-[2rem] p-8 shadow-xl hover:border-red-500/30 transition-all group overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                            <div className="flex flex-col xl:flex-row gap-8 relative z-10">
                                {/* Thumbnail & Info Base */}
                                <div className="flex gap-6 flex-1">
                                    <div className="w-24 h-24 bg-black rounded-2xl overflow-hidden border border-zinc-800 shrink-0">
                                        {order.listing_image ? (
                                            <img src={order.listing_image} alt={order.listing_title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-800"><Package size={32} /></div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-[10px] font-black bg-red-500 text-white px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg shadow-red-500/20 animate-pulse">EM DISPUTA</span>
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase">ID #{order.id}</span>
                                        </div>
                                        <h4 className="text-xl font-black text-white group-hover:text-red-400 transition-colors">{order.listing_title}</h4>
                                        <div className="flex items-center gap-2 mt-2 text-zinc-500 text-xs">
                                            <Info size={14} className="text-primary-500" />
                                            Abatida em: {new Date(order.disputed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>

                                {/* Partes Envolvidas */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:min-w-[400px]">
                                    <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800">
                                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <User size={12} className="text-primary-500" /> Comprador
                                        </p>
                                        <p className="text-sm font-bold text-white">{order.buyer_name}</p>
                                        <button
                                            onClick={() => window.alert(`Penalidade de -100 Score para ${order.buyer_name}`)}
                                            className="mt-3 text-[9px] text-red-500/60 hover:text-red-500 font-black uppercase transition-colors"
                                        >
                                            Punir Comprador
                                        </button>
                                    </div>
                                    <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800">
                                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Store size={12} className="text-orange-500" /> Vendedor
                                        </p>
                                        <p className="text-sm font-bold text-white">{order.seller_name}</p>
                                        <button
                                            onClick={() => window.alert(`Penalidade de -100 Score para ${order.seller_name}`)}
                                            className="mt-3 text-[9px] text-red-500/60 hover:text-red-500 font-black uppercase transition-colors"
                                        >
                                            Punir Vendedor
                                        </button>
                                    </div>
                                </div>

                                {/* Financeiro & Veredito */}
                                <div className="flex flex-col justify-between border-t xl:border-t-0 xl:border-l border-zinc-800 pt-6 xl:pt-0 xl:pl-8 min-w-[200px]">
                                    <div className="text-right mb-6">
                                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Valor em Garantia</p>
                                        <p className="text-3xl font-black text-white tabular-nums tracking-tighter">{formatCurrency(order.amount)}</p>
                                    </div>

                                    <div className="flex xl:flex-col gap-3">
                                        <button
                                            onClick={() => handleResolve(order.id, 'RELEASE_TO_SELLER')}
                                            disabled={!!processingId}
                                            className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-black font-black py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-tighter text-xs"
                                        >
                                            <Check size={18} /> Liberar Vendedor
                                        </button>
                                        <button
                                            onClick={() => handleResolve(order.id, 'REFUND_BUYER')}
                                            disabled={!!processingId}
                                            className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-30 text-white font-black py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-tighter text-xs"
                                        >
                                            <X size={18} /> Estornar Comprador
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Detalhe da Disputa */}
                            <div className="mt-8 pt-8 border-t border-zinc-800/50">
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-yellow-500" /> Motivo Alegado pela Parte
                                </p>
                                <div className="bg-black/60 p-6 rounded-2xl border border-yellow-500/10 text-zinc-300 text-sm italic leading-relaxed">
                                    "{order.dispute_reason || 'Nenhum motivo fornecido'}"
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
