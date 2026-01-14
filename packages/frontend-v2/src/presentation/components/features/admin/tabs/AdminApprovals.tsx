import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Check, X, ArrowDownCircle, Phone } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminApprovalsProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onRefresh: () => void;
}

export const AdminApprovals: React.FC<AdminApprovalsProps> = ({ onSuccess, onError, onRefresh }) => {
    const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPending = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await apiService.getPendingTransactions();
            setPendingTransactions(Array.isArray(response.data) ? response.data : []);
        } catch (e) {
            console.error('Erro ao buscar transações pendentes:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPending();
    }, [fetchPending]);

    const handleAction = async (id: any, type: 'TRANSACTION' | 'LOAN', action: 'APPROVE' | 'REJECT') => {
        try {
            const res = await apiService.processAction(id, type, action);
            if (res.success) {
                onSuccess('Sucesso', `Transação ${action === 'APPROVE' ? 'aprovada' : 'rejeitada'} com sucesso!`);
                fetchPending();
                onRefresh();
            } else {
                onError('Erro', res.message || 'Falha ao processar ação.');
            }
        } catch (e: any) {
            onError('Erro', e.message || 'Falha ao processar ação.');
        }
    };

    const formatCurrency = (val: number | string) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (typeof numVal !== 'number' || isNaN(numVal)) return 'R$ 0,00';
        return numVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'DEPOSIT': return 'DEPÓSITO (PIX)';
            case 'BUY_QUOTA': return 'COMPRA DE COTA';
            case 'LOAN_PAYMENT': return 'PAGAMENTO DE APOIO';
            case 'WITHDRAWAL': return 'RESGATE (SOLICITAÇÃO)';
            default: return type.replace('_', ' ');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="max-w-4xl mx-auto">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                            <div className="p-2 bg-primary-500/10 rounded-lg"><ArrowDownCircle className="text-primary-400" size={20} /></div>
                            Aprovações Pendentes
                        </h3>
                        <span className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                            Aguardando: {pendingTransactions.length}
                        </span>
                    </div>

                    <div className="space-y-4 max-h-[700px] overflow-y-auto pr-3 custom-scrollbar">
                        {isLoading ? (
                            <div className="py-24 text-center">
                                <div className="w-10 h-10 border-2 border-primary-500/20 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Sincronizando fila...</p>
                            </div>
                        ) : pendingTransactions.length === 0 ? (
                            <div className="py-24 text-center">
                                <div className="bg-zinc-800/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ShieldCheck className="text-zinc-500" size={32} />
                                </div>
                                <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Nenhuma transação pendente!</p>
                            </div>
                        ) : (
                            pendingTransactions.map((t) => (
                                <div key={t.id} className="bg-black/30 border border-zinc-800/50 rounded-2xl p-5 sm:p-6 transition-all hover:border-zinc-700 hover:bg-black/40">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                                        <div className="space-y-3 flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${t.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                    t.type === 'WITHDRAWAL' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                    }`}>
                                                    {getTypeLabel(t.type)}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 font-bold uppercase">{new Date(t.created_at).toLocaleString('pt-BR')}</span>
                                            </div>

                                            <div>
                                                <p className="text-sm font-bold text-white mb-0.5 uppercase tracking-tight">{t.user_name}</p>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                                    <p className="text-[11px] text-zinc-500 font-medium lowercase tracking-tight">{t.user_email}</p>
                                                    {t.user_phone && (
                                                        <a
                                                            href={`https://wa.me/55${t.user_phone.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[11px] text-primary-400 font-bold hover:underline flex items-center gap-1"
                                                        >
                                                            <Phone size={10} />
                                                            {t.user_phone}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <p className="text-2xl font-black text-white">{formatCurrency(t.amount)}</p>
                                                {t.metadata?.method === 'MANUAL_PIX' && (
                                                    <span className="text-[9px] bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded-md border border-primary-500/20 font-black uppercase">PIX Manual</span>
                                                )}
                                            </div>

                                            <p className="text-[11px] text-zinc-400 italic">"{t.description}"</p>
                                        </div>

                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button
                                                onClick={() => handleAction(t.id, 'TRANSACTION', 'REJECT')}
                                                className="flex-1 sm:flex-none p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                            >
                                                <X size={20} />
                                                <span className="text-[10px] font-black uppercase sm:hidden lg:inline">Rejeitar</span>
                                            </button>
                                            <button
                                                onClick={() => handleAction(t.id, 'TRANSACTION', 'APPROVE')}
                                                className="flex-2 sm:flex-none p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl hover:bg-emerald-500 hover:text-black transition-all flex items-center justify-center gap-2 sm:min-w-[140px]"
                                            >
                                                <Check size={20} />
                                                <span className="text-[10px] font-black uppercase">Aprovar Lançamento</span>
                                            </button>
                                        </div>
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
