import { useState, useEffect } from 'react';
import { FileText, Download, TrendingUp, Wallet, ArrowUpRight, Loader2, Calendar } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

export const AdminFiscal = () => {
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState<any>(null);
    const [selectedMonth, setSelectedMonth] = useState(0);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        loadReport();
    }, [selectedMonth, selectedYear]);

    const loadReport = async () => {
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
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header com Filtros */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <FileText className="text-primary-500" /> Auditoria Fiscal
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">Separação de volume transacionado vs receita tributável.</p>
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
                    <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">Gerando relatório contábil...</p>
                </div>
            ) : report ? (
                <>
                    {/* Cards de Resumo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] hover:border-primary-500/30 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-4 bg-primary-500/10 rounded-2xl">
                                    <Wallet className="text-primary-500" size={24} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Volume Transacionado</p>
                                    <h3 className="text-2xl font-black text-white">{formatCurrency(report.gross_volume)}</h3>
                                </div>
                            </div>
                            <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                                Todo o dinheiro que passou pelo sistema (PIX de entrada). <span className="text-red-500 font-bold">Não é lucro</span>, apenas custódia de terceiros.
                            </p>
                        </div>

                        <div className="bg-zinc-900 border-2 border-primary-500/30 p-8 rounded-[2.5rem] shadow-[0_0_40px_rgba(6,182,212,0.05)] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-4 bg-primary-500 rounded-2xl shadow-lg shadow-primary-500/20">
                                    <TrendingUp className="text-black" size={24} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-primary-400 font-black uppercase tracking-widest">Receita Tributável</p>
                                    <h3 className="text-2xl font-black text-white">{formatCurrency(report.taxable_revenue)}</h3>
                                </div>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed font-bold">
                                Seu faturamento real (Taxas e Comissões). <span className="text-emerald-400">Esta é a base para o seu imposto</span> e emissão de NFe.
                            </p>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] hover:border-zinc-700 transition-all relative overflow-hidden">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-4 bg-zinc-800 rounded-2xl">
                                    <ArrowUpRight className="text-zinc-500" size={24} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Repasse a Terceiros</p>
                                    <h3 className="text-2xl font-black text-white">{formatCurrency(report.transitory_funds)}</h3>
                                </div>
                            </div>
                            <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                                Valores devidos a vendedores e entregadores. Representa a parte transiente do capital.
                            </p>
                        </div>
                    </div>

                    {/* Detalhamento de Receitas */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden">
                        <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Composição da Receita</h3>
                            <button className="flex items-center gap-2 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-black transition-all">
                                <Download size={14} /> Exportar para Contador
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
                            <div className="p-8">
                                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Taxas Marketplace</p>
                                <p className="text-xl font-black text-white">{formatCurrency(report.details.marketplace_fees)}</p>
                            </div>
                            <div className="p-8">
                                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Juros de Empréstimo</p>
                                <p className="text-xl font-black text-white">{formatCurrency(report.details.loan_interests)}</p>
                            </div>
                            <div className="p-8">
                                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Taxas de Resgate</p>
                                <p className="text-xl font-black text-white">{formatCurrency(report.details.withdrawal_fees)}</p>
                            </div>
                            <div className="p-8">
                                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Outras Taxas</p>
                                <p className="text-xl font-black text-white">{formatCurrency(report.details.upgrades)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Alerta de Proteção Jurídica */}
                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-8 rounded-[2.5rem] flex items-center gap-6">
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0">
                            <FileText className="text-emerald-400" size={32} />
                        </div>
                        <div>
                            <h4 className="text-emerald-400 font-black uppercase text-xs tracking-widest">Proteção do Modelo de Mandato</h4>
                            <p className="text-emerald-300/70 text-sm mt-1 leading-relaxed">
                                Este relatório foi gerado seguindo o Art. 653 do Código Civil. Ele comprova que o Cred30 atua apenas como intermediário,
                                garantindo que você pague imposto exclusivamente sobre a **Receita Tributável** ({formatCurrency(report.taxable_revenue)}) e não sobre o volume total.
                            </p>
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
