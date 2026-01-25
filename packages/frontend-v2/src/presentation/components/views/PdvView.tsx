import { useState, useCallback, useEffect } from 'react';
import {
    Store,
    Search,
    User,
    DollarSign,
    Lock,
    CheckCircle,
    XCircle,
    Loader2,
    ArrowLeft,
    Clock,
    AlertTriangle,
    ShieldCheck,
    History,
    CreditCard,
    Percent,
    Share2,
    Copy
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiService } from '../../../application/services/api.service';
import { AppState } from '../../../domain/types/common.types';

interface PdvViewProps {
    state: AppState;
    onRefresh: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const PdvView = ({ onRefresh, onSuccess, onError }: PdvViewProps) => {
    const [view, setView] = useState<'menu' | 'charge' | 'confirm' | 'history'>('menu');
    const [isLoading, setIsLoading] = useState(false);

    // Estados do fluxo de cobrança
    const [customerSearch, setCustomerSearch] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [installments, setInstallments] = useState(1);
    const [creditSimulation, setCreditSimulation] = useState<any>(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [description, setDescription] = useState('');

    // Estados da cobrança criada
    const [chargeData, setChargeData] = useState<any>(null);
    const [countdown, setCountdown] = useState(300); // 5 minutos

    // Estados da confirmação do cliente
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmCode, setConfirmCode] = useState('');

    // Histórico de vendas
    const [sales, setSales] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);

    // Buscar cliente
    const searchCustomer = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const res = await apiService.get<any>(`/pdv/search-customer?q=${encodeURIComponent(query)}`);
            if (res.success) {
                setSearchResults(res.data);
            }
        } catch (error) {
            console.error('Erro ao buscar cliente:', error);
        }
    }, []);

    // Simular crédito para cliente
    const simulateCredit = useCallback(async (custId: string, amt: number) => {
        if (!custId || amt < 10) {
            setCreditSimulation(null);
            return;
        }
        setIsSimulating(true);
        try {
            const res = await apiService.get<any>(`/pdv/simulate-credit?customerId=${custId}&amount=${amt}`);
            if (res.success) {
                setCreditSimulation(res.data);
            } else {
                setCreditSimulation({ eligible: false, reason: res.message });
            }
        } catch (error: any) {
            setCreditSimulation({ eligible: false, reason: error.message });
        } finally {
            setIsSimulating(false);
        }
    }, []);

    // Criar cobrança
    const handleCreateCharge = async () => {
        if (!selectedCustomer || !amount) {
            onError('Campos obrigatórios', 'Selecione um cliente e informe o valor.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await apiService.post<any>('/pdv/create-charge', {
                customerId: selectedCustomer.id,
                amount: parseFloat(amount),
                description,
                installments,
                guaranteePercentage: 100 // Sempre 100% para menor juros
            });

            if (res.success) {
                setChargeData(res.data);
                setCountdown(300);
                setView('confirm');
                const msg = installments > 1
                    ? `Cobrança parcelada em ${installments}x criada!`
                    : 'Cobrança criada!';
                onSuccess('Cobrança Criada', msg);
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Confirmar cobrança (cliente)
    const handleConfirmCharge = async () => {
        if (!confirmPassword || !confirmCode) {
            onError('Campos obrigatórios', 'Digite sua senha e o código de confirmação.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await apiService.post<any>('/pdv/confirm-charge', {
                customerId: selectedCustomer.id,
                password: confirmPassword,
                confirmationCode: confirmCode
            });

            if (res.success) {
                onSuccess('Pagamento Confirmado! ✅', res.message);
                resetForm();
                setView('menu');
                onRefresh();
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Buscar histórico
    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await apiService.get<any>('/pdv/my-sales');
            if (res.success) {
                setSales(res.data.sales);
                setSummary(res.data.summary);
            }
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Countdown do código
    useEffect(() => {
        if (view === 'confirm' && countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0 && view === 'confirm') {
            onError('Código Expirado', 'O código expirou. Crie uma nova cobrança.');
            resetForm();
            setView('menu');
        }
    }, [countdown, view]);

    const resetForm = () => {
        setCustomerSearch('');
        setSearchResults([]);
        setSelectedCustomer(null);
        setAmount('');
        setDescription('');
        setChargeData(null);
        setConfirmPassword('');
        setConfirmCode('');
        setInstallments(1);
        setCreditSimulation(null);
    };

    // Efeito para simular crédito quando cliente e valor mudam
    useEffect(() => {
        if (selectedCustomer && amount && parseFloat(amount) >= 10) {
            const timeout = setTimeout(() => {
                simulateCredit(selectedCustomer.id, parseFloat(amount));
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [selectedCustomer, amount, simulateCredit]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Menu Principal
    if (view === 'menu') {
        return (
            <div className="space-y-6 px-4 sm:px-6 pb-12">
                <div className="text-center pt-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-primary-500/30">
                        <Store size={40} className="text-black" />
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">MINHA LOJA</h2>
                    <p className="text-zinc-500 text-xs font-medium mt-1">Sistema PDV Cred30</p>
                </div>

                {/* Resumo Rápido */}
                {summary && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Hoje</p>
                            <p className="text-xl font-black text-primary-400 mt-1">{formatCurrency(summary.todayReceived)}</p>
                        </div>
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Total</p>
                            <p className="text-xl font-black text-white mt-1">{formatCurrency(summary.totalReceived)}</p>
                        </div>
                    </div>
                )}

                {/* Botões de Ação */}
                <div className="space-y-4">
                    <button
                        onClick={() => setView('charge')}
                        className="w-full bg-gradient-to-r from-primary-500 to-primary-400 text-black py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-primary-500/20 hover:shadow-primary-500/40 transition-all active:scale-[0.98]"
                    >
                        <DollarSign size={24} />
                        COBRAR CLIENTE
                    </button>

                    <button
                        onClick={() => { setView('history'); fetchHistory(); }}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all"
                    >
                        <History size={20} />
                        Histórico de Vendas
                    </button>
                </div>

                {/* Info */}
                <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <ShieldCheck size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-emerald-400 font-bold text-sm">Pagamento Seguro</p>
                        <p className="text-zinc-400 text-xs mt-1">O cliente confirma com senha + código. Taxa de 3,5% por transação.</p>
                    </div>
                </div>
            </div>
        );
    }

    // Tela de Criar Cobrança
    if (view === 'charge') {
        return (
            <div className="space-y-6 px-4 sm:px-6 pb-12">
                <div className="flex items-center gap-3">
                    <button onClick={() => { resetForm(); setView('menu'); }} className="p-2 -ml-2 hover:bg-zinc-800 rounded-xl transition">
                        <ArrowLeft size={20} className="text-zinc-400" />
                    </button>
                    <h2 className="text-xl font-black text-white tracking-tight">Nova Cobrança</h2>
                </div>

                {/* Buscar Cliente */}
                <div className="space-y-3">
                    <label className="text-zinc-400 text-xs font-bold uppercase tracking-widest">1. Buscar Cliente</label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                        <input
                            type="text"
                            placeholder="ID, CPF ou Email do cliente..."
                            value={customerSearch}
                            onChange={(e) => { setCustomerSearch(e.target.value); searchCustomer(e.target.value); }}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white font-medium focus:outline-none focus:border-primary-500"
                        />
                    </div>

                    {/* Resultados da busca */}
                    {searchResults.length > 0 && !selectedCustomer && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                            {searchResults.map((customer) => (
                                <button
                                    key={customer.id}
                                    onClick={() => { setSelectedCustomer(customer); setSearchResults([]); }}
                                    className="w-full flex items-center gap-3 p-4 hover:bg-zinc-800 transition text-left border-b border-zinc-800 last:border-b-0"
                                >
                                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                                        <User size={18} className="text-zinc-500" />
                                    </div>
                                    <div>
                                        <p className="text-white font-bold">{customer.name}</p>
                                        <p className="text-zinc-500 text-xs">ID: {customer.id} • {customer.cpf || customer.email}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Cliente selecionado */}
                    {selectedCustomer && (
                        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckCircle size={20} className="text-emerald-400" />
                                <div>
                                    <p className="text-white font-bold">{selectedCustomer.name}</p>
                                    <p className="text-zinc-400 text-xs">ID: {selectedCustomer.id}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedCustomer(null)} className="text-zinc-500 hover:text-white">
                                <XCircle size={20} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Valor */}
                <div className="space-y-3">
                    <label className="text-zinc-400 text-xs font-bold uppercase tracking-widest">2. Valor da Cobrança</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400 font-black text-lg">R$</span>
                        <input
                            type="number"
                            placeholder="0,00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-14 pr-4 py-5 text-white font-black text-2xl focus:outline-none focus:border-primary-500"
                        />
                    </div>
                </div>

                {/* Descrição (opcional) */}
                <div className="space-y-3">
                    <label className="text-zinc-400 text-xs font-bold uppercase tracking-widest">3. Descrição (Opcional)</label>
                    <input
                        type="text"
                        placeholder="Ex: Compra de produtos..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white font-medium focus:outline-none focus:border-primary-500"
                    />
                </div>

                {/* Parcelamento - só mostra se tiver simulação */}
                {creditSimulation?.eligible && (
                    <div className="space-y-3">
                        <label className="text-zinc-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <CreditCard size={14} />
                            4. Forma de Pagamento
                        </label>

                        {/* Seletor de parcelas */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {[1, 2, 3, 4, 6, 8, 10, 12].map((i) => {
                                const option = creditSimulation.installmentOptions?.find((o: any) => o.installments === i);
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setInstallments(i)}
                                        className={`p-3 rounded-xl text-center transition-all ${installments === i
                                            ? 'bg-primary-500 text-black'
                                            : 'bg-zinc-900 border border-zinc-800 text-white hover:border-zinc-700'
                                            }`}
                                    >
                                        <p className="font-black text-sm">{i}x</p>
                                        {option && i > 1 && (
                                            <p className="text-[9px] opacity-70">+{option.interestRate.toFixed(0)}%</p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Info sobre limite */}
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-3 flex items-start gap-2">
                            <Percent size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="text-xs">
                                <p className="text-blue-400 font-bold">Limite do cliente: {formatCurrency(creditSimulation.remainingLimit)}</p>
                                <p className="text-zinc-400">Taxa de Manutenção de 10% (100% garantia em cotas)</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Aviso se cliente não tem crédito */}
                {selectedCustomer && amount && parseFloat(amount) >= 10 && creditSimulation && !creditSimulation.eligible && (
                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
                        <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-xs">
                            <p className="text-amber-400 font-bold">Parcelamento indisponível</p>
                            <p className="text-zinc-400">{creditSimulation.reason || 'Cliente precisa ter cotas para parcelar.'}</p>
                        </div>
                    </div>
                )}

                {/* Loading simulação */}
                {isSimulating && (
                    <div className="flex items-center justify-center gap-2 text-zinc-500 py-2">
                        <Loader2 className="animate-spin" size={16} />
                        <span className="text-xs">Verificando crédito...</span>
                    </div>
                )}

                {/* Resumo */}
                {amount && parseFloat(amount) > 0 && (
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Valor da compra:</span>
                            <span className="text-white font-bold">{formatCurrency(parseFloat(amount))}</span>
                        </div>

                        {/* Se parcelado, mostrar juros */}
                        {installments > 1 && creditSimulation?.installmentOptions && (
                            <>
                                <div className="flex justify-between text-sm">
                                    <span className="text-zinc-500">Taxa de Manutenção ({creditSimulation.installmentOptions.find((o: any) => o.installments === installments)?.interestRate.toFixed(0)}%):</span>
                                    <span className="text-amber-400 font-bold">
                                        +{formatCurrency(parseFloat(amount) * 0.10)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-zinc-500">Cliente paga:</span>
                                    <span className="text-white font-bold">
                                        {installments}x de {formatCurrency((parseFloat(amount) * 1.10) / installments)}
                                    </span>
                                </div>
                            </>
                        )}

                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Taxa PDV (3,5%):</span>
                            <span className="text-red-400 font-bold">-{formatCurrency(parseFloat(amount) * 0.035)}</span>
                        </div>
                        <div className="border-t border-zinc-800 pt-2 flex justify-between">
                            <span className="text-zinc-400 font-bold">Você recebe:</span>
                            <span className="text-primary-400 font-black text-lg">{formatCurrency(parseFloat(amount) * 0.965)}</span>
                        </div>

                        {installments > 1 && (
                            <p className="text-zinc-500 text-[10px] text-center pt-1">
                                ⚡ Você recebe à vista! Cliente paga parcelado ao Cred30.
                            </p>
                        )}
                    </div>
                )}

                {/* Botão Criar Cobrança */}
                <button
                    onClick={handleCreateCharge}
                    disabled={!selectedCustomer || !amount || isLoading || (installments > 1 && !creditSimulation?.eligible)}
                    className="w-full bg-gradient-to-r from-primary-500 to-primary-400 text-black py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : installments > 1 ? <CreditCard size={20} /> : <DollarSign size={20} />}
                    {isLoading ? 'CRIANDO...' : installments > 1 ? `COBRAR ${installments}X NO CRÉDITO` : 'GERAR CÓDIGO DE COBRANÇA'}
                </button>
            </div>
        );
    }

    // Tela de Confirmação (Cliente)
    if (view === 'confirm' && chargeData) {
        return (
            <div className="space-y-6 px-4 sm:px-6 pb-12 min-h-screen">
                {/* Header */}
                <div className="text-center pt-6">
                    <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Lock size={32} className="text-black" />
                    </div>
                    <h2 className="text-xl font-black text-white">CONFIRMAR PAGAMENTO</h2>
                    <p className="text-zinc-500 text-xs mt-1">Mostre esta tela para o cliente</p>
                </div>

                {/* Timer */}
                <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-full mx-auto w-fit ${countdown < 60 ? 'bg-red-500/20 text-red-400' : 'bg-zinc-900 text-zinc-400'}`}>
                    <Clock size={16} />
                    <span className="font-mono font-bold">{formatTime(countdown)}</span>
                </div>

                {/* Dados da Cobrança */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <div className="text-center">
                        <p className="text-zinc-500 text-xs font-bold uppercase">Valor a Pagar</p>
                        <p className="text-4xl font-black text-white mt-2">{formatCurrency(chargeData.amount)}</p>
                    </div>

                    <div className="border-t border-zinc-800 pt-4 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Para:</span>
                            <span className="text-white font-bold">{chargeData.merchant.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Cliente:</span>
                            <span className="text-white font-bold">{chargeData.customer.name}</span>
                        </div>
                    </div>
                </div>

                {/* QR Code e Código de Confirmação */}
                <div className="bg-white rounded-2xl p-6 text-center space-y-4">
                    <div className="flex justify-center">
                        <QRCodeSVG
                            value={`${window.location.origin}/app/pdv-confirm/${chargeData.chargeId}`}
                            size={180}
                            level="H"
                            includeMargin
                        />
                    </div>

                    <div className="border-t border-zinc-200 pt-4">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">Código da Transação</p>
                        <p className="text-4xl font-mono font-black text-black tracking-[0.3em]">{chargeData.confirmationCode}</p>
                    </div>
                </div>

                {/* Opções de Compartilhamento */}
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            const link = `${window.location.origin}/app/pdv-confirm/${chargeData.chargeId}`;
                            navigator.clipboard.writeText(link);
                            onSuccess('Link copiado!', 'Envie para o cliente confirmar.');
                        }}
                        className="flex-1 bg-zinc-900 border border-zinc-800 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-800 transition"
                    >
                        <Copy size={16} /> Link p/ Cliente
                    </button>
                    {navigator.share && (
                        <button
                            onClick={() => {
                                const link = `${window.location.origin}/app/pdv-confirm/${chargeData.chargeId}`;
                                navigator.share({
                                    title: 'Confirme seu pagamento Cred30',
                                    text: `Confirme o pagamento de ${formatCurrency(chargeData.amount)} para ${chargeData.merchant.name}`,
                                    url: link
                                }).catch(() => { });
                            }}
                            className="flex-1 bg-zinc-900 border border-zinc-800 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-800 transition"
                        >
                            <Share2 size={16} /> Enviar
                        </button>
                    )}
                </div>

                {/* Formulário do Cliente */}
                <div className="space-y-4 pt-4">
                    <p className="text-center text-zinc-400 text-sm font-bold">👤 CLIENTE: Digite abaixo</p>

                    <div className="space-y-3">
                        <input
                            type="password"
                            placeholder="Sua Senha Cred30"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white font-medium focus:outline-none focus:border-primary-500 text-center text-lg"
                        />
                        <input
                            type="text"
                            placeholder="Código da Transação (acima)"
                            value={confirmCode}
                            onChange={(e) => setConfirmCode(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white font-mono font-bold focus:outline-none focus:border-primary-500 text-center text-2xl tracking-widest"
                            maxLength={6}
                        />
                    </div>

                    <button
                        onClick={handleConfirmCharge}
                        disabled={isLoading || !confirmPassword || confirmCode.length < 6}
                        className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                        {isLoading ? 'CONFIRMANDO...' : 'CONFIRMAR PAGAMENTO AGORA'}
                    </button>

                    <p className="text-center text-zinc-500 text-[10px]">
                        Ou peça para o cliente escanear o QR Code acima
                    </p>

                    <button
                        onClick={() => { resetForm(); setView('menu'); }}
                        className="w-full text-zinc-500 py-3 text-xs font-bold uppercase tracking-widest"
                    >
                        Cancelar e Voltar
                    </button>
                </div>
            </div>
        );
    }

    // Histórico de Vendas
    if (view === 'history') {
        return (
            <div className="space-y-6 px-4 sm:px-6 pb-12">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView('menu')} className="p-2 -ml-2 hover:bg-zinc-800 rounded-xl transition">
                        <ArrowLeft size={20} className="text-zinc-400" />
                    </button>
                    <h2 className="text-xl font-black text-white tracking-tight">Histórico de Vendas</h2>
                </div>

                {/* Resumo */}
                {summary && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-center">
                            <p className="text-zinc-500 text-[9px] font-bold uppercase">Vendas</p>
                            <p className="text-lg font-black text-white">{summary.totalSales}</p>
                        </div>
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-center">
                            <p className="text-zinc-500 text-[9px] font-bold uppercase">Hoje</p>
                            <p className="text-lg font-black text-primary-400">{formatCurrency(summary.todayReceived)}</p>
                        </div>
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-center">
                            <p className="text-zinc-500 text-[9px] font-bold uppercase">Total</p>
                            <p className="text-lg font-black text-emerald-400">{formatCurrency(summary.totalReceived)}</p>
                        </div>
                    </div>
                )}

                {/* Lista de Vendas */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-primary-400" size={32} />
                    </div>
                ) : sales.length === 0 ? (
                    <div className="text-center py-12">
                        <History size={48} className="text-zinc-800 mx-auto mb-4" />
                        <p className="text-zinc-500">Nenhuma venda realizada ainda.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sales.map((sale) => (
                            <div key={sale.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-bold">{sale.customerName}</p>
                                        <p className="text-zinc-500 text-xs">
                                            {new Date(sale.createdAt).toLocaleDateString('pt-BR')} às{' '}
                                            {new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-black ${sale.status === 'COMPLETED' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                            {formatCurrency(sale.netAmount)}
                                        </p>
                                        <p className={`text-[9px] font-bold uppercase ${sale.status === 'COMPLETED' ? 'text-emerald-400' :
                                            sale.status === 'PENDING' ? 'text-yellow-400' : 'text-red-400'
                                            }`}>
                                            {sale.status === 'COMPLETED' ? 'Aprovado' :
                                                sale.status === 'PENDING' ? 'Pendente' : 'Cancelado'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return null;
};
