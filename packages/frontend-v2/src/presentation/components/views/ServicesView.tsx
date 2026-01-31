import React, { useState } from 'react';
import { ShieldCheck, TrendingUp, Search, Crown, Check, Loader2, Store } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import { ConfirmModal } from '../ui/ConfirmModal';

interface ServicesViewProps {
    userBalance: number;
    isVerified: boolean;
    isPro: boolean;
    isProtected: boolean;
    protectedUntil: string | null;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onRefresh: () => void;
}

export const ServicesView: React.FC<ServicesViewProps> = ({ userBalance, isVerified, isPro, isProtected, protectedUntil, onSuccess, onError, onRefresh }) => {
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
    const [confirmAction, setConfirmAction] = useState<{ type: string, title: string, cost: number, action: () => Promise<void> } | null>(null);
    const [searchEmail, setSearchEmail] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);

    const toggleLoading = (key: string, isLoading: boolean) => {
        setLoadingMap(prev => ({ ...prev, [key]: isLoading }));
    };

    const handleBuyVerified = async () => {
        if (userBalance < 9.90) return onError('Saldo Insuficiente', 'Você precisa de R$ 9,90 no saldo.');

        toggleLoading('verified', true);
        try {
            const res = await apiService.post('/monetization/buy-verified-badge', {});
            if (res.success) {
                onSuccess('Sucesso!', res.message);
                onRefresh();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        } finally {
            toggleLoading('verified', false);
            setConfirmAction(null);
        }
    };

    const handleBuyScoreBoost = async () => {
        if (userBalance < 15.00) return onError('Saldo Insuficiente', 'Você precisa de R$ 15,00 no saldo.');

        toggleLoading('score', true);
        try {
            const res = await apiService.post('/monetization/buy-score-boost', {});
            if (res.success) {
                onSuccess('Boost Ativado!', res.message);
                onRefresh();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        } finally {
            toggleLoading('score', false);
            setConfirmAction(null);
        }
    };

    const handleUpgradePro = async () => {
        if (userBalance < 29.90) return onError('Saldo Insuficiente', 'Você precisa de R$ 29,90 no saldo.');

        toggleLoading('pro', true);
        try {
            const res = await apiService.post('/monetization/upgrade-pro', { method: 'balance' });
            if (res.success) {
                onSuccess('Bem-vindo ao PRO!', res.message);
                onRefresh();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        } finally {
            toggleLoading('pro', false);
            setConfirmAction(null);
        }
    };

    const handleBuyProtection = async () => {
        if (userBalance < 5.00) return onError('Saldo Insuficiente', 'A proteção mútua custa R$ 5,00 mensais.');

        toggleLoading('protection', true);
        try {
            const res = await apiService.buyMutualProtection();
            if (res.success) {
                onSuccess('Proteção Ativada!', res.message);
                onRefresh();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        } finally {
            toggleLoading('protection', false);
            setConfirmAction(null);
        }
    };

    const handleReputationCheck = async () => {
        if (!searchEmail) return onError('E-mail necessário', 'Digite o e-mail do usuário que deseja consultar.');
        if (userBalance < 35.00) return onError('Saldo Insuficiente', 'A consulta custa R$ 35,00.');

        toggleLoading('search', true);
        setSearchResult(null);
        try {
            const res = await apiService.get<any>(`/monetization/reputation-check/${searchEmail}`);
            if (res.success) {
                setSearchResult(res.data);
                onRefresh(); // Atualiza saldo
            }
        } catch (e: any) {
            onError('Erro na Consulta', e.message);
        } finally {
            toggleLoading('search', false);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-400 mb-4 shadow-xl shadow-indigo-900/20 rotate-3">
                    <Crown size={32} />
                </div>
                <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Shopping de Serviços</h1>
                <p className="text-zinc-500 text-xs max-w-xs">Invista na sua reputação e desbloqueie benefícios exclusivos dentro do ecossistema.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* 0. Proteção Mútua (Destaque Social) */}
                <div className={`relative overflow-hidden rounded-3xl p-6 border transition-all group ${isProtected ? 'bg-blue-500/5 border-blue-500/20' : 'bg-gradient-to-br from-blue-900/10 to-indigo-900/10 border-blue-500/20 hover:border-blue-400'}`}>
                    <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isProtected ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/10 text-blue-400'}`}>
                            <ShieldCheck size={24} />
                        </div>
                        {isProtected && <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full uppercase tracking-wider">Protegido</span>}
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1">Proteção Mútua</h3>
                    <p className="text-xs text-zinc-500 h-10 mb-4">Garante seus direitos básicos e auxílio social direto entre associados.</p>

                    <div className="flex items-center justify-between mt-auto">
                        <p className="text-xl font-black text-white">R$ 5,00 <span className="text-[10px] text-zinc-500 font-normal ml-1">/mês</span></p>
                        <button
                            disabled={isProtected}
                            onClick={() => !isProtected && setConfirmAction({
                                type: 'BUY',
                                title: 'Ativar Proteção',
                                cost: 5.00,
                                action: handleBuyProtection
                            })}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${isProtected ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:scale-105 active:scale-95'
                                }`}
                        >
                            {loadingMap['protection'] ? <Loader2 size={16} className="animate-spin" /> : (isProtected ? 'Ativo' : 'Ativar')}
                        </button>
                    </div>
                    {isProtected && protectedUntil && (
                        <p className="text-[8px] text-zinc-600 mt-2 uppercase font-black">Expira em: {new Date(protectedUntil).toLocaleDateString()}</p>
                    )}
                </div>

                {/* 1. Selo Verificado */}
                <div className={`relative overflow-hidden rounded-3xl p-6 border transition-all group ${isVerified ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900/50 border-white/5 hover:border-primary-500/30'}`}>
                    <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isVerified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary-500/10 text-primary-400'}`}>
                            <ShieldCheck size={24} />
                        </div>
                        {isVerified && <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full uppercase tracking-wider">Ativo</span>}
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1">Selo Verificado</h3>
                    <p className="text-xs text-zinc-500 h-10 mb-4">Aumente sua confiança na comunidade e desbloqueie limites maiores.</p>

                    <div className="flex items-center justify-between mt-auto">
                        <p className="text-xl font-black text-white">R$ 9,90 <span className="text-[10px] text-zinc-500 font-normal ml-1">único</span></p>
                        <button
                            disabled={isVerified}
                            onClick={() => !isVerified && setConfirmAction({
                                type: 'BUY',
                                title: 'Comprar Verificado',
                                cost: 9.90,
                                action: handleBuyVerified
                            })}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${isVerified ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:scale-105 active:scale-95'
                                }`}
                        >
                            {loadingMap['verified'] ? <Loader2 size={16} className="animate-spin" /> : (isVerified ? 'Já Possui' : 'Comprar')}
                        </button>
                    </div>
                </div>

                {/* 2. Boost de Score */}
                <div className="relative overflow-hidden rounded-3xl p-6 bg-zinc-900/50 border border-white/5 hover:border-amber-500/30 transition-all group">
                    <div className="absolute top-0 right-0 p-16 opacity-5 bg-amber-500 blur-3xl rounded-full" />

                    <div className="flex items-start justify-between mb-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                            <TrendingUp size={24} />
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1 relative z-10">Boost de Score</h3>
                    <p className="text-xs text-zinc-500 h-10 mb-4 relative z-10">Adicione +100 pontos ao seu score imediatamente. Útil para desbloquear crédito.</p>

                    <div className="flex items-center justify-between mt-auto relative z-10">
                        <p className="text-xl font-black text-white">R$ 15,00</p>
                        <button
                            onClick={() => setConfirmAction({
                                type: 'BUY',
                                title: 'Comprar Boost',
                                cost: 15.00,
                                action: handleBuyScoreBoost
                            })}
                            className="px-5 py-2.5 bg-amber-500 text-black hover:bg-amber-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                        >
                            {loadingMap['score'] ? <Loader2 size={16} className="animate-spin" /> : 'Comprar'}
                        </button>
                    </div>
                </div>

                {/* 3. Upgrade PRO */}
                <div className={`relative overflow-hidden rounded-3xl p-6 border transition-all ${isPro ? 'bg-purple-500/5 border-purple-500/20' : 'bg-zinc-900/50 border-white/5 hover:border-purple-500/30'}`}>
                    <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isPro ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-500/10 text-purple-400'}`}>
                            <Crown size={24} />
                        </div>
                        {isPro && <span className="text-[10px] font-black bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full uppercase tracking-wider">Ativo</span>}
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1">Membro PRO</h3>
                    <p className="text-xs text-zinc-500 h-10 mb-4">Zero anúncios, taxas reduzidas e prioridade em todos os serviços do clube.</p>

                    <div className="flex items-center justify-between mt-auto">
                        <p className="text-xl font-black text-white">R$ 29,90 <span className="text-[10px] text-zinc-500 font-normal ml-1">/mês</span></p>
                        <button
                            disabled={isPro}
                            onClick={() => !isPro && setConfirmAction({
                                type: 'BUY',
                                title: 'Assinar PRO',
                                cost: 29.90,
                                action: handleUpgradePro
                            })}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${isPro ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:scale-105 active:scale-95'
                                }`}
                        >
                            {loadingMap['pro'] ? <Loader2 size={16} className="animate-spin" /> : (isPro ? 'Já é PRO' : 'Assinar')}
                        </button>
                    </div>
                </div>

                {/* 4. Sistema PDV (Vendas) */}
                <div className="relative overflow-hidden rounded-3xl p-6 bg-zinc-900/50 border border-white/5 hover:border-indigo-500/30 transition-all group">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                            <Store size={24} />
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1">Sistema PDV</h3>
                    <p className="text-xs text-zinc-500 h-10 mb-4">Venda produtos ou serviços e receba à vista, mesmo que o cliente parcele.</p>

                    <div className="flex items-center justify-between mt-auto">
                        <p className="text-xl font-black text-white">3,5% <span className="text-[10px] text-zinc-500 font-normal ml-1">por venda</span></p>
                        <button
                            onClick={() => window.location.hash = '/app/pdv'}
                            className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                        >
                            Usar PDV
                        </button>
                    </div>
                </div>
            </div>

            {/* 4. Consulta de Reputação (Full Width) */}
            <div className="mt-6 bg-zinc-900/80 border border-white/5 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <Search size={150} />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                            <Search size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Consulta de Reputação</h3>
                            <p className="text-xs text-zinc-500">Verifique a idoneidade de um membro antes de fazer negócios.</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <input
                            type="email"
                            placeholder="Digite o e-mail do usuário..."
                            value={searchEmail}
                            onChange={(e) => setSearchEmail(e.target.value)}
                            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-white text-sm outline-none focus:border-blue-500/50 transition-colors"
                        />
                        <button
                            onClick={handleReputationCheck}
                            disabled={loadingMap['search']}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-wider px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 md:w-auto w-full active:scale-95"
                        >
                            {loadingMap['search'] ? <Loader2 size={18} className="animate-spin" /> : <><Search size={18} /> Consultar (R$ 35,00)</>}
                        </button>
                    </div>

                    {searchResult && (
                        <div className="mt-6 bg-black/40 rounded-2xl p-6 border border-blue-500/20 animate-in slide-in-from-top-4">
                            <h4 className="text-blue-400 font-bold text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Check size={16} /> Resultado da Consulta
                            </h4>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase font-black">Nome</p>
                                    <p className="text-white font-bold">{searchResult.name}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase font-black">Score</p>
                                    <p className={`font-bold ${searchResult.score > 500 ? 'text-emerald-400' : 'text-amber-500'}`}>{searchResult.score} pts</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase font-black">Membro Desde</p>
                                    <p className="text-white font-bold">{new Date(searchResult.since).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase font-black">Status</p>
                                    <div className="flex items-center gap-2">
                                        {searchResult.isVerified && <ShieldCheck size={14} className="text-emerald-400" />}
                                        <span className="text-white font-bold">{searchResult.membership}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Confirmação */}
            {confirmAction && (
                <ConfirmModal
                    isOpen={!!confirmAction}
                    onClose={() => setConfirmAction(null)}
                    onConfirm={confirmAction.action}
                    title={confirmAction.title}
                    message={`Tem certeza que deseja continuar? Será debitado R$ ${confirmAction.cost.toFixed(2).replace('.', ',')} do seu saldo.`}
                    confirmText="Confirmar Compra"
                    type="info"
                />
            )}
        </div>
    );
};
