import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, Check, X } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminPendingTransactionsProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminPendingTransactions: React.FC<AdminPendingTransactionsProps> = ({ onSuccess, onError }) => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPendingTransactions();
    }, []);

    const fetchPendingTransactions = async () => {
        setLoading(true);
        try {
            const data = await apiService.getPendingTransactions();
            setTransactions(data || []);
        } catch (e) {
            console.error('Erro ao buscar transações pendentes:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id: any, action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !window.confirm('Tem certeza que deseja REJEITAR este pagamento manual?')) return;
        if (action === 'APPROVE' && !window.confirm('Você CONFIRMA que recebeu este valor via PIX em sua conta?')) return;

        try {
            const res = await apiService.adminProcessAction({
                id,
                type: 'TRANSACTION',
                action
            });

            if (res.success) {
                onSuccess('Sucesso', `Pagamento ${action === 'APPROVE' ? 'aprovado' : 'rejeitado'} com sucesso!`);
                fetchPendingTransactions();
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
        return Math.abs(numVal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const getTypeName = (type: string) => {
        switch (type) {
            case 'QUOTA_PURCHASE': return 'Compra de Cota';
            case 'LOAN_PAYMENT': return 'Pagamento de Empréstimo';
            case 'UPGRADE_PRO': return 'Upgrade Pro';
            case 'DEPOSIT': return 'Depósito em Conta';
            case 'ADMIN_GIFT': return 'Gift Admin (Audit)';
            default: return type || 'Pendente';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="max-w-4xl mx-auto">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                            <div className="p-2 bg-primary-500/10 rounded-lg"><ArrowDownLeft className="text-primary-400" size={20} /></div>
                            Pagamentos Manuais (Entradas)
                        </h3>
                        <span className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                            Aguardando: {transactions.length}
                        </span>
                    </div>

                    <div className="space-y-4 max-h-[700px] overflow-y-auto pr-3 custom-scrollbar">
                        {loading ? (
                            <div className="py-24 text-center">
                                <div className="w-10 h-10 border-2 border-primary-500/20 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Buscando pendências...</p>
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="py-24 text-center">
                                <div className="bg-zinc-800/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="text-zinc-500" size={32} />
                                </div>
                                <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Tudo em dia!</p>
                            </div>
                        ) : (
                            transactions.map((t) => (
                                <div key={t.id} className="bg-black/30 border border-zinc-800/50 rounded-2xl p-5 sm:p-6 transition-all hover:border-zinc-700 hover:bg-black/40 group">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                                        <div className="space-y-3 flex-1">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold text-white">{t.user_name}</p>
                                                    <span className="text-[9px] bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded-full font-black uppercase">
                                                        {getTypeName(t.type)}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-zinc-500 font-medium truncate max-w-[250px]">{t.user_email}</p>
                                            </div>
                                            <p className="text-2xl font-black text-white">{formatCurrency(t.amount)}</p>
                                            {t.description && (
                                                <p className="text-[10px] text-zinc-400 italic bg-black/20 p-2 rounded-lg border border-zinc-800/50">
                                                    "{t.description}"
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <button
                                                onClick={() => handleAction(t.id, 'REJECT')}
                                                className="flex-1 sm:flex-none p-4 bg-red-500/10 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 min-w-[50px]"
                                                title="Rejeitar"
                                            >
                                                <X size={20} />
                                                <span className="sm:hidden text-[10px] font-black uppercase tracking-widest">Rejeitar</span>
                                            </button>
                                            <button
                                                onClick={() => handleAction(t.id, 'APPROVE')}
                                                className="flex-[2] sm:flex-none p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl hover:bg-emerald-500 hover:text-black transition-all flex items-center justify-center gap-2 sm:min-w-[150px]"
                                            >
                                                <Check size={20} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Confirmar PIX</span>
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
