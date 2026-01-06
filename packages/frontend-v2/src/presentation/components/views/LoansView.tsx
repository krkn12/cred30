import { useState, useEffect } from 'react';
import { DollarSign, AlertTriangle, X as XIcon, Clock, TrendingUp, Download, FileText, QrCode, Wallet } from 'lucide-react';
import { Loan, User } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';
import { downloadLoanContract, createContractData } from '../../../application/services/contract.service';


interface LoansViewProps {
    loans: Loan[];
    onRequest: (amount: number, installments: number) => void;
    onPay: (loanId: string, full: boolean, method?: 'pix') => void;
    onPayInstallment: (loanId: string, amount: number, full: boolean, method?: 'pix') => void;
    userBalance: number;
    currentUser: User | null;
}

export const LoansView = ({ loans, onRequest, onPay, onPayInstallment, userBalance, currentUser }: LoansViewProps) => {
    const [amount, setAmount] = useState(500);
    const [months, setMonths] = useState(3);
    const [payModalId, setPayModalId] = useState<string | null>(null);

    const [viewDetailsId, setViewDetailsId] = useState<string | null>(null);
    const [installmentModalData, setInstallmentModalData] = useState<{ loanId: string, installmentAmount: number } | null>(null);

    // Usuários PRO não veem anúncios
    const isPro = currentUser?.membership_type === 'PRO';

    // Limite de Apoio Mútuo (Nubank Style)
    const [creditLimit, setCreditLimit] = useState<{
        totalLimit: number;
        activeDebt: number;
        remainingLimit: number;
        analysis?: { eligible: boolean; reason: string; details: any }
    } | null>(null);

    useEffect(() => {
        const fetchLimit = async () => {
            try {
                const data = await apiService.getAvailableLimit();
                setCreditLimit(data);
            } catch (e) {
                console.error('Erro ao buscar limite de apoio mútuo:', e);
            }
        };
        fetchLimit();
    }, [loans, userBalance]);

    const interestRate = 0.20; // 20%
    const totalRepay = amount * (1 + interestRate);
    const monthlyPayment = totalRepay / months;

    const activeLoans = loans.filter(l => l.status === 'APPROVED' || l.status === 'PENDING' || l.status === 'PAYMENT_PENDING');
    const selectedLoan = activeLoans.find(l => l.id === payModalId);

    // Helper: Calculate remaining installments
    const getRemainingInstallments = (loan: Loan) => {
        const total = loan.installments;
        const paid = loan.paidInstallmentsCount || 0;
        return Math.max(0, total - paid);
    };

    // Helper: Calculate installment value
    const getInstallmentValue = (loan: Loan) => {
        return loan.totalRepayment / loan.installments;
    };

    void isPro;
    void viewDetailsId;
    void setViewDetailsId;
    void getRemainingInstallments;

    return (
        <div className="space-y-8 pb-32">
            {/* Active Loan Card - Adaptado para responsividade */}
            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Wallet size={120} />
                </div>

                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <div>
                            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1 block">Apoio Mútuo em Aberto</span>
                            {/* This activeLoan variable is not defined in the current scope.
                                Assuming it should be derived from 'loans' or 'activeLoans' if there's only one active loan to display here.
                                For now, I'll use a placeholder or the first active loan if available.
                                If there can be multiple active loans, this card structure might need to be iterated or adapted.
                                For the purpose of this edit, I'll assume a single 'activeLoan' concept for this card.
                                If no active loan, this card might not render or show a different state.
                            */}
                            <h3 className="text-2xl sm:text-3xl font-black text-white">R$ {activeLoans.length > 0 ? activeLoans[0].amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</h3>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2 self-start sm:self-auto">
                            <Clock size={14} className="text-yellow-500" />
                            <span className="text-yellow-500 text-xs font-bold uppercase">Vence em {activeLoans.length > 0 && activeLoans[0].dueDate ? Math.ceil((new Date(activeLoans[0].dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 'N/A'} dias</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden border border-white/5">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                                style={{ width: `${activeLoans.length > 0 ? ((activeLoans[0].totalPaid || 0) / activeLoans[0].totalRepayment) * 100 : 0}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs font-medium text-zinc-500">
                            <span>Pago: R$ {activeLoans.length > 0 ? (activeLoans[0].totalPaid || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</span>
                            <span>Total: R$ {activeLoans.length > 0 ? activeLoans[0].totalRepayment.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                        <button
                            onClick={() => activeLoans.length > 0 && setInstallmentModalData({ loanId: activeLoans[0].id, installmentAmount: getInstallmentValue(activeLoans[0]) })}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                        >
                            Repor Parcela
                        </button>
                        <button
                            onClick={() => activeLoans.length > 0 && setPayModalId(activeLoans[0].id)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        >
                            Finalizar
                        </button>
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
                            <h2 className="text-xl font-bold text-white">Solicitar Ajuda Mútua</h2>
                            <p className="text-zinc-400 text-sm">Apoio financeiro imediato para membros</p>
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
                                        <span className="text-2xl font-bold text-white">{creditLimit.remainingLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        <span className="text-xs text-zinc-400">de {creditLimit.totalLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-primary-500 transition-all"
                                            style={{ width: `${Math.max(0, Math.min(100, (creditLimit.remainingLimit / creditLimit.totalLimit) * 100))}%` }}
                                        />
                                    </div>
                                    {creditLimit.activeDebt > 0 && (
                                        <p className="text-xs text-zinc-500 mt-2">Você tem {creditLimit.activeDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em compromissos ativos.</p>
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
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-4 pl-10 pr-4 text-white text-lg font-bold focus:border-primary-500 outline-none transition"
                                        placeholder="0,00"
                                    />
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {[100, 300, 500, 1000].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setAmount(val)}
                                            className="px-3 py-1 rounded-lg bg-surfaceHighlight text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
                                        >
                                            R$ {val}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-2 block">Deseja parcelar em quantas vezes?</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max="36"
                                        value={months}
                                        onChange={(e) => setMonths(Math.max(1, Number(e.target.value)))}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-4 px-4 text-white text-lg font-bold focus:border-primary-500 outline-none transition"
                                        placeholder="Meses"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">meses</span>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {[1, 3, 6, 12, 24].map(val => (
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
                                        <span className="text-white font-medium">{amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500">Taxa de Manutenção (20%)</span>
                                        <span className="text-red-400 font-medium">{(totalRepay - amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500">Valor da Reposição</span>
                                        <span className="text-primary-400 font-medium">{monthlyPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="h-px bg-zinc-800 my-2"></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-zinc-400 text-sm">Total a Repor</span>
                                        <span className="text-xl font-bold text-white">{totalRepay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => onRequest(amount, months)}
                                disabled={!amount || amount <= 0 || creditLimit?.totalLimit === 0}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl mt-6 transition shadow-lg shadow-emerald-500/20"
                            >
                                {creditLimit?.totalLimit === 0 ? 'Ajuda Indisponível' : 'Solicitar Apoio Mútuo'}
                            </button>

                            {/* AdBanner removido para limpeza de UI */}
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Loans List */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-white pl-1">Seus Compromissos Sociais</h3>

                {activeLoans.length === 0 && (
                    <div className="text-center py-12 bg-surface/50 rounded-3xl border border-surfaceHighlight border-dashed">
                        <p className="text-zinc-500">Nenhum apoio mútuo ativo no momento.</p>
                    </div>
                )}

                {activeLoans.map(loan => {
                    const daysUntilDue = loan.dueDate ? Math.ceil((new Date(loan.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                    const isOverdue = daysUntilDue < 0;
                    const isUrgent = daysUntilDue <= 3 && daysUntilDue >= 0;
                    void isUrgent;

                    const paidAmount = loan.totalPaid || 0;
                    const remainingAmount = loan.remainingAmount || loan.totalRepayment;
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
                                        <h4 className="font-bold text-white text-lg">{loan.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${loan.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                                loan.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400' :
                                                    'bg-zinc-800 text-zinc-400'
                                                }`}>
                                                {loan.status === 'APPROVED' ? 'Aprovado' : loan.status === 'PENDING' ? 'Em Análise' : loan.status}
                                            </span>
                                            {isOverdue && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={10} /> Atrasado</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-xs text-zinc-400">Restante</p>
                                    <p className="font-bold text-white">{remainingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
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
                            Você está prestes a repor o valor total de <strong className="text-white">{selectedLoan.totalRepayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> para a cooperativa.
                        </p>

                        <div className="space-y-4">
                            <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-3 flex items-center gap-3">
                                <QrCode size={20} className="text-primary-400" />
                                <div>
                                    <p className="text-xs font-bold text-primary-400">Pagamento via PIX Manual</p>
                                    <p className="text-[10px] text-zinc-500">Transferência para chave PIX do administrador</p>
                                </div>
                            </div>

                            <div className="bg-background p-3 rounded-xl border border-surfaceHighlight">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-zinc-400">Seu Saldo</span>
                                    <span className="text-white font-bold">{userBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => { onPay(selectedLoan.id, true); setPayModalId(null); }}
                                disabled={userBalance < selectedLoan.totalRepayment}
                                className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl mb-2 transition shadow-lg shadow-primary-500/20"
                            >
                                {userBalance < selectedLoan.totalRepayment ? 'Saldo Insuficiente' : 'Pagar com Saldo'}
                            </button>

                            <button
                                onClick={() => { onPay(selectedLoan.id, false, 'pix'); setPayModalId(null); }}
                                className="w-full font-black py-4 rounded-xl transition shadow-lg bg-emerald-500 text-white shadow-emerald-500/20"
                            >
                                Gerar PIX de Reposição
                            </button>

                            <p className="text-[9px] text-zinc-600 text-center mt-4 leading-relaxed">
                                O valor será transferido via PIX para o administrador. Após confirmação, o saldo será atualizado automaticamente.
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
                            Valor da parcela: <strong className="text-white">{installmentModalData.installmentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                        </p>

                        <div className="space-y-4">
                            <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-3 flex items-center gap-3">
                                <QrCode size={20} className="text-primary-400" />
                                <div>
                                    <p className="text-xs font-bold text-primary-400">Pagamento via PIX Manual</p>
                                    <p className="text-[10px] text-zinc-500">Transferência para chave PIX do administrador</p>
                                </div>
                            </div>

                            <div className="bg-background p-3 rounded-xl border border-surfaceHighlight">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-zinc-400">Seu Saldo</span>
                                    <span className="text-white font-bold">{userBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    onPayInstallment(installmentModalData.loanId, installmentModalData.installmentAmount, true);
                                    setInstallmentModalData(null);
                                }}
                                disabled={userBalance < installmentModalData.installmentAmount}
                                className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl mb-2 transition shadow-lg shadow-primary-500/20"
                            >
                                {userBalance < installmentModalData.installmentAmount ? 'Saldo Insuficiente' : 'Pagar com Saldo'}
                            </button>

                            <button
                                onClick={() => {
                                    onPayInstallment(installmentModalData.loanId, installmentModalData.installmentAmount, false, 'pix');
                                    setInstallmentModalData(null);
                                }}
                                className="w-full font-black py-4 rounded-xl transition shadow-lg bg-emerald-500 text-white shadow-emerald-500/20"
                            >
                                Gerar PIX da Parcela
                            </button>

                            <p className="text-[9px] text-zinc-600 text-center mt-4 leading-relaxed">
                                O valor será transferido via PIX para o administrador. Após confirmação, seu compromisso será atualizado.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            {/* Legal Disclaimer */}
            <div className="mt-8 px-4 text-[10px] text-zinc-600 text-center leading-relaxed">
                <p>As ajudas mútuas estão sujeitas à análise de Score e disponibilidade de caixa do Clube. Os apoios são lastreados por execução de garantia sobre licenças ativas no sistema. Em caso de atraso superior a 5 dias, o lastro será executado automaticamente conforme Termos de Uso (SCP/Mútuo Civil).</p>
            </div>
        </div>
    );
};
