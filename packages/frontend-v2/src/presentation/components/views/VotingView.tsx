import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Info, Trophy, BarChart3, FileText, Users, ShieldCheck, Zap, Gavel } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import jsPDF from 'jspdf';
import { AppState } from '../../../domain/types/common.types';
import { LoadingScreen } from '../ui/LoadingScreen';
import { LoadingButton } from '../ui/LoadingButton';

interface VotingViewProps {
    appState: AppState;
    onBack: () => void;
    onRefresh: () => Promise<void>;
    onSuccess: (title: string, msg: string) => void;
    onError: (title: string, msg: string) => void;
}

export const VotingView = ({ appState, onBack, onRefresh, onSuccess, onError }: VotingViewProps) => {
    void onBack;
    const [proposals, setProposals] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [votingInProgress, setVotingInProgress] = useState<number | null>(null);
    const [userCurrentPower, setUserCurrentPower] = useState<number>(0);

    const user = appState?.currentUser;
    const activeQuotas = appState?.quotas?.filter(q => q.userId === user?.id && q.status === 'ACTIVE').length ?? 0;
    const totalCommunityMembers = appState?.users?.length ?? 0;
    void totalCommunityMembers;

    // Guard clause: prevent crash if appState or user is not loaded yet
    if (!appState || !user) {
        return <LoadingScreen fullScreen message="Carregando Governança..." />;
    }

    if (isLoading && proposals.length === 0) {
        return <LoadingScreen message="Buscando Propostas Ativas..." />;
    }

    const fetchProposals = async () => {
        try {
            const res = await apiService.get('/voting/proposals');
            if (res.success) {
                setProposals(res.data as any[]);
                if ((res as any).userCurrentPower) {
                    setUserCurrentPower((res as any).userCurrentPower);
                }
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProposals();
        // Polling para atualização em tempo real (a cada 15s)
        const interval = setInterval(fetchProposals, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleVote = async (proposalId: number, choice: 'yes' | 'no') => {
        setVotingInProgress(proposalId);
        try {
            const res = await apiService.post('/voting/vote', { proposalId, choice });
            if (res.success) {
                onSuccess("Voto Registrado", res.message);
                fetchProposals();
                onRefresh(); // Sincroniza o score no app todo
                generateReceipt(proposalId, choice, (res as any).powerApplied);
            } else {
                onError("Erro", res.message);
            }
        } catch (e: any) {
            onError("Erro", e.message);
        } finally {
            setVotingInProgress(null);
        }
    };

    const generateReceipt = (proposalId: number, choice: 'yes' | 'no', power: number) => {
        const proposal = proposals.find(p => p.id === proposalId);
        const doc = new jsPDF();

        doc.setFillColor(5, 5, 5);
        doc.rect(0, 0, 210, 297, 'F');

        doc.setTextColor(34, 211, 238);
        doc.setFontSize(22);
        doc.text("CRED30 - COMPROVANTE DE VOTAÇÃO V2", 20, 30);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(`Protocolo: VOTE-DEMO-${proposalId}-${Date.now()}`, 20, 45);
        doc.text(`Data: ${new Date().toLocaleString('pt-BR')}`, 20, 52);

        doc.setDrawColor(34, 211, 238);
        doc.line(20, 60, 190, 60);

        doc.setFontSize(14);
        doc.text("DETALHES DA PROPOSTA:", 20, 75);
        doc.setFontSize(12);
        doc.text(`Título: ${proposal?.title || 'N/A'}`, 20, 85);

        doc.setFontSize(14);
        doc.text("SEU IMPACTO DEMOCRÁTICO:", 20, 105);
        doc.setTextColor(choice === 'yes' ? 52 : 239, choice === 'yes' ? 211 : 68, choice === 'yes' ? 153 : 68);
        doc.setFontSize(16);
        doc.text(choice === 'yes' ? "SIM (APROVO)" : "NÃO (REJEITO)", 20, 115);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(`Peso exercido nesta decisão: ${power.toFixed(2)} pontos de poder.`, 20, 125);

        doc.setTextColor(150, 150, 150);
        doc.setFontSize(10);
        const footerText = "Sua participação foi registrada usando o modelo de Voto Quadrático + Multiplicador de Reputação. Esse sistema protege a comunidade de abusos por capital e valoriza quem contribui para o ecossistema.";
        doc.text(footerText, 20, 150, { maxWidth: 170 });

        doc.save(`voto-cred30-prop-${proposalId}.pdf`);
    };

    const generateResultReport = (proposal: any) => {
        const doc = new jsPDF();

        doc.setFillColor(5, 5, 5);
        doc.rect(0, 0, 210, 297, 'F');

        doc.setTextColor(34, 211, 238);
        doc.setFontSize(22);
        doc.text("RELATÓRIO DE RESULTADO - GOVERNANÇA", 20, 30);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(`Proposta #${proposal.id}`, 20, 45);
        doc.text(`Título: ${proposal.title}`, 20, 52);
        doc.text(`Status: ${proposal.status === 'active' ? 'EM ANDAMENTO' : 'ENCERRADA'}`, 20, 59);

        doc.setDrawColor(34, 211, 238);
        doc.line(20, 70, 190, 70);

        const total = parseFloat(proposal.yes_votes_power) + parseFloat(proposal.no_votes_power);
        const yesPerc = total > 0 ? (parseFloat(proposal.yes_votes_power) / total) * 100 : 0;
        const noPerc = total > 0 ? (parseFloat(proposal.no_votes_power) / total) * 100 : 0;

        doc.setFontSize(14);
        doc.text("DISTRIBUIÇÃO DE PODER:", 20, 85);

        doc.setTextColor(52, 211, 153);
        doc.text(`SIM: ${parseFloat(proposal.yes_votes_power).toFixed(2)} (${yesPerc.toFixed(1)}%)`, 30, 95);

        doc.setTextColor(239, 68, 68);
        doc.text(`NÃO: ${parseFloat(proposal.no_votes_power).toFixed(2)} (${noPerc.toFixed(1)}%)`, 30, 105);

        doc.setTextColor(255, 255, 255);
        doc.text(`Poder Total Exercido: ${total.toFixed(2)}`, 20, 120);

        const win = yesPerc > noPerc ? "APROVADA" : noPerc > yesPerc ? "REJEITADA" : "EMPATE";
        doc.setFontSize(18);
        doc.text(`RESULTADO: ${win}`, 20, 140);

        doc.save(`resultado-democracia-prop-${proposal.id}.pdf`);
    };

    // Fórmulas para explicar o poder ao usuário
    const repMultiplier = 1 + (user.score / 1000);

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <BarChart3 className="text-primary-400" size={32} />
                        GOVERNANÇA V2
                    </h1>
                    <p className="text-zinc-500 text-sm">Democracia Direta: Voto Quadrático + Multiplicador de Reputação.</p>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-initial bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] text-zinc-500 uppercase font-bold text-nowrap">Seu Poder Atual</p>
                            <p className="text-sm font-bold text-white">
                                {userCurrentPower} Impacto
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quadro de Reputação e Impacto */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold">Base de Capital</p>
                        <p className="text-sm font-black text-white">{activeQuotas} Cotas</p>
                        <p className="text-[9px] text-zinc-600 font-bold uppercase mt-0.5">Influência: +{Math.sqrt(activeQuotas).toFixed(2)}</p>
                    </div>
                </div>
                <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400">
                        <Zap size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold">Reputação (Score)</p>
                        <p className="text-sm font-black text-white">{user.score} Pontos</p>
                        <p className="text-[9px] text-primary-500/60 font-black uppercase mt-0.5">Peso: x{repMultiplier.toFixed(2)}</p>
                    </div>
                </div>
                <div className="bg-primary-500/5 border border-primary-500/20 p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center text-black">
                        <Gavel size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] text-primary-400 uppercase font-black">Voto Quadrático</p>
                        <p className="text-base font-black text-white">{userCurrentPower} Pontos</p>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">Seu impacto total no clube</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {isLoading ? (
                    <div className="py-20 text-center text-zinc-500 animate-pulse font-black uppercase tracking-widest">Carregando votações democráticas...</div>
                ) : proposals.length === 0 ? (
                    <div className="py-20 text-center bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
                        <Info className="mx-auto mb-4 text-zinc-600" size={48} />
                        <h3 className="text-white font-bold">Nenhuma Votação Aberta</h3>
                        <p className="text-zinc-500 text-sm">Fique atento às notificações para novas propostas.</p>
                    </div>
                ) : (
                    proposals.map(prop => {
                        const totalPowerDirect = parseFloat(prop.yes_votes_power) + parseFloat(prop.no_votes_power);
                        const yesPerc = totalPowerDirect > 0 ? (parseFloat(prop.yes_votes_power) / totalPowerDirect) * 100 : 0;
                        const noPerc = totalPowerDirect > 0 ? (parseFloat(prop.no_votes_power) / totalPowerDirect) * 100 : 0;

                        return (
                            <div key={prop.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden group">
                                <div className="p-8">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${prop.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                                {prop.status === 'active' ? 'Em Votação' : 'Encerrada'}
                                            </span>
                                            <h3 className="text-2xl font-black text-white mt-2 tracking-tight uppercase">{prop.title}</h3>
                                            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mt-1">
                                                Iniciada por: <span className="text-zinc-400">{prop.creator_name || 'Conselho Adm'}</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-2 text-primary-400 font-black">
                                                <Trophy size={16} />
                                                <span className="text-xs uppercase">+10 SCORE</span>
                                            </div>
                                            <p className="text-[9px] text-zinc-600 font-bold uppercase mt-1">Prêmio de Participação</p>
                                        </div>
                                    </div>

                                    <p className="text-zinc-400 mb-8 leading-relaxed max-w-2xl">
                                        {prop.description}
                                    </p>

                                    {/* Placar de Poder (Visível após votar ou encerrada) */}
                                    {(prop.user_choice || prop.status !== 'active') ? (
                                        <div className="bg-black/60 rounded-[2rem] p-8 mb-8 animate-in fade-in zoom-in duration-500 border border-white/5">
                                            <div className="flex justify-between text-[11px] font-black uppercase text-zinc-500 mb-4 tracking-widest">
                                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Poder Sim: {parseFloat(prop.yes_votes_power).toFixed(0)}</span>
                                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> Poder Não: {parseFloat(prop.no_votes_power).toFixed(0)}</span>
                                            </div>
                                            <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
                                                <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000 shadow-[0_0_20px_rgba(16,185,129,0.3)]" style={{ width: `${yesPerc}%` }}></div>
                                                <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-1000 shadow-[0_0_20px_rgba(239,68,68,0.3)]" style={{ width: `${noPerc}%` }}></div>
                                            </div>
                                            <div className="flex justify-between mt-4">
                                                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">{yesPerc.toFixed(1)}%</p>
                                                <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">{noPerc.toFixed(1)}%</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-zinc-950 border border-dashed border-zinc-800 rounded-[2rem] p-10 mb-8 flex flex-col items-center justify-center gap-4">
                                            <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-800">
                                                <ShieldCheck size={32} />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-1">Voto Secreto Habilitado</p>
                                                <p className="text-xs text-zinc-600 font-medium">O impacto das decisões da comunidade será revelado após o seu voto.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row gap-4">
                                        {!prop.user_choice && prop.status === 'active' ? (
                                            <>
                                                <LoadingButton
                                                    onClick={() => handleVote(prop.id, 'yes')}
                                                    isLoading={votingInProgress === prop.id}
                                                    loadingText="REGISTRANDO..."
                                                    disabled={userCurrentPower <= 0}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-5 rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/20 uppercase tracking-widest text-xs"
                                                >
                                                    <CheckCircle2 size={24} /> VOTAR NO SIM
                                                </LoadingButton>
                                                <LoadingButton
                                                    onClick={() => handleVote(prop.id, 'no')}
                                                    isLoading={votingInProgress === prop.id}
                                                    loadingText="REGISTRANDO..."
                                                    disabled={userCurrentPower <= 0}
                                                    className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-5 rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-red-900/20 uppercase tracking-widest text-xs"
                                                >
                                                    <XCircle size={24} /> VOTAR NO NÃO
                                                </LoadingButton>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col sm:flex-row gap-4">
                                                <div className="flex-1 bg-black/40 border border-zinc-800 p-5 rounded-[1.5rem] flex items-center justify-center gap-4">
                                                    <div className={prop.user_choice === 'yes' ? 'text-emerald-400' : prop.user_choice === 'no' ? 'text-red-400' : 'text-zinc-500'}>
                                                        {prop.user_choice === 'yes' ? <CheckCircle2 size={24} /> : prop.user_choice === 'no' ? <XCircle size={24} /> : null}
                                                    </div>
                                                    <div>
                                                        <p className="text-zinc-300 text-sm font-black uppercase tracking-tight">
                                                            {prop.user_choice ? `Impacto registrado: ${userCurrentPower} Poder` : 'Votação Encerrada'}
                                                        </p>
                                                        <p className="text-[10px] text-zinc-600 font-bold uppercase">Sua participação foi computada</p>
                                                    </div>
                                                </div>
                                                {prop.user_choice && (
                                                    <button
                                                        onClick={() => generateReceipt(prop.id, prop.user_choice, userCurrentPower)}
                                                        className="px-8 py-5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-[1.5rem] border border-zinc-700 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl"
                                                    >
                                                        <FileText size={20} /> PDF
                                                    </button>
                                                )}
                                                {user.isAdmin && (
                                                    <button
                                                        onClick={() => generateResultReport(prop)}
                                                        className="px-8 py-5 bg-primary-600 hover:bg-primary-500 text-black rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-primary-900/40 font-black"
                                                    >
                                                        <BarChart3 size={20} /> RELATÓRIO
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
