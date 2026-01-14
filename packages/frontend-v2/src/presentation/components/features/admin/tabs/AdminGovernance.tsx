import React, { useState, useEffect, useCallback } from 'react';
import { Vote, Send, BarChart3, Gavel, ShieldCheck, Info } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminGovernanceProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

interface Proposal {
    id: number;
    title: string;
    description: string;
    status: 'active' | 'closed';
    yes_votes_power: string | number;
    no_votes_power: string | number;
    created_at: string;
}

export const AdminGovernance: React.FC<AdminGovernanceProps> = ({ onSuccess, onError }) => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [newPropTitle, setNewPropTitle] = useState('');
    const [newPropDesc, setNewPropDesc] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchProposals = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await apiService.getProposals() as any;
            if (res.success) {
                setProposals(res.data || []);
            }
        } catch (e) {
            console.error('Erro ao buscar propostas:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProposals();
    }, [fetchProposals]);

    const handleCreateProposal = async () => {
        if (!newPropTitle || !newPropDesc) return;
        try {
            const res = await apiService.createProposal(newPropTitle, newPropDesc);
            if (res.success) {
                onSuccess('Democracia Ativa', 'Sua proposta foi lançada para a comunidade com sucesso!');
                setNewPropTitle('');
                setNewPropDesc('');
                fetchProposals();
            } else {
                onError('Erro', res.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleCloseProposal = async (id: number) => {
        if (!window.confirm('Deseja realmente encerrar esta votação? O resultado será final e imutável.')) return;
        try {
            const res = await apiService.closeProposal(id);
            if (res.success) {
                onSuccess('Votação Encerrada', 'Os votos foram computados e a decisão foi selada.');
                fetchProposals();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Informativo */}
            <div className="bg-primary-500/5 border border-primary-500/20 rounded-3xl p-6 flex items-center gap-6">
                <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                    <ShieldCheck size={32} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Conselho de Governança</h2>
                    <p className="text-sm text-zinc-500 font-bold uppercase tracking-wider mt-1 italic">Gestão Democrática baseada em Voto Quadrático + Reputação</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
                        <Vote size={120} className="text-primary-400" />
                    </div>

                    <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3 relative z-10 uppercase tracking-tight">
                        <div className="p-2 bg-zinc-800 rounded-xl"><Vote className="text-primary-400" size={20} /></div>
                        Nova Proposta do Clube
                    </h3>

                    <div className="space-y-6 relative z-10">
                        <div>
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] ml-1 mb-2 block">Título da Proposta</label>
                            <input
                                placeholder="Ex: Ajuste da taxa de cessão de cotas"
                                value={newPropTitle}
                                onChange={(e) => setNewPropTitle(e.target.value)}
                                className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-bold tracking-tight transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] ml-1 mb-2 block">Descrição Detalhada para Membros</label>
                            <textarea
                                rows={4}
                                placeholder="Explique os benefícios sistêmicos para a comunidade Cred30..."
                                value={newPropDesc}
                                onChange={(e) => setNewPropDesc(e.target.value)}
                                className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-medium resize-none transition-all"
                            />
                        </div>
                        <button
                            onClick={handleCreateProposal}
                            disabled={!newPropTitle || !newPropDesc}
                            className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-30 text-black font-black py-5 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95 translate-y-[-2px] hover:translate-y-[-4px]"
                        >
                            <Send size={20} /> LANÇAR PARA VOTAÇÃO
                        </button>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3 uppercase tracking-tight">
                        <div className="p-2 bg-zinc-800 rounded-xl"><BarChart3 className="text-zinc-400" size={20} /></div>
                        Histórico de Decisões
                    </h3>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {isLoading ? (
                            <div className="py-20 text-center text-zinc-600 font-black uppercase tracking-[0.2em] animate-pulse">Sincronizando...</div>
                        ) : proposals.length === 0 ? (
                            <div className="text-center py-24 opacity-30">
                                <Info size={60} className="mx-auto mb-6 text-zinc-700" />
                                <p className="text-xs font-black uppercase tracking-[0.3em]">Nenhuma proposta no registro</p>
                            </div>
                        ) : (
                            proposals.map((prop) => (
                                <div key={prop.id} className="bg-black/40 border border-zinc-800 hover:border-zinc-700 p-6 rounded-3xl space-y-5 transition-all group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="text-white font-black text-lg uppercase tracking-tight leading-none mb-2">{prop.title}</h4>
                                            <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                                                ID: {prop.id} • {new Date(prop.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border ${prop.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                            {prop.status === 'active' ? 'ATIVA' : 'FINALIZADA'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5">
                                            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> PODER SIM
                                            </p>
                                            <p className="text-2xl font-black text-white tabular-nums">{Number(prop.yes_votes_power || 0).toFixed(1)}</p>
                                        </div>
                                        <div className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5">
                                            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> PODER NÃO
                                            </p>
                                            <p className="text-2xl font-black text-zinc-500 tabular-nums">{Number(prop.no_votes_power || 0).toFixed(1)}</p>
                                        </div>
                                    </div>

                                    {prop.status === 'active' && (
                                        <button
                                            onClick={() => handleCloseProposal(prop.id)}
                                            className="w-full bg-zinc-800 hover:bg-red-600 text-zinc-400 hover:text-white border border-zinc-700 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl"
                                        >
                                            <Gavel size={14} /> ENCERRAR E COMPUTAR
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
