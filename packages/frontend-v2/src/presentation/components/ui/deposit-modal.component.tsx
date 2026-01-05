import React, { useState } from 'react';
import { X, ArrowDownLeft, DollarSign } from 'lucide-react';

interface DepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (amount: number) => void;
    isLoading?: boolean;
}

export const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose, onConfirm, isLoading }) => {
    const [amount, setAmount] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const value = parseFloat(amount.replace(',', '.'));
        if (isNaN(value) || value < 1) return;
        onConfirm(value);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-[500] p-0 sm:p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div
                className="bg-[#0A0A0A] border-t sm:border border-white/5 sm:border-zinc-800 rounded-t-[2.5rem] sm:rounded-3xl p-6 sm:p-8 w-full sm:max-w-md relative animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 sm:duration-300"
                onClick={e => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden opacity-50" />

                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-400 mx-auto mb-4 border border-primary-500/20 shadow-xl shadow-primary-900/10">
                        <ArrowDownLeft size={32} />
                    </div>
                    <h3 className="text-xl font-black text-white tracking-tight">Depositar Saldo</h3>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Adicionar fundos à sua conta</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] ml-1">Valor do Depósito</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400 font-bold">R$</div>
                            <input
                                autoFocus
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 focus:border-primary-500/50 rounded-2xl pl-12 pr-6 py-5 text-2xl font-black text-white outline-none transition-all placeholder:text-zinc-800"
                            />
                        </div>
                        <p className="text-[10px] text-zinc-600 font-bold ml-1 italic">* Valor mínimo: R$ 1,00</p>
                    </div>

                    <div className="bg-primary-500/5 border border-primary-500/10 rounded-2xl p-4 flex gap-4 items-start">
                        <div className="p-2 bg-primary-500/10 rounded-lg text-primary-400">
                            <DollarSign size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] text-primary-400 font-black uppercase tracking-widest mb-1">Pagamento via PIX</p>
                            <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">Após confirmar, um QR Code será gerado para você realizar o pagamento instantaneamente.</p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !amount || parseFloat(amount.replace(',', '.')) < 1}
                        className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:hover:bg-primary-500 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-primary-500/10 flex items-center justify-center gap-2 group active:scale-[0.98]"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                            <>
                                GERAR PIX DE DEPÓSITO
                            </>
                        )}
                    </button>

                    <p className="text-center text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                        Ambiente Seguro & Criptografado
                    </p>
                </form>
            </div>
        </div>
    );
};
