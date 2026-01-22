import { useState, useMemo, useEffect } from 'react';
import { ArrowUpFromLine, ShieldCheck, Clock, XCircle, TrendingUp } from 'lucide-react';
// import packageJson from '../../../../package.json';
import { User } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';
import { confirmWithdrawal } from '../../../application/services/storage.service';
import { WITHDRAWAL_FEE_FIXED, WITHDRAWAL_MIN_AMOUNT } from '../../../shared/constants/app.constants';
import { formatBRL, parseToNumber } from '../../../shared/utils/format.utils';

interface WithdrawViewProps {
    balance: number;
    currentUser: User | null;
    totalQuotaValue: number;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onRefresh: () => void;
}

export const WithdrawView = ({ balance, currentUser, totalQuotaValue, onSuccess, onError, onRefresh }: WithdrawViewProps) => {
    const [val, setVal] = useState('');
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, transactionId: number | null, code: string, password: string }>({ isOpen: false, transactionId: null, code: '', password: '' });
    const [showAd, setShowAd] = useState(false);
    const [adTimer, setAdTimer] = useState(5);

    // Quick amount options
    const quickAmounts = [50, 100, 200, 500];

    const { isValidAmount, isFree, fee, netAmount } = useMemo(() => {
        const amount = parseToNumber(val);
        const valid = val !== '' && amount >= WITHDRAWAL_MIN_AMOUNT && amount <= balance;
        const free = totalQuotaValue >= amount;

        const f = (valid && !free) ? WITHDRAWAL_FEE_FIXED : 0;
        const net = valid ? Math.max(0, amount - f) : 0;
        return { isValidAmount: valid, withdrawalAmount: amount, isFree: free, fee: f, netAmount: net };
    }, [val, balance, totalQuotaValue]);


    const [twoFactorData, setTwoFactorData] = useState<{ otpUri: string } | null>(null);

    useEffect(() => {
        if (confirmModal.isOpen) {
            fetch2FASetup();
        }
    }, [confirmModal.isOpen]);

    useEffect(() => {
        let interval: any;
        if (showAd && adTimer > 0) {
            interval = setInterval(() => {
                setAdTimer(prev => prev - 1);
            }, 1000);
        } else if (showAd && adTimer === 0) {
            // Quando o timer acaba, podemos permitir fechar ou fechar automaticamente
            // Vamos deixar o botão de fechar aparecer
        }
        return () => clearInterval(interval);
    }, [showAd, adTimer]);

    const fetch2FASetup = async () => {
        try {
            const data = await apiService.get2FASetup();
            setTwoFactorData(data);
        } catch (e) {
            console.error('Erro ao buscar setup 2FA:', e);
        }
    };

    const handleConfirmWithCode = async () => {
        if (!confirmModal.transactionId) return;
        try {
            const res = await confirmWithdrawal(confirmModal.transactionId, confirmModal.code, confirmModal.password);
            if (res.success) {
                onSuccess('Resgate Confirmado!', 'Seu resgate foi processado com sucesso.');
                setConfirmModal({ ...confirmModal, isOpen: false, password: '', code: '' });
                setVal('');
                onRefresh();
            } else {
                onError('Erro na Confirmação', res.message);
            }
        } catch (e: any) {
            onError('Erro na Confirmação', e.message);
        }
    };

    const [viewFarmVideo, setViewFarmVideo] = useState<any>(null);

    const processWithdrawal = async () => {
        setShowAd(false);
        const amount = parseFloat(val);
        try {
            const res = await apiService.requestWithdrawal(amount, currentUser?.pixKey || '');

            if (res.success && res.data?.requiresConfirmation) {
                setConfirmModal({ isOpen: true, transactionId: res.data.transactionId, code: '', password: '' });
            } else if (res.success) {
                onSuccess('Solicitação Enviada', 'Solicitação de resgate enviada! Aguarde processamento.');
                setVal('');
                onRefresh();
            } else {
                onError('Erro no Resgate', res.message);
            }
        } catch (e: any) {
            onError('Erro no Resgate', e.message);
        }
    };

    const handleRequestWithdrawal = async () => {
        if (!currentUser?.is_verified) {
            onError('Conta não Verificada', 'Você precisa ter o selo de verificado para realizar resgates. Verifique seu perfil nas configurações.');
            return;
        }

        try {
            // Buscar vídeos da View Farm
            const feed = await apiService.misc.getPromoFeed();
            if (feed && feed.length > 0) {
                // Selecionar um vídeo aleatório
                const randomVideo = feed[Math.floor(Math.random() * feed.length)];
                setViewFarmVideo(randomVideo);
                await apiService.misc.startPromoView(randomVideo.id);
            }
        } catch (e) {
            console.error('Erro ao buscar vídeos View Farm:', e);
        }

        setShowAd(true);
        setAdTimer(10); // 10 segundos para saques
    };

    const handleAdComplete = async () => {
        if (viewFarmVideo && !viewFarmVideo.isFallback && viewFarmVideo.id) {
            try {
                await apiService.misc.completePromoView(viewFarmVideo.id, 10);
            } catch (e) {
                console.warn('Erro ao completar view em saque (Pode ser AdBlock):', e);
            }
        }
        processWithdrawal();
    };

    return (
        <div className="max-w-xl mx-auto space-y-6">
            {/* Balance Overview Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-black">
                <div className="text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ArrowUpFromLine size={32} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Solicitar Resgate</h2>
                    <p className="text-sm opacity-80">Transfira seu saldo disponível para sua chave PIX cadastrada</p>
                </div>

                <div className="bg-white/20 rounded-xl p-4 mt-6">
                    <p className="text-sm opacity-80 mb-1">Saldo Disponível</p>
                    <p className="text-3xl font-bold">{formatBRL(balance)}</p>
                    <p className="text-xs opacity-70 mt-1">Seu saldo atual na conta</p>
                </div>
            </div>

            {/* Withdrawal Form */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6">
                <div className="space-y-6">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-3">Valor do Resgate</label>

                        {/* Quick Amount Buttons */}
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {quickAmounts.map(amount => (
                                <button
                                    key={amount}
                                    onClick={() => setVal(Math.min(amount, balance).toString())}
                                    disabled={amount > balance}
                                    className={`py-2 rounded-lg text-sm font-bold border transition ${amount > balance
                                        ? 'bg-zinc-800 text-zinc-600 border-zinc-700 cursor-not-allowed'
                                        : 'bg-surfaceHighlight text-zinc-300 border-zinc-600 hover:bg-primary-900/30 hover:border-primary-500/50'
                                        }`}
                                >
                                    R$ {amount}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <span className="absolute left-3 top-3 text-zinc-500">R$</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={val}
                                onChange={e => {
                                    const v = e.target.value;
                                    if (v === '' || /^[0-9.,]+$/.test(v)) {
                                        setVal(v);
                                    }
                                }}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 pr-16 text-white outline-none focus:border-primary-500 transition"
                                placeholder="0,00"
                            />
                            <button
                                onClick={() => setVal(balance.toString())}
                                className="absolute right-2 top-2 text-xs text-primary-400 hover:bg-primary-900/30 px-2 py-1.5 rounded transition"
                            >
                                Tudo
                            </button>
                        </div>

                        {val !== '' && parseFloat(val) < WITHDRAWAL_MIN_AMOUNT && (
                            <p className="text-red-400 text-[10px] mt-2 font-medium">
                                * O valor mínimo para resgate é de {formatBRL(WITHDRAWAL_MIN_AMOUNT)}.
                            </p>
                        )}

                        {/* Fee Information */}
                        {isValidAmount && (
                            <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg text-xs space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Taxa de resgate operativo ({isFree ? 'Grátis' : 'Taxa de Manutenção'})</span>
                                    <span className={isFree ? 'text-emerald-400' : 'text-zinc-300'}>
                                        {isFree ? 'R$ 0,00' : formatBRL(fee)}
                                    </span>
                                </div>
                                <div className="flex justify-between font-bold">
                                    <span className="text-white">Você receberá</span>
                                    <span className="text-emerald-400">{formatBRL(netAmount)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                        <label className="text-xs text-emerald-400 block mb-1 font-medium italic">Depósito automático via PIX</label>
                        <p className="text-white text-sm font-mono break-all line-clamp-1">{currentUser?.pixKey || 'Chave não cadastrada'}</p>
                        <p className="text-emerald-500/60 text-[10px] mt-1 line-clamp-2 leading-tight">O valor será enviado para sua chave principal cadastrada no perfil.</p>
                    </div>
                </div>

                <button
                    onClick={handleRequestWithdrawal}
                    disabled={!isValidAmount || !currentUser?.pixKey}
                    className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] mt-6"
                >
                    Confirmar Resgate
                </button>

                {confirmModal.isOpen && (
                    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[500] p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-[#0A0A0A] border-t sm:border border-white/5 sm:border-surfaceHighlight rounded-t-[2.5rem] sm:rounded-3xl p-8 w-full sm:max-w-sm relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 duration-500 sm:duration-300">
                            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden opacity-50" />

                            <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition hidden sm:block">
                                <XCircle size={24} />
                            </button>

                            <div className="text-center mb-8">
                                <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-900/20 ring-1 ring-primary-500/20">
                                    <ShieldCheck size={40} className="text-primary-500" strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-black text-white tracking-tight">Autenticação 2FA</h3>
                                <p className="text-zinc-500 text-sm mt-2 font-medium">Insira o código do seu autenticador</p>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="space-y-2">
                                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">Senha da Conta</p>
                                    <input
                                        type="password"
                                        placeholder="••••••"
                                        value={confirmModal.password}
                                        onChange={e => setConfirmModal({ ...confirmModal, password: e.target.value })}
                                        className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 px-6 text-white focus:border-primary-500/50 outline-none font-medium transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">Código 2FA</p>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        placeholder="000 000"
                                        value={confirmModal.code}
                                        onChange={e => setConfirmModal({ ...confirmModal, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                        className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 text-center text-2xl tracking-[0.2em] text-white focus:border-primary-500/50 outline-none font-black font-mono transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={handleConfirmWithCode}
                                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-widest py-5 rounded-2xl transition-all shadow-2xl shadow-primary-500/20 active:scale-[0.98]"
                                >
                                    CONFIRMAR RESGATE
                                </button>

                                {twoFactorData?.otpUri && (
                                    <a
                                        href={twoFactorData.otpUri}
                                        className="w-full bg-white/5 hover:bg-white/10 text-zinc-400 py-4 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        <ShieldCheck size={14} /> Abrir Autenticador
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
                <p className="text-xs text-blue-300 flex items-center gap-2">
                    <Clock size={14} />
                    <span>Processamento em até 24h úteis</span>
                </p>
                <p className="text-xs text-zinc-400 mt-2">
                    Taxa de manutenção por resgate de {(WITHDRAWAL_FEE_FIXED || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.
                </p>
                <p className="text-xs text-emerald-400/80 mt-2">
                    💡 <strong>Benefício VIP:</strong> Se o valor das suas participações (cotas) for maior ou igual ao resgate, a taxa é <strong>ZERO</strong>!
                </p>
                <p className="text-xs text-zinc-400 mt-2">
                    <strong>Importante:</strong> Você está resgatando do seu saldo disponível na conta.
                </p>
            </div>

            {/* Legal Disclaimer & Compliance */}
            <div className="px-6 py-4 bg-zinc-900/30 border border-white/5 rounded-2xl space-y-3">
                <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                    <strong className="text-zinc-400">Natureza da Operação:</strong> Você está solicitando a restituição de aporte/excedente de uma associação de apoio mútuo. Esta operação <strong className="text-zinc-400">NÃO</strong> é um serviço bancário.
                </p>
                <div className="h-px bg-white/5 w-1/2 mx-auto" />
                <p className="text-[9px] text-zinc-600 text-center leading-relaxed italic">
                    O resgate será processado via PIX pelo administrador. O prazo de 24h úteis depende da liquidez do fundo comum e disponibilidade bancária. Ao confirmar, você declara ciência de que o sistema opera sob regime de cooperação mútua (Art. 991-996 do Código Civil Brasileiro).
                </p>
            </div>

            {/* Anúncio Intersticial - Abre AdsTerra antes do saque */}
            {showAd && (
                <div className="fixed inset-0 bg-black/95 z-[600] flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 backdrop-blur-2xl">
                    <div className="w-full max-w-md relative flex flex-col">
                        {/* Status Bar */}
                        <div className="flex justify-between items-center mb-8 px-2 animate-in slide-in-from-top-4 duration-700">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Processando Resgate</span>
                            </div>

                            {adTimer > 0 ? (
                                <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                                    <span className="text-[10px] text-zinc-400 font-bold">Aguarde <span className="text-primary-400 font-black">{adTimer}s</span></span>
                                </div>
                            ) : (
                                <button
                                    onClick={handleAdComplete}
                                    className="bg-primary-500 text-black px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95"
                                >
                                    CONTINUAR <ArrowUpFromLine size={14} />
                                </button>
                            )}
                        </div>

                        {/* Card de Patrocinador */}
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
                            {viewFarmVideo ? (
                                <div className="aspect-video bg-black relative">
                                    <video
                                        src={viewFarmVideo.video_url}
                                        autoPlay
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                                        <p className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                            <TrendingUp size={12} className="text-primary-400" /> Anúncio Pago
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center">
                                    <div className="w-20 h-20 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-2 ring-amber-500/30">
                                        <TrendingUp size={40} className="text-amber-500" />
                                    </div>

                                    <span className="bg-amber-500 text-black text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest mb-4 inline-block">
                                        Patrocinador Oficial
                                    </span>

                                    <h4 className="text-2xl font-black text-white leading-tight tracking-tighter mt-4">
                                        Seu resgate está sendo preparado
                                    </h4>
                                    <p className="text-zinc-400 text-sm mt-3 font-medium leading-relaxed">
                                        Enquanto processamos, confira uma oferta especial dos nossos parceiros.
                                    </p>
                                </div>
                            )}

                            <div className="p-8">
                                {/* Link Patrocinado ou Info do Vídeo */}
                                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                                    <a
                                        href={viewFarmVideo?.external_link || "https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black py-4 rounded-xl transition-all text-sm uppercase tracking-widest text-center"
                                        onClick={() => {
                                            if (adTimer > 2) setTimeout(() => setAdTimer(0), 1000);
                                        }}
                                    >
                                        {viewFarmVideo ? '🔗 Visitar Site do Anunciante' : '🎁 Ver Oferta Especial'}
                                    </a>
                                </div>
                            </div>

                            <div className="p-6 bg-zinc-900/30 border-t border-white/5">
                                <div className="flex items-center justify-center gap-2">
                                    {adTimer > 0 ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs text-zinc-400">Preparando seu resgate...</span>
                                        </>
                                    ) : (
                                        <span className="text-xs text-emerald-400 font-bold">✓ Pronto! Clique em continuar</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 text-center animate-in fade-in duration-1000 delay-500">
                            <p className="text-[9px] text-zinc-600 uppercase font-black tracking-[0.3em]">Powered by Cred30 Network</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
