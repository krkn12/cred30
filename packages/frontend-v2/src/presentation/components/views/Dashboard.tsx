import { useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import {
    Users, Gamepad2, TrendingUp, ArrowUpFromLine, BookOpen,
    Crown, Clock, ArrowDownLeft, ArrowUpRight,
    PieChart, Star, Zap,
    ShieldCheck, ChevronRight, Wallet, Settings, BarChart3, Gift, Sparkles, Eye, EyeOff
} from 'lucide-react';
import { AppState, Transaction, Quota, Loan } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';
import { LoadingScreen } from '../ui/LoadingScreen';
import { NotificationBell } from '../ui/NotificationBell';

interface DashboardProps {
    state: AppState;
    onBuyQuota: () => void;
    onGames: () => void;
    onLoans: () => void;
    onWithdraw: () => void;
    onDeposit: () => void;
    onRefer: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onEducation: () => void;
    onVoting: () => void;
}

const TransactionRow = memo(({ t, formatCurrency, isPositive, showValues }: any) => (
    <div key={t.id} className="group glass glass-hover p-6 rounded-[2rem] flex items-center justify-between">
        <div className="flex items-center gap-6">
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-2xl shadow-black transition-transform group-hover:scale-110 duration-500 ${isPositive(t.type) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                {isPositive(t.type) ? <ArrowDownLeft size={28} /> : <ArrowUpRight size={28} />}
            </div>
            <div>
                <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-tight mb-1 group-hover:text-primary-400 transition-colors">
                    {t.description || t.type}
                </h4>
                <div className="flex items-center gap-2">
                    <Clock size={10} className="text-zinc-500" />
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                        {new Date(t.created_at || t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(' de ', ' ')}
                    </p>
                </div>
            </div>
        </div>
        <div className="text-right">
            <p className={`text-lg sm:text-xl font-black tabular-nums tracking-tighter mb-1 ${isPositive(t.type) ? 'text-emerald-400' : 'text-zinc-500'
                }`}>
                {showValues ? (
                    <>
                        {isPositive(t.type) ? '+' : '-'} {formatCurrency(t.amount)}
                    </>
                ) : '••••••'}
            </p>
            <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg inline-block border ${t.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse' : 'bg-zinc-900 text-zinc-600 border-white/5'
                }`}>
                {t.status === 'PENDING' ? 'Em Validação' : 'Processado'}
            </div>
        </div>
    </div>
));
TransactionRow.displayName = 'TransactionRow';
export const Dashboard = ({ state, onBuyQuota, onGames, onLoans, onWithdraw, onDeposit, onRefer, onSuccess, onError, onEducation, onVoting }: DashboardProps) => {
    const user = state?.currentUser;

    // Guard clause: prevent crash if state or user is not loaded yet
    if (!state || !user) {
        return <LoadingScreen fullScreen message="Sincronizando seu Painel..." />;
    }

    // Usuários PRO não veem anúncios
    const isPro = user?.membership_type === 'PRO';

    const { userQuotas, totalInvested, totalCurrentValue, totalEarnings, earningsPercentage } = useMemo(() => {
        const quotas = state.quotas?.filter((q: Quota) => q.userId === user.id) ?? [];
        const invested = quotas.reduce((acc: number, q: Quota) => acc + q.purchasePrice, 0);
        const current = quotas.reduce((acc: number, q: Quota) => acc + (q.currentValue || q.purchasePrice), 0);
        const earnings = current - invested;
        const percentage = invested > 0 ? (earnings / invested) * 100 : 0;
        return { userQuotas: quotas, totalInvested: invested, totalCurrentValue: current, totalEarnings: earnings, earningsPercentage: percentage };
    }, [state.quotas, user.id]);

    const { userLoans, totalDebt } = useMemo(() => {
        const loans = state.loans?.filter((l: Loan) => l.userId === user.id && l.status === 'APPROVED') ?? [];
        const debt = loans.reduce((acc: number, l: Loan) => acc + l.totalRepayment, 0);
        return { userLoans: loans, totalDebt: debt };
    }, [state.loans, user.id]);

    const navigate = useNavigate();

    // Benefício de boas-vindas vem do estado global (sincronizado)
    const welcomeBenefit = state.welcomeBenefit;

    // Estados para o Baú de Recompensas (sincronizado com backend)
    const [chestCountdown, setChestCountdown] = useState(0);
    const [chestsRemaining, setChestsRemaining] = useState(3);
    const [isOpeningChest, setIsOpeningChest] = useState(false);
    const [showValues, setShowValues] = useState(true);

    // Buscar status do baú do backend ao carregar
    useEffect(() => {
        const fetchChestStatus = async () => {
            try {
                const response = await apiService.get('/earn/chest-status') as any;
                if (response.success) {
                    setChestsRemaining(response.chestsRemaining ?? 3);
                    setChestCountdown(response.countdown ?? 0);
                }
            } catch (error) {
                console.error('Erro ao buscar status do baú:', error);
            }
        };
        fetchChestStatus();
    }, []);

    // Memoizar transações recentes do estado global
    const recentTransactions = useMemo(() => {
        if (!state.transactions) return [];
        return [...state.transactions]
            .filter(t => t.userId === user.id)
            .sort((a: Transaction, b: Transaction) =>
                new Date((b.created_at || b.date)!).getTime() - new Date((a.created_at || a.date)!).getTime()
            )
            .slice(0, 5);
    }, [state.transactions, user.id]);


    const handleOpenChest = useCallback(async () => {
        if (chestsRemaining <= 0 || chestCountdown > 0 || isOpeningChest) return;

        window.open('https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa', '_blank');
        setIsOpeningChest(true);

        setTimeout(async () => {
            try {
                const reward = (Math.random() * (0.03 - 0.01) + 0.01).toFixed(2);
                const response = await apiService.post('/earn/chest-reward', { amount: parseFloat(reward) }) as any;

                if (response.success) {
                    onSuccess("Baú Aberto!", response.message || `Você recebeu R$ ${reward}!`);
                    setChestsRemaining(response.chestsRemaining ?? chestsRemaining - 1);
                    setChestCountdown(3600);
                } else {
                    onError("Erro", response.message || "Não foi possível abrir o baú");
                }
            } catch (error: any) {
                onError("Erro", error.message || "Erro ao abrir o baú");
            } finally {
                setIsOpeningChest(false);
            }
        }, 5000);
    }, [chestsRemaining, chestCountdown, isOpeningChest, onSuccess, onError]);

    // Timer para countdown
    useEffect(() => {
        let timer: any;
        if (chestCountdown > 0) {
            timer = setInterval(() => setChestCountdown(prev => Math.max(0, prev - 1)), 1000);
        }
        return () => clearInterval(timer);
    }, [chestCountdown]);

    const formatCountdown = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const getVipLevel = (quotas: number) => {
        if (quotas >= 100) return { name: 'Fundador', color: 'bg-primary-600/20 text-primary-400 border-primary-500/30' };
        if (quotas >= 50) return { name: 'Ouro', color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' };
        if (quotas >= 10) return { name: 'Prata', color: 'bg-zinc-400/20 text-zinc-300 border-zinc-400/30' };
        return { name: 'Bronze', color: 'bg-orange-700/20 text-orange-600 border-orange-700/30' };
    };

    const getNextLevelInfo = (level: string) => {
        if (level === 'Bronze') return { next: 'Prata', goal: 10 };
        if (level === 'Prata') return { next: 'Ouro', goal: 50 };
        if (level === 'Ouro') return { next: 'Fundador', goal: 100 };
        return { next: null, goal: 100 };
    };

    const vipLevel = getVipLevel(userQuotas.length);
    const nextLevel = getNextLevelInfo(vipLevel.name);
    const progressToNext = nextLevel.next ? Math.min((userQuotas.length / nextLevel.goal) * 100, 100) : 100;

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const isPositive = (type: string) => ['DEPOSIT', 'DIVIDEND', 'REFERRAL_BONUS', 'LOAN_RECEIVED', 'QUOTA_SELL', 'EDUCATION_REWARD', 'ADMIN_GIFT'].includes(type);

    const isLocked = user.securityLockUntil ? new Date(user.securityLockUntil).getTime() > Date.now() : false;
    const lockTimeRemaining = user.securityLockUntil ? Math.ceil((new Date(user.securityLockUntil).getTime() - Date.now()) / (1000 * 60 * 60)) : 0;

    // Supress unused warnings for items we want to keep
    void isPro;
    void totalCurrentValue;
    void userLoans;
    void totalDebt;
    void welcomeBenefit;
    void progressToNext;

    return (
        <div className="space-y-6 pb-32">
            {/* 1. Header com Boas-Vindas */}
            <div className="relative overflow-hidden rounded-3xl glass p-5 sm:p-8 animate-fade-in animate-float">
                <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none select-none">
                    <Sparkles size={120} className="text-primary-400" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        {/* Selo de nível baseado em cotas */}
                        <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 ${vipLevel.color}`}>
                            <Crown size={14} fill="currentColor" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{vipLevel.name}</span>
                        </div>
                        {/* Selo verificado só aparece se user.is_verified = true */}
                        {user.is_verified && (
                            <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Verificado</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                        <div>
                            <p className="text-zinc-500 font-bold text-sm mb-1 uppercase tracking-widest flex items-center gap-2">
                                {new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'}
                                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                {new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}
                            </p>
                            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none text-gradient">
                                {user.name.split(' ')[0]}<span className="text-white">.</span>
                            </h1>
                        </div>

                        <div className="flex items-center gap-4">
                            <NotificationBell />
                            <div className="text-right">
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Impacto Democrático</p>
                                <div
                                    onClick={onVoting}
                                    className="cursor-pointer flex items-center gap-2 glass px-4 py-2 rounded-2xl hover:bg-white/10 transition-all active:scale-95"
                                >
                                    <BarChart3 size={16} className="text-primary-400" />
                                    <span className="text-xl font-black text-white">
                                        {((1 + Math.sqrt(userQuotas.length)) * (1 + (user.score || 0) / 1000)).toFixed(1)}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/app/settings')}
                                className="w-14 h-14 glass glass-hover rounded-2xl flex items-center justify-center group"
                            >
                                <Settings size={24} className="text-zinc-400 group-hover:text-white transition-colors" />
                            </button>
                        </div>
                    </div>
                    {/* Stats Grid - Score e Nível */}
                    <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400 border border-primary-500/20">
                                <Star size={18} fill="currentColor" />
                            </div>
                            <div>
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Score</p>
                                <p className="text-sm font-black text-white">{user.score || 0} pts</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${vipLevel.color}`}>
                                <ShieldCheck size={18} />
                            </div>
                            <div>
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Nível</p>
                                <p className="text-sm font-black text-white">{vipLevel.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                                <PieChart size={18} />
                            </div>
                            <div>
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Licenças</p>
                                <p className="text-sm font-black text-white">{userQuotas.length} ativas</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                <TrendingUp size={18} />
                            </div>
                            <div>
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Sobras</p>
                                <p className="text-sm font-black text-emerald-400">+{earningsPercentage.toFixed(1)}%</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20">
                                <Zap size={18} fill="currentColor" />
                            </div>
                            <div>
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Pontos Farm</p>
                                <p className="text-sm font-black text-white">{user.ad_points || 0} pts</p>
                                <p className="text-[8px] text-zinc-600">1000 pts = R$ 0,03</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alerta de Segurança */}
            {isLocked && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h3 className="text-red-500 font-bold text-sm mb-1">Trava de Segurança Ativa</h3>
                        <p className="text-zinc-400 text-xs">
                            Operações bloqueadas. Liberação em <strong className="text-white">{lockTimeRemaining}h</strong>.
                        </p>
                    </div>
                </div>
            )}

            {/* 2. Card de Saldo Principal */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2 bg-gradient-to-br from-primary-600 via-primary-700 to-[#10b981] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl shadow-primary-900/40">
                    <div className="absolute top-0 right-0 p-8 opacity-20 rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none select-none">
                        <Wallet size={180} />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Saldo Corrente Líquido</span>
                            <button onClick={() => setShowValues(!showValues)} className="ml-auto text-white/50 hover:text-white transition-colors">
                                {showValues ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                        </div>
                        <h2 className="text-4xl sm:text-5xl font-black tracking-tighter mb-6 tabular-nums">
                            {showValues ? formatCurrency(user.balance) : '••••••'}
                        </h2>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <button
                                onClick={onDeposit}
                                className="bg-white text-emerald-900 hover:scale-[1.02] transition-all text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl flex flex-col items-center justify-center gap-2 active:scale-95"
                            >
                                <ArrowDownLeft size={20} /> DEPOSITAR
                            </button>
                            <button
                                onClick={onWithdraw}
                                className="bg-black/20 hover:bg-black/40 text-white text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl backdrop-blur-md transition-all flex flex-col items-center justify-center gap-2 border border-white/10 active:scale-95"
                            >
                                <ArrowUpFromLine size={20} /> SACAR
                            </button>
                            <button
                                onClick={onBuyQuota}
                                className="col-span-2 sm:col-span-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl backdrop-blur-md transition-all flex flex-col sm:flex-col items-center justify-center gap-2 border border-white/10 active:scale-95"
                            >
                                <TrendingUp size={20} /> LICENÇAS
                            </button>
                        </div>
                    </div>
                </div>

                <div className="glass glass-hover p-5 sm:p-8 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-14 h-14 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-400">
                            <PieChart size={28} />
                        </div>
                        <span className="glass px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest text-primary-400">{userQuotas.length} ATIVAS</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Capital Social Integralizado</p>
                        <h3 className="text-3xl font-black text-white tracking-tight">{formatCurrency(totalInvested)}</h3>
                    </div>
                </div>

                <div className="glass glass-hover p-5 sm:p-8 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
                            <ArrowUpRight size={28} />
                        </div>
                        <span className="glass px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest text-emerald-400">+{earningsPercentage.toFixed(1)}%</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Excedentes Acumulados</p>
                        <h3 className="text-3xl font-black text-emerald-400 tracking-tight">{formatCurrency(totalEarnings)}</h3>
                    </div>
                </div>
            </div>

            {/* 3. Central de Prêmios */}
            <div className="bg-zinc-900 border border-white/5 rounded-3xl p-5 sm:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none select-none">
                    <Zap size={180} className="text-yellow-500" />
                </div>

                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                        <div>
                            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
                                <span className="p-3 bg-yellow-500/10 rounded-2xl shadow-inner">
                                    <Zap size={28} className="text-yellow-500 fill-yellow-500" />
                                </span>
                                Central de Prêmios
                            </h3>
                            <p className="text-sm text-zinc-500 font-bold uppercase tracking-wider mt-2">Maximize sua reputação para desbloquear benefícios</p>
                        </div>
                        <div className="bg-zinc-900/80 px-5 py-3 rounded-2xl border border-white/5 flex items-center gap-4 shadow-2xl">
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                            <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Missões Disponíveis</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-10">
                        {[
                            { icon: Crown, label: 'Loja', sub: 'VIP', act: () => navigate('/app/services'), color: 'text-pink-400', bg: 'bg-pink-500/10' },
                            { icon: Zap, label: 'Farm', sub: 'Views', act: () => navigate('/app/promo-videos/farm'), color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                            { icon: Wallet, label: 'Crédito', sub: 'Mútuo', act: onLoans, color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
                            { icon: Gamepad2, label: 'Jogar', sub: 'Fun', act: onGames, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                            { icon: BookOpen, label: 'Estudar', sub: 'Learn', act: onEducation, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                            { icon: Users, label: 'Indicar', sub: 'Invite', act: onRefer, color: 'text-primary-400', bg: 'bg-primary-500/10' },
                            { icon: BarChart3, label: 'Votar', sub: 'Club', act: onVoting, color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
                        ].map((item, idx) => (
                            <button
                                key={idx}
                                onClick={item.act}
                                className="aspect-square glass glass-hover rounded-[2rem] flex flex-col items-center justify-center gap-2 group"
                            >
                                <div className={`w-12 h-12 ${item.bg} rounded-2xl flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                                    <item.icon size={24} />
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-white uppercase tracking-widest">{item.label}</p>
                                    <p className="text-[7px] font-black opacity-40 uppercase tracking-[0.3em] mt-1">{item.sub}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                    {/* Baú de Excedentes */}
                    <div
                        onClick={handleOpenChest}
                        className={`group relative rounded-2xl p-5 sm:p-6 transition-all cursor-pointer ${chestCountdown > 0 || chestsRemaining === 0
                            ? 'bg-zinc-800/50 opacity-60'
                            : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40'
                            }`}
                    >
                        <div className="flex items-center gap-4 sm:gap-6">
                            {/* Ícone do Baú */}
                            <div className="relative shrink-0">
                                <Gift size={48} className={chestCountdown > 0 ? 'text-zinc-600' : 'text-amber-500'} strokeWidth={1.5} />
                                {chestCountdown === 0 && chestsRemaining > 0 && (
                                    <div className="absolute inset-0 bg-amber-500 blur-xl opacity-30 animate-pulse" />
                                )}
                            </div>

                            {/* Conteúdo */}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-base sm:text-lg font-bold text-white mb-1">Baú de Excedentes Diários</h4>
                                <p className="text-xs text-zinc-400 mb-3">Assista conteúdo e receba saldo imediato</p>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-3 py-1.5 bg-black/50 rounded-lg border border-white/5 text-[10px] font-bold text-zinc-400 uppercase">
                                        {chestCountdown > 0 ? `Aguarde: ${formatCountdown(chestCountdown)}` : `${chestsRemaining}/3 Baús`}
                                    </span>
                                    {chestCountdown === 0 && chestsRemaining > 0 && (
                                        <span className="px-3 py-1.5 bg-amber-500 text-black rounded-lg text-[10px] font-bold uppercase flex items-center gap-1">
                                            Abrir <ChevronRight size={14} />
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Loading Overlay */}
                        {isOpeningChest && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-2xl">
                                <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
                                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Carregando...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* 4. Histórico de Transações */}
            <div className="bg-zinc-900 border border-white/5 rounded-3xl p-5 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <Clock size={24} className="text-zinc-600" />
                        Fluxo de Caixa
                    </h3>
                    <button
                        onClick={() => navigate('/app/history')}
                        className="text-[11px] font-black text-primary-400 uppercase tracking-[0.2em] hover:text-white transition-all ring-1 ring-primary-500/20 px-4 py-2 rounded-xl"
                    >
                        EXTRATO COMPLETO
                    </button>
                </div>

                <div className="space-y-4">
                    {recentTransactions.length > 0 ? (
                        recentTransactions.map((t: Transaction) => (
                            <TransactionRow
                                key={t.id}
                                t={t}
                                formatCurrency={formatCurrency}
                                isPositive={isPositive}
                                showValues={showValues}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-900/10 rounded-[3rem] border border-dashed border-zinc-800">
                            <Clock size={60} className="text-zinc-800 mb-6" />
                            <p className="text-zinc-500 text-sm font-black uppercase tracking-[0.2em]">Fluxo de caixa vazio</p>
                            <p className="text-[10px] text-zinc-700 mt-3 font-bold uppercase tracking-widest italic">Inicie sua jornada para ver movimentações aqui</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
