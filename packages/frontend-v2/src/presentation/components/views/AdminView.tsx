import { useState, useEffect, useCallback, useMemo } from 'react';
import packageJson from '../../../../package.json';
import {
    ShieldCheck, RefreshCw, LogOut, Send, MessageSquare, PieChart, Activity, Settings as SettingsIcon, UserPlus, ShoppingBag as ShoppingBagIcon, Vote, Bug, TrendingUp, Truck, Gift, FileText, Users, Scale
} from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { AppState } from '../../../domain/types/common.types';
import { clearAllCache } from '../../../application/services/storage.service';
import { apiService } from '../../../application/services/api.service';

// Tab Components
import { AdminOverview } from '../features/admin/tabs/AdminOverview';
import { AdminPayouts } from '../features/admin/tabs/AdminPayouts';
import { AdminMetrics } from '../features/admin/tabs/AdminMetrics';
import { AdminSystem } from '../features/admin/tabs/AdminSystem';
import { AdminReferrals } from '../features/admin/tabs/AdminReferrals';
import { AdminUsers } from '../features/admin/tabs/AdminUsers';
import { AdminGovernance } from '../features/admin/tabs/AdminGovernance';
import { AdminReviews } from '../features/admin/tabs/AdminReviews';
import { AdminBugs } from '../features/admin/tabs/AdminBugs';
import { AdminInvestments } from '../features/admin/tabs/AdminInvestments';
import { AdminLogistics } from '../features/admin/tabs/AdminLogistics';
import { AdminPartners } from '../features/admin/tabs/AdminPartners';
import { AdminApprovals } from '../features/admin/tabs/AdminApprovals';
import { AdminRewardsTab } from '../features/admin/tabs/AdminRewardsTab';
import { AdminFiscal } from '../features/admin/tabs/AdminFiscal';
import { AdminDisputes } from '../features/admin/tabs/AdminDisputes';
import { ConsortiumAdminView } from '../features/admin/tabs/ConsortiumAdminTab';
import { AdminCompliance } from '../features/admin/tabs/AdminCompliance';

// Existing Shared Components
import { AdminStoreManager } from '../features/store/admin-store.component';
import { NotificationBell } from '../ui/NotificationBell';

interface AdminViewProps {
    state: AppState;
    onRefresh: () => void;
    onLogout: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

type TabType = 'overview' | 'approvals' | 'payouts' | 'disputes' | 'system' | 'investments' | 'store' | 'rewards' | 'referrals' | 'users' | 'metrics' | 'governance' | 'reviews' | 'bugs' | 'logistics' | 'partners' | 'fiscal' | 'consortium' | 'compliance';

export const AdminView = ({ state, onRefresh, onLogout, onSuccess, onError }: AdminViewProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [confirmMP, setConfirmMP] = useState<{ id: string, tid: string } | null>(null);



    // Lógica robusta para determinar o papel do usuário
    const userRole = (() => {
        if (state.currentUser?.isAdmin) return 'ADMIN';
        const role = state.currentUser?.role?.toUpperCase() || 'MEMBER';
        if (role === 'ROOT' || role === 'MANAGER') return 'ADMIN';
        return role;
    })();

    const [activeTab, setActiveTab] = useState<TabType>(
        userRole === 'ATTENDANT' ? 'approvals' : 'overview'
    );

    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
    const [pendingPayoutsCount, setPendingPayoutsCount] = useState(0);
    const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
    const [pendingBugsCount, setPendingBugsCount] = useState(0);
    const [pendingDisputesCount, setPendingDisputesCount] = useState(0);

    const fetchCounts = useCallback(async () => {
        if (!state?.currentUser) return;
        try {
            const [approvalsRes, payoutRes, reviewsRes, bugsRes, disputesRes] = await Promise.all([
                apiService.getPendingTransactions(),
                apiService.getPayoutQueue(),
                apiService.getAdminReviews(),
                apiService.get<any>('/bugs/admin?status=open'),
                apiService.admin.getMarketplaceDisputes()
            ]);

            setPendingApprovalsCount(Array.isArray(approvalsRes?.data) ? approvalsRes.data.length : 0);
            setPendingPayoutsCount(Array.isArray(payoutRes?.data?.transactions) ? payoutRes.data.transactions.length : 0);
            setPendingReviewsCount(Array.isArray(reviewsRes?.data) ? reviewsRes.data.filter((r: any) => r.is_public && !r.is_approved).length : 0);
            setPendingBugsCount(Array.isArray(bugsRes?.data) ? bugsRes.data.length : 0);
            setPendingDisputesCount(Array.isArray(disputesRes?.data) ? disputesRes.data.length : 0);
        } catch (e) {
            console.error('Error fetching admin counts:', e);
        }
    }, []);

    useEffect(() => {
        fetchCounts();
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchCounts();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchCounts]);

    const handleRefresh = async () => {
        setIsLoading(true);
        clearAllCache();
        // Forçar atualização do dashboard no backend E no estado
        await apiService.admin.getDashboard(true);
        // Chamar onRefresh DEPOIS para garantir que o estado local seja atualizado
        onRefresh();
        await fetchCounts();
        setIsLoading(false);
        onSuccess("Atualizado", "Dados sincronizados com o servidor.");
    };

    const confirmSimulateMpPayment = async () => {
        if (!confirmMP) return;
        const { id: paymentId, tid: transactionId } = confirmMP;
        try {
            const response = await apiService.post<any>('/admin/simulate-mp-payment', { paymentId, transactionId });
            if (response.success) {
                onSuccess('Simulação Sucesso', 'Pagamento aprovado no Sandbox.');
                await onRefresh();
            } else {
                onError('Erro na Simulação', response.message);
            }
        } catch (error: any) {
            onError('Erro ao Simular', error.message);
        }
    };

    const tabs = useMemo(() => [
        { id: 'overview', name: 'Resumo', icon: PieChart, roles: ['ADMIN'] },
        { id: 'approvals', name: 'Pendentes', icon: ShieldCheck, count: pendingApprovalsCount, roles: ['ADMIN', 'ATTENDANT'] },
        { id: 'payouts', name: 'Resgates', icon: Send, count: pendingPayoutsCount, roles: ['ADMIN'] },
        { id: 'disputes', name: 'Mediação', icon: Scale, count: pendingDisputesCount, roles: ['ADMIN'] },
        { id: 'metrics', name: 'Monitoramento', icon: Activity, roles: ['ADMIN', 'ATTENDANT'] },
        { id: 'system', name: 'Financeiro', icon: SettingsIcon, roles: ['ADMIN'] },
        { id: 'referrals', name: 'Indicações', icon: UserPlus, roles: ['ADMIN'] },
        { id: 'users', name: 'Usuários', icon: ShieldCheck, roles: ['ADMIN'] },
        { id: 'store', name: 'Afiliados', icon: ShoppingBagIcon, roles: ['ADMIN'] },
        { id: 'rewards', name: 'Prêmios', icon: Gift, roles: ['ADMIN'] },
        { id: 'investments', name: 'Gestão de Capital', icon: TrendingUp, roles: ['ADMIN'] },
        { id: 'governance', name: 'Governança', icon: Vote, roles: ['ADMIN'] },
        { id: 'reviews', name: 'Depoimentos', icon: MessageSquare, count: pendingReviewsCount, roles: ['ADMIN'] },
        { id: 'bugs', name: 'Bugs', icon: Bug, count: pendingBugsCount, roles: ['ADMIN'] },
        { id: 'logistics', name: 'Logística', icon: Truck, roles: ['ADMIN'] },
        { id: 'partners', name: 'Parceiros', icon: UserPlus, roles: ['ADMIN'] },
        { id: 'fiscal', name: 'Fiscal', icon: FileText, roles: ['ADMIN'] },
        { id: 'consortium', name: 'Consórcios', icon: Users, roles: ['ADMIN'] },
        { id: 'compliance', name: 'Blindagem', icon: ShieldCheck, roles: ['ADMIN'] },
    ].filter(tab => tab.roles.includes(userRole)), [userRole, pendingApprovalsCount, pendingPayoutsCount, pendingReviewsCount, pendingBugsCount, pendingDisputesCount]);


    if (!state?.currentUser) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 pb-32 max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 min-h-screen bg-black">
            {/* Header Modernizado */}
            <div className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-6 sm:p-8 border border-zinc-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

                <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center border border-primary-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)] group-hover:scale-105 transition-transform duration-500">
                            <ShieldCheck size={40} className="text-primary-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold text-white tracking-tight">Painel de Controle</h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="flex h-2.5 w-2.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                                <p className="text-xs text-zinc-400 font-bold uppercase tracking-[0.2em]">Servidor Ativo • v{packageJson.version} • Role: {userRole}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <div className="flex items-center gap-2 bg-zinc-800/30 p-1.5 rounded-2xl border border-zinc-700/30">
                            <NotificationBell />
                            <button
                                onClick={async () => {
                                    try {
                                        await apiService.post('/notifications/test', {});
                                    } catch (e) {
                                        console.error('Erro ao testar:', e);
                                    }
                                }}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary-400 hover:text-white hover:bg-primary-500/10 rounded-xl transition-all"
                            >
                                Testar Sino
                            </button>
                        </div>
                        <button
                            onClick={handleRefresh}
                            className="group bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-primary-500/50 px-6 py-3.5 rounded-2xl flex items-center gap-3 transition-all duration-300 text-sm font-bold text-zinc-300 shadow-lg"
                        >
                            <RefreshCw size={18} className={isLoading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
                            {isLoading ? "Sincronizando" : "Atualizar Sistema"}
                        </button>
                        <button
                            onClick={onLogout}
                            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 px-6 py-3.5 rounded-2xl flex items-center gap-3 transition-all duration-300 text-sm font-bold text-red-500 shadow-lg"
                        >
                            <LogOut size={18} /> Sair
                        </button>
                    </div>
                </div>
            </div>

            {/* Abas com Scroll Otimizado */}
            {tabs.length === 0 ? (
                <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl text-center">
                    <p className="text-red-500 font-bold text-lg">Acesso Restrito</p>
                    <p className="text-zinc-400 text-sm mt-2">Nenhuma opção de gerenciamento disponível para seu perfil ({userRole}).</p>
                </div>
            ) : (
                <div className="flex items-center gap-1.5 p-1.5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-[2rem] overflow-x-auto no-scrollbar shadow-xl sticky top-4 z-50 touch-pan-x">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`
                                relative flex items-center gap-3 px-6 sm:px-10 py-4 sm:py-5 rounded-[2rem] text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] transition-all duration-500 whitespace-nowrap group
                                ${activeTab === tab.id
                                    ? 'bg-zinc-800 text-primary-400 shadow-2xl shadow-black border border-white/5 scale-[1.02]'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                            `}
                        >
                            <tab.icon size={20} className={activeTab === tab.id ? "text-primary-400 animate-pulse" : "group-hover:scale-110 transition-transform"} />
                            {tab.name}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center bg-primary-500 text-zinc-900 text-[10px] font-black rounded-full shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-bounce">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Tab Content */}
            <div className="min-h-[600px]">
                {activeTab === 'overview' && <AdminOverview state={state} />}
                {activeTab === 'approvals' && <AdminApprovals onSuccess={onSuccess} onError={onError} onRefresh={fetchCounts} />}
                {activeTab === 'payouts' && <AdminPayouts onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'disputes' && <AdminDisputes onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'metrics' && <AdminMetrics />}
                {activeTab === 'system' && <AdminSystem state={state} onRefresh={onRefresh} onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'referrals' && <AdminReferrals onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'users' && <AdminUsers onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'store' && <AdminStoreManager onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'rewards' && <AdminRewardsTab onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'investments' && <AdminInvestments onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'governance' && <AdminGovernance onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'reviews' && <AdminReviews onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'bugs' && <AdminBugs onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'logistics' && <AdminLogistics state={state} onRefresh={onRefresh} onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'partners' && <AdminPartners onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'fiscal' && <AdminFiscal />}
                {activeTab === 'consortium' && <ConsortiumAdminView />}
                {activeTab === 'compliance' && <AdminCompliance />}
            </div>

            {confirmMP && (
                <ConfirmModal
                    isOpen={true}
                    title="Simular Pagamento"
                    message="Deseja aprovar este pagamento no Sandbox?"
                    onConfirm={confirmSimulateMpPayment}
                    onClose={() => setConfirmMP(null)}
                />
            )}
        </div>
    );
};
