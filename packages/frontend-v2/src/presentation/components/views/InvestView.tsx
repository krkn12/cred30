import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, X as XIcon, Users, ShieldCheck, Info, CheckCircle2, Building2, ArrowRight, Zap, Gavel } from 'lucide-react';
import { QUOTA_PRICE, QUOTA_SHARE_VALUE, QUOTA_ADM_FEE } from '../../../shared/constants/app.constants';
import { calculateTotalToPay } from '../../../shared/utils/financial.utils';

interface InvestViewProps {
    onBuy: (qty: number, acceptedTerms: boolean) => void;
    isPro?: boolean;
    userBalance?: number;
    isVerified?: boolean;
    kycStatus?: string;
}

export const InvestView = ({ onBuy, isPro, userBalance = 0, isVerified = false, kycStatus = 'NONE' }: InvestViewProps) => {
    void isPro;
    const [qty, setQty] = useState(1);
    const [method] = useState<'BALANCE'>('BALANCE');
    const [showConfirm, setShowConfirm] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const navigate = useNavigate();

    const baseAmount = qty * QUOTA_PRICE;
    const { total } = calculateTotalToPay(baseAmount, method.toLowerCase() as any);

    const handlePurchase = () => {
        if (!acceptedTerms) return;
        onBuy(qty, acceptedTerms);
        setShowConfirm(false);
    };

    return (
        <div className="min-h-screen bg-gradient-premium text-zinc-400 font-medium pb-24 lg:pb-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">

                {/* Hero Section */}
                <div className="text-center mb-10 sm:mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 px-4 py-2 rounded-full text-primary-400 font-black text-[9px] uppercase tracking-widest mb-6">
                        <ShieldCheck size={12} /> Cooperativa Digital Cred30
                    </div>
                    <h1 className="text-3xl sm:text-6xl font-black text-white leading-tight mb-6 tracking-tight">
                        Faça parte da <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">Revolução Financeira</span> Colaborativa.
                    </h1>
                    <p className="text-sm sm:text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed px-4">
                        Ao integralizar suas cotas-parte, você se torna dono do negócio, participa das decisões e recebe sobras operacionais proporcionais ao capital aportado.
                    </p>
                </div>

                {/* Benefits Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                    <BenefitCard
                        icon={<TrendingUp size={20} />}
                        title="Distribuição de Sobras"
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
                        description="Modelo de Sociedade em Conta de Participação (Lei 10.406/02)."
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

                                <div className="bg-black/40 p-1.5 rounded-2xl border border-white/5">
                                    <div className="flex-1 py-3.5 rounded-xl text-[10px] font-black tracking-widest bg-primary-500 text-black shadow-lg shadow-primary-500/20 flex flex-col items-center justify-center">
                                        <span>SALDO INTERNO</span>
                                        <span className="text-[8px] mt-0.5 opacity-70 text-black">
                                            Disponível: {userBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KYC Warning (Mobile/Inline) */}
                        {(!isVerified && kycStatus !== 'APPROVED') && (
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6 lg:hidden">
                                <h4 className="text-amber-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <ShieldCheck size={18} /> Verificação Necessária
                                </h4>
                                <p className="text-xs text-zinc-500 mb-4">
                                    {kycStatus === 'PENDING' ? 'Seus documentos estão em análise. Aguarde a aprovação para investir.' :
                                        kycStatus === 'REJECTED' ? 'Sua verificação foi recusada. Verifique os motivos e envie novamente.' :
                                            'Para segurança da cooperativa, precisamos validar sua identidade.'}
                                </p>
                                {kycStatus !== 'PENDING' && (
                                    <button
                                        onClick={() => navigate('/app/settings')}
                                        className="w-full py-3 bg-amber-500/10 text-amber-500 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all"
                                    >
                                        Enviar Documentos
                                    </button>
                                )}
                            </div>
                        )}

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
                                {QUOTA_ADM_FEE > 0 && <SummaryItem label="Taxa Operacional" value={qty * QUOTA_ADM_FEE} />}

                                <div className="pt-4 mt-4 border-t border-white/5">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-sm font-black text-white uppercase tracking-wider">Total Aporte</span>
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

                                {isVerified || kycStatus === 'APPROVED' ? (
                                    <button
                                        onClick={() => {
                                            if (!acceptedTerms) {
                                                alert('Por favor, aceite os termos de adesão para continuar.');
                                                return;
                                            }
                                            setShowConfirm(true);
                                        }}
                                        disabled={!acceptedTerms}
                                        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${acceptedTerms
                                            ? 'bg-primary-500 text-black hover:bg-primary-400 shadow-primary-500/20 active:scale-[0.98]'
                                            : 'bg-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed shadow-none'
                                            }`}
                                    >
                                        Confirmar Ingresso
                                        <ArrowRight size={18} />
                                    </button>
                                ) : (
                                    <div className="w-full py-6 rounded-2xl bg-zinc-800/30 border border-zinc-700/50 p-6 text-center backdrop-blur-sm">
                                        <div className="flex justify-center mb-4">
                                            {kycStatus === 'PENDING' ? (
                                                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 animate-pulse border border-amber-500/20 shadow-lg shadow-amber-500/5">
                                                    <ShieldCheck size={24} />
                                                </div>
                                            ) : kycStatus === 'REJECTED' ? (
                                                <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 border border-red-500/20 shadow-lg shadow-red-500/5">
                                                    <XIcon size={24} />
                                                </div>
                                            ) : (
                                                <div className="w-12 h-12 bg-zinc-700/30 rounded-2xl flex items-center justify-center text-zinc-400 border border-zinc-600/30">
                                                    <ShieldCheck size={24} />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-white font-black text-sm uppercase tracking-wider mb-2">
                                            {kycStatus === 'PENDING' ? 'Análise em Andamento' :
                                                kycStatus === 'REJECTED' ? 'Verificação Recusada' :
                                                    'Acesso Restrito'}
                                        </p>
                                        <p className="text-zinc-500 text-[11px] leading-relaxed mb-6 px-2 font-medium">
                                            {kycStatus === 'PENDING'
                                                ? 'Nossa equipe está validando seus documentos. Você será notificado assim que aprovado.'
                                                : kycStatus === 'REJECTED'
                                                    ? 'Identificamos um problema com seus documentos. Por favor, envie novamente.'
                                                    : 'A integralização de cotas é exclusiva para membros verificados. Realize seu KYC para liberar.'}
                                        </p>

                                        {(kycStatus === 'NONE' || kycStatus === 'REJECTED') && (
                                            <button
                                                onClick={() => navigate('/app/settings')}
                                                className="w-full py-4 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border border-white/10 flex items-center justify-center gap-2 group"
                                            >
                                                <span>Resolver Agora</span>
                                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        )}

                                        {kycStatus === 'PENDING' && (
                                            <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                                Aguardando Aprovação
                                            </div>
                                        )}
                                    </div>
                                )}
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

            {/* Modal: Termo de Ciência e Sustentabilidade Financeira */}
            {
                showTermsModal && (
                    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[700] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300" onClick={(e) => { if (e.target === e.currentTarget) setShowTermsModal(false); }}>
                        <div className="bg-[#0A0A0A] border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 w-full max-w-sm max-h-[90vh] overflow-y-auto relative shadow-2xl ring-1 ring-white/10 scrollbar-hide pb-[calc(2rem+var(--safe-bottom))] sm:pb-10">
                            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8 sm:hidden opacity-50" />
                            <button onClick={() => setShowTermsModal(false)} className="absolute top-6 right-6 text-zinc-600 hover:text-white bg-zinc-900/50 p-2 rounded-full hidden sm:block transition-colors outline-none"><XIcon size={20} /></button>

                            <div className="text-center mb-8">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary-500/10 rounded-[1.5rem] sm:rounded-3xl flex items-center justify-center mx-auto mb-6 border border-primary-500/20 shadow-xl shadow-primary-900/20">
                                    <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary-500" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">Termo de Ciência</h3>
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-2 px-2 leading-tight">Sustentabilidade e Transparência</p>
                            </div>

                            <div className="space-y-3 sm:space-y-4 text-[11px] sm:text-xs text-zinc-500 leading-relaxed font-medium">
                                <p className="text-black font-black bg-emerald-500 p-3 sm:p-4 rounded-2xl text-center shadow-lg shadow-emerald-500/20 uppercase tracking-tighter">Economia Circular Cooperativa</p>

                                <TermItem num="01" text="Natureza Associativa: O Cred30 é um sistema de suporte mútuo privado. Você não está realizando um 'investimento financeiro', mas sim integralizando capital em uma Sociedade Cooperativa Digital." />
                                <TermItem num="02" text="Sustentabilidade Real: A receita da plataforma provém de serviços reais de marketing (vídeos), taxas de marketplace e contribuições de apoio social." highlight />
                                <TermItem num="03" text="Retorno Variável (Sobras): A distribuição de resultados é variável e depende exclusivamente do faturamento real da comunidade, sem garantia de lucro fixo." highlight />
                                <TermItem num="04" text="Circulação de Valor: O capital social é utilizado para fomentar o apoio interno entre associados, gerando riqueza que volta para você." />
                                <TermItem num="05" text="Carência e Segurança: O resgate integral (100%) é liberado após 365 dias da primeira cota. Antes disso, há multa de 40% em prol da cooperativa." />
                            </div>

                            <button
                                onClick={() => { setAcceptedTerms(true); setShowTermsModal(false); }}
                                className="w-full bg-white text-black font-black py-4 sm:py-5 rounded-2xl mt-8 text-[10px] sm:text-xs uppercase tracking-[0.2em] hover:scale-[1.02] transition-all shadow-xl active:scale-95 outline-none"
                            >
                                ENTENDI E ACEITO OS TERMOS
                            </button>
                        </div>
                    </div>
                )
            }

            {
                showConfirm && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-500" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
                        <div className="bg-[#0A0A0A] border-t sm:border border-white/10 rounded-t-[3rem] sm:rounded-[2.5rem] p-8 sm:p-10 w-full sm:max-w-sm relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 sm:duration-300 ring-1 ring-white/10 pb-[calc(2rem+var(--safe-bottom))] sm:pb-10">
                            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8 sm:hidden opacity-50" />
                            <button title="Fechar" onClick={() => setShowConfirm(false)} className="absolute top-6 right-6 text-zinc-600 hover:text-white bg-zinc-900/50 p-2 rounded-full hidden sm:block transition-colors outline-none"><XIcon size={20} /></button>

                            <div className="text-center mb-10">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary-500/10 rounded-[1.5rem] sm:rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary-900/20 ring-1 ring-primary-500/20">
                                    <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary-500" strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-black text-white tracking-tight">Confirmar Adesão</h3>
                                <p className="text-zinc-500 text-sm mt-3 font-medium tracking-tight">Integralização de <span className="text-white font-bold">{qty} cota(s)-parte</span></p>
                            </div>

                            <div className="bg-zinc-900/50 border border-white/10 rounded-[2rem] p-6 mb-10 space-y-4">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-zinc-600">Subtotal Aporte</span>
                                    <span className="text-white">{baseAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>

                                <div className="h-px bg-white/5 my-2"></div>
                                <div className="flex justify-between items-end">
                                    <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">Total Final</span>
                                    <span className="text-3xl font-black text-primary-400">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {userBalance < total ? (
                                    <div className="space-y-3">
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                                            <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-1">Saldo Insuficiente</p>
                                            <p className="text-zinc-500 text-[10px]">Você precisa depositar para continuar.</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setShowConfirm(false);
                                                window.location.hash = '#/app/dashboard';
                                            }}
                                            className="w-full py-4 sm:py-5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] bg-white text-black hover:bg-zinc-200 transition-all shadow-xl active:scale-95 outline-none"
                                        >
                                            FAZER DEPÓSITO AGORA
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handlePurchase}
                                        className="w-full py-4 sm:py-5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl bg-primary-500 text-black hover:bg-primary-400 shadow-primary-500/20 active:scale-[0.98] outline-none"
                                    >
                                        CONFIRMAR E PAGAR
                                        <ArrowRight size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="w-full py-3 sm:py-4 text-zinc-700 hover:text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em] transition-all outline-none"
                                >
                                    CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
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
