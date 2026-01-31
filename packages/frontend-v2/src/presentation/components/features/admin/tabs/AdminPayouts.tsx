import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight, Check, Clipboard } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminPayoutsProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

interface PayoutItem {
    id: number;
    user_name: string;
    user_pix: string;
    pix_key: string;
    amount: number | string;
}

export const AdminPayouts: React.FC<AdminPayoutsProps> = ({ onSuccess, onError }) => {
    const [payoutQueue, setPayoutQueue] = useState<{ transactions: PayoutItem[], loans: any[] }>({ transactions: [], loans: [] });

    const fetchPayoutQueue = useCallback(async () => {
        try {
            const response = await apiService.getPayoutQueue();
            const data = response.data || {};
            setPayoutQueue({
                transactions: Array.isArray(data.transactions) ? data.transactions : [],
                loans: Array.isArray(data.loans) ? data.loans : []
            });
        } catch (e) {
            console.error('Erro ao buscar fila de pagamentos:', e);
        }
    }, []);

    useEffect(() => {
        fetchPayoutQueue();
    }, [fetchPayoutQueue]);

    const handleConfirmPayout = async (id: any, type: 'TRANSACTION' | 'LOAN') => {
        try {
            await apiService.confirmPayout(id.toString(), type);
            onSuccess('Sucesso', 'Pagamento registrado com sucesso!');
            fetchPayoutQueue();
        } catch (e: any) {
            onError('Erro', e.message || 'Falha ao confirmar pagamento.');
        }
    };

    const formatCurrency = (val: number | string) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (typeof numVal !== 'number' || isNaN(numVal)) return 'R$ 0,00';
        return numVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="max-w-5xl mx-auto">
                <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-[2.5rem] p-8 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="text-2xl font-black text-white flex items-center gap-3 mb-1">
                                <ArrowUpRight className="text-primary-500" size={24} />
                                Fila de Resgates (Outbound)
                            </h3>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Processamento de saques via PIX</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-full text-[10px] font-black border border-emerald-500/20 uppercase tracking-tight">
                                {payoutQueue.transactions?.length || 0} Pendentes
                            </span>
                            <p className="text-[9px] font-bold text-zinc-600 uppercase">Sincronizado agora</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[750px] overflow-y-auto pr-2 custom-scrollbar">
                        {!payoutQueue.transactions || payoutQueue.transactions.length === 0 ? (
                            <div className="col-span-full py-32 text-center bg-black/20 border border-dotted border-zinc-800 rounded-[2rem]">
                                <div className="bg-zinc-800/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Check className="text-emerald-500" size={40} />
                                </div>
                                <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-1">Queue Empty</h4>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                                    Todos os saques foram processados.<br />Nenhuma pendência operacional encontrada.
                                </p>
                            </div>
                        ) : (
                            payoutQueue.transactions.map((t) => (
                                <div key={t.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 transition-all hover:border-emerald-500/30 hover:bg-black/40 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-emerald-500/10 transition-colors"></div>

                                    <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="w-10 h-10 bg-zinc-800/50 rounded-xl flex items-center justify-center text-xs font-black text-zinc-400">
                                                    ID{t.id}
                                                </div>
                                                <p className="text-2xl font-black text-white tracking-tighter">{formatCurrency(t.amount)}</p>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">Favorecido:</p>
                                                    <p className="text-sm font-black text-white uppercase tracking-tight">{t.user_name}</p>
                                                </div>

                                                <div
                                                    className="bg-black/40 border border-zinc-800 rounded-xl p-3 cursor-pointer hover:border-emerald-500/50 transition-all flex items-center justify-between group/key"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(t.user_pix || t.pix_key);
                                                        onSuccess('Copiado', 'Chave PIX copiada!');
                                                    }}
                                                >
                                                    <div>
                                                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-0.5">Chave PIX (Click to copy)</p>
                                                        <p className="text-[11px] text-emerald-400 font-black font-mono break-all line-clamp-1">{t.user_pix || t.pix_key}</p>
                                                    </div>
                                                    <Clipboard size={14} className="text-zinc-700 group-hover/key:text-emerald-500 transition-colors" />
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleConfirmPayout(t.id, 'TRANSACTION')}
                                            className="w-full bg-zinc-800 hover:bg-emerald-500 text-zinc-400 hover:text-black py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 shadow-lg active:scale-95 group-hover:shadow-emerald-500/10"
                                        >
                                            <Check size={18} />
                                            Confirmar Envio
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
