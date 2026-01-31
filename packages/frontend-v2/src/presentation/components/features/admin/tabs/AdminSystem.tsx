import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Activity, ArrowUpRight, ArrowDownLeft, Trash2, Check, Settings as SettingsIcon, AlertTriangle, DollarSign, Send, RefreshCw } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';
import { AppState } from '../../../../../domain/types/common.types';

interface SystemCost {
    id: number;
    description: string;
    amount: string | number;
    category: 'FISCAL' | 'OPERATIONAL' | 'MIXED';
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
    const [newCostCategory, setNewCostCategory] = useState<'FISCAL' | 'OPERATIONAL' | 'MIXED'>('MIXED');
    const [financeHistory, setFinanceHistory] = useState<FinanceLog[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [historyOffset, setHistoryOffset] = useState(0);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);
    const [isDistributing, setIsDistributing] = useState(false);
    const LIMIT = 50;

    const fetchSystemCosts = useCallback(async () => {
        try {
            const res = await apiService.get<SystemCost[]>('/admin/costs');
            if (res.success) {
                setSystemCosts(Array.isArray(res.data) ? res.data : []);
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
                amount: parseFloat(newCostAmount),
                category: newCostCategory
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
                <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-[2.5rem] p-8 backdrop-blur-xl">
                    <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3">
                        <TrendingUp className="text-primary-500" size={20} />
                        Compromissos Mensais
                    </h3>
                    <div className="space-y-6">
                        <div className="bg-zinc-800/30 p-6 rounded-3xl border border-zinc-800 hover:border-red-500/20 transition-all group">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Previsão de Gastos/Mês</p>
                                <span className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors"><DollarSign className="text-red-400" size={14} /></span>
                            </div>
                            <p className="text-4xl font-black text-white tracking-tighter">
                                {formatCurrency(state.stats?.systemConfig?.monthly_fixed_costs || 0)}
                            </p>
                        </div>

                        <div className="space-y-3 p-6 bg-zinc-900/40 border border-zinc-800/50 rounded-3xl">
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-primary-500 rounded-full"></div> Lançar Nova Despesa
                            </p>
                            <div className="flex flex-col gap-3">
                                <input
                                    type="text"
                                    placeholder="Descrição (ex: Servidor AWS)"
                                    value={newCostDescription}
                                    onChange={(e) => setNewCostDescription(e.target.value)}
                                    className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary-500/50 transition-all font-bold"
                                />
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600">R$</span>
                                        <input
                                            type="text"
                                            placeholder="0,00"
                                            value={newCostAmount}
                                            onChange={(e) => setNewCostAmount(e.target.value)}
                                            className="w-full bg-black/40 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-sm text-white outline-none focus:border-primary-500/50 transition-all font-black"
                                        />
                                    </div>
                                    <select
                                        value={newCostCategory}
                                        onChange={(e) => setNewCostCategory(e.target.value as any)}
                                        className="bg-black/40 border border-zinc-800 rounded-xl px-3 py-3 text-[10px] font-black text-zinc-400 outline-none focus:border-primary-500/50 uppercase appearance-none cursor-pointer"
                                    >
                                        <option value="MIXED">⚖️ MISTO</option>
                                        <option value="FISCAL">🏛️ FISCAL</option>
                                        <option value="OPERATIONAL">🏢 INFRA</option>
                                    </select>
                                    <button
                                        onClick={handleAddCost}
                                        className="bg-primary-500 hover:bg-primary-400 p-3 rounded-xl text-black transition-all shadow-lg shadow-primary-500/20 active:scale-90"
                                    >
                                        <Check size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {systemCosts.map((cost) => (
                                <div key={cost.id} className="group bg-zinc-800/10 border border-zinc-800/40 p-5 rounded-2xl flex justify-between items-center transition-all hover:bg-zinc-800/20 hover:border-zinc-700">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black border ${cost.category === 'FISCAL' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                cost.category === 'OPERATIONAL' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                                    'bg-zinc-800 text-zinc-500 border-zinc-700'
                                                }`}>
                                                {cost.category === 'FISCAL' ? 'FISCAL' : cost.category === 'OPERATIONAL' ? 'INFRA' : 'DIVIDIDO'}
                                            </span>
                                            <p className="text-[11px] font-bold text-zinc-300">{cost.description}</p>
                                        </div>
                                        <p className="text-base font-black text-white">{formatCurrency(parseFloat(String(cost.amount)))}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => { handlePayCost(cost.id, cost.description); }}
                                            className="bg-zinc-800 hover:bg-emerald-500 text-zinc-400 hover:text-black px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95"
                                        >
                                            BAIXAR
                                        </button>
                                        <button
                                            onClick={() => { handleDeleteCost(cost.id); }}
                                            className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {systemCosts.length === 0 && (
                                <div className="text-center py-10 opacity-20">
                                    <Activity size={32} className="mx-auto mb-2" />
                                    <p className="text-[9px] font-black uppercase tracking-widest">Sem custos pendentes</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Distribuição de Reservas Internas (Potes) */}
                <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-[2.5rem] p-8 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-white flex items-center gap-3">
                            <Activity className="text-primary-500" size={20} />
                            Reservas e Sustentabilidade
                        </h3>
                        <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                            <span className="text-[10px] font-black tracking-widest text-emerald-500 uppercase">Sistema Ativo</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 mb-8">
                        {[
                            { label: 'Impostos', val: state.stats?.systemConfig?.total_tax_reserve, icon: '🏛️', color: 'text-zinc-400' },
                            { label: 'Infraestrutura', val: state.stats?.systemConfig?.total_operational_reserve, icon: '🏢', color: 'text-zinc-400' },
                            { label: 'Owner Profit', val: state.stats?.systemConfig?.total_owner_profit, icon: '💎', color: 'text-primary-400' },
                            { label: 'Mutual Reserve', val: state.stats?.systemConfig?.mutual_reserve, icon: '📈', color: 'text-emerald-400' },
                            { label: 'Fundo Social', val: state.stats?.systemConfig?.investment_reserve, icon: '🤝', color: 'text-indigo-400' },
                            { label: 'Proteção Mútua', val: state.stats?.systemConfig?.mutual_protection_fund, icon: '🛡️', color: 'text-emerald-500' },
                        ].map((pote, idx) => (
                            <div key={idx} className="bg-black/20 border border-zinc-800/50 p-5 rounded-2xl group hover:border-zinc-700/80 transition-all">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{pote.label}</span>
                                    <span className="text-base">{pote.icon}</span>
                                </div>
                                <p className={`text-xl font-black ${pote.color}`}>{formatCurrency(pote.val || 0)}</p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-zinc-900/50 border border-zinc-800/80 p-8 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Pool de Recompensa (Cotistas)</span>
                                <span className="text-lg font-black text-white">{formatCurrency(state.profitPool)}</span>
                            </div>
                            <div className="w-full bg-zinc-800/50 h-2 rounded-full overflow-hidden mb-4">
                                <div className="bg-gradient-to-r from-emerald-500 to-primary-500 h-full shadow-[0_0_15px_rgba(16,185,129,0.3)]" style={{ width: '100%' }}></div>
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase italic">
                                    {state.stats?.quotasCount || 0} Cotistas aguardando bonificação
                                </p>
                                {state.stats?.quotasCount > 0 && (
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-tight">
                                        Expectativa: {formatCurrency(state.profitPool / state.stats.quotasCount)} / cota
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Botão Distribuir Excedentes Agora */}
                    {state.profitPool > 0 && (
                        <button
                            onClick={() => {
                                const handleDistribute = async () => {
                                    if (!window.confirm(`Deseja distribuir R$ ${state.profitPool.toFixed(2)} de excedentes para os cotistas agora?\n\n• 85% (R$ ${(state.profitPool * 0.85).toFixed(2)}) será distribuído proporcionalmente\n• 15% (R$ ${(state.profitPool * 0.15).toFixed(2)}) vai para manutenção`)) return;

                                    setIsDistributing(true);
                                    try {
                                        const res = await apiService.distributeDividends();
                                        if (res.success) {
                                            onSuccess('Distribuição Realizada!', res.message || 'Excedentes distribuídos com sucesso para os cotistas elegíveis!');
                                            onRefresh();
                                            fetchFinanceHistory();
                                        } else {
                                            onError('Aviso', res.message || 'Não foi possível realizar a distribuição.');
                                        }
                                    } catch (e: any) {
                                        onError('Erro', e.message || 'Falha ao distribuir excedentes.');
                                    } finally {
                                        setIsDistributing(false);
                                    }
                                };
                                handleDistribute();
                            }}
                            disabled={isDistributing}
                            className="w-full mt-6 bg-gradient-to-r from-primary-500 to-emerald-500 hover:from-primary-400 hover:to-emerald-400 disabled:from-zinc-700 disabled:to-zinc-800 text-black disabled:text-zinc-500 font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 shadow-xl shadow-primary-500/20 active:scale-95"
                        >
                            {isDistributing ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    DISTRIBUINDO...
                                </>
                            ) : (
                                <>
                                    <Send size={18} />
                                    DISTRIBUIR EXCEDENTES AGORA
                                </>
                            )}
                        </button>
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
                            onClick={() => {
                                const handleInject = async () => {
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
                                };
                                handleInject();
                            }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-4 rounded-2xl transition-all uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/20 active:scale-95"
                        >
                            Confirmar Injeção
                        </button>
                    </div>
                </div>
            </div>

            {/* Extrato Financeiro Administrativo Modernizado */}
            <div className="col-span-1 md:col-span-2 bg-zinc-900/30 border border-zinc-800/80 rounded-[2.5rem] p-8 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <Activity className="text-primary-500" size={20} />
                        Log de Movimentações (Ledger)
                    </h3>
                    <div className="p-2 bg-zinc-800/50 rounded-xl">
                        <SettingsIcon className="text-zinc-600" size={16} />
                    </div>
                </div>

                <div className="bg-black/20 rounded-3xl border border-zinc-800/50 overflow-hidden">
                    <div className="grid grid-cols-1 divide-y divide-zinc-800/50 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {isHistoryLoading && financeHistory.length === 0 && (
                            <div className="text-center py-20 flex flex-col items-center gap-4">
                                <div className="w-10 h-10 border-2 border-primary-500/20 border-t-primary-500 rounded-full animate-spin"></div>
                                <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">Sincronizando Ledger...</p>
                            </div>
                        )}

                        {financeHistory.map((log) => (
                            <div key={log.id} className="p-5 flex items-center justify-between hover:bg-zinc-800/20 transition-all group">
                                <div className="flex items-center gap-5">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${log.action === 'PAY_COST' ? 'bg-red-500/5 text-red-500 group-hover:bg-red-500/10' :
                                        log.action === 'MANUAL_PROFIT_ADD' ? 'bg-emerald-500/5 text-emerald-500 group-hover:bg-emerald-500/10' :
                                            'bg-zinc-800/50 text-zinc-500'
                                        }`}>
                                        {log.action === 'PAY_COST' ? <ArrowUpRight size={20} /> :
                                            log.action === 'MANUAL_PROFIT_ADD' ? <ArrowDownLeft size={20} /> :
                                                <Activity size={20} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="text-[11px] font-black text-white uppercase tracking-tight">
                                                {log.action === 'PAY_COST' ? 'BAIXA DE CUSTO' :
                                                    log.action === 'MANUAL_PROFIT_ADD' ? 'INJEÇÃO DE RECEITA' :
                                                        log.action.replace('_', ' ')}
                                            </p>
                                            <span className="text-[9px] font-bold text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full uppercase">@{log.admin_name}</span>
                                        </div>
                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">
                                            {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-lg font-black tracking-tight ${log.action === 'PAY_COST' ? 'text-red-500' :
                                        log.action === 'MANUAL_PROFIT_ADD' ? 'text-emerald-500' :
                                            'text-white'
                                        }`}>
                                        {log.action === 'PAY_COST' ? '-' : '+'}{formatCurrency(log.new_values?.amount || log.new_values?.amountToAdd || log.new_values?.addedAmount || 0)}
                                    </p>
                                    <p className="text-[9px] text-zinc-600 font-black uppercase mt-0.5 max-w-[150px] truncate group-hover:text-zinc-500">
                                        {log.new_values?.description?.substring(0, 30) || 'SEM DETALHES'}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {hasMoreHistory && (
                            <div className="p-6 flex justify-center border-t border-zinc-800/50 bg-black/40">
                                <button
                                    onClick={() => fetchFinanceHistory(true)}
                                    disabled={isHistoryLoading}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-[10px] font-black uppercase text-zinc-400 px-8 py-3 rounded-2xl border border-zinc-700 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
                                >
                                    {isHistoryLoading ? 'Carregando...' : 'Ver mais movimentações'}
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
            </div>

            {/* Varredura de Inadimplência */}
            <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-[2.5rem] p-8 backdrop-blur-xl">
                <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3">
                    <AlertTriangle className="text-red-500" size={20} />
                    Gestão de Inadimplência
                </h3>
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1">
                        <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-xl">
                            A varredura manual executa o lastro de proteção para apoios com atraso superior a 5 dias. As licenças (cotas) dos devedores são liquidadas para cobrir o compromisso social e manter a saúde do fundo mútuo.
                        </p>
                    </div>
                    <button
                        onClick={() => { handleRunLiquidation(); }}
                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-black border border-red-500/30 font-black px-10 py-5 rounded-[2rem] transition-all uppercase tracking-widest text-[10px] whitespace-nowrap shadow-lg shadow-red-500/5 active:scale-95"
                    >
                        Executar Varredura Flash
                    </button>
                </div>
            </div>
        </div>
    );
};
