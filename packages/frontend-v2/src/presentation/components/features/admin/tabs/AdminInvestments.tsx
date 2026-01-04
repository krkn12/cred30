import React, { useState, useEffect } from 'react';
import {
    TrendingUp, Plus, RefreshCw, Briefcase, PiggyBank,
    ArrowUpRight, ArrowDownRight, Coins, AlertTriangle,
    Activity
} from 'lucide-react';
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
    status: string;
}

interface InvestmentSold {
    id: number;
    assetName: string;
    assetType: 'STOCK' | 'FII' | 'BOND' | 'ETF' | 'OTHER';
    quantity: number;
    unitPrice: number;
    totalInvested: number;
    saleValue: number;
    soldAt: string;
    dividendsReceived: number;
    broker?: string;
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
    const [soldHistory, setSoldHistory] = useState<InvestmentSold[]>([]);
    const [summary, setSummary] = useState<InvestmentSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Modais
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSellModal, setShowSellModal] = useState<Investment | null>(null);
    const [showDividendModal, setShowDividendModal] = useState<Investment | null>(null);
    const [showUpdateModal, setShowUpdateModal] = useState<Investment | null>(null);

    // Estados dos formulários
    const [newInvestment, setNewInvestment] = useState({
        assetName: '',
        assetType: 'STOCK' as Investment['assetType'],
        quantity: '',
        unitPrice: '',
        totalInvested: '',
        broker: '',
        notes: '',
        investedAt: new Date().toISOString().split('T')[0]
    });

    const [sellData, setSellData] = useState({ saleValue: '' });
    const [dividendData, setDividendData] = useState({ amount: '', reinvest: false });
    const [updateData, setUpdateData] = useState({ currentValue: '' });

    const fetchInvestments = async () => {
        setIsLoading(true);
        try {
            const res = await apiService.get<any>('/admin/investments');
            if (res.success) {
                setInvestments(res.data.investments || []);
                setSoldHistory(res.data.sold || []);
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
                ...newInvestment,
                quantity: parseFloat(newInvestment.quantity) || 0,
                unitPrice: parseFloat(newInvestment.unitPrice) || 0,
                totalInvested: parseFloat(newInvestment.totalInvested) || 0,
            });

            if (res.success) {
                onSuccess('Investimento Registrado', res.message);
                setShowAddModal(false);
                setNewInvestment({ assetName: '', assetType: 'STOCK', quantity: '', unitPrice: '', totalInvested: '', broker: '', notes: '', investedAt: new Date().toISOString().split('T')[0] });
                fetchInvestments();
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro ao Registrar', error.message);
        }
    };

    const handleReceiveDividend = async () => {
        if (!showDividendModal) return;
        try {
            const res = await apiService.post<any>(`/admin/investments/${showDividendModal.id}/dividends`, {
                amount: parseFloat(dividendData.amount),
                reinvest: dividendData.reinvest
            });

            if (res.success) {
                onSuccess('Dividendo Registrado', res.message);
                setShowDividendModal(null);
                setDividendData({ amount: '', reinvest: false });
                fetchInvestments();
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    const handleSellInvestment = async () => {
        if (!showSellModal) return;
        try {
            const res = await apiService.post<any>(`/admin/investments/${showSellModal.id}/sell`, {
                saleValue: parseFloat(sellData.saleValue)
            });

            if (res.success) {
                onSuccess('Venda Registrada', res.message);
                setShowSellModal(null);
                setSellData({ saleValue: '' });
                fetchInvestments();
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    const handleUpdateValue = async () => {
        if (!showUpdateModal) return;
        try {
            const res = await apiService.patch<any>(`/admin/investments/${showUpdateModal.id}`, {
                currentValue: parseFloat(updateData.currentValue)
            });

            if (res.success) {
                onSuccess('Atualizado', 'Valor de mercado atualizado!');
                setShowUpdateModal(null);
                setUpdateData({ currentValue: '' });
                fetchInvestments();
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    return (
        <div className="space-y-8 pb-32">
            {/* Header com Resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-primary-500/10 to-cyan-500/5 border border-primary-500/20 rounded-3xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-primary-500/20 flex items-center justify-center">
                            <PiggyBank size={18} className="text-primary-400" />
                        </div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Disponível</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-white">
                        R$ {summary?.availableReserve.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </p>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Briefcase size={18} className="text-blue-400" />
                        </div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Alocado</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-white">
                        R$ {summary?.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </p>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <TrendingUp size={18} className="text-emerald-400" />
                        </div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Valor Atual</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-white">
                        R$ {summary?.totalCurrentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </p>
                    {summary && summary.totalProfitLoss !== 0 && (
                        <p className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${summary.totalProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {summary.totalProfitLoss >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {summary.totalProfitLoss >= 0 ? '+' : ''}{summary.totalProfitLossPercent.toFixed(2)}%
                        </p>
                    )}
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <Coins size={18} className="text-amber-400" />
                        </div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Dividendos</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-white">
                        R$ {summary?.totalDividends.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </p>
                </div>
            </div>

            {/* Ações e Lista Ativa */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Briefcase className="text-primary-400" size={24} />
                        <h2 className="text-xl font-black text-white">Alocações Ativas</h2>
                    </div>
                    <div className="flex gap-2 sm:gap-3">
                        <button
                            onClick={fetchInvestments}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white p-2.5 rounded-xl transition-colors"
                        >
                            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-primary-500 hover:bg-primary-400 text-black px-4 sm:px-6 py-2.5 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-black transition-colors"
                        >
                            <Plus size={18} />
                            <span className="hidden sm:inline">Nova Alocação</span>
                            <span className="sm:hidden">Nova</span>
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <RefreshCw size={32} className="animate-spin text-primary-500" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {investments.map((inv) => (
                            <div key={inv.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 group">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase border mb-2 ${assetTypeColors[inv.assetType]}`}>
                                            {assetTypeLabels[inv.assetType]}
                                        </div>
                                        <h3 className="text-lg font-black text-white">{inv.assetName}</h3>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-white">R$ {inv.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        <p className={`text-[10px] font-bold ${inv.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {inv.profitLoss >= 0 ? '+' : ''}{inv.profitLossPercent.toFixed(2)}%
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 py-4 border-y border-white/5 mb-4">
                                    <div>
                                        <p className="text-[9px] text-zinc-500 uppercase font-black mb-1">Preço Médio</p>
                                        <p className="text-sm font-bold text-zinc-300">R$ {inv.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-zinc-500 uppercase font-black mb-1">Qtd</p>
                                        <p className="text-sm font-bold text-zinc-300">{inv.quantity.toLocaleString('pt-BR')}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-zinc-500 uppercase font-black mb-1">Dividendos</p>
                                        <p className="text-sm font-bold text-amber-400">R$ {inv.dividendsReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setShowUpdateModal(inv); setUpdateData({ currentValue: inv.currentValue.toString() }); }}
                                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-xl text-[10px] font-black uppercase transition-colors"
                                    >
                                        Cotação
                                    </button>
                                    <button
                                        onClick={() => setShowDividendModal(inv)}
                                        className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 py-2.5 rounded-xl text-[10px] font-black uppercase transition-colors"
                                    >
                                        Dividendos
                                    </button>
                                    <button
                                        onClick={() => setShowSellModal(inv)}
                                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2.5 rounded-xl text-[10px] font-black uppercase transition-colors"
                                    >
                                        Vender
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Histórico de Liquidação */}
            {soldHistory.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="text-zinc-500" size={24} />
                        <h2 className="text-xl font-black text-white">Histórico de Liquidação</h2>
                    </div>

                    <div className="overflow-x-auto rounded-3xl border border-zinc-800 bg-zinc-900/30">
                        <table className="w-full text-left">
                            <thead className="bg-zinc-900 border-b border-zinc-800 text-[10px] font-black uppercase text-zinc-500">
                                <tr>
                                    <th className="px-6 py-4">Ativo</th>
                                    <th className="px-6 py-4">Custo</th>
                                    <th className="px-6 py-4">Venda</th>
                                    <th className="px-6 py-4">Resultado</th>
                                    <th className="px-6 py-4">Data</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {soldHistory.map((inv) => (
                                    <tr key={inv.id} className="text-sm hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-bold text-white">{inv.assetName}</td>
                                        <td className="px-6 py-4 text-zinc-400">R$ {inv.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="px-6 py-4 text-zinc-100 font-bold">R$ {inv.saleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className={`px-6 py-4 font-black ${inv.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {inv.profitLoss >= 0 ? '+' : ''}R$ {inv.profitLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-500 text-xs">{new Date(inv.soldAt).toLocaleDateString('pt-BR')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modais */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 sm:p-10 w-full max-w-2xl animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh] scrollbar-hide" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-primary-500/20 rounded-2xl flex items-center justify-center border border-primary-500/20">
                                <Plus size={24} className="text-primary-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white">Nova Alocação</h3>
                                <p className="text-sm text-zinc-500">Registre a compra de um novo ativo</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-zinc-400 font-black uppercase mb-2 block">Nome do Ativo</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: ITSA4"
                                        value={newInvestment.assetName}
                                        onChange={e => setNewInvestment({ ...newInvestment, assetName: e.target.value })}
                                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary-500 focus:outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-zinc-400 font-black uppercase mb-2 block">Tipo</label>
                                        <select
                                            value={newInvestment.assetType}
                                            onChange={e => setNewInvestment({ ...newInvestment, assetType: e.target.value as Investment['assetType'] })}
                                            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:outline-none"
                                        >
                                            <option value="STOCK">Ação</option>
                                            <option value="FII">FII</option>
                                            <option value="BOND">Renda Fixa</option>
                                            <option value="ETF">ETF</option>
                                            <option value="OTHER">Outros</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-400 font-black uppercase mb-2 block">Qtd</label>
                                        <input
                                            type="number"
                                            value={newInvestment.quantity}
                                            onChange={e => setNewInvestment({ ...newInvestment, quantity: e.target.value })}
                                            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-400 font-black uppercase mb-2 block">Preço Unitário (R$)</label>
                                    <input
                                        type="number"
                                        value={newInvestment.unitPrice}
                                        onChange={e => setNewInvestment({ ...newInvestment, unitPrice: e.target.value })}
                                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-zinc-400 font-black uppercase mb-2 block">Total Alocado (R$)</label>
                                    <input
                                        type="number"
                                        value={newInvestment.totalInvested}
                                        onChange={e => setNewInvestment({ ...newInvestment, totalInvested: e.target.value })}
                                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:outline-none"
                                    />
                                    {summary && parseFloat(newInvestment.totalInvested) > summary.availableReserve && (
                                        <div className="flex items-center gap-1.5 mt-2 text-red-400">
                                            <AlertTriangle size={12} />
                                            <span className="text-[10px] font-bold uppercase">Saldo Insuficiente</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-400 font-black uppercase mb-2 block">Instituição / Corretora</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: BTG Pactual"
                                        value={newInvestment.broker}
                                        onChange={e => setNewInvestment({ ...newInvestment, broker: e.target.value })}
                                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-400 font-black uppercase mb-2 block">Data da Compra</label>
                                    <input
                                        type="date"
                                        value={newInvestment.investedAt}
                                        onChange={e => setNewInvestment({ ...newInvestment, investedAt: e.target.value })}
                                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-4">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-all">Cancelar</button>
                            <button onClick={handleAddInvestment} className="flex-1 py-4 rounded-2xl bg-primary-500 hover:bg-primary-400 text-black font-black uppercase text-sm transition-all shadow-xl shadow-primary-500/20">Registrar</button>
                        </div>
                    </div>
                </div>
            )}

            {showSellModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={() => setShowSellModal(null)}>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-white text-center mb-6">Liquidar {showSellModal.assetName}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-zinc-400 font-black uppercase mb-2 block text-center">Valor Total da Venda (R$)</label>
                                <input
                                    type="number"
                                    autoFocus
                                    value={sellData.saleValue}
                                    onChange={e => setSellData({ saleValue: e.target.value })}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 text-2xl font-black text-white text-center focus:border-red-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="mt-8 flex gap-3">
                            <button onClick={() => setShowSellModal(null)} className="flex-1 py-3 text-zinc-500 font-bold">Cancelar</button>
                            <button onClick={handleSellInvestment} className="flex-2 bg-red-500 hover:bg-red-400 text-white py-3 px-6 rounded-xl font-black uppercase text-xs">Confirmar Venda</button>
                        </div>
                    </div>
                </div>
            )}

            {showDividendModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={() => setShowDividendModal(null)}>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-white text-center mb-6">Registrar Dividendos</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-zinc-400 font-black uppercase mb-2 block text-center">Valor (R$)</label>
                                <input
                                    type="number"
                                    autoFocus
                                    value={dividendData.amount}
                                    onChange={e => setDividendData({ ...dividendData, amount: e.target.value })}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 text-2xl font-black text-white text-center focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                            <label className="flex items-center gap-3 bg-zinc-800/50 p-4 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={dividendData.reinvest}
                                    onChange={e => setDividendData({ ...dividendData, reinvest: e.target.checked })}
                                    className="w-5 h-5 rounded border-zinc-700 text-primary-500 focus:ring-primary-500"
                                />
                                <span className="text-xs font-bold text-zinc-300">Reinvestir Reais</span>
                            </label>
                        </div>
                        <div className="mt-8 flex gap-3">
                            <button onClick={() => setShowDividendModal(null)} className="flex-1 py-3 text-zinc-500 font-bold">Cancelar</button>
                            <button onClick={handleReceiveDividend} className="flex-2 bg-amber-500 hover:bg-amber-400 text-black py-3 px-6 rounded-xl font-black uppercase text-xs">Registrar</button>
                        </div>
                    </div>
                </div>
            )}

            {showUpdateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={() => setShowUpdateModal(null)}>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                                <Activity size={32} className="text-blue-400" />
                            </div>
                        </div>
                        <h3 className="text-xl font-black text-white text-center mb-2">Atualizar Cotação</h3>
                        <p className="text-zinc-500 text-xs text-center mb-6">Preço de mercado atual de {showUpdateModal.assetName}</p>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-zinc-400 font-black uppercase mb-2 block text-center">Valor Atual de Mercado (R$)</label>
                                <input
                                    type="number"
                                    autoFocus
                                    value={updateData.currentValue}
                                    onChange={e => setUpdateData({ currentValue: e.target.value })}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 text-2xl font-black text-white text-center focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="mt-8 flex gap-3">
                            <button onClick={() => setShowUpdateModal(null)} className="flex-1 py-3 text-zinc-500 font-bold">Cancelar</button>
                            <button onClick={handleUpdateValue} className="flex-2 bg-blue-500 hover:bg-blue-400 text-white py-3 px-6 rounded-xl font-black uppercase text-xs">Atualizar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
