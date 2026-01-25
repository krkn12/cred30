
import React, { useState, useEffect } from 'react';
import { Plus, Users, DollarSign, Calendar } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface ConsortiumGroup {
    id: string;
    name: string;
    total_value: number;
    duration_months: number;
    admin_fee_percent: number;
    monthly_installment_value: number;
    status: string;
    start_date: string;
    current_pool: number;
    current_assembly_number: number;
    member_count: number;
    group_identifier: string;
    annual_adjustment_percent: number;
}

interface ConsortiumMember {
    id: string;
    user_name: string;
    user_email: string;
    quota_number: number;
    status: string;
    paid_installments: number;
    total_paid: number;
    credit_status?: 'PENDING' | 'APPROVED' | 'BLOCKED';
    guarantee_description?: string;
}

export const ConsortiumAdminView: React.FC = () => {
    const [groups, setGroups] = useState<ConsortiumGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroup, setNewGroup] = useState({
        name: '',
        totalValue: 10000,
        durationMonths: 60,
        adminFeePercent: 15,
        reserveFeePercent: 1,
        fixedBidPercent: 30,
        maxEmbeddedBidPercent: 30,
        minMembersToStart: 10,
        startDate: new Date().toISOString().split('T')[0],
        annualAdjustmentPercent: 0
    });
    const [selectedGroup, setSelectedGroup] = useState<ConsortiumGroup | null>(null);
    const [members, setMembers] = useState<ConsortiumMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [showAssemblyModal, setShowAssemblyModal] = useState(false);
    const [assemblyData, setAssemblyData] = useState({
        monthYear: new Date().toISOString().slice(0, 7) // YYYY-MM
    });
    const [stats, setStats] = useState({
        totalPool: 0,
        totalAvailable: 0,
        ownerProfit: 0,
        investorsProfit: 0,
        totalGroups: 0,
        totalMembers: 0,
        totalContemplated: 0
    });

    useEffect(() => {
        loadGroups();
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const res = await apiService.get<any>('/consortium/stats');
            if (res.success && res.data) setStats(res.data);
        } catch (e) {
            console.error('Erro ao carregar stats', e);
        }
    };

    const loadGroups = async () => {
        try {
            const res = await apiService.get<ConsortiumGroup[]>('/consortium/groups');
            if (res.success && res.data) {
                setGroups(res.data);
            }
        } catch (e) {
            console.error('Erro ao carregar grupos', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async () => {
        try {
            const res = await apiService.post('/consortium/groups', newGroup);
            if (res.success) {
                loadGroups();
                setShowCreateModal(false);
            } else {
                alert('Erro ao criar grupo: ' + res.message);
            }
        } catch (e) {
            alert('Erro ao criar grupo');
        }
    };

    const loadMembers = async (groupId: string) => {
        setLoadingMembers(true);
        try {
            const res = await apiService.get<ConsortiumMember[]>(`/consortium/groups/${groupId}/members`);
            if (res.success && res.data) {
                setMembers(res.data);
            }
        } catch (e) {
            console.error('Erro ao carregar membros', e);
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleCreateAssembly = async () => {
        if (!selectedGroup) return;
        try {
            const res = await apiService.post('/consortium/assemblies', {
                groupId: selectedGroup.id,
                monthYear: assemblyData.monthYear
            });
            if (res.success) {
                alert('Assembleia aberta com sucesso!');
                setShowAssemblyModal(false);
                loadGroups();
            }
        } catch (e) {
            alert('Erro ao abrir assembleia');
        }
    };

    /* 
    const handleCloseAssembly = async (winnerMemberId?: string, bidAmount?: number) => {
        // Implementação simplificada para o admin fechar a assembleia atual
        const assemblyId = prompt('Digite o ID da Assembleia para fechar (ou use a tela de assembleia)');
        if (!assemblyId) return;

        try {
            const res = await apiService.post('/consortium/assemblies/close', {
                assemblyId,
                winnerMemberId,
                winningBidAmount: bidAmount
            });
            if (res.success) {
                alert('Assembleia encerrada!');
                loadGroups();
            }
        } catch (e) {
            alert('Erro ao encerrar assembleia');
        }
    };
    */

    const handleApproveCredit = async (memberId: string) => {
        const description = prompt('Descreva a garantia (Ex: Moto X Alienada, Seguro Ok):');
        if (!description) return;

        try {
            const res = await apiService.post('/consortium/approve-credit', {
                memberId,
                guaranteeDescription: description
            });
            if (res.success) {
                alert('Crédito liberado com sucesso!');
                if (selectedGroup) loadMembers(selectedGroup.id);
                loadStats();
            } else {
                alert('Erro ao liberar crédito: ' + res.message);
            }
        } catch (e) {
            alert('Erro ao processar aprovação');
        }
    };

    const handleAdjustValue = async (group: ConsortiumGroup) => {
        const percent = prompt(`Deseja aplicar o reajuste anual de ${group.annual_adjustment_percent}%? Digite a porcentagem ou deixe em branco para usar o padrão do grupo.`, group.annual_adjustment_percent.toString());
        if (percent === null) return;

        if (!confirm(`Confirmar reajuste do grupo ${group.group_identifier}? Isso alterará o valor da carta e das parcelas para TODOS os membros.`)) return;

        try {
            const res = await apiService.post('/consortium/adjust-value', {
                groupId: group.id,
                adjustmentPercent: parseFloat(percent)
            });
            if (res.success) {
                alert(res.message);
                loadGroups();
            } else {
                alert('Erro ao reajustar: ' + res.message);
            }
        } catch (e) {
            alert('Erro ao processar reajuste');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Gestão de Consórcios</h2>
                    <p className="text-zinc-400">Gerencie grupos, cotas e assembleias.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-primary-500 text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-primary-400 transition"
                >
                    <Plus size={18} /> Novo Grupo
                </button>
            </div>

            {/* Performance Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-900/20 border border-emerald-500/20 p-4 rounded-2xl">
                    <p className="text-[10px] text-emerald-400 font-black uppercase mb-1">Excedente Acumulado (Seu)</p>
                    <p className="text-xl font-black text-white">{stats.ownerProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="bg-zinc-900 border border-white/5 p-4 rounded-2xl">
                    <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Saldo Total nos Grupos</p>
                    <p className="text-xl font-black text-white">{stats.totalPool.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="bg-zinc-900 border border-white/5 p-4 rounded-2xl">
                    <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Saldo Disponível (Prêmios)</p>
                    <p className="text-xl font-black text-white">{stats.totalAvailable.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="bg-zinc-900 border border-white/5 p-4 rounded-2xl">
                    <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Membros Ativos</p>
                    <p className="text-xl font-black text-white">{stats.totalMembers}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map(group => (
                    <div key={group.id} className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-4 hover:border-primary-500/30 transition-all">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest inline-block ${group.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                                        {group.status}
                                    </span>
                                    <span className="bg-primary-500/10 text-primary-400 px-2 py-1 rounded text-[10px] font-black uppercase border border-primary-500/20">
                                        {group.group_identifier}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-white">{group.name}</h3>
                            </div>
                            <div className="w-10 h-10 bg-zinc-800 rounded-lg flex flex-col items-center justify-center">
                                <Users size={16} className="text-zinc-400" />
                                <span className="text-[10px] text-zinc-500 font-bold">{group.member_count || 0}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-black/20 p-2 rounded-lg">
                                <p className="text-[10px] text-zinc-500 uppercase font-black">Carta de Crédito</p>
                                <p className="text-white font-bold">{Number(group.total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                            <div className="bg-black/20 p-2 rounded-lg">
                                <p className="text-[10px] text-zinc-500 uppercase font-black">Parcela</p>
                                <p className="text-emerald-400 font-bold">{Number(group.monthly_installment_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-xs text-zinc-400 border-t border-white/5 pt-3">
                            <span className="flex items-center gap-1"><Calendar size={12} /> {group.duration_months} meses</span>
                            <span className="flex items-center gap-1"><DollarSign size={12} /> Taxa {group.admin_fee_percent}%</span>
                        </div>

                        <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 flex justify-between items-center">
                            <div>
                                <p className="text-[10px] text-emerald-400 uppercase font-black uppercase">Saldo Disponível</p>
                                <p className="text-lg font-black text-white">{(group as any).current_pool_available ? Number((group as any).current_pool_available).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : Number(group.current_pool || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedGroup(group);
                                    loadMembers(group.id);
                                }}
                                className="bg-emerald-500 text-black px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-emerald-400 transition"
                            >
                                Ver Detalhes
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setSelectedGroup(group);
                                    setShowAssemblyModal(true);
                                }}
                                className="flex-1 bg-zinc-800 text-white py-2 rounded-xl text-xs font-bold hover:bg-zinc-700 transition"
                            >
                                Gerir Assembleia
                            </button>
                            <button
                                onClick={() => handleAdjustValue(group)}
                                className="bg-primary-500/10 text-primary-400 p-2 rounded-xl hover:bg-primary-500 hover:text-black transition border border-primary-500/20"
                                title="Aplicar Reajuste Anual"
                            >
                                <DollarSign size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Detalhes do Grupo / Membros */}
            {
                selectedGroup && !showAssemblyModal && (
                    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-white">Membros do Grupo: {selectedGroup.name}</h3>
                                    <p className="text-xs text-zinc-500">Gestão de cotas e aprovação de garantias</p>
                                </div>
                                <button onClick={() => setSelectedGroup(null)} className="text-zinc-500 hover:text-white font-bold bg-zinc-800 px-3 py-1 rounded-lg transition">FECHAR</button>
                            </div>

                            <div className="overflow-y-auto flex-1 pr-2">
                                {loadingMembers ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-zinc-500 animate-pulse">
                                        <Users size={40} className="mb-2 opacity-20" />
                                        <p>Carregando membros...</p>
                                    </div>
                                ) : members.length === 0 ? (
                                    <p className="text-center py-20 text-zinc-500 italic">Nenhum membro neste grupo ainda.</p>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="text-[10px] text-zinc-500 uppercase font-black border-b border-white/5">
                                            <tr>
                                                <th className="pb-3 px-2">Cota</th>
                                                <th className="pb-3 px-2">Usuário</th>
                                                <th className="pb-3 px-2">Parcelas</th>
                                                <th className="pb-3 px-2">Total Pago</th>
                                                <th className="pb-3 px-2">Status</th>
                                                <th className="pb-3 px-2 text-right">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-xs text-white divide-y divide-white/5">
                                            {members.map(m => (
                                                <tr key={m.id} className="hover:bg-white/[0.02] transition">
                                                    <td className="py-4 px-2 font-black text-primary-400">#{m.quota_number}</td>
                                                    <td className="py-4 px-2">
                                                        <p className="font-bold">{m.user_name}</p>
                                                        <p className="text-[10px] text-zinc-500">{m.user_email}</p>
                                                    </td>
                                                    <td className="py-4 px-2">{m.paid_installments}</td>
                                                    <td className="py-4 px-2 text-emerald-400 font-bold">{Number(m.total_paid).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                    <td className="py-4 px-2">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black w-fit ${m.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                                {m.status}
                                                            </span>
                                                            {m.status === 'CONTEMPLATED' && (
                                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black w-fit ${m.credit_status === 'APPROVED' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400 animate-pulse'}`}>
                                                                    {m.credit_status === 'APPROVED' ? 'CRÉDITO LIBERADO' : 'AGUARDANDO GARANTIA'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-2 text-right">
                                                        {m.status === 'CONTEMPLATED' && m.credit_status !== 'APPROVED' && (
                                                            <button
                                                                onClick={() => handleApproveCredit(m.id)}
                                                                className="bg-primary-500 text-black px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-primary-400 transition transform active:scale-95 shadow-lg shadow-primary-500/20"
                                                            >
                                                                APROVAR GARANTIA
                                                            </button>
                                                        )}
                                                        {m.credit_status === 'APPROVED' && (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[10px] text-emerald-400 font-black flex items-center gap-1">
                                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                                                    Garantia Ok
                                                                </span>
                                                                <p className="text-[9px] text-zinc-600 italic max-w-[120px] truncate" title={m.guarantee_description}>
                                                                    {m.guarantee_description}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal Gerir Assembleia */}
            {
                showAssemblyModal && selectedGroup && (
                    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white">Assembleia: {selectedGroup.name}</h3>
                                <button onClick={() => setShowAssemblyModal(false)} className="text-zinc-500 hover:text-white transition">X</button>
                            </div>
                            <p className="text-xs text-zinc-400">Assembleia atual: <strong className="text-white">#{selectedGroup.current_assembly_number}</strong></p>

                            <div>
                                <label className="text-xs text-zinc-500 block mb-1 uppercase font-black">Mês/Ano de Referência</label>
                                <input
                                    type="month"
                                    value={assemblyData.monthYear}
                                    onChange={e => setAssemblyData({ ...assemblyData, monthYear: e.target.value })}
                                    className="w-full bg-black rounded-lg border border-white/10 p-4 text-white outline-none focus:border-primary-500 transition"
                                />
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                                <p className="text-[10px] text-amber-400 font-black uppercase mb-1">Atenção</p>
                                <p className="text-[10px] text-zinc-500 leading-relaxed">
                                    Abrir uma nova assembleia permite que membros deem lances e participem do sorteio para este mês.
                                </p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setShowAssemblyModal(false)}
                                    className="flex-1 bg-zinc-800 text-white p-4 rounded-xl font-bold hover:bg-zinc-700 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreateAssembly}
                                    className="flex-1 bg-emerald-500 text-black p-4 rounded-xl font-bold hover:bg-emerald-400 shadow-xl shadow-emerald-500/20 transition"
                                >
                                    Abrir Assembleia
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal Criar Grupo */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold text-white">Criar Novo Grupo</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-zinc-500 block mb-1 uppercase font-black">Nome do Grupo</label>
                                    <input
                                        type="text"
                                        value={newGroup.name}
                                        onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
                                        className="w-full bg-black rounded-xl border border-white/10 p-3 text-white outline-none focus:border-primary-500 transition"
                                        placeholder="Ex: Moto Yamaha 30k"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-zinc-500 block mb-1 uppercase font-black">Valor (R$)</label>
                                        <input
                                            type="number"
                                            value={newGroup.totalValue}
                                            onChange={e => setNewGroup({ ...newGroup, totalValue: Number(e.target.value) })}
                                            className="w-full bg-black rounded-xl border border-white/10 p-3 text-white outline-none focus:border-primary-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 block mb-1 uppercase font-black">Prazo</label>
                                        <input
                                            type="number"
                                            value={newGroup.durationMonths}
                                            onChange={e => setNewGroup({ ...newGroup, durationMonths: Number(e.target.value) })}
                                            className="w-full bg-black rounded-xl border border-white/10 p-3 text-white outline-none focus:border-primary-500 transition"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-zinc-500 block mb-1 uppercase font-black">Taxa Adm (%)</label>
                                        <input
                                            type="number"
                                            value={newGroup.adminFeePercent}
                                            onChange={e => setNewGroup({ ...newGroup, adminFeePercent: Number(e.target.value) })}
                                            className="w-full bg-black rounded-xl border border-white/10 p-3 text-white outline-none focus:border-primary-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 block mb-1 uppercase font-black">Fundo Res. (%)</label>
                                        <input
                                            type="number"
                                            value={newGroup.reserveFeePercent}
                                            onChange={e => setNewGroup({ ...newGroup, reserveFeePercent: Number(e.target.value) })}
                                            className="w-full bg-black rounded-xl border border-white/10 p-3 text-white outline-none focus:border-primary-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-zinc-500 block mb-1 uppercase font-black">Lance Fixo (%)</label>
                                        <input
                                            type="number"
                                            value={newGroup.fixedBidPercent}
                                            onChange={e => setNewGroup({ ...newGroup, fixedBidPercent: Number(e.target.value) })}
                                            className="w-full bg-black rounded-xl border border-white/10 p-3 text-white outline-none focus:border-primary-500 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 block mb-1 uppercase font-black">Embutido (%)</label>
                                        <input
                                            type="number"
                                            value={newGroup.maxEmbeddedBidPercent}
                                            onChange={e => setNewGroup({ ...newGroup, maxEmbeddedBidPercent: Number(e.target.value) })}
                                            className="w-full bg-black rounded-xl border border-white/10 p-3 text-white outline-none focus:border-primary-500 text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-zinc-500 block mb-1 uppercase font-black">Mín. Membros</label>
                                        <input
                                            type="number"
                                            value={newGroup.minMembersToStart}
                                            onChange={e => setNewGroup({ ...newGroup, minMembersToStart: Number(e.target.value) })}
                                            className="w-full bg-black rounded-xl border border-white/10 p-3 text-white outline-none focus:border-primary-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 block mb-1 uppercase font-black">Início</label>
                                        <input
                                            type="date"
                                            value={newGroup.startDate}
                                            onChange={e => setNewGroup({ ...newGroup, startDate: e.target.value })}
                                            className="w-full bg-black rounded-xl border border-white/10 p-3 text-white outline-none focus:border-primary-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 block mb-1 uppercase font-black">Reajuste Anual (%)</label>
                                        <input
                                            type="number"
                                            value={newGroup.annualAdjustmentPercent}
                                            onChange={e => setNewGroup({ ...newGroup, annualAdjustmentPercent: Number(e.target.value) })}
                                            className="w-full bg-black rounded-xl border border-white/10 p-3 text-white outline-none focus:border-primary-500"
                                            placeholder="Ex: 5"
                                        />
                                    </div>
                                </div>

                                <div className="bg-primary-500/10 p-4 rounded-2xl border border-primary-500/20">
                                    <p className="text-[10px] text-zinc-500 uppercase font-black mb-1">Parcela Estimada</p>
                                    <p className="text-xl font-black text-primary-400">
                                        {((newGroup.totalValue * (1 + (newGroup.adminFeePercent + newGroup.reserveFeePercent) / 100)) / newGroup.durationMonths).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 bg-zinc-800 text-white p-4 rounded-xl font-bold hover:bg-zinc-700 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreateGroup}
                                    className="flex-1 bg-primary-500 text-black p-4 rounded-xl font-bold hover:bg-primary-400 transition shadow-xl shadow-primary-500/20"
                                >
                                    Criar Grupo
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
