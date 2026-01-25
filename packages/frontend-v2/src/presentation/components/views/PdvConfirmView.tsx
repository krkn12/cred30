import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    Store,
    Lock,
    Clock,
    CheckCircle,
    Loader2,
    AlertTriangle,
    CreditCard,
    DollarSign
} from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface PdvConfirmViewProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const PdvConfirmView = ({ onSuccess, onError }: PdvConfirmViewProps) => {
    const { chargeId } = useParams<{ chargeId: string }>();
    const [isLoading, setIsLoading] = useState(true);
    const [chargeData, setChargeData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [isConfirming, setIsConfirming] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [confirmed, setConfirmed] = useState(false);

    // Buscar detalhes da cobrança
    const fetchChargeDetails = useCallback(async () => {
        if (!chargeId) {
            setError('ID da cobrança não informado.');
            setIsLoading(false);
            return;
        }

        try {
            const res = await apiService.get<any>(`/pdv/charge/${chargeId}`);
            if (res.success) {
                setChargeData(res.data);
                setCountdown(res.data.remainingSeconds);
            } else {
                setError(res.message);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar cobrança');
        } finally {
            setIsLoading(false);
        }
    }, [chargeId]);

    useEffect(() => {
        fetchChargeDetails();
    }, [fetchChargeDetails]);

    // Countdown
    useEffect(() => {
        if (countdown > 0 && !confirmed) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0 && chargeData && !confirmed) {
            setError('O código expirou. Peça ao comerciante para gerar uma nova cobrança.');
        }
    }, [countdown, chargeData, confirmed]);

    // Confirmar pagamento
    const handleConfirm = async () => {
        if (!password) {
            onError('Senha obrigatória', 'Digite sua senha Cred30 para confirmar.');
            return;
        }

        setIsConfirming(true);
        try {
            const res = await apiService.post<any>('/pdv/confirm-charge', {
                customerId: chargeData.customerId,
                password,
                confirmationCode: chargeData.confirmationCode
            });

            if (res.success) {
                setConfirmed(true);
                onSuccess('Pagamento Confirmado! ✅', res.message);
            } else {
                onError('Erro', res.message);
            }
        } catch (err: any) {
            onError('Erro', err.message || 'Erro ao confirmar');
        } finally {
            setIsConfirming(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Loading
    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="animate-spin text-primary-400" size={48} />
            </div>
        );
    }

    // Erro
    if (error) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle size={40} className="text-red-400" />
                    </div>
                    <h2 className="text-xl font-black text-white mb-2">Ops!</h2>
                    <p className="text-zinc-400">{error}</p>
                </div>
            </div>
        );
    }

    // Confirmado com sucesso
    if (confirmed) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                        <CheckCircle size={48} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">Pagamento Confirmado!</h2>
                    <p className="text-zinc-400 mb-4">
                        {chargeData.paymentType === 'CREDIT'
                            ? `Compra de ${formatCurrency(chargeData.amount)} parcelada em ${chargeData.installments}x`
                            : `Pagamento de ${formatCurrency(chargeData.amount)} realizado`}
                    </p>
                    <p className="text-emerald-400 font-bold">{chargeData.merchantName}</p>
                </div>
            </div>
        );
    }

    // Tela de confirmação
    return (
        <div className="min-h-screen bg-black px-4 py-8 pb-20">
            {/* Header */}
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-primary-500/30">
                    <Store size={32} className="text-black" />
                </div>
                <h1 className="text-xl font-black text-white">CONFIRMAR PAGAMENTO</h1>
                <p className="text-zinc-500 text-xs mt-1">Verifique os dados e confirme</p>
            </div>

            {/* Timer */}
            <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-full mx-auto w-fit mb-6 ${countdown < 60 ? 'bg-red-500/20 text-red-400' : 'bg-zinc-900 text-zinc-400'}`}>
                <Clock size={16} />
                <span className="font-mono font-bold">{formatTime(countdown)}</span>
            </div>

            {/* Dados do Comerciante */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4">
                <div className="text-center mb-4">
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Estabelecimento</p>
                    <p className="text-xl font-black text-white mt-1">{chargeData.merchantName}</p>
                </div>

                {chargeData.description && (
                    <div className="text-center border-t border-zinc-800 pt-3">
                        <p className="text-zinc-500 text-xs">{chargeData.description}</p>
                    </div>
                )}
            </div>

            {/* Valor e Forma de Pagamento */}
            <div className="bg-gradient-to-br from-primary-500/10 to-primary-600/5 border border-primary-500/30 rounded-2xl p-5 mb-4">
                <div className="text-center">
                    <p className="text-primary-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                        {chargeData.paymentType === 'CREDIT' ? 'Valor Parcelado' : 'Valor à Vista'}
                    </p>
                    <p className="text-4xl font-black text-white">{formatCurrency(chargeData.amount)}</p>

                    {chargeData.paymentType === 'CREDIT' && chargeData.installments > 1 && (
                        <div className="mt-3 flex items-center justify-center gap-2">
                            <CreditCard size={16} className="text-primary-400" />
                            <span className="text-primary-400 font-bold">
                                {chargeData.installments}x de {formatCurrency(chargeData.installmentValue)}
                            </span>
                        </div>
                    )}

                    {chargeData.paymentType === 'BALANCE' && (
                        <div className="mt-3 flex items-center justify-center gap-2">
                            <DollarSign size={16} className="text-emerald-400" />
                            <span className="text-emerald-400 font-bold">Pagamento com Saldo</span>
                        </div>
                    )}
                </div>

                {chargeData.interestRate > 0 && (
                    <div className="mt-3 text-center border-t border-primary-500/20 pt-3">
                        <p className="text-zinc-400 text-xs">
                            Total com Taxa de Manutenção: <span className="text-white font-bold">{formatCurrency(chargeData.totalWithInterest)}</span>
                            <span className="text-zinc-500"> (+{chargeData.interestRate.toFixed(0)}%)</span>
                        </p>
                    </div>
                )}
            </div>

            {/* Código de Presença */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest text-center mb-2">
                    Código de Confirmação (Presença)
                </p>
                <p className="text-3xl font-mono font-black text-white text-center tracking-[0.2em]">
                    {chargeData.confirmationCode}
                </p>
                <p className="text-zinc-600 text-[10px] text-center mt-2">
                    Este código prova que você está no estabelecimento
                </p>
            </div>

            {/* Campo de Senha */}
            <div className="space-y-4">
                <div>
                    <label className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2 block">
                        <Lock size={12} className="inline mr-1" />
                        Sua Senha Cred30
                    </label>
                    <input
                        type="password"
                        placeholder="Digite sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white font-medium focus:outline-none focus:border-primary-500 text-center text-lg"
                        autoFocus
                    />
                </div>

                <button
                    onClick={handleConfirm}
                    disabled={isConfirming || !password || countdown === 0}
                    className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/20"
                >
                    {isConfirming ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                    {isConfirming ? 'CONFIRMANDO...' : 'CONFIRMAR PAGAMENTO'}
                </button>
            </div>

            {/* Aviso de Segurança */}
            <div className="mt-6 text-center">
                <p className="text-zinc-600 text-[10px]">
                    🔒 Sua senha é criptografada e nunca é compartilhada
                </p>
            </div>
        </div>
    );
};
