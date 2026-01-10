import React, { useState, useEffect } from 'react';
import { Plus, Gift, Key, List, Clock, CheckCircle2, AlertCircle, Save, X } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

export const AdminRewardsTab: React.FC<{ onSuccess: (t: string, m: string) => void, onError: (t: string, m: string) => void }> = ({ onSuccess, onError }) => {
    const [rewards, setRewards] = useState<any[]>([]);
    const [redemptions, setRedemptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [editingReward, setEditingReward] = useState<any | null>(null);
    const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
    const [inventoryCodes, setInventoryCodes] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rewardsRes, redemptionsRes] = await Promise.all([
                apiService.getRewardsAdmin(),
                apiService.getRewardRedemptionsAdmin()
            ]);
            if (rewardsRes.success) setRewards(rewardsRes.data);
            if (redemptionsRes.success) setRedemptions(redemptionsRes.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReward = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const data = Object.fromEntries(formData.entries());

        try {
            const res = await apiService.saveRewardAdmin({
                ...data,
                points_cost: parseInt(data.points_cost as string),
                value: parseFloat(data.value as string),
                is_active: data.is_active === 'on'
            });

            if (res.success) {
                onSuccess('Sucesso', 'Recompensa salva com sucesso!');
                setShowRewardModal(false);
                loadData();
            } else {
                onError('Erro', res.message);
            }
        } catch (err: any) {
            onError('Erro', err.message);
        }
    };

    const handleAddInventory = async () => {
        if (!selectedRewardId || !inventoryCodes) return;
        try {
            const res = await apiService.addRewardInventoryAdmin(selectedRewardId, inventoryCodes);
            if (res.success) {
                onSuccess('Estoque Atualizado', res.message);
                setShowInventoryModal(false);
                setInventoryCodes('');
                loadData();
            } else {
                onError('Erro', res.message);
            }
        } catch (err: any) {
            onError('Erro', err.message);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Ações Rápidas */}
            <div className="flex flex-wrap gap-4">
                <button
                    onClick={() => { setEditingReward(null); setShowRewardModal(true); }}
                    className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-2xl flex items-center gap-3 text-sm font-black uppercase tracking-widest shadow-lg shadow-primary-900/20 active:scale-95 transition-all"
                >
                    <Plus size={18} /> Novo Item no Catálogo
                </button>
            </div>

            {/* Lista de Recompensas */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-zinc-800 bg-black/40 flex justify-between items-center">
                    <h3 className="text-lg font-black text-white flex items-center gap-3">
                        <Gift className="text-primary-400" /> Catálogo da Loja de Pontos
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Total: {rewards.length}</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[10px] uppercase font-black text-zinc-500 tracking-widest bg-black/20">
                            <tr>
                                <th className="px-6 py-4">Item</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Custo</th>
                                <th className="px-6 py-4 text-center">Vendido</th>
                                <th className="px-6 py-4 text-center">Estoque</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {rewards.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-600 italic">Nenhuma recompensa ativa.</td>
                                </tr>
                            )}
                            {rewards.map(reward => (
                                <tr key={reward.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 font-bold text-white">
                                        <div className="flex flex-col">
                                            <span>{reward.name}</span>
                                            <span className="text-[10px] text-zinc-500 font-mono tracking-tighter uppercase">{reward.id}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${reward.type === 'GIFT_CARD' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' :
                                            reward.type === 'MEMBERSHIP' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                                'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                            }`}>
                                            {reward.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-black text-white">{reward.points_cost.toLocaleString()} pts</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-xs font-bold text-zinc-400">{reward.used_count || 0}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`text-xs font-black ${reward.stock_count > 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                                            {reward.stock_count || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {reward.type === 'GIFT_CARD' && (
                                                <button
                                                    onClick={() => { setSelectedRewardId(reward.id); setShowInventoryModal(true); }}
                                                    className="p-2 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-colors border border-emerald-500/20"
                                                    title="Adicionar Códigos"
                                                >
                                                    <Key size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { setEditingReward(reward); setShowRewardModal(true); }}
                                                className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors border border-zinc-800"
                                                title="Editar"
                                            >
                                                <List size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Histórico Recente */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-zinc-800 bg-black/40">
                    <h3 className="text-lg font-black text-white flex items-center gap-3">
                        <Clock className="text-zinc-500" /> Últimos Resgates Realizados
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[10px] uppercase font-black text-zinc-500 tracking-widest bg-black/20">
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Associado</th>
                                <th className="px-6 py-4">Prêmio</th>
                                <th className="px-6 py-4">Código Enviado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {redemptions.map(r => (
                                <tr key={r.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 text-xs text-zinc-500">
                                        {new Date(r.created_at).toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white">{r.user_name}</span>
                                            <span className="text-[10px] text-zinc-500">{r.user_email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-zinc-300">
                                        {r.reward_name}
                                    </td>
                                    <td className="px-6 py-4">
                                        <code className="text-xs font-mono bg-black/50 px-2 py-1 rounded border border-white/5 text-primary-400">
                                            {r.code_delivered || 'AUTOMÁTICO'}
                                        </code>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Recompensa */}
            {showRewardModal && (
                <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl overflow-y-auto max-h-[90vh] ring-1 ring-white/10">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-white tracking-tight">{editingReward ? 'Editar' : 'Nova'} Recompensa</h3>
                            <button onClick={() => setShowRewardModal(false)} className="text-zinc-600 hover:text-white bg-white/5 p-2 rounded-full transition-colors"><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSaveReward} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 px-1">ID Único (Fixo)</label>
                                    <input name="id" defaultValue={editingReward?.id} readOnly={!!editingReward} required className="w-full bg-black/50 border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-primary-500 transition-colors" placeholder="gc-netflix-25" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 px-1">Tipo</label>
                                    <select name="type" defaultValue={editingReward?.type || 'GIFT_CARD'} className="w-full bg-black/50 border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-primary-500 transition-colors appearance-none">
                                        <option value="GIFT_CARD">GIFT_CARD</option>
                                        <option value="COUPON">COUPON</option>
                                        <option value="MEMBERSHIP">MEMBERSHIP</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 px-1">Nome de Exibição</label>
                                <input name="name" defaultValue={editingReward?.name} required className="w-full bg-black/50 border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-primary-500 transition-colors" placeholder="Gift Card Netflix R$ 25" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 px-1">Custo em Pontos</label>
                                    <input name="points_cost" type="number" defaultValue={editingReward?.points_cost} required className="w-full bg-black/50 border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-primary-500 transition-colors" placeholder="2500" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 px-1">Valor Comercial (R$)</label>
                                    <input name="value" type="number" step="0.01" defaultValue={editingReward?.value} required className="w-full bg-black/50 border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-primary-500 transition-colors" placeholder="25.00" />
                                </div>
                            </div>

                            <div className="flex items-center gap-4 bg-black/30 p-4 rounded-2xl border border-zinc-800">
                                <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                                    <input type="checkbox" name="is_active" defaultChecked={editingReward?.is_active ?? true} className="w-5 h-5 rounded border-zinc-800 text-primary-500 bg-zinc-900 focus:ring-offset-black" />
                                    <span className="text-sm font-bold text-white uppercase tracking-widest">Recompensa Ativa</span>
                                </label>
                            </div>

                            <button type="submit" className="w-full bg-primary-600 hover:bg-primary-500 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-primary-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                                <Save size={20} /> {editingReward ? 'Atualizar Catálogo' : 'Cadastrar Recompensa'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Estoque */}
            {showInventoryModal && (
                <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl ring-1 ring-white/10">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-white tracking-tight">Abastecer Estoque</h3>
                            <button onClick={() => setShowInventoryModal(false)} className="text-zinc-600 hover:text-white bg-white/5 p-2 rounded-full transition-colors"><X size={24} /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-4 items-start">
                                <AlertCircle size={24} className="text-amber-500 shrink-0" />
                                <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                                    Insira os códigos um abaixo do outro (um por linha). Códigos duplicados serão ignorados.
                                </p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 px-1">Códigos dos Gift Cards</label>
                                <textarea
                                    className="w-full bg-black/50 border border-zinc-800 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-primary-500 transition-colors h-48 resize-none"
                                    placeholder="ABCD-1234-EFGH-5678&#10;WXYZ-9876-UVTS-5432"
                                    value={inventoryCodes}
                                    onChange={e => setInventoryCodes(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={handleAddInventory}
                                disabled={!inventoryCodes.trim()}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <CheckCircle2 size={20} /> Confirmar Adição ao Estoque
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
