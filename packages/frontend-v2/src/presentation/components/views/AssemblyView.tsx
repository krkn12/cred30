
import React, { useState, useEffect, useCallback } from 'react';
import {
    Gavel, Users, Info, TrendingUp, Send, CheckCircle2, History, MessageSquare, AlertTriangle, Loader2, ArrowLeft, Trophy, DollarSign, ThumbsUp, ThumbsDown, Clock
} from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import { useNavigate, useParams } from 'react-router-dom';

interface Assembly {
    id: string;
    group_id: string;
    assembly_number: number;
    month_year: string;
    status: 'SCHEDULED' | 'OPEN_FOR_BIDS' | 'VOTING' | 'FINISHED';
    total_pool_collected: number;
    bids: Bid[] | null;
}

interface Bid {
    id?: string;
    amount: number;
    status: string;
    member_quota: number;
}

interface AssemblyViewProps {
    groupId: string;
    memberId: string;
    groupName: string;
    totalValue: number;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onClose: () => void;
}

export const AssemblyView: React.FC<AssemblyViewProps> = ({
    groupId,
    memberId,
    groupName,
    totalValue,
    onSuccess,
    onError,
    onClose
}) => {
    const [assembly, setAssembly] = useState<Assembly | null>(null);
    const [loading, setLoading] = useState(true);
    const [bidAmount, setBidAmount] = useState('');
    const [bidType, setBidType] = useState<'FREE' | 'FIXED'>('FREE');
    const [isEmbedded, setIsEmbedded] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const loadAssembly = useCallback(async () => {
        try {
            const res = await apiService.get<Assembly>(`/consortium/groups/${groupId}/active-assembly`);
            if (res.success && res.data) {
                setAssembly(res.data);
            }
        } catch (e) {
            console.error('Erro ao carregar assembleia', e);
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    useEffect(() => {
        loadAssembly();
        // Auto-refresh a cada 10 segundos
        const interval = setInterval(loadAssembly, 10000);
        return () => clearInterval(interval);
    }, [loadAssembly]);

    const handlePlaceBid = async () => {
        if (!assembly || !bidAmount) return;
        setSubmitting(true);
        try {
            const embeddedAmount = isEmbedded ? parseFloat(bidAmount) : 0;
            const res = await apiService.post<{ message: string }>('/consortium/bid', {
                assemblyId: assembly.id,
                memberId,
                amount: parseFloat(bidAmount),
                bidType,
                isEmbedded,
                embeddedAmount
            });
            if (res.success) {
                onSuccess('Lance Registrado!', res.data?.message || 'Seu lance foi enviado.');
                loadAssembly();
                setBidAmount('');
            } else {
                onError('Erro', res.message || 'Não foi possível registrar o lance.');
            }
        } catch (e: any) {
            onError('Erro', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleVote = async (bidId: string, vote: boolean) => {
        if (!assembly) return;
        setSubmitting(true);
        try {
            const res = await apiService.post<{ message: string }>('/consortium/vote', {
                assemblyId: assembly.id,
                bidId,
                vote
            });
            if (res.success) {
                onSuccess('Voto Registrado!', res.data?.message || 'Seu voto foi contabilizado.');
                loadAssembly();
            } else {
                onError('Erro', res.message || 'Não foi possível votar.');
            }
        } catch (e: any) {
            onError('Erro', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (value: number) =>
        Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 size={32} className="animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto pb-32">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition">
                    <ArrowLeft size={20} className="text-zinc-400" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-white">{groupName}</h1>
                    <p className="text-xs text-zinc-500">Assembleia #{assembly?.assembly_number || 1} • {assembly?.month_year}</p>
                </div>
            </div>

            {/* Status Banner */}
            <div className={`p-5 rounded-2xl border text-center ${assembly?.status === 'OPEN_FOR_BIDS' ? 'bg-emerald-500/10 border-emerald-500/20' :
                assembly?.status === 'VOTING' ? 'bg-amber-500/10 border-amber-500/20' :
                    assembly?.status === 'FINISHED' ? 'bg-zinc-800 border-zinc-700' :
                        'bg-zinc-900 border-zinc-800'
                }`}>
                {assembly?.status === 'OPEN_FOR_BIDS' && (
                    <>
                        <Gavel size={32} className="mx-auto mb-2 text-emerald-400" />
                        <p className="text-lg font-bold text-emerald-400">Janela de Lances Aberta!</p>
                        <p className="text-xs text-zinc-400 mt-1">Faça sua oferta para ser contemplado.</p>
                    </>
                )}
                {assembly?.status === 'VOTING' && (
                    <>
                        <Users size={32} className="mx-auto mb-2 text-amber-400" />
                        <p className="text-lg font-bold text-amber-400">Votação em Andamento</p>
                        <p className="text-xs text-zinc-400 mt-1">Aprove ou rejeite o lance vencedor.</p>
                    </>
                )}
                {assembly?.status === 'FINISHED' && (
                    <>
                        <Trophy size={32} className="mx-auto mb-2 text-primary-400" />
                        <p className="text-lg font-bold text-white">Assembleia Encerrada</p>
                        <p className="text-xs text-zinc-400 mt-1">O vencedor já foi definido.</p>
                    </>
                )}
                {assembly?.status === 'SCHEDULED' && (
                    <>
                        <Clock size={32} className="mx-auto mb-2 text-zinc-400" />
                        <p className="text-lg font-bold text-white">Aguardando Início</p>
                        <p className="text-xs text-zinc-400 mt-1">A assembleia ainda não começou.</p>
                    </>
                )}
                {!assembly && (
                    <>
                        <Clock size={32} className="mx-auto mb-2 text-zinc-400" />
                        <p className="text-lg font-bold text-white">Nenhuma Assembleia Ativa</p>
                        <p className="text-xs text-zinc-400 mt-1">Aguarde a próxima assembleia ser agendada.</p>
                    </>
                )}
            </div>

            {/* Place Bid Section */}
            {assembly?.status === 'OPEN_FOR_BIDS' && (
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <DollarSign size={16} className="text-primary-400" /> Dar Lance
                    </h3>
                    <p className="text-xs text-zinc-500">
                        O lance é o valor que você oferece para antecipar sua contemplação. Quanto maior o lance, maiores as chances de ser escolhido.
                    </p>

                    {/* Aviso de Risco/Blindagem */}
                    <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl mb-6">
                        <div className="flex gap-3">
                            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                                Ao enviar um lance, você confirma ciência de que este é um processo de
                                <strong> Aquisição Programada Coletiva</strong>. A liberação do crédito depende do
                                saldo comum do grupo e da aprovação comunitária dos demais membros.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2 p-1 bg-black/40 rounded-2xl border border-white/5">
                        <button
                            onClick={() => setBidType('FREE')}
                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${bidType === 'FREE' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Lance Livre
                        </button>
                        <button
                            onClick={() => {
                                setBidType('FIXED');
                                // Sugere o valor fixo baseado em 30% (padrão)
                                setBidAmount((totalValue * 0.3).toString());
                            }}
                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${bidType === 'FIXED' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Lance Fixo (30%)
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-4 flex items-center text-zinc-500 font-medium">
                                R$
                            </div>
                            <input
                                type="number"
                                value={bidAmount}
                                onChange={(e) => setBidAmount(e.target.value)}
                                placeholder="Valor do lance"
                                className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-colors"
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEmbedded ? 'bg-primary-500/10 text-primary-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                    <Send size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white">Lance Embutido</p>
                                    <p className="text-[10px] text-zinc-500">Usar saldo da própria carta</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEmbedded(!isEmbedded)}
                                className={`w-12 h-6 rounded-full relative transition-colors ${isEmbedded ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isEmbedded ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

                        {isEmbedded && (
                            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl text-[10px] text-blue-400">
                                <strong>Nota:</strong> Este valor será descontado da sua carta de crédito caso você seja contemplado. Você receberá o valor líquido.
                            </div>
                        )}
                        <button
                            onClick={handlePlaceBid}
                            disabled={submitting || !bidAmount}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/10"
                        >
                            {submitting ? 'Enviando...' : 'Confirmar Lance'}
                        </button>
                    </div>

                    <div className="bg-black/20 p-3 rounded-lg text-xs text-zinc-400">
                        <strong className="text-white">Dica:</strong> Lances comuns ficam entre 10% e 30% do valor da carta ({formatCurrency(totalValue * 0.1)} a {formatCurrency(totalValue * 0.3)}).
                    </div>
                </div>
            )}

            {/* Bids Ranking */}
            {assembly?.bids && assembly.bids.length > 0 && (
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Trophy size={16} className="text-amber-400" /> Ranking de Lances
                    </h3>
                    <div className="space-y-2">
                        {assembly.bids
                            .sort((a, b) => b.amount - a.amount)
                            .map((bid, index) => (
                                <div key={index} className={`flex justify-between items-center p-3 rounded-xl ${index === 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-black/20'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${index === 0 ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'
                                            }`}>
                                            {index + 1}
                                        </span>
                                        <span className="text-white text-sm font-bold">Cota #{bid.member_quota}</span>
                                    </div>
                                    <span className={`font-black ${index === 0 ? 'text-amber-400' : 'text-white'}`}>
                                        {formatCurrency(bid.amount)}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Voting Section */}
            {assembly?.status === 'VOTING' && assembly.bids && assembly.bids.length > 0 && (
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Users size={16} className="text-primary-400" /> Votação
                    </h3>
                    <p className="text-xs text-zinc-500">
                        O maior lance foi de <strong className="text-amber-400">{formatCurrency(assembly.bids[0].amount)}</strong> pela Cota #{assembly.bids[0].member_quota}.
                        Você aprova a contemplação?
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={() => handleVote(assembly.bids![0].id!, true)}
                            disabled={submitting}
                            className="flex-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl font-bold hover:bg-emerald-500/20 transition flex items-center justify-center gap-2"
                        >
                            <ThumbsUp size={20} /> Aprovar
                        </button>
                        <button
                            onClick={() => handleVote(assembly.bids![0].id!, false)}
                            disabled={submitting}
                            className="flex-1 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl font-bold hover:bg-red-500/20 transition flex items-center justify-center gap-2"
                        >
                            <ThumbsDown size={20} /> Rejeitar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
