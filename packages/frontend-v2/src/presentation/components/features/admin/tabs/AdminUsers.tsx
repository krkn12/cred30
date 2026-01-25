import React, { useState } from 'react';
import { Gift, Shield, Zap } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';
import { AdminUserManagement } from '../AdminUserManagement';

interface AdminUsersProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({ onSuccess, onError }) => {
    const [giftEmail, setGiftEmail] = useState('');
    const [giftQuantity, setGiftQuantity] = useState('');
    const [giftReason, setGiftReason] = useState('');

    const [depositEmail, setDepositEmail] = useState('');
    const [depositAmount, setDepositAmount] = useState('');
    const [depositReason, setDepositReason] = useState('');

    const [loanUserId, setLoanUserId] = useState('');
    const [loanAmount, setLoanAmount] = useState('');
    const [loanInterest, setLoanInterest] = useState('20');
    const [loanInstallments, setLoanInstallments] = useState('12');

    const handleGiftQuota = async () => {
        if (!giftEmail || !giftQuantity) return;
        if (!window.confirm(`CONFIRMAÇÃO: Enviar ${giftQuantity} participações para ${giftEmail}? Esta ação criará as participações e não cobrará do usuário.`)) return;

        try {
            const response = await apiService.post<any>('/admin/users/add-quota', {
                email: giftEmail,
                quantity: parseInt(giftQuantity),
                reason: giftReason
            });
            if (response.success) {
                onSuccess('Envio Realizado!', response.message);
                setGiftEmail('');
                setGiftQuantity('');
                setGiftReason('');
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleDepositBalance = async () => {
        if (!depositEmail || !depositAmount) return;
        if (!window.confirm(`CONFIRMAÇÃO CRÍTICA (FINANCEIRO): Adicionar R$ ${depositAmount} para ${depositEmail}? Esta ação criará dinheiro novo no sistema.`)) return;

        try {
            const response = await apiService.adminAddBalance(depositEmail, parseFloat(depositAmount), depositReason);
            if (response.success) {
                onSuccess('Depósito Realizado!', response.message);
                setDepositEmail('');
                setDepositAmount('');
                setDepositReason('');
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleCreateManualLoan = async () => {
        if (!loanUserId || !loanAmount || !loanInterest || !loanInstallments) return;
        if (!window.confirm(`CONFIRMAÇÃO CRÍTICA (APOIO MÚTUO MANUAL): Criar apoio mútuo de R$ ${loanAmount} para o Usuário ID ${loanUserId}?`)) return;

        try {
            const response = await apiService.post<any>('/admin/users/create-manual-loan', {
                userId: parseInt(loanUserId),
                amount: parseFloat(loanAmount),
                interestRate: parseFloat(loanInterest),
                installments: parseInt(loanInstallments)
            });
            if (response.success) {
                onSuccess('Apoio Mútuo Liberado!', response.message);
                setLoanUserId('');
                setLoanAmount('');
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    return (
        <div className="space-y-8">
            <AdminUserManagement onSuccess={onSuccess} onError={onError} />

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto opacity-50 hover:opacity-100 transition-opacity">
                <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg"><Gift className="text-purple-400" size={20} /></div>
                    Presentear Participações (Ação Direta)
                </h3>
                <div className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email do usuário"
                        value={giftEmail}
                        onChange={(e) => setGiftEmail(e.target.value)}
                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-purple-500/50 font-bold"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="number"
                            placeholder="Quantidade"
                            value={giftQuantity}
                            onChange={(e) => setGiftQuantity(e.target.value)}
                            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-purple-500/50 font-bold"
                        />
                        <button
                            onClick={handleGiftQuota}
                            className="bg-purple-500 hover:bg-purple-400 text-black font-black px-6 py-4 rounded-2xl transition-all shadow-xl"
                        >
                            Enviar
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto opacity-50 hover:opacity-100 transition-opacity">
                <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg"><Gift className="text-emerald-400" size={20} /></div>
                    Adicionar Saldo (Depósito Direto)
                </h3>
                <div className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email do usuário"
                        value={depositEmail}
                        onChange={(e) => setDepositEmail(e.target.value)}
                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-emerald-500/50 font-bold"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="number"
                            placeholder="Valor (R$)"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-emerald-500/50 font-bold"
                        />
                        <button
                            onClick={handleDepositBalance}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-6 py-4 rounded-2xl transition-all shadow-xl"
                        >
                            Creditat
                        </button>
                    </div>
                    <input
                        type="text"
                        placeholder="Motivo (Opcional - ex: Bônus, Estorno)"
                        value={depositReason}
                        onChange={(e) => setDepositReason(e.target.value)}
                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-emerald-500/50 font-bold text-sm"
                    />
                </div>
            </div>

            <div className="bg-zinc-900 border-2 border-primary-500/20 rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto">
                <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                    <div className="p-2 bg-primary-500/10 rounded-lg"><Shield className="text-primary-400" size={20} /></div>
                    Apoio Mútuo Manual Especial (Forçar Liberação)
                </h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-black uppercase ml-1">ID do Usuário</label>
                            <input
                                type="number"
                                placeholder="ID Numérico"
                                value={loanUserId}
                                onChange={(e) => setLoanUserId(e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-bold"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-black uppercase ml-1">Valor do Apoio (R$)</label>
                            <input
                                type="number"
                                placeholder="Ex: 500.00"
                                value={loanAmount}
                                onChange={(e) => setLoanAmount(e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-bold"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-black uppercase ml-1">Taxa de Manutenção Total (%)</label>
                            <input
                                type="number"
                                placeholder="20"
                                value={loanInterest}
                                onChange={(e) => setLoanInterest(e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-bold text-center"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-black uppercase ml-1">Parcelas</label>
                            <select
                                value={loanInstallments}
                                onChange={(e) => setLoanInstallments(e.target.value)}
                                className="w-full h-[60px] bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 text-white outline-none focus:border-primary-500/50 font-bold"
                            >
                                {[1, 2, 3, 6, 12, 18, 24, 36].map(n => (
                                    <option key={n} value={n}>{n}x parcelas</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleCreateManualLoan}
                        className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black px-6 py-5 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 mt-4"
                    >
                        <Zap size={20} /> LIBERAR APOIO MÚTUO MANUAL
                    </button>
                    <p className="text-[9px] text-zinc-500 font-bold text-center uppercase tracking-widest px-4">
                        ESTA AÇÃO É IRREVERSÍVEL E DEDUZ DIRETAMENTE DA LIQUIDEZ REAL DO SISTEMA.
                    </p>
                </div>
            </div>
        </div>
    );
};
