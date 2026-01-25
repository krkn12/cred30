import { memo } from 'react';
import { PieChart, TrendingUp, DollarSign, Vote, Users, ShieldCheck, Activity } from 'lucide-react';
import { AppState } from '../../../../../domain/types/common.types';

interface AdminOverviewProps {
    state: AppState;
}

interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    color: 'blue' | 'cyan' | 'emerald' | 'yellow' | 'red' | 'orange' | 'purple' | 'indigo';
}

const MetricCard = memo(({ title, value, subtitle, icon: Icon, color }: MetricCardProps) => {
    const colorClasses: Record<MetricCardProps['color'], string> = {
        blue: "from-blue-600 to-blue-700 border-blue-500/30 shadow-blue-500/10",
        cyan: "from-primary-600 to-primary-700 border-primary-500/30 shadow-primary-500/10",
        emerald: "from-emerald-600 to-emerald-700 border-emerald-500/30 shadow-emerald-500/10",
        yellow: "from-amber-600 to-amber-700 border-amber-500/30 shadow-amber-500/10",
        red: "from-red-600 to-red-700 border-red-500/30 shadow-red-500/10",
        orange: "from-orange-600 to-orange-700 border-orange-500/30 shadow-orange-500/10",
        purple: "from-purple-600 to-purple-700 border-purple-500/30 shadow-purple-500/10",
        indigo: "from-indigo-600 to-indigo-700 border-indigo-500/30 shadow-indigo-500/10",
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-6 text-white border shadow-lg transition-transform hover:scale-[1.02] duration-300`}>
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon size={20} className="text-white" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">{title}</span>
            </div>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className="text-[10px] opacity-90 mt-1 font-medium uppercase">{subtitle}</p>
        </div>
    );
});

MetricCard.displayName = 'MetricCard';

export const AdminOverview = ({ state }: AdminOverviewProps) => {
    const formatCurrency = (val: number | string) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (typeof numVal !== 'number' || isNaN(numVal)) return 'R$ 0,00';
        return numVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Guard clause: prevent crash if state is not loaded yet
    if (!state) {
        return <div className="text-center py-12 text-zinc-500">Carregando...</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Métricas Principais */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <MetricCard title="Membros" value={state.stats?.usersCount ?? state.users?.length ?? 0} subtitle="Usuários Totais" icon={Users} color="blue" />
                <MetricCard title="Participações" value={state.stats?.quotasCount ?? 0} subtitle="Licenças em Operação" icon={PieChart} color="cyan" />
                <MetricCard title="Liquidez Real" value={formatCurrency(state.stats?.systemConfig?.real_liquidity ?? state.systemBalance ?? 0)} subtitle="Capital das Cotas - Apoios Mútuos" icon={DollarSign} color="emerald" />
                <MetricCard title="Votações Ativas" value={state.stats?.activeProposalsCount ?? 0} subtitle="Governança em Aberto" icon={Vote} color="purple" />
            </div>

            {/* Dashboard de Potes (Divisão dos 12%) */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-primary-500/10 rounded-2xl">
                        <TrendingUp className="text-primary-500" size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-widest">Dashboard de Potes</h3>
                        <p className="text-xs text-zinc-500 font-bold">Transparência da Taxa de 12% do Marketplace</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
                    <MetricCard
                        title="Cotistas (6%)"
                        value={formatCurrency(state.stats?.systemConfig?.profit_pool || 0)}
                        subtitle="Distribuição de Sobras"
                        icon={Users}
                        color="blue"
                    />
                    <MetricCard
                        title="Impostos (1.2%)"
                        value={formatCurrency(state.stats?.systemConfig?.total_tax_reserve || 0)}
                        subtitle="Reserva Fiscal"
                        icon={ShieldCheck}
                        color="red"
                    />
                    <MetricCard
                        title="Operacional (1.2%)"
                        value={formatCurrency(state.stats?.systemConfig?.total_operational_reserve || 0)}
                        subtitle="Servidores e APIs"
                        icon={Activity}
                        color="orange"
                    />
                    <MetricCard
                        title="Pró-Labore (1.2%)"
                        value={formatCurrency(state.stats?.systemConfig?.total_owner_profit || 0)}
                        subtitle="Excedente do Fundador"
                        icon={DollarSign}
                        color="emerald"
                    />
                    <MetricCard
                        title="Estabilidade (1.2%)"
                        value={formatCurrency(state.stats?.systemConfig?.investment_reserve || 0)}
                        subtitle="Fundo de Reserva"
                        icon={ShieldCheck}
                        color="cyan"
                    />
                    <MetricCard
                        title="Empresas (1.2%)"
                        value={formatCurrency(state.stats?.systemConfig?.total_corporate_investment_reserve || 0)}
                        subtitle="Venture Capital / Equity"
                        icon={TrendingUp}
                        color="indigo"
                    />
                </div>
            </div>
        </div>
    );
};
