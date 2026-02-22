import { useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import {
    Users, TrendingUp, ArrowUpFromLine, BookOpen,
    Crown, Clock, ArrowDownLeft, ArrowUpRight,
    PieChart, Star, Zap, Store,
    ShieldCheck, ChevronRight, Wallet, Settings, BarChart3, Gift, Sparkles, Eye, EyeOff,
    RefreshCw, ArrowRight
} from 'lucide-react';
import { AppState, Transaction, Quota, Loan } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';
import { LoadingScreen } from '../ui/LoadingScreen';
import { NotificationBell } from '../ui/NotificationBell';
import { RankingWidget } from '../features/gamification/RankingWidget';

interface DashboardProps {
    state: AppState;
    onBuyQuota: () => void;
    onLoans: () => void;
    onWithdraw: () => void;
    onDeposit: () => void;
    onRefer: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onEducation: () => void;
    onVoting: () => void;
    onRefresh: () => Promise<void>;
}

interface TransactionRowProps {
    t: Transaction;
    formatCurrency: (val: number) => string;
    isPositive: (type: string) => boolean;
    showValues: boolean;
}

const isPointTransaction = (type: string) => [
    'AD_REWARD', 'CHEST_REWARD', 'VIDEO_REWARD', 'EDUCATION_REWARD'
].includes(type);

const TransactionRow = memo(({ t, formatCurrency, isPositive, showValues }: TransactionRowProps) => (
    <div key={t.id} className="group glass glass-hover p-6 rounded-[2rem] flex items-center justify-between">
        <div className="flex items-center gap-6">
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-2xl shadow-black transition-transform group-hover:scale-110 duration-500 ${isPositive(t.type) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                {t.type === 'DIVIDEND' ? <TrendingUp size={28} /> : (isPositive(t.type) ? <ArrowDownLeft size={28} /> : <ArrowUpRight size={28} />)}
            </div>
            <div>
                <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-tight mb-1 group-hover:text-primary-400 transition-colors">
                    {t.type === 'DIVIDEND' ? 'Rendimento Diário' : (t.description || t.type)}
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
                        {isPositive(t.type) ? '+' : '-'} {isPointTransaction(t.type) ? `${t.amount} pts` : formatCurrency(t.amount)}
                    </>
                ) : '••••••'}
            </p>
            <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg inline-block border ${t.status === 'PENDING' || t.status === 'PAYMENT_PENDING' || t.status === 'PENDING_CONFIRMATION'
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                : t.status === 'REJECTED' || t.status === 'CANCELLED'
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}>
                {t.status === 'PENDING' || t.status === 'PAYMENT_PENDING' || t.status === 'PENDING_CONFIRMATION' ? 'Em Análise' :
                    (t.status === 'REJECTED' || t.status === 'CANCELLED' ? 'Rejeitado' : 'Concluído')}
            </div>
        </div>
    </div>
));
TransactionRow.displayName = 'TransactionRow';
export const Dashboard = ({ state, onLoans, onBuyQuota, onWithdraw, onDeposit, onRefer, onSuccess, onError, onEducation, onVoting, onRefresh }: DashboardProps) => {
    const user = state?.currentUser;
    const navigate = useNavigate();

    const { userQuotas, totalCurrentValue, totalEarnings, earningsPercentage, earningsToday } = useMemo(() => {
        if (!state?.quotas || !user) return { userQuotas: [], totalCurrentValue: 0, totalEarnings: 0, earningsPercentage: 0, earningsToday: 0 };
        const quotas = state.quotas.filter((q: Quota) =>
            q.userId === user.id && (q.status === 'ACTIVE' || !q.status)
        );
        // Capital Social = quantidade de cotas * R$ 42 (valor resgatável por cota)
        const invested = quotas.length * 42;

        // Valorização de Capital = (Valor Atual - 42) * Qtd
        // Se current_value for null/undefined, assume 42 (sem valorização)
        // const capitalGains = quotas.reduce((acc: number, q: Quota) => acc + ((q.currentValue || 42) - 42), 0); // Removed unused

        // Excedentes reais = Apenas Dividendos Pagos (Solicitação: remover valorização não realizada)
        const dividendsEarned = user.total_dividends_earned || 0;
        const totalGains = dividendsEarned;

        // O valor atual do aporte é fixo (R$ 42 resgatável * cotas), pois não estamos computando valorização de cota
        const current = invested;
        // Porcentagem de retorno sobre o investido (baseado no que já ganhou de dividendos)
        const percentage = invested > 0 ? (totalGains / invested) * 100 : 0;

        // Calculate earnings today from transactions
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEarnings = state.transactions
            .filter(t => t.type === 'DIVIDEND' && new Date(t.created_at || t.date).getTime() >= startOfDay)
            .reduce((acc, t) => acc + t.amount, 0);

        return { userQuotas: quotas, totalCurrentValue: current, totalEarnings: totalGains, earningsPercentage: percentage, earningsToday: todayEarnings };
    }, [state?.quotas, user?.id, user?.total_dividends_earned, state?.transactions]);

    const { userLoans, totalDebt } = useMemo(() => {
        if (!state?.loans || !user) return { userLoans: [], totalDebt: 0 };
        const loans = state.loans.filter((l: Loan) =>
            l.userId === user.id && ['APPROVED', 'PAYMENT_PENDING', 'PENDING', 'WAITING_GUARANTOR'].includes(l.status)
        );
        const debt = loans.reduce((acc: number, l: Loan) => acc + (l.remainingAmount ?? l.totalRepayment), 0);
        return { userLoans: loans, totalDebt: debt };
    }, [state?.loans, user?.id]);

    // Estados para o Baú de Recompensas (sincronizado com backend)
    const [chestCountdown, setChestCountdown] = useState(0);
    const [chestsRemaining, setChestsRemaining] = useState(3);
    const [isOpeningChest, setIsOpeningChest] = useState(false);
    const [showValues, setShowValues] = useState(() => {
        const stored = localStorage.getItem('dashboard_show_values');
        return stored === null ? true : stored === 'true';
    });

    const [viewFarmVideo, setViewFarmVideo] = useState<any>(null);
    const [adTimer, setAdTimer] = useState(0);

    const [referralInput, setReferralInput] = useState('');
    const [linkingReferrer, setLinkingReferrer] = useState(false);

    useEffect(() => {
        localStorage.setItem('dashboard_show_values', showValues.toString());
    }, [showValues]);

    // Buscar status do baú do backend ao carregar
    useEffect(() => {
        if (!state || !user) return;
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
    }, [state, user]);

    // Memoizar transações recentes do estado global
    const recentTransactions = useMemo(() => {
        if (!state?.transactions || !user) return [];
        return [...state.transactions]
            .filter(t => t.userId === user.id)
            .sort((a: Transaction, b: Transaction) =>
                new Date((b.created_at || b.date)!).getTime() - new Date((a.created_at || a.date)!).getTime()
            )
            .slice(0, 5);
    }, [state?.transactions, user?.id]);

    const handleLinkReferrer = async () => {
        if (!referralInput.trim() || linkingReferrer) return;
        setLinkingReferrer(true);
        try {
            const response = await apiService.linkReferrer(referralInput);
            if (response.success) {
                onSuccess('Sucesso!', 'Seu padrinho foi vinculado com sucesso.');
                setReferralInput('');
                await onRefresh();
            } else {
                onError('Erro', response.message || 'Código de indicação inválido.');
            }
        } catch (error: any) {
            onError('Erro', error.message || 'Falha ao vincular padrinho.');
        } finally {
            setLinkingReferrer(false);
        }
    };

    const handleOpenChest = useCallback(async () => {
        if (chestsRemaining <= 0 || chestCountdown > 0 || isOpeningChest) return;

        setIsOpeningChest(true);

        try {
            // Primeiro busca um vídeo da View Farm
            const feed = await apiService.misc.getPromoFeed();
            if (feed && feed.length > 0) {
                const randomVideo = feed[Math.floor(Math.random() * feed.length)];
                setViewFarmVideo(randomVideo);
                setAdTimer(5); // 5 segundos para o baú
                if (randomVideo.id) {
                    try {
                        await apiService.misc.startPromoView(randomVideo.id);
                    } catch (e) {
                        console.warn('Erro ao iniciar view (AdBlock?):', e);
                    }
                }
            } else {
                // FALLBACK: Se não tiver vídeo da View Farm, mostra anúncio Adsterra/Link
                setViewFarmVideo({
                    isFallback: true,
                    video_url: null,
                    external_link: "https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa"
                });
                setAdTimer(5);
            }
        } catch (error: any) {
            onError("Erro", error.message || "Erro ao abrir o baú");
            setIsOpeningChest(false);
        }
    }, [chestsRemaining, chestCountdown, isOpeningChest, onSuccess, onError]);

    const handleCompleteChestReward = useCallback(async () => {
        setIsOpeningChest(true);
        try {
            // Só tenta completar na API se for um vídeo real (não fallback)
            if (viewFarmVideo && !viewFarmVideo.isFallback && viewFarmVideo.id) {
                try {
                    await apiService.misc.completePromoView(viewFarmVideo.id, 5);
                } catch (e) {
                    console.warn('Erro ao registrar visualização (Pode ser AdBlock):', e);
                }
            }

            const response = await apiService.post('/earn/chest-reward', {}) as any;
            if (response.success) {
                onSuccess("Baú Aberto!", response.message || `+${response.points || 100} pontos farm!`);
                setChestsRemaining(response.chestsRemaining ?? chestsRemaining - 1);
                setChestCountdown(3600);
            } else {
                onError("Erro", response.message || "Não foi possível resgatar prêmio");
            }
        } catch (error: any) {
            console.error('Erro ao resgatar recompensa do baú:', error);
            onError("Erro", error.message || "Erro ao resgatar prêmio");
        } finally {
            setIsOpeningChest(false);
            setViewFarmVideo(null);
            setAdTimer(0);
        }
    }, [viewFarmVideo, chestsRemaining, onSuccess, onError]);

    // Timer para Ad do Baú
    useEffect(() => {
        let timer: any;
        if (adTimer > 0) {
            timer = setInterval(() => setAdTimer(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [adTimer]);

    // Timer para countdown
    useEffect(() => {
        let timer: any;
        if (chestCountdown > 0) {
            timer = setInterval(() => setChestCountdown(prev => Math.max(0, prev - 1)), 1000);
        }
        return () => clearInterval(timer);
    }, [chestCountdown]);

    // Guard clause: prevent crash if state or user is not loaded yet
    if (!state || !user) {
        return <LoadingScreen fullScreen message="Sincronizando seu Painel..." />;
    }

    // Usuários PRO não veem anúncios
    const isPro = user?.membership_type === 'PRO';

    // Benefício de boas-vindas vem do estado global (sincronizado)
    const welcomeBenefit = state.welcomeBenefit;


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
                        {/* Selo de Proteção Mútua */}
                        {user.is_protected && (
                            <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
                                <ShieldCheck size={12} className="text-blue-400" />
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Protegido</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                        <div className="w-full sm:w-auto">
                            <p className="text-zinc-500 font-bold text-[10px] sm:text-sm mb-1 uppercase tracking-widest flex items-center gap-2">
                                {new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'}
                                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                {new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}
                            </p>
                            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none text-gradient truncate flex items-center gap-2">
                                {user.name.split(' ')[0]}<span className="text-white">.</span>
                                <span className="text-[10px] sm:text-xs font-black text-white/50 bg-white/5 px-2 py-1 rounded-lg border border-white/5 align-middle mt-2">
                                    #{user.id}
                                </span>
                            </h1>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                            <NotificationBell />
                            <div className="text-right flex-1 sm:flex-none">
                                <p className="text-[8px] sm:text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Boost de Resultado</p>
                                <div
                                    className="cursor-help flex items-center gap-2 glass px-3 sm:px-4 py-2 rounded-2xl hover:bg-white/10 transition-all border border-emerald-500/20"
                                    title="Seu multiplicador de excedentes baseado em engajamento (2FA + PRO + Atividade)"
                                >
                                    <TrendingUp size={14} className="text-emerald-400" />
                                    <span className="text-lg sm:text-xl font-black text-white">
                                        {(1.0 + (user.two_factor_enabled ? 0.1 : 0) + (user.membership_type === 'PRO' ? 0.2 : 0)).toFixed(1)}x
                                    </span>
                                </div>
                            </div>
                            <button
                                title="Configurações"
                                aria-label="Configurações"
                                onClick={() => navigate('/app/settings')}
                                className="w-12 h-12 sm:w-14 sm:h-14 glass glass-hover rounded-2xl flex items-center justify-center group shrink-0"
                            >
                                <Settings size={20} className="text-zinc-400 group-hover:text-white transition-colors" />
                            </button>
                        </div>
                    </div>
                    {/* Stats Grid - Score e Nível */}
                    <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400 border border-primary-500/20 shrink-0">
                                <Star size={18} fill="currentColor" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider truncate">Score</p>
                                <p className="text-sm font-black text-white truncate">{user.score || 0} pts</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${vipLevel.color}`}>
                                <ShieldCheck size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider truncate">Nível</p>
                                <p className="text-sm font-black text-white truncate">{vipLevel.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shrink-0">
                                <PieChart size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider truncate">Licenças</p>
                                <p className="text-sm font-black text-white truncate">{userQuotas.length} ativas</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shrink-0">
                                <TrendingUp size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider truncate">Sobras</p>
                                <p className="text-sm font-black text-emerald-400 truncate">+{earningsPercentage.toFixed(1)}%</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 col-span-2 md:col-span-1">
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20 shrink-0">
                                <Zap size={18} fill="currentColor" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider truncate">Pontos Farm</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-black text-white truncate">{user.ad_points || 0}</p>
                                    <span className="text-[8px] text-zinc-600 font-bold truncate">R$ {(user.ad_points * 0.00003).toFixed(2)}</span>
                                </div>
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

            {/* Vincular Padrinho (Apenas se não tiver) */}
            {!user.referred_by && (
                <div className="bg-primary-500/5 border border-primary-500/20 rounded-2xl p-5 mb-4 group transition-all hover:bg-primary-500/10 overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-400 shrink-0 mb-2 sm:mb-0">
                            <Users size={24} />
                        </div>
                        <div className="flex-1 w-full min-w-0">
                            <h3 className="text-white font-bold text-sm mb-1">Quem te indicou?</h3>
                            <p className="text-zinc-400 text-xs mb-4 leading-relaxed">
                                Você ainda não tem um padrinho vinculado. Insira o código de quem te convidou para liberar benefícios.
                            </p>
                            <div className="flex flex-col xs:flex-row gap-2">
                                <input
                                    type="text"
                                    placeholder="Código de Indicação"
                                    value={referralInput}
                                    onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary-500/50 min-w-0"
                                />
                                <button
                                    onClick={handleLinkReferrer}
                                    disabled={linkingReferrer || !referralInput.trim()}
                                    className="bg-primary-500 hover:bg-primary-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black px-6 py-3 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
                                >
                                    {linkingReferrer ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
                                    VINCULAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* RANKING DE FARM - TOP 3 */}
            <RankingWidget />


            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2 bg-gradient-to-br from-primary-600 via-primary-700 to-[#10b981] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl shadow-primary-900/40">
                    <div className="absolute top-0 right-0 p-8 opacity-20 rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none select-none">
                        <Wallet size={120} className="sm:size-[180px]" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2 sm:mb-3">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Saldo da Carteira</span>
                            <button onClick={() => setShowValues(!showValues)} className="ml-auto text-white/50 hover:text-white transition-colors p-2 -m-2">
                                {showValues ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tighter mb-6 tabular-nums">
                            {showValues ? formatCurrency(user.balance) : '••••••'}
                        </h2>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <button
                                onClick={() => onDeposit()}
                                className="bg-white text-black hover:scale-[1.02] transition-all duration-500 text-[9px] font-black uppercase tracking-[0.25em] py-4 rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-2 active:scale-95 border border-white/20 group"
                            >
                                <div className="p-1.5 bg-emerald-500/10 rounded-xl group-hover:rotate-12 transition-transform">
                                    <ArrowDownLeft size={20} className="text-emerald-600" />
                                </div>
                                <span className="opacity-80">APORTAR</span>
                            </button>
                            <button
                                onClick={onWithdraw}
                                className="bg-zinc-900/40 hover:bg-zinc-900 text-white text-[9px] font-black uppercase tracking-[0.25em] py-4 rounded-2xl backdrop-blur-md transition-all duration-500 flex flex-col items-center justify-center gap-2 border border-white/5 active:scale-95 group"
                            >
                                <div className="p-1.5 bg-white/5 rounded-xl group-hover:-rotate-12 transition-transform">
                                    <ArrowUpFromLine size={20} className="text-primary-400" />
                                </div>
                                <span className="opacity-60 group-hover:opacity-100 transition-opacity whitespace-nowrap">RESGATAR</span>
                            </button>
                            <button
                                onClick={() => navigate('/app/services')}
                                className="col-span-2 sm:col-span-1 bg-white text-black hover:scale-[1.02] transition-all duration-500 text-[9px] font-black uppercase tracking-[0.25em] py-4 rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-2 active:scale-95 border border-white/20 group"
                            >
                                <div className="p-1.5 bg-primary-500/10 rounded-xl group-hover:rotate-12 transition-transform">
                                    <Sparkles size={20} className="text-primary-600" />
                                </div>
                                <span className="opacity-80">PAGAR</span>
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
                        <div className="flex justify-between items-end mb-2">
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Dinheiro Disponível</p>
                            <button
                                onClick={onBuyQuota}
                                className="text-[9px] font-black text-primary-400 uppercase tracking-wider hover:text-primary-300 transition-colors flex items-center gap-1"
                            >
                                Integralizar <ArrowRight size={10} />
                            </button>
                        </div>
                        <h3 className="text-3xl font-black text-white tracking-tight">{formatCurrency(user.balance)}</h3>
                        {earningsToday > 0 && (
                            <div className="flex items-center gap-1.5 mt-2 animate-bounce-slow">
                                <TrendingUp size={12} className="text-emerald-400" />
                                <span className="text-[10px] font-bold text-emerald-400 tracking-wide">
                                    Rendeu {formatCurrency(earningsToday)} hoje 🚀
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass glass-hover p-5 sm:p-8 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <TrendingUp size={80} className="text-emerald-500" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
                                <ArrowUpRight size={24} />
                            </div>
                            <span className="glass px-3 py-1 rounded-full text-[10px] font-black tracking-widest text-emerald-400" title="Retorno sobre Saldo">
                                RETORNO: +{earningsPercentage.toFixed(1)}%
                            </span>
                        </div>

                        <div>
                            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Crescimento do Saldo</p>
                            <h3 className="text-2xl font-black text-emerald-400 tracking-tight mb-3">+{formatCurrency(totalEarnings)}</h3>

                            {/* Sobras Pendentes Integradas (Cálculo Ajustado com Multiplicadores) */}
                            {state.profitPool > 0 && userQuotas.length > 0 && state.stats?.quotasCount && (
                                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    <div>
                                        <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wide leading-none mb-0.5" title="Estimativa de pagamento no dia 01 do próximo mês">Previsão (Dia 01)</p>
                                        <p className="text-xs font-black text-amber-500 tabular-nums">
                                            {(() => {
                                                // Lógica de Peso do Backend replicada
                                                let multiplier = 1.0;
                                                if (user.two_factor_enabled) multiplier += 0.1;
                                                if (user.membership_type === 'PRO') multiplier += 0.2;
                                                // Bônus de Score aproximado (simplificado)
                                                if ((user.score || 0) > 300) multiplier += 0.1;

                                                // Cálculo: (Pool * 85% / TotalCotas) * MinhasCotas * MeuMultiplicador * FatorSegurança
                                                // Fator de Segurança (0.6) é para compensar a diluição dos "Super Usuários" que puxam a média pra cima
                                                const estimatedValue = ((state.profitPool * 0.85) / state.stats.quotasCount) * userQuotas.length * multiplier * 0.6;

                                                return `+${formatCurrency(estimatedValue)}`;
                                            })()} *
                                        </p>
                                    </div>
                                    <div className="ml-auto group/tooltip relative">
                                        <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] text-zinc-500 font-bold cursor-help">?</div>
                                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-black/90 border border-white/10 rounded-lg text-[9px] text-zinc-400 hidden group-hover/tooltip:block z-50">
                                            Rendimento estimado baseado na sua participação no clube. O valor final depende do lucro diário das operações.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>



            {/* 4. Central de Prêmios */}
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

                    <div className="flex overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-8 gap-4 mb-10 pb-4 sm:pb-0">
                        {[
                            { icon: Crown, label: 'Shopping', sub: 'VIP', act: () => navigate('/app/services'), color: 'text-pink-400', bg: 'bg-pink-500/10' },
                            { icon: Gift, label: 'Prêmios', sub: 'Resgatar', act: () => navigate('/app/rewards-shop'), color: 'text-amber-400', bg: 'bg-amber-500/10' },
                            { icon: Zap, label: 'Tarefas', sub: 'Ganhar', act: () => navigate('/app/promo-videos'), color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                            { icon: Wallet, label: 'Apoio', sub: 'Mútuo', act: onLoans, color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
                            { icon: BookOpen, label: 'Aprender', sub: 'Academy', act: onEducation, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                            { icon: Users, label: 'Indicar', sub: 'Invite', act: onRefer, color: 'text-primary-400', bg: 'bg-primary-500/10' },
                            { icon: BarChart3, label: 'Votar', sub: 'Club', act: onVoting, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                            { icon: Users, label: 'Consórcio', sub: 'Grupo', act: () => navigate('/app/consortium'), color: 'text-teal-400', bg: 'bg-teal-500/10' },
                            { icon: Store, label: 'PDV', sub: 'Vendas', act: () => navigate('/app/pdv'), color: 'text-indigo-400', bg: 'bg-indigo-500/10' }
                        ].map((item, idx) => (
                            <button
                                key={idx}
                                onClick={item.act}
                                className="min-w-[100px] aspect-square glass glass-hover rounded-[2rem] flex flex-col items-center justify-center gap-2 group shrink-0 sm:min-w-0"
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
                            {/* Ícone do Baú */}
                            <div className="relative shrink-0 group-hover:scale-110 transition-transform duration-500">
                                <Gift
                                    size={48}
                                    className={`${chestCountdown > 0 ? 'text-zinc-600' : 'text-amber-500 animate-bounce'} transition-colors`}
                                    strokeWidth={1.5}
                                />
                                {chestCountdown === 0 && chestsRemaining > 0 && (
                                    <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-40 animate-pulse rounded-full" />
                                )}
                            </div>

                            {/* Conteúdo */}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-base sm:text-lg font-bold text-white mb-1 group-hover:text-amber-400 transition-colors">Baú de Pontos Diários</h4>
                                <p className="text-xs text-zinc-400 mb-3 font-medium">Ganhe pontos Farm para trocar por prêmios reais</p>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-3 py-1.5 bg-black/60 rounded-lg border border-white/5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                        {chestCountdown > 0 ? `Aguarde: ${formatCountdown(chestCountdown)}` : `${chestsRemaining}/3 Baús Disponíveis`}
                                    </span>
                                    {chestCountdown === 0 && chestsRemaining > 0 && (
                                        <span className="px-4 py-1.5 bg-amber-500 text-black rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all">
                                            ABRIR AGORA <ChevronRight size={14} />
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Loading or Video Overlay */}
                        {(isOpeningChest || viewFarmVideo) && (
                            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center z-20 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                                {viewFarmVideo ? (
                                    <div className="w-full h-full relative" onClick={(e) => e.stopPropagation()}>
                                        {viewFarmVideo.isFallback ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-t from-black via-zinc-900 to-zinc-950">
                                                <div className="w-20 h-20 bg-amber-500/20 rounded-3xl flex items-center justify-center text-amber-500 mb-6 animate-pulse shadow-2xl shadow-amber-500/10">
                                                    <Sparkles size={40} />
                                                </div>
                                                <h4 className="text-white font-black text-2xl mb-2 tracking-tighter uppercase">BAÚ BLOQUEADO</h4>
                                                <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest mb-8 leading-relaxed max-w-[200px] mx-auto">
                                                    Visite o site do nosso parceiro para desbloquear seus pontos!
                                                </p>
                                                <a
                                                    href={viewFarmVideo.external_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-5 rounded-2xl transition-all text-xs uppercase tracking-[0.25em] shadow-[0_0_40px_rgba(245,158,11,0.4)] text-center flex items-center justify-center gap-3 active:scale-95"
                                                    onClick={() => {
                                                        if (adTimer > 2) setAdTimer(0);
                                                    }}
                                                >
                                                    <Zap size={18} /> DESBLOQUEAR PONTOS
                                                </a>
                                            </div>
                                        ) : (
                                            <video
                                                src={viewFarmVideo.video_url}
                                                autoPlay
                                                muted
                                                className="w-full h-full object-cover opacity-80"
                                            />
                                        )}

                                        <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-30">
                                            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                                                <p className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                                    <Sparkles size={14} className="text-amber-400" /> RECOMPENSA FARM
                                                </p>
                                            </div>
                                            {adTimer > 0 ? (
                                                <div className="bg-amber-500 text-black px-4 py-2 rounded-xl font-black text-xs uppercase shadow-xl flex items-center gap-2">
                                                    <Clock size={14} /> {adTimer}s
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCompleteChestReward();
                                                    }}
                                                    className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-bounce flex items-center gap-2"
                                                >
                                                    <Gift size={16} /> RESGATAR AGORA
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin shadow-xl shadow-amber-500/10" />
                                        <p className="text-[11px] font-black text-amber-500 uppercase tracking-[0.3em] animate-pulse">Sincronizando prêmio...</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* 5. Histórico de Transações */}
            <div className="bg-zinc-900 border border-white/5 rounded-3xl p-5 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <Clock size={24} className="text-zinc-600" />
                        Extrato Recente
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
