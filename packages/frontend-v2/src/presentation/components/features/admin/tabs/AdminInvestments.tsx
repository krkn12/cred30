import React, { useState, useEffect } from 'react';
import { TrendingUp, Plus, DollarSign, RefreshCw, Briefcase, PiggyBank, ArrowUpRight, ArrowDownRight, Coins, AlertTriangle } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface Investment {
    id: number;
    assetName: string;
    assetType: 'STOCK' | 'FII' | 'BOND' | 'ETF' | 'OTHER';
    quantity: number;
    unitPrice: number;
    totalInvested: number;
    currentValue: number;
    dividendsReceived: number;
    broker?: string;
    notes?: string;
    investedAt: string;
    profitLoss: number;
    profitLossPercent: number;
}

interface InvestmentSummary {
    availableReserve: number;
    totalInvested: number;
    totalCurrentValue: number;
    totalDividends: number;
    totalProfitLoss: number;
    totalProfitLossPercent: number;
}

interface AdminInvestmentsProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

const assetTypeLabels: Record<string, string> = {
    STOCK: 'Ação',
    FII: 'FII',
    BOND: 'Renda Fixa',
    ETF: 'ETF',
    OTHER: 'Outro'
};

const assetTypeColors: Record<string, string> = {
    STOCK: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    FII: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    BOND: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    ETF: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    OTHER: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
};

export const AdminInvestments: React.FC<AdminInvestmentsProps> = ({ onSuccess, onError }) => {
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [summary, setSummary] = useState<InvestmentSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newInvestment, setNewInvestment] = useState({
        assetName: '',
        assetType: 'STOCK' as Investment['assetType'],
        quantity: '',
        unitPrice: '',
        totalInvested: '',
        broker: '',
        notes: ''
    });

    const fetchInvestments = async () => {
        setIsLoading(true);
        try {
            const res = await apiService.get<any>('/admin/investments');
            if (res.success) {
                setInvestments(res.data.investments || []);
                setSummary(res.data.summary || null);
            }
        } catch (error) {
            console.error('Erro ao carregar investimentos:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvestments();
    }, []);

    const handleAddInvestment = async () => {
        try {
            const res = await apiService.post<any>('/admin/investments', {
                assetName: newInvestment.assetName,
                assetType: newInvestment.assetType,
                quantity: parseFloat(newInvestment.quantity) || 0,
                unitPrice: parseFloat(newInvestment.unitPrice) || 0,
                totalInvested: parseFloat(newInvestment.totalInvested) || 0,
                broker: newInvestment.broker || undefined,
                notes: newInvestment.notes || undefined
            });

            if (res.success) {
                onSuccess('Investimento Registrado', res.message);
                setShowAddModal(false);
                setNewInvestment({ assetName: '', assetType: 'STOCK', quantity: '', unitPrice: '', totalInvested: '', broker: '', notes: '' });
                fetchInvestments();
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro ao Registrar', error.message);
        }
    };

    const handleReceiveDividend = async (id: number, reinvest: boolean) => {
        const amount = prompt('Valor do dividendo recebido (R$):');
        if (!amount) return;

        try {
            const res = await apiService.post<any>(`/admin/investments/${id}/dividends`, {
                amount: parseFloat(amount),
                reinvest
            });

            if (res.success) {
                onSuccess('Dividendo Registrado', res.message);
                fetchInvestments();
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    const handleSellInvestment = async (id: number, assetName: string) => {
        const saleValue = prompt(`Valor total de venda de ${assetName} (R$):`);
        if (!saleValue) return;

        try {
            const res = await apiService.post<any>(`/admin/investments/${id}/sell`, {
                saleValue: parseFloat(saleValue)
            });

            if (res.success) {
                onSuccess('Venda Registrada', res.message);
                fetchInvestments();
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    const handleUpdateValue = async (id: number, assetName: string) => {
        const newValue = prompt(`Novo valor de mercado de ${assetName} (R$):`);
        if (!newValue) return;

        try {
            const res = await apiService.patch<any>(`/admin/investments/${id}`, {
                currentValue: parseFloat(newValue)
            });

            if (res.success) {
                onSuccess('Atualizado', 'Valor de mercado atualizado!');
                fetchInvestments();
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header com Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Disponível para Investir */}
                <div className="bg-gradient-to-br from-primary-500/10 to-cyan-500/5 border border-primary-500/20 rounded-3xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                            <PiggyBank size={20} className="text-primary-400" />
                        </div>
                        <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Disponível</span>
                    </div>
                    <p className="text-2xl font-black text-white">
                        R$ {summary?.availableReserve.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </p>
                </div>

                {/* Total Investido */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Briefcase size={20} className="text-blue-400" />
                        </div>
                        <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Investido</span>
                    </div>
                    <p className="text-2xl font-black text-white">
                        R$ {summary?.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </p>
                </div>

                {/* Valor Atual */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <TrendingUp size={20} className="text-emerald-400" />
                        </div>
                        <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Valor Atual</span>
                    </div>
                    <p className="text-2xl font-black text-white">
                        R$ {summary?.totalCurrentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </p>
                    {summary && summary.totalProfitLoss !== 0 && (
                        <p className={`text-xs font-bold mt-1 flex items-center gap-1 ${summary.totalProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {summary.totalProfitLoss >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {summary.totalProfitLoss >= 0 ? '+' : ''}{summary.totalProfitLossPercent.toFixed(2)}%
                        </p>
                    )}
                </div>

                {/* Dividendos */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <Coins size={20} className="text-amber-400" />
                        </div>
                        <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Dividendos</span>
                    </div>
                    <p className="text-2xl font-black text-white">
                        R$ {summary?.totalDividends.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </p>
                </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">Meus Investimentos</h2>
                <div className="flex gap-3">
                    <button
                        onClick={fetchInvestments}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-primary-500 hover:bg-primary-400 text-black px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-black transition-colors"
                    >
                        <Plus size={18} />
                        Novo Investimento
                    </button>
                </div>
            </div>

            {/* Lista de Investimentos */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <RefreshCw size={32} className="animate-spin text-primary-500" />
                </div>
            ) : investments.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center">
                    <Briefcase size={48} className="text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500 font-bold">Nenhum investimento registrado</p>
                    <p className="text-zinc-600 text-sm mt-2">Clique em "Novo Investimento" para começar</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {investments.map((inv) => (
                        <div key={inv.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase border ${assetTypeColors[inv.assetType]}`}>
                                        {assetTypeLabels[inv.assetType]}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{inv.assetName}</h3>
                                        <p className="text-xs text-zinc-500">
                                            {inv.quantity > 0 && `${inv.quantity} unid. × R$ ${inv.unitPrice.toFixed(2)} • `}
                                            {inv.broker && `${inv.broker} • `}
                                            {new Date(inv.investedAt).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-xs text-zinc-500 uppercase font-bold">Investido</p>
                                        <p className="text-lg font-bold text-white">R$ {inv.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-xs text-zinc-500 uppercase font-bold">Atual</p>
                                        <p className="text-lg font-bold text-white">R$ {inv.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        <p className={`text-xs font-bold flex items-center gap-1 justify-end ${inv.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {inv.profitLoss >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                            {inv.profitLoss >= 0 ? '+' : ''}{inv.profitLossPercent.toFixed(2)}%
                                        </p>
                                    </div>

                                    {inv.dividendsReceived > 0 && (
                                        <div className="text-right">
                                            <p className="text-xs text-zinc-500 uppercase font-bold">Dividendos</p>
                                            <p className="text-lg font-bold text-amber-400">R$ {inv.dividendsReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleUpdateValue(inv.id, inv.assetName)}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                                        title="Atualizar valor de mercado"
                                    >
                                        Atualizar
                                    </button>
                                    <button
                                        onClick={() => handleReceiveDividend(inv.id, false)}
                                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                                        title="Registrar dividendo"
                                    >
                                        +Dividendo
                                    </button>
                                    <button
                                        onClick={() => handleSellInvestment(inv.id, inv.assetName)}
                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                                        title="Vender investimento"
                                    >
                                        Vender
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Adicionar Investimento */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-white mb-6">Registrar Novo Investimento</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-zinc-400 font-bold uppercase block mb-2">Nome do Ativo</label>
                                <input
                                    type="text"
                                    placeholder="Ex: ITSA4, MXRF11, Tesouro IPCA+ 2029"
                                    value={newInvestment.assetName}
                                    onChange={e => setNewInvestment({ ...newInvestment, assetName: e.target.value })}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 font-bold uppercase block mb-2">Tipo</label>
                                <select
                                    value={newInvestment.assetType}
                                    onChange={e => setNewInvestment({ ...newInvestment, assetType: e.target.value as Investment['assetType'] })}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:outline-none"
                                >
                                    <option value="STOCK">Ação</option>
                                    <option value="FII">Fundo Imobiliário (FII)</option>
                                    <option value="BOND">Renda Fixa (Tesouro, CDB, LCI, LCA)</option>
                                    <option value="ETF">ETF</option>
                                    <option value="OTHER">Outro</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-zinc-400 font-bold uppercase block mb-2">Quantidade</label>
                                    <input
                                        type="number"
                                        placeholder="Ex: 100"
                                        value={newInvestment.quantity}
                                        onChange={e => setNewInvestment({ ...newInvestment, quantity: e.target.value })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-400 font-bold uppercase block mb-2">Preço Unitário (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="Ex: 10.50"
                                        value={newInvestment.unitPrice}
                                        onChange={e => setNewInvestment({ ...newInvestment, unitPrice: e.target.value })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 font-bold uppercase block mb-2">Valor Total Investido (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Ex: 1050.00"
                                    value={newInvestment.totalInvested}
                                    onChange={e => setNewInvestment({ ...newInvestment, totalInvested: e.target.value })}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary-500 focus:outline-none"
                                />
                                {summary && parseFloat(newInvestment.totalInvested) > summary.availableReserve && (
                                    <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                                        <AlertTriangle size={12} />
                                        Valor excede o disponível (R$ {summary.availableReserve.toFixed(2)})
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 font-bold uppercase block mb-2">Corretora (opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Rico, XP, BTG"
                                    value={newInvestment.broker}
                                    onChange={e => setNewInvestment({ ...newInvestment, broker: e.target.value })}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 font-bold uppercase block mb-2">Observações (opcional)</label>
                                <textarea
                                    placeholder="Notas sobre o investimento..."
                                    value={newInvestment.notes}
                                    onChange={e => setNewInvestment({ ...newInvestment, notes: e.target.value })}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary-500 focus:outline-none resize-none"
                                    rows={2}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddInvestment}
                                disabled={!newInvestment.assetName || !newInvestment.totalInvested}
                                className="flex-1 bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-black py-3 rounded-xl font-black transition-colors"
                            >
                                Registrar Investimento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
