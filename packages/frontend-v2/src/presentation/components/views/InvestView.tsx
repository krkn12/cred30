import React, { useState } from 'react';
import { TrendingUp, X as XIcon, Users, ShieldCheck, Info, CheckCircle2, Building2, ArrowRight, Zap, Scale, Gavel, FileText } from 'lucide-react';
import { QUOTA_PRICE, QUOTA_SHARE_VALUE, QUOTA_ADM_FEE } from '../../../shared/constants/app.constants';
import { calculateTotalToPay } from '../../../shared/utils/financial.utils';

interface InvestViewProps {
    onBuy: (qty: number, method: 'PIX' | 'BALANCE' | 'CARD') => void;
    isPro?: boolean;
}

export const InvestView = ({ onBuy, isPro }: InvestViewProps) => {
    const [qty, setQty] = useState(1);
    const [method, setMethod] = useState<'PIX' | 'BALANCE' | 'CARD'>('PIX');
    const [showConfirm, setShowConfirm] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const baseAmount = qty * QUOTA_PRICE;
    const { total, fee } = calculateTotalToPay(baseAmount, method.toLowerCase() as any);

    const handlePurchase = () => {
        if (!acceptedTerms) return;

        // Adsterra SmartLink Trigger
        window.open('https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa', '_blank');

        onBuy(qty, method);
        setShowConfirm(false);
    };

    return (
        <div className="min-h-screen bg-gradient-premium text-zinc-400 font-medium pb-24 lg:pb-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">

                {/* Hero Section */}
                <div className="text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 px-4 py-2 rounded-full text-primary-400 font-bold text-[10px] uppercase tracking-widest mb-6">
                        <ShieldCheck size={14} /> Cooperativa Digital Cred30
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight mb-6 tracking-tight">
                        Faça parte da <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">Revolução Financeira</span> Colaborativa.
                    </h1>
                    <p className="text-base sm:text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
                        Ao adquirir suas cotas-parte, você se torna dono do negócio, participa das decisões e recebe excedentes proporcionais ao capital investido.
                    </p>
                </div>

                {/* Benefits Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                    <BenefitCard
                        icon={<TrendingUp size={20} />}
                        title="Distribuição de Excedentes"
                        color="primary"
                        description="Receba parte dos resultados operacionais da cooperativa diretamente em sua conta."
                    />
                    <BenefitCard
                        icon={<Users size={20} />}
                        title="Gestão Democrática"
                        color="blue"
                        description="Voz ativa e poder de voto nas assembleias de decisão de rumo do capital."
                    />
                    <BenefitCard
                        icon={<Gavel size={20} />}
                        title="Segurança Jurídica"
                        color="purple"
                        description="Operamos sob o modelo de Sociedade em Conta de Participação (Lei 10.406/02)."
                    />
                </div>

                {/* Configurator Section */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">

                    {/* Left: Input Selection */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="glass p-8 relative overflow-hidden group">
                            <div className="absolute -right-8 -bottom-8 text-primary-500/5 rotate-12 group-hover:scale-110 transition-transform duration-700">
                                <Building2 size={200} />
                            </div>

                            <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3">
                                <Zap size={20} className="text-primary-500" /> Configurar Aporte
                            </h3>

                            <div className="space-y-8 relative z-10">
                                <div>
                                    <div className="flex justify-between items-end mb-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Valor Atual por Cota</p>
                                        <p className="text-3xl font-black text-white">
                                            {QUOTA_PRICE.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            <span className="text-sm font-normal text-zinc-600"> / unidade</span>
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-6 bg-black/40 p-4 rounded-3xl border border-white/5 ring-1 ring-white/5 mb-8">
                                        <button
                                            onClick={() => setQty(Math.max(1, qty - 1))}
                                            className="w-14 h-14 rounded-2xl bg-zinc-800 text-white flex items-center justify-center hover:bg-zinc-700 transition active:scale-90 shadow-xl"
                                        >
                                            <span className="text-3xl font-light">-</span>
                                        </button>
                                        <div className="flex-1 text-center">
                                            <span className="text-4xl font-black text-white tabular-nums">{qty}</span>
                                            <p className="text-[10px] font-black uppercase text-zinc-600 tracking-tighter mt-1">Cotas Selecionadas</p>
                                        </div>
                                        <button
                                            onClick={() => setQty(qty + 1)}
                                            className="w-14 h-14 rounded-2xl bg-primary-500 text-black flex items-center justify-center hover:bg-primary-400 transition active:scale-90 shadow-xl shadow-primary-500/20"
                                        >
                                            <span className="text-3xl font-light">+</span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4">Método de Integralização</p>
                                    <div className="grid grid-cols-3 gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                                        <MethodButton
                                            active={method === 'PIX'}
                                            onClick={() => setMethod('PIX')}
                                            label="PIX"
                                        />
                                        <MethodButton
                                            active={method === 'CARD'}
                                            onClick={() => setMethod('CARD')}
                                            label="CARTÃO"
                                        />
                                        <MethodButton
                                            active={method === 'BALANCE'}
                                            onClick={() => setMethod('BALANCE')}
                                            label="SALDO"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Legal Disclaimers */}
                        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-6 flex gap-4 items-start">
                            <Info size={18} className="text-primary-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] sm:text-xs text-zinc-600 leading-relaxed font-medium">
                                <strong className="text-zinc-500 uppercase tracking-widest block mb-1">Nota Técnica</strong>
                                O Cred30 é um sistema de economia colaborativa. A integralização de capital social não se caracteriza como investimento, poupança, título de capitalização ou depósito bancário. Operações realizadas sob modelo de SCP conforme Lei 10.406/02.
                            </p>
                        </div>
                    </div>

                    {/* Right: Summary & CTA */}
                    <div className="lg:col-span-2 space-y-6 lg:sticky lg:top-24">
                        <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] p-8 backdrop-blur-sm shadow-2xl">
                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-6 border-b border-white/5 pb-4">Composição do Aporte</h4>

                            <div className="space-y-4 mb-8">
                                <SummaryItem label={`Capital Social (${qty}x)`} value={qty * QUOTA_SHARE_VALUE} />
                                <SummaryItem label="Taxa Operacional" value={qty * QUOTA_ADM_FEE} />
                                {fee > 0 && (
                                    <SummaryItem
                                        label={`Encargos ${method === 'PIX' ? 'Gateway' : 'Processamento'}`}
                                        value={fee}
                                        highlight
                                    />
                                )}
                                <div className="pt-4 mt-4 border-t border-white/5">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-sm font-black text-white uppercase tracking-wider">Total Final</span>
                                        <span className="text-3xl font-black text-primary-400">
                                            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3 text-left bg-black/40 p-4 rounded-2xl border border-white/5">
                                    <div className="relative flex items-center shrink-0">
                                        <input
                                            type="checkbox"
                                            id="terms"
                                            checked={acceptedTerms}
                                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-zinc-700 checked:border-primary-500 checked:bg-primary-500 transition-all"
                                        />
                                        <CheckCircle2 size={12} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-black opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                                    </div>
                                    <label htmlFor="terms" className="text-[10px] text-zinc-500 leading-tight pt-0.5 cursor-pointer select-none">
                                        Li e aceito os <button onClick={() => setShowTermsModal(true)} className="text-primary-500 font-bold hover:underline">Termos de Adesão</button> ao grupo Cred30.
                                    </label>
                                </div>

                                <button
                                    onClick={() => {
                                        if (!acceptedTerms) {
                                            alert('Por favor, aceite os termos de adesão para continuar.');
                                            return;
                                        }
                                        if (method === 'CARD') {
                                            handlePurchase();
                                        } else {
                                            setShowConfirm(true);
                                        }
                                    }}
                                    disabled={!acceptedTerms}
                                    className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${acceptedTerms
                                        ? 'bg-primary-500 text-black hover:bg-primary-400 shadow-primary-500/20 active:scale-[0.98]'
                                        : 'bg-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed shadow-none'
                                        }`}
                                >
                                    {method === 'CARD' ? 'Ir para Pagamento' : 'Confirmar Ingresso'}
                                    <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Extra Context */}
                        <div className="px-4 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0 text-primary-400 border border-primary-500/20">
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <h5 className="text-[11px] font-black text-white uppercase tracking-tight">Cota-Parte Social</h5>
                                    <p className="text-[10px] text-zinc-500 leading-tight mt-1">Representa sua participação no Capital Social, tornando você um cooperado com acesso a crédito.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Disclaimers */}
                <footer className="mt-24 pt-12 border-t border-white/5 text-center">
                    <p className="text-[11px] font-black text-white tracking-widest uppercase mb-4">Cred30 © 2024 • Sistema de Cooperação Associativa Mutuária</p>
                    <div className="flex justify-center gap-6 text-[10px] font-bold text-zinc-600 mb-8">
                        <button className="hover:text-primary-500 transition-colors uppercase tracking-widest">Termos de Uso</button>
                        <span className="opacity-20">•</span>
                        <button className="hover:text-primary-500 transition-colors uppercase tracking-widest">Política de Privacidade</button>
                    </div>
                    <p className="text-[10px] text-zinc-700 max-w-3xl mx-auto leading-relaxed uppercase tracking-wider">
                        O Cred30 não é uma instituição financeira regulada pelo BACEN ou uma corretora de valores mobiliários (CVM). As operações de suporte mútuo e participações são baseadas no Código Civil Brasileiro (Sociedade em Conta de Participação e Mútua Privada).
                    </p>
                </footer>
            </div>

            {/* Modals from previous version adapted */}
            {showTermsModal && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[700] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-zinc-900 border border-white/10 rounded-[2.5rem] p-10 w-full max-w-sm max-h-[80vh] overflow-y-auto relative shadow-2xl ring-1 ring-white/10">
                        <button onClick={() => setShowTermsModal(false)} className="absolute top-6 right-6 text-zinc-600 hover:text-white bg-white/5 p-2 rounded-full transition-colors"><XIcon size={20} /></button>

                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-primary-500/20 shadow-xl shadow-primary-900/20">
                                <ShieldCheck size={40} className="text-primary-500" />
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tight uppercase">Termo de Adesão</h3>
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-2">Leia atentamente antes de prosseguir</p>
                        </div>

                        <div className="space-y-4 text-xs text-zinc-500 leading-relaxed font-medium">
                            <p className="text-black font-black bg-primary-500 p-4 rounded-2xl text-center shadow-lg shadow-primary-500/20 uppercase tracking-tighter">Declaração de Ciência e Aceite</p>

                            <TermItem num="01" text="Trata-se de uma adesão a um sistema de suporte mútuo e economia colaborativa (SCP - Sociedade em Conta de Participação)." />
                            <TermItem num="02" text="O valor aportado compõe o capital social da comunidade para fins de socorro financeiro e benefícios mútuos." />
                            <TermItem num="03" text="Os excedentes operacionais distribuídos são frutos do desempenho coletivo da plataforma." />
                            <TermItem num="04" text="Não há garantia de rendimento fixo. Resultados passados não garantem resultados futuros." highlight />
                            <TermItem num="05" text="Existe um período de carência (Vesting) de 365 dias para o resgate do capital social sem taxas de saída." />
                        </div>

                        <button
                            onClick={() => { setAcceptedTerms(true); setShowTermsModal(false); }}
                            className="w-full bg-white text-black font-black py-5 rounded-2xl mt-8 text-xs uppercase tracking-[0.2em] hover:scale-[1.02] transition-all shadow-xl active:scale-95"
                        >
                            ENTENDI E ACEITO
                        </button>
                    </div>
                </div>
            )}

            {showConfirm && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-500" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
                    <div className="bg-[#0A0A0A] border-t sm:border border-white/10 rounded-t-[3rem] sm:rounded-[2.5rem] p-10 w-full sm:max-w-sm relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 sm:duration-300 ring-1 ring-white/10">
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8 sm:hidden opacity-50" />
                        <button title="Fechar" onClick={() => setShowConfirm(false)} className="absolute top-6 right-6 text-zinc-600 hover:text-white bg-zinc-900/50 p-2 rounded-full hidden sm:block transition-colors"><XIcon size={20} /></button>

                        <div className="text-center mb-10">
                            <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary-900/20 ring-1 ring-primary-500/20">
                                <CheckCircle2 size={40} className="text-primary-500" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tight">Confirmar Adesão</h3>
                            <p className="text-zinc-500 text-sm mt-3 font-medium tracking-tight">Integralização de <span className="text-white font-bold">{qty} cota(s)-parte</span></p>
                        </div>

                        <div className="bg-zinc-900/50 border border-white/10 rounded-[2rem] p-6 mb-10 space-y-4">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                <span className="text-zinc-600">Subtotal Aporte</span>
                                <span className="text-white">{baseAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            {fee > 0 && (
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-primary-500/70">
                                    <span>Taxas Externas</span>
                                    <span>+{fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            )}
                            <div className="h-px bg-white/5 my-2"></div>
                            <div className="flex justify-between items-end">
                                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">Total Final</span>
                                <span className="text-3xl font-black text-primary-400">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={handlePurchase}
                                className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-primary-500/20 active:scale-[0.98] text-xs flex items-center justify-center gap-3"
                            >
                                {method === 'BALANCE' ? 'PAGAR COM MEU SALDO' : 'GERAR PAGAMENTO PIX'}
                                <ArrowRight size={18} />
                            </button>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="w-full py-4 text-zinc-700 hover:text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em] transition-all"
                            >
                                CANCELAR E VOLTAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-components for cleaner structure
const BenefitCard = ({ icon, title, description, color }: { icon: any, title: string, description: string, color: string }) => (
    <div className="glass glass-hover p-6 group">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shrink-0 border transition-all ${color === 'primary' ? 'bg-primary-500/10 border-primary-500/20 text-primary-400 group-hover:bg-primary-500 group-hover:text-black' :
            color === 'blue' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-black' :
                'bg-purple-500/10 border-purple-500/20 text-purple-400 group-hover:bg-purple-500 group-hover:text-black'
            }`}>
            {icon}
        </div>
        <h4 className="text-white font-bold text-lg mb-2 tracking-tight">{title}</h4>
        <p className="text-zinc-500 text-xs leading-relaxed font-medium">{description}</p>
    </div>
);

const MethodButton = ({ active, onClick, label }: any) => (
    <button
        onClick={onClick}
        className={`flex-1 py-3.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${active
            ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20'
            : 'text-zinc-600 hover:text-white hover:bg-white/5'
            }`}
    >
        {label}
    </button>
);

const SummaryItem = ({ label, value, highlight }: any) => (
    <div className={`flex justify-between text-xs font-bold ${highlight ? 'text-primary-500/80' : 'text-zinc-500'}`}>
        <span className="uppercase tracking-widest">{label}</span>
        <span className={highlight ? 'font-black' : 'font-medium'}>
            {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
    </div>
);

const TermItem = ({ num, text, highlight }: any) => (
    <div className="flex gap-4 bg-black/40 p-4 rounded-2xl border border-white/5 group hover:border-white/10 transition-colors">
        <span className={`font-black text-lg ${highlight ? 'text-primary-400' : 'text-zinc-700'}`}>{num}</span>
        <p className={`text-[11px] leading-snug font-medium ${highlight ? 'text-zinc-300' : ''}`}>{text}</p>
    </div>
);
