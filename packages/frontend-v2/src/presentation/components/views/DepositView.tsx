import React, { useState } from 'react';
import { Wallet, ArrowDownLeft, ShieldCheck, ChevronRight, Copy, CheckCircle2 } from 'lucide-react';
import { ADMIN_PIX_KEY } from '../../../shared/constants/app.constants';

interface DepositViewProps {
    onDeposit: (amount: number, senderName?: string) => void;
    onBack: () => void;
}

export const DepositView: React.FC<DepositViewProps> = ({ onDeposit, onBack }) => {
    const [amount, setAmount] = useState<string>('');
    const [senderName, setSenderName] = useState<string>('');
    const [step, setStep] = useState<1 | 2>(1);
    const [copied, setCopied] = useState(false);

    const handleContinue = () => {
        const val = parseFloat(amount.replace(',', '.'));
        if (isNaN(val) || val < 10) {
            alert('Valor mínimo para depósito é R$ 10,00');
            return;
        }
        if (!senderName || senderName.trim().length < 3) {
            alert('Por favor, informe o nome do titular da conta que fará o PIX para agilizar sua aprovação.');
            return;
        }
        setStep(2);
    };

    const handleConfirm = () => {
        const val = parseFloat(amount.replace(',', '.'));
        onDeposit(val, senderName);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(ADMIN_PIX_KEY);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
            <div className="w-full max-w-md bg-zinc-900/50 border border-white/5 rounded-[2.5rem] p-8 sm:p-10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute -right-16 -top-16 opacity-5 pointer-events-none rotate-12">
                    <Wallet size={200} className="text-primary-400" />
                </div>

                {step === 1 ? (
                    <>
                        <div className="text-center mb-10">
                            <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center text-primary-400 mx-auto mb-6 border border-primary-500/20 shadow-xl shadow-primary-900/20">
                                <ArrowDownLeft size={40} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-3xl font-black text-white tracking-tight">Depósito Social</h2>
                            <p className="text-zinc-500 text-sm font-medium mt-2">Agilize sua aprovação informando o nome de quem fará o PIX.</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4 mb-2 block">Quanto deseja aportar?</label>
                                <div className="relative group mb-6">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-zinc-600 group-focus-within:text-primary-400 transition-colors">R$</span>
                                    <input
                                        type="text"
                                        placeholder="0,00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-black/40 border-2 border-white/5 focus:border-primary-500/50 rounded-3xl py-6 pl-16 pr-6 text-3xl font-black text-white outline-none transition-all placeholder:text-zinc-800"
                                    />
                                </div>

                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4 mb-2 block">Nome do Titular do PIX</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder="Nome impresso no comprovante"
                                        value={senderName}
                                        onChange={(e) => setSenderName(e.target.value)}
                                        className="w-full bg-black/40 border-2 border-white/5 focus:border-primary-500/50 rounded-2xl py-4 px-6 text-base font-bold text-white outline-none transition-all placeholder:text-zinc-800"
                                    />
                                </div>
                                <p className="text-[9px] text-zinc-600 mt-3 ml-4 font-bold uppercase tracking-tight text-center leading-relaxed">
                                    🛡️ Para sua segurança, depósitos feitos por terceiros passam por análise rigorosa de 24h.
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {[20, 50, 100].map(val => (
                                    <button
                                        key={val}
                                        onClick={() => setAmount(val.toString())}
                                        className="py-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl text-xs font-black text-white transition-all active:scale-95 border border-white/5"
                                    >
                                        + R$ {val}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleContinue}
                                className="w-full py-5 bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 mt-4 active:scale-95"
                            >
                                CONTINUAR <ChevronRight size={20} />
                            </button>

                            <button
                                onClick={onBack}
                                className="w-full py-2 text-zinc-700 hover:text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em] transition-all"
                            >
                                VOLTAR AO PAINEL
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-400 mx-auto mb-6 border border-emerald-500/20 shadow-xl shadow-emerald-900/20">
                                <ShieldCheck size={40} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Pagamento Manual</h2>
                            <p className="text-zinc-500 text-sm font-medium mt-2">Transfira o valor exato via PIX para a chave abaixo.</p>
                        </div>

                        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 mb-8 text-center">
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Valor Solicitado</p>
                            <p className="text-4xl font-black text-white tabular-nums">
                                {formatBRL(amount)}
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="relative group cursor-copy" onClick={handleCopy}>
                                <div className="bg-zinc-800/50 border border-white/10 rounded-2xl p-5 text-center transition-all group-hover:bg-zinc-800 active:scale-[0.98]">
                                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.3em] mb-2">Chave PIX do Administrador</p>
                                    <p className="text-base font-mono font-black text-emerald-400 break-all">{ADMIN_PIX_KEY}</p>
                                    <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-black text-primary-500 uppercase tracking-widest">
                                        {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                                        {copied ? 'COPIADO!' : 'CLIQUE PARA COPIAR'}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                                    !
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-relaxed font-bold uppercase tracking-tight">
                                    Após transferir, clique no botão abaixo para avisar o sistema. O saldo será liberado após a conferência do administrador.
                                </p>
                            </div>

                            <button
                                onClick={handleConfirm}
                                className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 active:scale-95"
                            >
                                JÁ REALIZEI O PIX
                            </button>

                            <button
                                onClick={() => setStep(1)}
                                className="w-full py-2 text-zinc-700 hover:text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em] transition-all"
                            >
                                CORRIGIR VALOR
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
