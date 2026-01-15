
import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Calendar, ChevronRight, Loader2, CheckCircle, Clock, Gavel } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import { AssemblyView } from './AssemblyView';

interface ConsortiumGroup {
    id: string;
    name: string;
    total_value: number;
    duration_months: number;
    admin_fee_percent: number;
    monthly_installment_value: number;
    status: string;
    member_count: number;
}

interface MyMembership {
    id: string;
    group_id: string;
    quota_number: number;
    status: string;
    group_name: string;
    total_value: number;
    monthly_installment_value: number;
    group_status: string;
    current_assembly_number: number;
    paid_installments: number;
    next_due_date: string;
    total_paid: number;
    current_pool: number;
    last_winner_name?: string;
}

interface ConsortiumViewProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const ConsortiumView: React.FC<ConsortiumViewProps> = ({ onSuccess, onError }) => {
    const [activeTab, setActiveTab] = useState<'explore' | 'my'>('explore');
    const [groups, setGroups] = useState<ConsortiumGroup[]>([]);
    const [myMemberships, setMyMemberships] = useState<MyMembership[]>([]);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState<string | null>(null);
    const [selectedAssembly, setSelectedAssembly] = useState<MyMembership | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [groupsRes, myRes] = await Promise.all([
                apiService.get<ConsortiumGroup[]>('/consortium/groups'),
                apiService.get<MyMembership[]>('/consortium/my-groups')
            ]);
            if (groupsRes.success && groupsRes.data) setGroups(groupsRes.data);
            if (myRes.success && myRes.data) setMyMemberships(myRes.data);
        } catch (e) {
            console.error('Erro ao carregar consórcios', e);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (groupId: string) => {
        setJoining(groupId);
        try {
            const res = await apiService.post<{ message: string }>('/consortium/join', { groupId });
            if (res.success) {
                onSuccess('Bem-vindo!', res.data?.message || 'Você entrou no consórcio!');
                loadData();
            } else {
                onError('Erro', res.message || 'Não foi possível entrar.');
            }
        } catch (e: any) {
            onError('Erro', e.message);
        } finally {
            setJoining(null);
        }
    };

    const handlePayInstallment = async (memberId: string) => {
        try {
            const res = await apiService.post<{ message: string }>('/consortium/pay-installment', { memberId });
            if (res.success) {
                onSuccess('Sucesso', res.data?.message || 'Parcela paga com sucesso!');
                loadData();
            } else {
                onError('Erro', res.message || 'Não foi possível pagar.');
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const formatCurrency = (value: number) =>
        Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Se estiver visualizando uma assembleia, mostrar a tela de assembleia
    if (selectedAssembly) {
        return (
            <AssemblyView
                groupId={selectedAssembly.group_id}
                memberId={selectedAssembly.id}
                groupName={selectedAssembly.group_name}
                totalValue={selectedAssembly.total_value}
                onSuccess={onSuccess}
                onError={onError}
                onClose={() => setSelectedAssembly(null)}
            />
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 size={32} className="animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-32">
            {/* Header */}
            <div className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-6 border border-zinc-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary-500/10 rounded-2xl flex items-center justify-center border border-primary-500/20">
                        <Users size={28} className="text-primary-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-white">Consórcios</h1>
                        <p className="text-xs text-zinc-400">Junte-se a um grupo e conquiste seu bem.</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
                <button
                    onClick={() => setActiveTab('explore')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'explore' ? 'bg-primary-500 text-black' : 'text-zinc-400 hover:text-white'}`}
                >
                    Explorar Grupos
                </button>
                <button
                    onClick={() => setActiveTab('my')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'my' ? 'bg-primary-500 text-black' : 'text-zinc-400 hover:text-white'}`}
                >
                    Meus Consórcios {myMemberships.length > 0 && <span className="ml-1 bg-black/20 px-2 py-0.5 rounded-full text-[10px]">{myMemberships.length}</span>}
                </button>
            </div>

            {/* Explore Tab */}
            {activeTab === 'explore' && (
                <div className="space-y-4">
                    {groups.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                            <Users size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="font-bold">Nenhum grupo disponível no momento.</p>
                        </div>
                    ) : (
                        groups.map(group => {
                            const alreadyJoined = myMemberships.some(m => m.group_id === group.id);
                            return (
                                <div key={group.id} className="bg-zinc-900 border border-white/5 rounded-2xl p-5 hover:border-primary-500/30 transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 inline-block mb-2">
                                                {group.status}
                                            </span>
                                            <h3 className="text-lg font-bold text-white">{group.name}</h3>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase font-black mb-1 justify-end">
                                                <Users size={10} /> {group.member_count || 0} participantes
                                            </div>
                                            <p className="text-[10px] text-zinc-500 uppercase font-black">Carta</p>
                                            <p className="text-xl font-black text-white">{formatCurrency(group.total_value)}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-sm mb-4">
                                        <div className="bg-black/20 p-3 rounded-lg text-center">
                                            <p className="text-[10px] text-zinc-500 uppercase font-black flex items-center justify-center gap-1"><DollarSign size={10} /> Parcela</p>
                                            <p className="text-emerald-400 font-bold">{formatCurrency(group.monthly_installment_value)}</p>
                                        </div>
                                        <div className="bg-black/20 p-3 rounded-lg text-center">
                                            <p className="text-[10px] text-zinc-500 uppercase font-black flex items-center justify-center gap-1"><Calendar size={10} /> Prazo</p>
                                            <p className="text-white font-bold">{group.duration_months}x</p>
                                        </div>
                                        <div className="bg-black/20 p-3 rounded-lg text-center">
                                            <p className="text-[10px] text-zinc-500 uppercase font-black">Taxa Adm</p>
                                            <p className="text-white font-bold">{group.admin_fee_percent}%</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => !alreadyJoined && handleJoin(group.id)}
                                        disabled={alreadyJoined || joining === group.id}
                                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${alreadyJoined
                                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                            : 'bg-primary-500 text-black hover:bg-primary-400'
                                            }`}
                                    >
                                        {joining === group.id ? (
                                            <><Loader2 size={18} className="animate-spin" /> Entrando...</>
                                        ) : alreadyJoined ? (
                                            <><CheckCircle size={18} /> Você já participa</>
                                        ) : (
                                            <>Entrar no Grupo <ChevronRight size={18} /></>
                                        )}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* My Consortiums Tab */}
            {activeTab === 'my' && (
                <div className="space-y-4">
                    {myMemberships.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                            <Clock size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="font-bold">Você ainda não participa de nenhum consórcio.</p>
                            <p className="text-sm mt-1">Explore os grupos disponíveis!</p>
                        </div>
                    ) : (
                        myMemberships.map(m => (
                            <div key={m.id} className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest inline-block mb-2 ${m.status === 'CONTEMPLATED' ? 'bg-amber-500/10 text-amber-400' : 'bg-primary-500/10 text-primary-400'
                                            }`}>
                                            {m.status === 'CONTEMPLATED' ? '🏆 Contemplado!' : `Cota #${m.quota_number}`}
                                        </span>
                                        <h3 className="text-lg font-bold text-white">{m.group_name}</h3>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white font-black">{formatCurrency(m.total_value)}</p>
                                        <p className="text-xs text-zinc-500">Parcela: {formatCurrency(m.monthly_installment_value)}</p>
                                    </div>
                                </div>

                                {m.last_winner_name && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 flex items-center gap-3">
                                        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                                            <CheckCircle size={16} className="text-amber-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-amber-400 uppercase font-black">Última Contemplação</p>
                                            <p className="text-sm font-bold text-white">{m.last_winner_name}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4 mb-4">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[10px] text-primary-400 uppercase font-black">Fundo Acumulado do Grupo</p>
                                        <Users size={12} className="text-primary-400 opacity-50" />
                                    </div>
                                    <p className="text-2xl font-black text-white">{formatCurrency(m.current_pool)}</p>
                                </div>


                                <div className="space-y-4">
                                    <div className="bg-black/20 p-4 rounded-xl space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-zinc-400">Progresso do Plano</span>
                                            <span className="text-white font-bold">{m.paid_installments} parcelas pagas</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 transition-all"
                                                style={{ width: `${(m.paid_installments / 60) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <div className="flex items-center gap-1 text-zinc-400">
                                                <Calendar size={10} />
                                                <span>Próximo: {m.next_due_date ? new Date(m.next_due_date).toLocaleDateString('pt-BR') : 'A definir'}</span>
                                            </div>
                                            <div className="text-emerald-400 font-bold">
                                                Total Pago: {formatCurrency(m.total_paid)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handlePayInstallment(m.id)}
                                            className="flex-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all"
                                        >
                                            <DollarSign size={16} /> Pagar Parcela
                                        </button>
                                        <button
                                            onClick={() => setSelectedAssembly(m)}
                                            className="flex-1 bg-primary-500/10 border border-primary-500/20 text-primary-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-500/20 transition-all"
                                        >
                                            <Gavel size={16} /> Assembleia
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
