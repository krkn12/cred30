
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
        startDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadGroups();
    }, []);

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map(group => (
                    <div key={group.id} className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-4 hover:border-primary-500/30 transition-all">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest mb-2 inline-block ${group.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                                    {group.status}
                                </span>
                                <h3 className="text-lg font-bold text-white">{group.name}</h3>
                            </div>
                            <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                                <Users size={20} className="text-zinc-400" />
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
                    </div>
                ))}
            </div>

            {/* Modal Criar Grupo */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                        <h3 className="text-xl font-bold text-white">Criar Novo Grupo</h3>

                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Nome do Grupo</label>
                            <input
                                type="text"
                                value={newGroup.name}
                                onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
                                className="w-full bg-black rounded-lg border border-white/10 p-3 text-white outline-none focus:border-primary-500"
                                placeholder="Ex: Moto Yamaha 30k"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Valor da Carta (R$)</label>
                                <input
                                    type="number"
                                    value={newGroup.totalValue}
                                    onChange={e => setNewGroup({ ...newGroup, totalValue: Number(e.target.value) })}
                                    className="w-full bg-black rounded-lg border border-white/10 p-3 text-white outline-none focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Prazo (Meses)</label>
                                <input
                                    type="number"
                                    value={newGroup.durationMonths}
                                    onChange={e => setNewGroup({ ...newGroup, durationMonths: Number(e.target.value) })}
                                    className="w-full bg-black rounded-lg border border-white/10 p-3 text-white outline-none focus:border-primary-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Taxa Adm (%)</label>
                                <input
                                    type="number"
                                    value={newGroup.adminFeePercent}
                                    onChange={e => setNewGroup({ ...newGroup, adminFeePercent: Number(e.target.value) })}
                                    className="w-full bg-black rounded-lg border border-white/10 p-3 text-white outline-none focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Início</label>
                                <input
                                    type="date"
                                    value={newGroup.startDate}
                                    onChange={e => setNewGroup({ ...newGroup, startDate: e.target.value })}
                                    className="w-full bg-black rounded-lg border border-white/10 p-3 text-white outline-none focus:border-primary-500"
                                />
                            </div>
                        </div>

                        <div className="bg-primary-500/10 p-3 rounded-lg border border-primary-500/20">
                            <div className="flex justify-between text-sm">
                                <span className="text-zinc-400">Parcela Estimada:</span>
                                <span className="text-primary-400 font-black">
                                    {((newGroup.totalValue * (1 + newGroup.adminFeePercent / 100)) / newGroup.durationMonths).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 bg-zinc-800 text-white p-3 rounded-xl font-bold hover:bg-zinc-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateGroup}
                                className="flex-1 bg-primary-500 text-black p-3 rounded-xl font-bold hover:bg-primary-400"
                            >
                                Criar Grupo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
