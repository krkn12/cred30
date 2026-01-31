import { useState, useEffect } from 'react';
import { Wallet, Clock, DollarSign, TrendingUp, AlertTriangle, FileText, X as XIcon, Download } from 'lucide-react';
import { Loan, User } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';
import { createContractData, downloadLoanContract } from '../../../application/services/contract.service';
import { formatBRL, formatNumberBR, parseToNumber } from '../../../shared/utils/format.utils';

interface LoansViewProps {
    loans: Loan[];
    onRequest: (amount: number, installments: number, guaranteePercentage: number, guarantorId?: string, acceptedTerms?: boolean) => void;
    onGuarantorRespond: (loanId: string, action: 'APPROVE' | 'REJECT') => void;
    onPay: (loanId: string, full: boolean) => void;
    onPayInstallment: (loanId: string, amount: number) => void;
    userBalance: number;
    currentUser: User | null;
}

export const LoansView = ({ loans, onRequest, onGuarantorRespond, onPay, onPayInstallment, userBalance, currentUser }: LoansViewProps) => {
    const [amountText, setAmountText] = useState('500');
    const amount = parseToNumber(amountText);
    const [months, setMonths] = useState(3);
    const [guaranteePercentage, setGuaranteePercentage] = useState(100);
    const [guarantorId, setGuarantorId] = useState('');
    const [payModalId, setPayModalId] = useState<string | null>(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    // Helpers de formatação segura migrados para utils
    const formatNumber = formatNumberBR;

    const getDaysRemaining = (dueDate: string | number | null | undefined) => {
        if (!dueDate) return 'N/A';
        const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    };

    const getNextDueDate = (loan: Loan | undefined) => {
        if (!loan) return null;
        const next = loan.installmentsList?.find(i => i.status === 'PENDING');
        return next ? next.dueDate : loan.dueDate;
    };

    const [viewDetailsId, setViewDetailsId] = useState<string | null>(null);
    const [installmentModalData, setInstallmentModalData] = useState<{ loanId: string, installmentAmount: number } | null>(null);

    // Usuários PRO não veem anúncios
    const isPro = currentUser?.membership_type === 'PRO';

    // Limite de Apoio Mútuo (Nubank Style)
    const [creditLimit, setCreditLimit] = useState<{
        totalLimit: number;
        activeDebt: number;
        availableLimit: number;
        analysis?: { eligible: boolean; reason: string; details: any }
    } | null>(null);

    useEffect(() => {
        const fetchLimit = async () => {
            try {
                const response = await apiService.getAvailableLimit();
                if (response.success && response.data) {
                    setCreditLimit(response.data);
                }
            } catch (e) {
                console.error('Erro ao buscar limite de apoio mútuo:', e);
            }
        };
        fetchLimit();
    }, [loans, userBalance]);

    // Tabela de taxas baseada na garantia (Conforme Backend Unificado)
    const getInterestRate = (pct: number) => {
        // Fórmula Unificada: Base 5% + (35% * (1 - pct/100))
        // Se 100% Garantia -> 5% juros
        // Se 0% Garantia -> 40% juros
        return 0.05 + (0.35 * (1 - pct / 100));
    };

    const effectiveInterestRate = guarantorId ? 0.10 : getInterestRate(guaranteePercentage);
    const totalRepay = amount * (1 + effectiveInterestRate);
    const monthlyPayment = totalRepay / months;

    const myLoans = loans.filter(l => !l.isGuarantor && (l.status === 'APPROVED' || l.status === 'PENDING' || l.status === 'PAYMENT_PENDING' || l.status === 'WAITING_GUARANTOR' || l.status === 'PAID'));
    const guarantorRequests = loans.filter(l => l.isGuarantor && l.status === 'WAITING_GUARANTOR');
    const activeLoans = myLoans.filter(l => ['APPROVED', 'PAYMENT_PENDING', 'PENDING', 'WAITING_GUARANTOR'].includes(l.status));
    const selectedLoan = activeLoans.find(l => l.id === payModalId);

    // Helper: Calculate installment value
    const getInstallmentValue = (loan: Loan | undefined) => {
        if (!loan) return 0;
        const nextPending = (loan.installmentsList || []).find(i => i.status === 'PENDING');
        if (nextPending) return nextPending.expectedAmount;

        const totalRepay = loan.totalRepayment || 0;
        const installments = loan.installments || 1;
        const fixedValue = totalRepay / installments;
        const remaining = loan.remainingAmount ?? totalRepay;
        return Math.min(fixedValue, remaining);
    };

    void isPro;
    void viewDetailsId;
    void setViewDetailsId;

    return (
        <div className="space-y-8 pb-32">
            {/* Solicitações de Fiança para este usuário */}
            {guarantorRequests.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pl-1">
                        <AlertTriangle className="text-yellow-500" size={20} />
                        <h3 className="text-lg font-bold text-white">Solicitações de Fiança</h3>
                    </div>
                    {guarantorRequests.map(req => (
                        <div key={req.id} className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 animate-pulse-slow">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <p className="text-yellow-500 text-xs font-bold uppercase mb-1">Ação Requerida</p>
                                    <p className="text-white text-sm">
                                        <span className="font-bold">{req.requesterName || 'Usuário'}</span> solicitou que você seja fiador de um apoio de
                                        <span className="font-bold text-yellow-400 ml-1">{formatBRL(req.amount)}</span>.
                                    </p>
                                    <p className="text-zinc-500 text-xs mt-1 italic">* Suas cotas serão usadas como garantia se você aceitar.</p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => onGuarantorRespond(req.id, 'REJECT')}
                                        className="flex-1 sm:flex-none px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-lg transition"
                                    >
                                        Recusar
                                    </button>
                                    <button
                                        onClick={() => onGuarantorRespond(req.id, 'APPROVE')}
                                        className="flex-1 sm:flex-none px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold rounded-lg transition"
                                    >
                                        Aceitar Fiança
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Active Loan Card - Adaptado para responsividade */}
            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Wallet size={120} />
                </div>

                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <div>
                            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1 block">Saldo Devedor Total</span>
                            <h3 className="text-2xl sm:text-3xl font-black text-white">
                                {formatBRL(activeLoans.reduce((acc, l) => acc + (l.remainingAmount ?? l.totalRepayment), 0))}
                            </h3>
                            {activeLoans.length > 1 && (
                                <p className="text-[10px] text-zinc-500 mt-1 font-bold italic">
                                    * Somatória de {activeLoans.length} compromissos ativos
                                </p>
                            )}
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2 self-start sm:self-auto uppercase">
                            <Clock size={14} className="text-yellow-500" />
                            <span className="text-yellow-500 text-[10px] font-black">
                                Próx. Vencimento: {activeLoans.length > 0 ? (getNextDueDate(activeLoans.sort((a, b) => new Date(getNextDueDate(a) || 0).getTime() - new Date(getNextDueDate(b) || 0).getTime())[0]) ? new Date(getNextDueDate(activeLoans[0])!).toLocaleDateString('pt-BR') : 'N/A') : 'N/A'}
                                {activeLoans.length > 0 && (
                                    <span className="ml-1 opacity-60">({getDaysRemaining(getNextDueDate(activeLoans[0]))} dias)</span>
                                )}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden border border-white/5">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                                style={{
                                    width: `${activeLoans.length > 0
                                        ? (activeLoans.reduce((acc, l) => acc + (l.totalPaid || 0), 0) / activeLoans.reduce((acc, l) => acc + l.totalRepayment, 0)) * 100
                                        : 0}%`
                                }}
                            />
                        </div>
                        <div className="flex justify-between text-xs font-medium text-zinc-500">
                            <span>Total Pago: {formatBRL(activeLoans.reduce((acc, l) => acc + (l.totalPaid || 0), 0))}</span>
                            <span>Total a Pagar: {formatBRL(activeLoans.reduce((acc, l) => acc + l.totalRepayment, 0))}</span>
                        </div>
                    </div>

                    <div className="mt-6 text-center">
                        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2">Gerencie seus compromissos individuais abaixo</p>
                        <div className="w-full h-px bg-white/5"></div>
                    </div>
                </div>
            </div>

            {/* Loan Request Card */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <DollarSign size={120} />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                            <DollarSign className="text-primary-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Solicitar Reciprocidade</h2>
                            <p className="text-zinc-400 text-sm">Apoio social imediato para membros</p>
                        </div>
                    </div>

                    {/* Limite de Crédito Card (Nubank Style) */}
                    {creditLimit && (
                        <div className={`border rounded-2xl p-4 mb-6 ${(!creditLimit.analysis?.eligible || creditLimit.totalLimit === 0) ? 'bg-orange-500/10 border-orange-500/30' : 'bg-gradient-to-r from-emerald-500/10 to-primary-500/10 border-emerald-500/30'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {(!creditLimit.analysis?.eligible || creditLimit.totalLimit === 0) ? (
                                    <AlertTriangle className="text-orange-400" size={18} />
                                ) : (
                                    <TrendingUp className="text-emerald-400" size={18} />
                                )}
                                <span className={`text-sm font-medium ${(!creditLimit.analysis?.eligible || creditLimit.totalLimit === 0) ? 'text-orange-400' : 'text-emerald-400'}`}>
                                    {(!creditLimit.analysis?.eligible || creditLimit.totalLimit === 0) ? 'Atenção: Ajuda Indisponível' : 'Seu Limite de Ajuda Mútua'}
                                </span>
                            </div>

                            {!creditLimit.analysis?.eligible || creditLimit.totalLimit === 0 ? (
                                <p className="text-sm text-zinc-300">
                                    {creditLimit.analysis?.reason || 'Para liberar o apoio mútuo, você precisa ter no mínimo 1 participação ativa no clube e score de crédito saudável.'}
                                </p>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-2xl font-bold text-white">{formatBRL(creditLimit.availableLimit)}</span>
                                        <span className="text-xs text-zinc-400">de {formatBRL(creditLimit.totalLimit)}</span>
                                    </div>
                                    <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-primary-500 transition-all"
                                            style={{ width: `${Math.max(0, Math.min(100, (creditLimit.availableLimit / (creditLimit.totalLimit || 1)) * 100))}%` }}
                                        />
                                    </div>
                                    {creditLimit.activeDebt > 0 && (
                                        <p className="text-xs text-zinc-500 mt-2">Você tem {formatBRL(creditLimit.activeDebt)} em compromissos ativos.</p>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Simulation Inputs */}
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-2 block">Quanto você solicita de apoio?</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">R$</span>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={amountText}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            // Permitir apenas números e vírgula/ponto
                                            if (val === '' || /^[0-9.,]+$/.test(val)) {
                                                setAmountText(val);
                                            }
                                        }}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-4 pl-10 pr-4 text-white text-lg font-bold focus:border-primary-500 outline-none transition"
                                        placeholder="0,00"
                                    />
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {[100, 300, 500, 1000].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setAmountText(val.toString())}
                                            className="px-3 py-1 rounded-lg bg-surfaceHighlight text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
                                        >
                                            R$ {val}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-2 block">Participações em Garantia (Menos Garantia = Maior Taxa)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[50, 60, 70, 80, 90, 100].map(pct => (
                                        <button
                                            key={pct}
                                            onClick={() => setGuaranteePercentage(pct)}
                                            className={`py-3 rounded-xl text-xs font-black transition-all border ${guaranteePercentage === pct
                                                ? 'bg-primary-500 text-black border-primary-400 shadow-lg shadow-primary-500/20'
                                                : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-white'}`}
                                        >
                                            {pct}% Gar.
                                            <div className="text-[9px] opacity-70">Taxa Serv.: {(getInterestRate(pct) * 100).toFixed(0)}%</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-2 block">Deseja adicionar um Fiador? (Opcional)</label>
                                <input
                                    type="text"
                                    value={guarantorId}
                                    onChange={(e) => setGuarantorId(e.target.value)}
                                    placeholder="ID ou Email do Fiador"
                                    className="w-full bg-background border border-surfaceHighlight rounded-xl py-4 px-4 text-white text-sm focus:border-primary-500 outline-none transition"
                                />
                                {guarantorId ? (
                                    <p className="text-[10px] text-emerald-400 mt-2 font-bold animate-pulse">
                                        ✓ Modo Fiador Ativo: A garantia será de 100% das cotas do fiador.
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-zinc-500 mt-2">
                                        As cotas do fiador somam ao seu limite. Ele precisará aprovar a solicitação.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-2 block">Deseja parcelar em quantas vezes?</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max="12"
                                        value={months}
                                        onChange={(e) => setMonths(Math.max(1, Number(e.target.value)))}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-4 px-4 text-white text-lg font-bold focus:border-primary-500 outline-none transition"
                                        placeholder="Meses"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">meses</span>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {[1, 3, 6, 12].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setMonths(val)}
                                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${months === val
                                                ? 'bg-primary-500 text-black border border-primary-400'
                                                : 'bg-zinc-900 border border-white/5 text-zinc-500 hover:bg-zinc-800 hover:text-white'}`}
                                        >
                                            {val}X
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-background rounded-2xl p-6 border border-surfaceHighlight flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-white mb-4">Resumo da Simulação</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500">Valor Solicitado</span>
                                        <span className="text-white font-medium">{formatBRL(amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500">Taxa de Manutenção ({(effectiveInterestRate * 100).toFixed(0)}%)</span>
                                        <span className="text-red-400 font-medium">{formatBRL(totalRepay - amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500">Valor da Reposição</span>
                                        <span className="text-primary-400 font-medium">{formatBRL(monthlyPayment)}</span>
                                    </div>
                                    <div className="h-px bg-zinc-800 my-2"></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-zinc-400 text-sm">Total a Repor</span>
                                        <span className="text-xl font-bold text-white">{formatBRL(totalRepay)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 mt-4 mb-4">
                                <div className="relative flex items-center shrink-0">
                                    <input
                                        type="checkbox"
                                        id="loanTerms"
                                        checked={acceptedTerms}
                                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-zinc-700 checked:border-emerald-500 checked:bg-emerald-500 transition-all"
                                    />
                                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-black opacity-0 peer-checked:opacity-100 transition-opacity">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                </div>
                                <label htmlFor="loanTerms" className="text-[10px] text-zinc-500 leading-tight pt-0.5 cursor-pointer select-none">
                                    Li e concordo com o Termo de Adesão ao Mútuo Civil e declaro estar ciente das taxas de manutenção e reposição.
                                </label>
                            </div>

                            <button
                                onClick={() => onRequest(amount, months, guarantorId ? 100 : guaranteePercentage, guarantorId, acceptedTerms)}
                                disabled={!amount || amount <= 0 || (creditLimit?.totalLimit === 0 && !guarantorId) || creditLimit?.analysis?.details?.isCurrentlyGuarantor || !acceptedTerms}
                                className={`w-full font-bold py-4 rounded-xl transition shadow-lg ${creditLimit?.analysis?.details?.isCurrentlyGuarantor
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                    : (!acceptedTerms && amount > 0)
                                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-70'
                                        : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                                    }`}
                            >
                                {creditLimit?.analysis?.details?.isCurrentlyGuarantor
                                    ? 'Bloqueado: Você é Fiador Ativo'
                                    : (creditLimit?.totalLimit === 0 && !guarantorId)
                                        ? 'Ajuda Indisponível'
                                        : !acceptedTerms
                                            ? 'Aceite os Termos'
                                            : 'Solicitar Apoio Mútuo'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Loans List */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-white pl-1">Seus Compromissos Sociais</h3>

                {myLoans.length === 0 && (
                    <div className="text-center py-12 bg-surface/50 rounded-3xl border border-surfaceHighlight border-dashed">
                        <p className="text-zinc-500">Nenhum apoio mútuo ativo no momento.</p>
                    </div>
                )}

                {myLoans.map(loan => {
                    const daysUntilDue = loan.dueDate ? Math.ceil((new Date(loan.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                    const isOverdue = daysUntilDue < 0;
                    const isUrgent = daysUntilDue <= 3 && daysUntilDue >= 0;
                    void isUrgent;

                    const paidAmount = loan.totalPaid || 0;
                    const remainingAmount = loan.status === 'PAID' ? 0 : (loan.remainingAmount ?? loan.totalRepayment);
                    const progressPercentage = (paidAmount / loan.totalRepayment) * 100;
                    const installmentValue = getInstallmentValue(loan);

                    return (
                        <div key={loan.id} className="bg-surface border border-surfaceHighlight rounded-2xl p-5 transition hover:border-zinc-700">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${loan.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' :
                                        loan.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-zinc-800 text-zinc-400'
                                        }`}>
                                        <DollarSign size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-lg">{formatBRL(loan.amount)}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${loan.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                                loan.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400' :
                                                    loan.status === 'WAITING_GUARANTOR' ? 'bg-blue-500/10 text-blue-400' :
                                                        loan.status === 'PAID' ? 'bg-zinc-500/10 text-zinc-400' :
                                                            'bg-zinc-800 text-zinc-400'
                                                }`}>
                                                {loan.status === 'APPROVED' ? 'Aprovado' :
                                                    loan.status === 'PENDING' ? 'Em Análise' :
                                                        loan.status === 'WAITING_GUARANTOR' ? 'Aguardando Fiador' :
                                                            loan.status === 'PAID' ? 'Quitado' :
                                                                loan.status}
                                            </span>
                                            {isOverdue && loan.status !== 'PAID' && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={10} /> Atrasado</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-xs text-zinc-400">Restante</p>
                                    <p className="font-bold text-white">{formatBRL(remainingAmount)}</p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            {loan.status === 'APPROVED' && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-zinc-500">{loan.paidInstallmentsCount || 0} de {loan.installments} reposições</span>
                                        <span className="text-zinc-400">{progressPercentage.toFixed(0)}% reposto</span>
                                    </div>
                                    <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                                        ></div>
                                    </div>

                                    {/* CRONOGRAMA DE PARCELAS */}
                                    {loan.installmentsList && loan.installmentsList.length > 0 && (
                                        <div className="mt-6 space-y-2">
                                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Cronograma de Reposição</p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {loan.installmentsList.map((inst: any) => (
                                                    <div key={inst.id} className={`flex items-center justify-between p-3 rounded-xl border ${inst.status === 'PAID' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-black/20 border-white/5'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2 h-2 rounded-full ${inst.status === 'PAID' ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                                                            <div>
                                                                <p className="text-[10px] font-black text-white uppercase tracking-tighter">Parcela {inst.installmentNumber || '-'}</p>
                                                                <p className="text-[9px] text-zinc-500 font-bold">{new Date(inst.dueDate).toLocaleDateString('pt-BR')}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[11px] font-black text-white">{formatBRL(inst.expectedAmount)}</p>
                                                            <p className={`text-[8px] font-black uppercase tracking-widest ${inst.status === 'PAID' ? 'text-emerald-500' : 'text-zinc-500'}`}>
                                                                {inst.status === 'PAID' ? 'REPOSTO' : 'PENDENTE'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            {loan.status === 'APPROVED' && !loan.isFullyPaid && (
                                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-surfaceHighlight">
                                    <button
                                        onClick={() => setInstallmentModalData({ loanId: loan.id, installmentAmount: installmentValue })}
                                        className="py-2.5 rounded-xl bg-surfaceHighlight hover:bg-zinc-700 text-white text-sm font-medium transition"
                                    >
                                        Repor Parcela
                                    </button>
                                    <button
                                        onClick={() => setPayModalId(loan.id)}
                                        className={`py-2.5 rounded-xl text-white text-sm font-medium transition ${isOverdue ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-500 hover:bg-primary-400 text-black'}`}
                                    >
                                        Finalizar Compromisso
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (currentUser) {
                                                const contractData = createContractData(loan, currentUser);
                                                downloadLoanContract(contractData);
                                            }
                                        }}
                                        className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition flex items-center justify-center gap-1.5"
                                        title="Baixar Contrato"
                                    >
                                        <FileText size={14} />
                                        <span className="hidden sm:inline">Contrato</span>
                                    </button>
                                </div>
                            )}

                            {/* Botão de contrato para compromissos já quitados */}
                            {loan.status === 'APPROVED' && loan.isFullyPaid && (
                                <div className="pt-4 border-t border-surfaceHighlight">
                                    <button
                                        onClick={() => {
                                            if (currentUser) {
                                                const contractData = createContractData(loan, currentUser);
                                                downloadLoanContract(contractData);
                                            }
                                        }}
                                        className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition flex items-center justify-center gap-2"
                                    >
                                        <Download size={16} />
                                        Baixar Contrato PDF
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Pay Full Loan Modal */}
            {selectedLoan && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={(e) => { if (e.target === e.currentTarget) setPayModalId(null); }}>
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in">
                        <button title="Fechar" onClick={() => setPayModalId(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={24} /></button>

                        <h3 className="text-xl font-bold text-white mb-4">Finalizar Compromisso</h3>
                        <p className="text-zinc-400 text-sm mb-6">
                            Você está prestes a repor o valor restante de <strong className="text-white">{formatBRL(selectedLoan.remainingAmount ?? selectedLoan.totalRepayment)}</strong> para o clube.
                        </p>

                        <div className="space-y-4">
                            <div className="bg-background p-3 rounded-xl border border-surfaceHighlight">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-zinc-400">Seu Saldo</span>
                                    <span className="text-white font-bold">{formatBRL(userBalance)}</span>
                                </div>
                            </div>

                            {userBalance < (selectedLoan.remainingAmount ?? selectedLoan.totalRepayment) ? (
                                <button
                                    onClick={() => window.location.hash = '#/app/dashboard'} // Redireciona para home onde tem o botão de depósito
                                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black py-4 rounded-xl mb-2 transition"
                                >
                                    SALDO INSUFICIENTE (RECARREGAR)
                                </button>
                            ) : (
                                <button
                                    onClick={() => { onPay(selectedLoan.id, true); setPayModalId(null); }}
                                    className="w-full bg-primary-500 hover:bg-primary-600 text-black font-black py-4 rounded-xl mb-2 transition shadow-lg shadow-primary-500/20"
                                >
                                    Pagar com Saldo
                                </button>
                            )}

                            <p className="text-[9px] text-zinc-600 text-center mt-4 leading-relaxed">
                                O valor será debitado do seu saldo interno e o compromisso será baixado automaticamente.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Pay Installment Modal */}
            {installmentModalData && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={(e) => { if (e.target === e.currentTarget) setInstallmentModalData(null); }}>
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in">
                        <button title="Fechar" onClick={() => setInstallmentModalData(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={24} /></button>

                        <h3 className="text-xl font-bold text-white mb-4">Repor Parcela</h3>
                        <p className="text-zinc-400 text-sm mb-6">
                            Valor da parcela: <strong className="text-white">{formatBRL(installmentModalData.installmentAmount)}</strong>
                        </p>

                        <div className="space-y-4">
                            <div className="bg-background p-3 rounded-xl border border-surfaceHighlight">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-zinc-400">Seu Saldo</span>
                                    <span className="text-white font-bold">{formatBRL(userBalance)}</span>
                                </div>
                            </div>

                            {userBalance < installmentModalData.installmentAmount ? (
                                <button
                                    onClick={() => window.location.hash = '#/app/dashboard'}
                                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black py-4 rounded-xl mb-2 transition"
                                >
                                    SALDO INSUFICIENTE (RECARREGAR)
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        onPayInstallment(installmentModalData.loanId, installmentModalData.installmentAmount);
                                        setInstallmentModalData(null);
                                    }}
                                    className="w-full bg-primary-500 hover:bg-primary-600 text-black font-black py-4 rounded-xl mb-2 transition shadow-lg shadow-primary-500/20"
                                >
                                    Pagar com Saldo
                                </button>
                            )}

                            <p className="text-[9px] text-zinc-600 text-center mt-4 leading-relaxed">
                                O valor será debitado do seu saldo interno e sua parcela será registrada como paga.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Legal Disclaimer */}
            <div className="mt-8 px-4 text-[10px] text-zinc-600 text-center leading-relaxed">
                <p>As ajudas mútuas estão sujeitas à análise de Score e disponibilidade de caixa do Clube. Os apoios são lastreados por execução de garantia sobre licenças ativas no sistema. Em caso de atraso superior a 5 dias, o lastro será executado automaticamente conforme Termos de Uso (SCP/Mútuo Civil) e Termo de Adesão.</p>
            </div>
        </div>
    );
};
