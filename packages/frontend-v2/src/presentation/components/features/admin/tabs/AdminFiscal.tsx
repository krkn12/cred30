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
                    {/* FLUXO DE CAIXA E PERFORMANCE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-[2rem] relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-emerald-500/10 transition-colors"></div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                                    <TrendingUp className="text-emerald-500" size={20} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Entradas</span>
                            </div>
                            <h3 className="text-2xl font-black text-white">{formatCurrency(report.total_inflow)}</h3>
                            <p className="text-[9px] text-zinc-500 mt-1 uppercase font-bold tracking-tighter">Volume Total Bruto</p>
                        </div>

                        <div className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-[2rem] relative overflow-hidden group hover:border-red-500/30 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-red-500/10 transition-colors"></div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-red-500/10 rounded-xl">
                                    <TrendingDown className="text-red-500" size={20} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-red-500/80">Saídas</span>
                            </div>
                            <h3 className="text-2xl font-black text-white">{formatCurrency(report.total_outflow)}</h3>
                            <p className="text-[9px] text-zinc-500 mt-1 uppercase font-bold tracking-tighter">Resgates e Operação</p>
                        </div>

                        <div className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-[2rem] relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-blue-500/10 transition-colors"></div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-blue-500/10 rounded-xl">
                                    <Activity className="text-blue-500" size={20} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500/80">Lucro Operacional</span>
                            </div>
                            <h3 className="text-2xl font-black text-white">{formatCurrency(report.gross_revenue)}</h3>
                            <p className="text-[9px] text-zinc-500 mt-1 uppercase font-bold tracking-tighter">Margem de Serviços</p>
                        </div>

                        <div className="bg-primary-500/5 border border-primary-500/20 p-6 rounded-[2rem] relative overflow-hidden group hover:border-primary-500/40 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-primary-500/20 transition-colors"></div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-primary-500/20 rounded-xl">
                                    <DollarSign className="text-primary-400" size={20} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary-400">Resultado Líquido</span>
                            </div>
                            <h3 className="text-2xl font-black text-white">{formatCurrency(report.net_profit)}</h3>
                            <p className="text-[9px] text-primary-400/60 mt-1 uppercase font-bold tracking-tighter">Excedente Retido</p>
                        </div>
                    </div>

                    {/* DRE DETALHADA */}
                    <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-[2.5rem] overflow-hidden backdrop-blur-xl">
                        <div className="p-8 border-b border-zinc-800/50 bg-zinc-900/40 flex items-center justify-between">
                            <h3 className="font-black text-white uppercase text-[10px] tracking-[0.25em] flex items-center gap-3">
                                <PieChart size={18} className="text-primary-500" />
                                Demonstração do Resultado Detalhada
                            </h3>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 bg-black/30 px-3 py-1.5 rounded-full border border-zinc-800">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Dados em tempo real
                            </div>
                        </div>

                        <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                            {/* Coluna 1: Origem das Receitas */}
                            <div className="space-y-6">
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Origem das Receitas
                                </p>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Comissões Marketplace', val: report.details.marketplace_commissions, color: 'text-blue-400' },
                                        { label: 'Margem Logística', val: report.details.logistics_margin, color: 'text-emerald-400' },
                                        { label: 'Taxas de Manutenção', val: report.details.quota_maintenance_fees, color: 'text-orange-400' },
                                        { label: 'Juros de Apoios', val: report.details.loan_interest_revenue, color: 'text-purple-400' },
                                        { label: 'Educação / Cursos', val: report.details.education_revenue, color: 'text-indigo-400' },
                                        { label: 'Vídeos e Patrocínios', val: report.details.promo_videos_revenue, color: 'text-pink-400' },
                                        { label: 'Monetização e Selos', val: report.details.monetization_revenue, color: 'text-primary-400' },
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-zinc-800/20 hover:bg-zinc-800/40 border border-zinc-800/50 rounded-2xl transition-all group">
                                            <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-300 transition-colors">{item.label}</span>
                                            <span className={`text-sm font-black ${item.color}`}>{formatCurrency(item.val)}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl mt-4">
                                        <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Receita Operacional Bruta</span>
                                        <span className="text-lg font-black text-white">{formatCurrency(report.gross_revenue)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Coluna 2: Destinação e Resultado */}
                            <div className="space-y-6">
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div> Distribuições e Reservas
                                </p>
                                <div className="space-y-4">
                                    <div className="p-6 bg-orange-500/5 border border-orange-500/20 rounded-3xl group transition-all">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Dividendos Pagos</span>
                                            <ArrowUpRight size={16} className="text-orange-500" />
                                        </div>
                                        <h4 className="text-xl font-black text-white mb-2">{formatCurrency(report.total_dividends)}</h4>
                                        <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                                            Valor total repassado aos cotistas como recompensa pela liquidez fornecida ao sistema.
                                        </p>
                                    </div>

                                    <div className="p-6 bg-primary-500/5 border border-primary-500/20 rounded-3xl group transition-all">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Excedente Retido</span>
                                            <DollarSign size={16} className="text-primary-500" />
                                        </div>
                                        <h4 className="text-xl font-black text-white mb-2">{formatCurrency(report.net_profit)}</h4>
                                        <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                                            Capital reinvestido no fundo de reserva para garantir a segurança e o crescimento da plataforma.
                                        </p>
                                    </div>

                                    <div className="mt-8 p-6 bg-zinc-800/20 border border-zinc-800 rounded-3xl flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-zinc-800 rounded-xl">
                                                <Wallet className="text-zinc-500" size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Custódia de Terceiros</p>
                                                <p className="text-[9px] text-zinc-600 font-bold uppercase mt-0.5">Dinheiro em Trânsito</p>
                                            </div>
                                        </div>
                                        <p className="text-lg font-black text-zinc-400">{formatCurrency(report.details.volume_transitory)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Banner de Rodapé Legal */}
                        <div className="px-8 py-6 bg-black/40 border-t border-zinc-800/50 flex flex-col md:flex-row items-center gap-6 justify-between">
                            <div className="flex items-center gap-4 max-w-2xl">
                                <FileText className="text-zinc-700 shrink-0" size={20} />
                                <p className="text-[9px] text-zinc-600 font-bold leading-relaxed uppercase tracking-tight">
                                    {report.legal_notice}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Geração de Relatório</p>
                                    <p className="text-[10px] font-black text-zinc-500">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            </div>
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
