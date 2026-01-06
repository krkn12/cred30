import { useState, useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, XCircle, Search, Filter, Calendar, DollarSign, TrendingUp, TrendingDown, Receipt, ChevronDown, Loader2 } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import { Transaction } from '../../../domain/types/common.types';
import { AdBanner } from '../ui/AdBanner';

interface HistoryViewProps {
    transactions: Transaction[];
    isPro?: boolean;
}

type FilterType = 'ALL' | 'IN' | 'OUT';
type StatusFilter = 'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED';

export const HistoryView = ({ transactions: initialTransactions, isPro }: HistoryViewProps) => {
    const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions || []);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<FilterType>('ALL');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [showFilters, setShowFilters] = useState(false);
    const [hasMore, setHasMore] = useState(initialTransactions?.length === 20); // /sync returns 20
    const [offset, setOffset] = useState(initialTransactions?.length || 0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const LIMIT = 20;

    const fetchMore = async () => {
        setIsLoadingMore(true);
        try {
            const res = await apiService.getUserTransactions({ limit: LIMIT, offset });
            if (res.success) {
                const newTx = res.data?.transactions || [];
                setTransactions(prev => [...prev, ...newTx]);
                setHasMore(newTx.length === LIMIT);
                setOffset(prev => prev + newTx.length);
            }
        } catch (e) {
            console.error('Erro ao buscar mais transações:', e);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Classificar tipos de transação
    const isIncoming = (type: string) => ['DEPOSIT', 'DIVIDEND', 'REFERRAL_BONUS', 'LOAN_RECEIVED', 'QUOTA_SELL', 'EDUCATION_REWARD', 'ADMIN_GIFT'].includes(type);
    const isOutgoing = (type: string) => ['WITHDRAWAL', 'LOAN_PAYMENT', 'QUOTA_PURCHASE', 'LOAN_INSTALLMENT'].includes(type);

    // Traduzir tipos
    const translateType = (type: string) => {
        const map: Record<string, string> = {
            'DEPOSIT': 'Adesão Social',
            'WITHDRAWAL': 'Resgate de Capital',
            'DIVIDEND': 'Excedente Operacional',
            'REFERRAL_BONUS': 'Bônus de Indicação',
            'LOAN_RECEIVED': 'Apoio Mútuo Recebido',
            'QUOTA_SELL': 'Cessão de Participação',
            'EDUCATION_REWARD': 'Recompensa Educacional',
            'ADMIN_GIFT': 'Presente Administrativo',
            'LOAN_PAYMENT': 'Quitação de Apoio Mútuo',
            'QUOTA_PURCHASE': 'Aporte em Participação',
            'LOAN_INSTALLMENT': 'Reposição de Apoio',
            'PRO_UPGRADE': 'Assinatura Cred30 PRO',
        };
        return map[type] || type;
    };

    // Traduzir status
    const translateStatus = (status: string) => {
        const map: Record<string, string> = {
            'APPROVED': 'Aprovado',
            'PENDING': 'Pendente',
            'REJECTED': 'Rejeitado',
            'PAYMENT_PENDING': 'Aguardando Pagamento',
            'COMPLETED': 'Concluído',
        };
        return map[status] || status;
    };

    // Filtrar transações
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            // Filtro de busca
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const matchDesc = t.description?.toLowerCase().includes(search);
                const matchType = translateType(t.type).toLowerCase().includes(search);
                const matchAmount = t.amount.toString().includes(search);
                if (!matchDesc && !matchType && !matchAmount) return false;
            }

            // Filtro de tipo
            if (typeFilter === 'IN' && !isIncoming(t.type)) return false;
            if (typeFilter === 'OUT' && !isOutgoing(t.type)) return false;

            // Filtro de status
            if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

            return true;
        });
    }, [transactions, searchTerm, typeFilter, statusFilter]);

    // Calcular totais
    const totals = useMemo(() => {
        const incoming = filteredTransactions.filter(t => isIncoming(t.type)).reduce((sum, t) => sum + t.amount, 0);
        const outgoing = filteredTransactions.filter(t => isOutgoing(t.type)).reduce((sum, t) => sum + t.amount, 0);
        return { incoming, outgoing, net: incoming - outgoing };
    }, [filteredTransactions]);

    // Agrupar por data
    const groupedTransactions = useMemo(() => {
        const groups: Record<string, Transaction[]> = {};
        filteredTransactions.forEach(t => {
            const date = new Date(t.date || t.created_at || new Date()).toLocaleDateString('pt-BR');
            if (!groups[date]) groups[date] = [];
            groups[date].push(t);
        });
        return groups;
    }, [filteredTransactions]);

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });


    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-32">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">Extrato Completo</h1>
                    <p className="text-zinc-400 text-sm mt-1">{filteredTransactions.length} transações encontradas</p>
                </div>
            </div>


            {/* Cards de resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="glass p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={16} className="text-emerald-400" />
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Entradas</span>
                    </div>
                    <p className="text-lg sm:text-xl font-black text-emerald-400">{formatCurrency(totals.incoming)}</p>
                </div>
                <div className="glass p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingDown size={16} className="text-red-400" />
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Saídas</span>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-red-400">{formatCurrency(totals.outgoing)}</p>
                </div>
                <div className="col-span-2 sm:col-span-1 glass p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={16} className="text-primary-400" />
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Período</span>
                    </div>
                    <p className={`text-lg sm:text-xl font-bold ${totals.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(totals.net)}
                    </p>
                </div>
            </div>

            {/* Barra de busca e filtros */}
            <div className="space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar transação..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full glass rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-primary-500 outline-none transition"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition ${showFilters ? 'bg-primary-500/10 border-primary-500/30 text-primary-400' : 'bg-surface border-surfaceHighlight text-zinc-400 hover:text-white'}`}
                        aria-label="Abrir filtros"
                        title="Abrir filtros"
                    >
                        <Filter size={18} />
                        <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Filtros expandidos */}
                {showFilters && (
                    <div className="bg-surface border border-surfaceHighlight rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <label className="text-xs text-zinc-400 mb-2 block">Tipo de Transação</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: 'ALL', label: 'Todas' },
                                    { value: 'IN', label: 'Entradas' },
                                    { value: 'OUT', label: 'Saídas' },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setTypeFilter(opt.value as FilterType)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${typeFilter === opt.value ? 'bg-primary-500 text-black' : 'bg-surfaceHighlight text-zinc-400 hover:text-white'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 mb-2 block">Status</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: 'ALL', label: 'Todos' },
                                    { value: 'APPROVED', label: 'Aprovados' },
                                    { value: 'PENDING', label: 'Pendentes' },
                                    { value: 'REJECTED', label: 'Rejeitados' },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setStatusFilter(opt.value as StatusFilter)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${statusFilter === opt.value ? 'bg-primary-500 text-black' : 'bg-surfaceHighlight text-zinc-400 hover:text-white'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Lista de transações agrupadas por data */}
                {Object.keys(groupedTransactions).length === 0 ? (
                    <div className="text-center py-16 bg-surface/50 rounded-2xl border border-surfaceHighlight border-dashed">
                        <Receipt size={48} className="mx-auto text-zinc-600 mb-4" />
                        <p className="text-zinc-500">Nenhuma transação encontrada.</p>
                        {(searchTerm || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
                            <button
                                onClick={() => { setSearchTerm(''); setTypeFilter('ALL'); setStatusFilter('ALL'); }}
                                className="mt-4 text-primary-400 text-sm hover:underline"
                                aria-label="Limpar filtros"
                                title="Limpar filtros"
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
                            <div key={date} className="space-y-2">
                                {/* Cabeçalho do dia */}
                                <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium px-1">
                                    <Calendar size={14} />
                                    <span>{date}</span>
                                    <span className="text-zinc-600">•</span>
                                    <span>{dayTransactions.length} transações</span>
                                </div>

                                {/* Transações do dia */}
                                <div className="space-y-3">
                                    {dayTransactions.map((t) => {
                                        const incoming = isIncoming(t.type);
                                        const statusColor = t.status === 'APPROVED' || t.status === 'COMPLETED'
                                            ? 'text-emerald-400'
                                            : t.status === 'PENDING' || t.status === 'PAYMENT_PENDING'
                                                ? 'text-yellow-400'
                                                : 'text-red-400';
                                        const StatusIcon = t.status === 'APPROVED' || t.status === 'COMPLETED'
                                            ? CheckCircle2
                                            : t.status === 'PENDING' || t.status === 'PAYMENT_PENDING'
                                                ? Clock
                                                : XCircle;

                                        return (
                                            <div key={t.id} className="group glass glass-hover flex items-center gap-4 p-4">
                                                {/* Ícone */}
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${incoming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    {incoming ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm sm:text-base font-medium text-white truncate">{translateType(t.type)}</p>
                                                    <p className="text-[10px] sm:text-xs text-zinc-500 truncate">{t.description || `ID: ${t.id}`}</p>
                                                </div>

                                                {/* Valor e Status */}
                                                <div className="text-right shrink-0">
                                                    <p className={`text-sm sm:text-base font-bold ${incoming ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {incoming ? '+' : '-'}{formatCurrency(t.amount)}
                                                    </p>
                                                    <div className={`flex items-center justify-end gap-1 ${statusColor}`}>
                                                        <StatusIcon size={12} />
                                                        <span className="text-[10px] sm:text-xs">{translateStatus(t.status)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {hasMore && (
                            <div className="pt-4 flex justify-center pb-12">
                                <button
                                    onClick={fetchMore}
                                    disabled={isLoadingMore}
                                    className="glass glass-hover px-10 py-5 rounded-3xl flex items-center gap-4 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 group"
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
                                            <span>Buscando registros...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="w-5 h-5 text-primary-400 group-hover:translate-y-1 transition-transform" />
                                            <span>Ver transações mais antigas</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Banner promocional */}
                <div className="pt-4">
                    <AdBanner
                        type="BANNER"
                        title="Aumente seu Score Hoje!"
                        description="Nossos parceiros ajudam você a limpar seu nome e conseguir mais apoios mútuos."
                        actionText="ABRIR OFERTA"
                        hide={isPro}
                    />
                </div>
            </div>
        </div>
    );
};
