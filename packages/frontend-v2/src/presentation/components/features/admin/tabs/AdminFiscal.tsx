import { useState, useEffect, useCallback } from 'react';
import { FileText, TrendingUp, TrendingDown, Wallet, ArrowUpRight, Loader2, Calendar, DollarSign, PieChart, Activity } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

export const AdminFiscal = () => {
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState<any>(null);
    const [selectedMonth, setSelectedMonth] = useState(0);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const loadReport = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiService.get<any>(`/admin/fiscal/report?month=${selectedMonth}&year=${selectedYear}`);
            if (res.success) {
                setReport(res.data);
            }
        } catch (error) {
            console.error('Erro ao buscar relatório fiscal:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header com Filtros */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <Activity className="text-primary-500" /> Resultado Econômico
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">DRE Gerencial: Fluxo de Caixa e Lucratividade Real.</p>
                </div>

                <div className="flex items-center gap-4 bg-black/40 p-2 rounded-2xl border border-zinc-800">
                    <div className="flex items-center gap-2 px-4">
                        <Calendar size={16} className="text-zinc-500" />
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer"
                        >
                            <option value={0} className="bg-zinc-900">Todo o Período</option>
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1} className="bg-zinc-900">
                                    {new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="w-px h-6 bg-zinc-800"></div>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-transparent text-white font-bold text-sm focus:outline-none px-4 cursor-pointer"
                    >
                        <option value={2025} className="bg-zinc-900">2025</option>
                        <option value={2026} className="bg-zinc-900">2026</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="text-primary-500 animate-spin" size={48} />
                    <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">Processando dados financeiros...</p>
                </div>
            ) : report ? (
                <>
                    {/* FLUXO DE CAIXA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="p-4 bg-emerald-500/10 rounded-2xl">
                                    <TrendingUp className="text-emerald-500" size={24} />
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">Entradas Totais</span>
                            </div>
                            <h3 className="text-3xl font-black text-white mb-1">{formatCurrency(report.total_inflow)}</h3>
                            <p className="text-xs text-zinc-500">Depósitos, Vendas, Aportes</p>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] relative overflow-hidden group hover:border-red-500/30 transition-all">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="p-4 bg-red-500/10 rounded-2xl">
                                    <TrendingDown className="text-red-500" size={24} />
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-3 py-1 rounded-full">Saídas Totais</span>
                            </div>
                            <h3 className="text-3xl font-black text-white mb-1">{formatCurrency(report.total_outflow)}</h3>
                            <p className="text-xs text-zinc-500">Saques, Pagamentos a Terceiros</p>
                        </div>
                    </div>

                    {/* DRE SIMPLIFICADO */}
                    <div className="bg-black/40 border border-zinc-800 rounded-[2.5rem] overflow-hidden backdrop-blur-sm">
                        <div className="p-8 border-b border-zinc-800 bg-zinc-900/50">
                            <h3 className="font-black text-white uppercase text-xs tracking-[0.2em] flex items-center gap-2">
                                <PieChart size={16} className="text-primary-500" />
                                Demonstração do Resultado
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
                            {/* Receita Operacional */}
                            <div className="p-8 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                        <Wallet size={20} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Faturamento Bruto</p>
                                        <p className="text-2xl font-black text-white">{formatCurrency(report.gross_revenue)}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Comissões Marketplace</p>
                                        <p className="text-xl font-black text-white">{formatCurrency(report.details.marketplace_commissions)}</p>
                                    </div>
                                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Margem Logística (27.5%)</p>
                                        <p className="text-xl font-black text-white">{formatCurrency(report.details.logistics_margin)}</p>
                                    </div>
                                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Taxas de Manutenção</p>
                                        <p className="text-xl font-black text-white">{formatCurrency(report.details.quota_maintenance_fees)}</p>
                                    </div>
                                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Taxa de Manutenção de Apoios</p>
                                        <p className="text-xl font-black text-white">{formatCurrency(report.details.loan_interest_revenue)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Distribuição */}
                            <div className="p-8 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                                        <ArrowUpRight size={20} className="text-orange-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Distribuição (Div. Passivo)</p>
                                        <p className="text-2xl font-black text-white">{formatCurrency(report.total_dividends)}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-500 leading-relaxed mt-4">
                                    Valor total repassado aos cotistas como excedentes. Isso é custo de capital e reduz o excedente retido do sistema.
                                </p>
                            </div>

                            {/* Resultado Líquido */}
                            <div className="p-8 space-y-4 bg-primary-500/5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
                                        <DollarSign size={20} className="text-black" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-primary-300 font-black uppercase tracking-widest">Excedente Operacional Líquido</p>
                                        <p className="text-2xl font-black text-white">{formatCurrency(report.net_profit)}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-primary-200/60 leading-relaxed mt-4 relative z-10">
                                    Resultado final após pagamento de todas as obrigações e distribuições. Este valor compõe o fundo de reserva e proteção.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Legal */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl flex items-center gap-4">
                            <FileText className="text-zinc-600 shrink-0" size={24} />
                            <div>
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Nota Legal</p>
                                <p className="text-[10px] text-zinc-600 leading-relaxed max-w-sm">
                                    {report.legal_notice}
                                </p>
                            </div>
                        </div>
                        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Caixa de Terceiros (Transiente)</p>
                                <p className="text-[10px] text-zinc-600">Custódia temporária</p>
                            </div>
                            <p className="text-xl font-bold text-zinc-500">{formatCurrency(report.details.volume_transitory)}</p>
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-[2.5rem] border-dashed">
                    <p className="text-zinc-500">Nenhum dado financeiro encontrado para este período.</p>
                </div>
            )}
        </div>
    );
};
