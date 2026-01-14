import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Activity, ArrowUpRight, ArrowDownLeft, Trash2, Check, Settings as SettingsIcon, AlertTriangle, DollarSign } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';
import { AppState } from '../../../../../domain/types/common.types';

interface SystemCost {
    id: number;
    description: string;
    amount: string | number;
}

interface FinanceLog {
    id: number;
    action: string;
    created_at: string;
    admin_name: string;
    new_values: any;
}

interface AdminSystemProps {
    state: AppState;
    onRefresh: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminSystem = ({ state, onRefresh, onSuccess, onError }: AdminSystemProps) => {
    const [systemCosts, setSystemCosts] = useState<SystemCost[]>([]);
    const [newCostDescription, setNewCostDescription] = useState('');
    const [newCostAmount, setNewCostAmount] = useState('');
    const [financeHistory, setFinanceHistory] = useState<FinanceLog[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [historyOffset, setHistoryOffset] = useState(0);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);
    const LIMIT = 50;

    const fetchSystemCosts = useCallback(async () => {
        try {
            const res = await apiService.get<SystemCost[]>('/admin/costs');
            if (res.success) {
                setSystemCosts(res.data || []);
            }
        } catch (e) {
            console.error('Erro ao buscar custos:', e);
        }
    }, []);

    const fetchFinanceHistory = useCallback(async (isLoadMore = false) => {
        setIsHistoryLoading(true);
        try {
            const currentOffset = isLoadMore ? historyOffset + LIMIT : 0;
            const res = await apiService.get<FinanceLog[]>(`/admin/finance-history?limit=${LIMIT}&offset=${currentOffset}`);
            if (res.success) {
                const newLogs = res.data || [];
                setFinanceHistory(prev => isLoadMore ? [...prev, ...newLogs] : newLogs);
                setHasMoreHistory(res.pagination?.hasMore || false);
                if (isLoadMore) setHistoryOffset(currentOffset);
            }
        } catch (e) {
            console.error('Erro ao buscar histórico financeiro:', e);
        } finally {
            setIsHistoryLoading(false);
        }
    }, [historyOffset]);

    useEffect(() => {
        fetchSystemCosts();
        fetchFinanceHistory();
    }, [fetchSystemCosts, fetchFinanceHistory]);

    const handleAddCost = async () => {
        if (!newCostDescription || !newCostAmount) return;
        try {
            const res = await apiService.post<any>('/admin/costs', {
                description: newCostDescription,
                amount: parseFloat(newCostAmount)
            });
            if (res.success) {
                onSuccess('Sucesso', 'Custo adicionado!');
                setNewCostDescription('');
                setNewCostAmount('');
                fetchSystemCosts();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handlePayCost = async (id: number, desc: string) => {
        if (!window.confirm(`Deseja marcar '${desc}' como pago e deduzir do saldo do sistema?`)) return;
        try {
            const res = await apiService.post<any>(`/admin/costs/${id}/pay`, {});
            if (res.success) {
                onSuccess('Pago', 'Custo deduzido do saldo do sistema.');
                fetchSystemCosts();
                fetchFinanceHistory();
                onRefresh();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleDeleteCost = async (id: number) => {
        if (!window.confirm('Excluir este custo?')) return;
        try {
            await apiService.delete(`/admin/costs/${id}`);
            onSuccess('Sucesso', 'Custo removido.');
            fetchSystemCosts();
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleRunLiquidation = async () => {
        if (!window.confirm('Iniciar varredura de garantias agora? O sistema executará o lastro de todos os apoios em atraso há mais de 5 dias.')) return;
        try {
            const res = await apiService.post<any>('/admin/run-liquidation', {});
            if (res.success) {
                onSuccess('Varredura Concluída', res.message);
                onRefresh();
            } else {
                onError('Erro na Liquidação', res.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const formatCurrency = (val: number | string) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (typeof numVal !== 'number' || isNaN(numVal)) return 'R$ 0,00';
        return numVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Gestão de Custos Fixos */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-primary-500/10 rounded-lg"><TrendingUp className="text-primary-400" size={20} /></div>
                        Custos Fixos Mensais
                    </h3>
                    <div className="space-y-6">
                        <div className="bg-black/20 p-6 rounded-2xl border border-zinc-800">
                            <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Total de Despesas/Mês</p>
                            <p className="text-4xl font-black text-red-400 tracking-tighter">
                                -{formatCurrency(state.stats?.systemConfig?.monthly_fixed_costs || 0)}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Adicionar Nova Despesa</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Descrição (ex: MEI)"
                                    value={newCostDescription}
                                    onChange={(e) => setNewCostDescription(e.target.value)}
                                    className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary-500/50"
                                />
                                <input
                                    type="text"
                                    placeholder="Valor"
                                    value={newCostAmount}
                                    onChange={(e) => setNewCostAmount(e.target.value)}
                                    className="w-24 bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary-500/50"
                                />
                                <button
                                    onClick={handleAddCost}
                                    className="bg-primary-500 hover:bg-primary-400 p-3 rounded-xl text-black transition-all"
                                >
                                    <Check size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {systemCosts.map((cost) => (
                                <div key={cost.id} className="group bg-black/40 border border-zinc-800/50 p-4 rounded-2xl flex justify-between items-center transition-all hover:border-zinc-700">
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-zinc-300">{cost.description}</p>
                                        <p className="text-sm font-black text-white">{formatCurrency(parseFloat(cost.amount))}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handlePayCost(cost.id, cost.description)}
                                            className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all"
                                        >
                                            PAGAR
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCost(cost.id)}
                                            className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {systemCosts.length === 0 && (
                                <p className="text-center py-4 text-xs text-zinc-600 font-bold uppercase">Nenhum custo fixo lançado.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Distribuição de Reservas Internas */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-primary-500/10 rounded-lg"><Activity className="text-primary-400" size={20} /></div>
                        Reservas de Crescimento (25/25/25/25)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/40 border border-zinc-800/50 p-4 rounded-2xl">
                            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Impostos (Receita)</p>
                            <p className="text-lg font-black text-white">{formatCurrency(state.stats?.systemConfig?.total_tax_reserve || 0)}</p>
                        </div>
                        <div className="bg-black/40 border border-zinc-800/50 p-4 rounded-2xl">
                            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Operacional (Infra)</p>
                            <p className="text-lg font-black text-white">{formatCurrency(state.stats?.systemConfig?.total_operational_reserve || 0)}</p>
                        </div>
                        <div className="bg-black/40 border border-zinc-800/50 p-4 rounded-2xl">
                            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Owner Profit (Salário)</p>
                            <p className="text-lg font-black text-white">{formatCurrency(state.stats?.systemConfig?.total_owner_profit || 0)}</p>
                        </div>
                        <div className="bg-black/40 border border-zinc-800/50 p-4 rounded-2xl">
                            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Reserva Social</p>
                            <p className="text-lg font-black text-primary-400">{formatCurrency(state.stats?.systemConfig?.investment_reserve || 0)}</p>
                        </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-zinc-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-zinc-500 font-bold uppercase">Reward Pool (Cotistas)</span>
                            <span className="text-xs text-emerald-400 font-black tracking-tight">{formatCurrency(state.profitPool)}</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: '100%' }}></div>
                        </div>
                        {state.stats?.quotasCount ? (
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">
                                    {state.stats.quotasCount} Cotas Ativas
                                </span>
                                <span className="text-[10px] text-emerald-400 font-bold">
                                    ~ {formatCurrency(state.profitPool / state.stats.quotasCount)} / cota
                                </span>
                            </div>
                        ) : (
                            <p className="text-[9px] text-zinc-600 mt-2 text-right">Sem cotas ativas para divisão.</p>
                        )}
                    </div>
                </div>

                {/* Injeção de Lucro Manual (Receita Externa) */}
                <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/10 border border-emerald-500/20 rounded-3xl p-8 shadow-2xl col-span-1 md:col-span-2">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/20 rounded-lg"><DollarSign className="text-emerald-400" size={20} /></div>
                                Injetar Receita Externa
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                                Recebeu excedente fora do App (ex: taxas, serviços externos)? Injete aqui para aumentar o saldo do sistema e o pool de participação dos membros.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R$</span>
                                <input
                                    type="number"
                                    placeholder="0,00"
                                    id="manual-profit-input"
                                    className="w-full sm:w-48 bg-black/40 border border-emerald-500/20 rounded-2xl pl-10 pr-4 py-4 text-white font-black outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
                                />
                            </div>
                            <button
                                onClick={async () => {
                                    const input = document.getElementById('manual-profit-input') as HTMLInputElement;
                                    const val = parseFloat(input.value);
                                    if (!val || val <= 0) return onError("Erro", "Insira um valor válido.");

                                    if (!window.confirm(`Deseja injetar R$ ${val.toFixed(2)} como excedente no sistema?`)) return;

                                    try {
                                        const res = await apiService.addProfitToPool(val);
                                        if (res.success) {
                                            onSuccess("Sucesso", res.message || "Excedente injetado e distribuído!");
                                            input.value = '';
                                            onRefresh();
                                            fetchFinanceHistory();
                                        }
                                    } catch (e: any) {
                                        onError("Erro", e.message);
                                    }
                                }}
                                className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-4 rounded-2xl transition-all uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/20 active:scale-95"
                            >
                                Confirmar Injeção
                            </button>
                        </div>
                    </div>
                </div>

                {/* Extrato Financeiro Administrativo */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl col-span-1 md:col-span-2">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-primary-500/10 rounded-lg"><Activity className="text-primary-400" size={20} /></div>
                        Extrato de Movimentações Administrativas
                    </h3>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                        {isHistoryLoading && <div className="text-center py-10 text-zinc-500 text-xs font-bold uppercase animate-pulse">Carregando extrato...</div>}

                        {financeHistory.map((log) => (
                            <div key={log.id} className="bg-black/30 border border-zinc-800/50 p-4 rounded-2xl flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${log.action === 'PAY_COST' ? 'bg-red-500/10 text-red-400' :
                                        log.action === 'MANUAL_PROFIT_ADD' ? 'bg-emerald-500/10 text-emerald-400' :
                                            'bg-zinc-800 text-zinc-400'
                                        }`}>
                                        {log.action === 'PAY_COST' ? <ArrowUpRight size={18} /> :
                                            log.action === 'MANUAL_PROFIT_ADD' ? <ArrowDownLeft size={18} /> :
                                                <SettingsIcon size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-white uppercase tracking-tight">
                                            {log.action === 'PAY_COST' ? 'PAGAMENTO REALIZADO' :
                                                log.action === 'MANUAL_PROFIT_ADD' ? 'EXCEDENTE ADICIONADO' :
                                                    log.action.replace('_', ' ')}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase">{new Date(log.created_at).toLocaleString('pt-BR')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-black ${log.action === 'PAY_COST' ? 'text-red-400' :
                                        log.action === 'MANUAL_PROFIT_ADD' ? 'text-emerald-400' :
                                            'text-white'
                                        }`}>
                                        {log.action === 'PAY_COST' ? '-' : '+'}{formatCurrency(log.new_values?.amount || log.new_values?.amountToAdd || log.new_values?.addedAmount || 0)}
                                    </p>
                                    <p className="text-[9px] text-zinc-600 font-bold uppercase">POR: {log.admin_name}</p>
                                </div>
                            </div>
                        ))}

                        {hasMoreHistory && (
                            <div className="pt-4 flex justify-center">
                                <button
                                    onClick={() => fetchFinanceHistory(true)}
                                    disabled={isHistoryLoading}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-[10px] font-black uppercase text-zinc-400 px-6 py-2.5 rounded-xl border border-zinc-700 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isHistoryLoading ? 'Carregando...' : 'Carregar mais movimentações'}
                                </button>
                            </div>
                        )}

                        {!isHistoryLoading && financeHistory.length === 0 && (
                            <div className="py-20 text-center opacity-30">
                                <Activity size={48} className="mx-auto mb-4" />
                                <p className="text-xs font-bold uppercase">Nenhuma movimentação registrada</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Varredura de Inadimplência */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl col-span-1 md:col-span-2">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg"><AlertTriangle className="text-red-400" size={20} /></div>
                        Varredura de Atraso de Reposição
                    </h3>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                            Clique abaixo para executar manualmente a proteção de lastro. Membros com atraso superior a 5 dias terão suas licenças executadas para cobrir o compromisso social.
                        </p>
                        <button
                            onClick={handleRunLiquidation}
                            className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-black border border-red-500/30 font-black px-8 py-5 rounded-2xl transition-all uppercase tracking-widest text-xs whitespace-nowrap"
                        >
                            Iniciar Varredura de Garantias
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
