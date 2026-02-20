import { useState, useEffect } from 'react';
import {
    Search,
    ShoppingCart,
    Trash2,
    X,
    CreditCard,
    Smartphone,
    Banknote,
    CheckCircle,
    Monitor,
    Phone,
    User,
    Wallet
} from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    barcode?: string;
    sku?: string;
}

interface CartItem extends Product {
    quantity: number;
}

interface PdvPosProps {
    onClose: () => void;
}

export const PdvPos = ({ onClose }: PdvPosProps) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'pos' | 'checkout' | 'success'>('pos');

    // Checkout State
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'CRED30_SALDO' | 'CRED30_CREDITO'>('PIX');
    const [receivedAmount, setReceivedAmount] = useState('');
    const [customerCpf, setCustomerCpf] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastSale, setLastSale] = useState<any>(null);

    // --- Cliente Cred30 ---
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerData, setCustomerData] = useState<any>(null);
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [installments, setInstallments] = useState(1);
    const [feeRate, setFeeRate] = useState(0.06);

    // Carregar produtos
    useEffect(() => {
        const loadProducts = async () => {
            try {
                const res = await apiService.get<any>('/pdv/products');
                const data = res?.data || res;
                if (data && Array.isArray(data.products)) {
                    setProducts(data.products);
                } else {
                    setProducts([]);
                }
            } catch (error) {
                console.error('Erro ao carregar produtos:', error);
            }
        };
        loadProducts();
    }, []);

    // Filter products (Nome, SKU ou Barras)
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
        (p.barcode && p.barcode.includes(search))
    );

    // Cart Actions
    const addToCart = (product: Product) => {
        setCart(prev => {
            const exists = prev.find(item => item.id === product.id);
            if (exists) {
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    // Auto-Add Logic (Scanner / Enter Manual)
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && search.trim()) {
            // Prioridade 1: Match exato por código de barras ou SKU
            const exactMatch = products.find(p =>
                p.barcode === search ||
                p.sku?.toLowerCase() === search.toLowerCase()
            );

            if (exactMatch) {
                addToCart(exactMatch);
                setSearch('');
                return;
            }

            // Prioridade 2: Se só existe 1 resultado da busca, adiciona
            if (filteredProducts.length === 1) {
                addToCart(filteredProducts[0]);
                setSearch('');
                return;
            }

            // Prioridade 3: Primeiro resultado da lista
            if (filteredProducts.length > 0) {
                addToCart(filteredProducts[0]);
                setSearch('');
            }
        }
    };

    // Adiciona ao carrinho e limpa a busca
    const handleSelectProduct = (product: Product) => {
        addToCart(product);
        setSearch('');
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const change = receivedAmount ? Math.max(0, parseFloat(receivedAmount) - total) : 0;

    // Buscar cliente Cred30 por telefone
    const handleLookupCustomer = async () => {
        if (!customerPhone || customerPhone.replace(/\D/g, '').length < 10) return;
        setIsSearchingCustomer(true);
        setCustomerData(null);
        try {
            const res = await apiService.post<any>('/pdv/customer/lookup', { phone: customerPhone });
            if (res.success && res.found) {
                setCustomerData(res.customer);
                if (res.transactionFeeRate) setFeeRate(res.transactionFeeRate);
            } else {
                setCustomerData({ notFound: true });
            }
        } catch (error) {
            console.error('Erro ao buscar cliente:', error);
            setCustomerData({ notFound: true });
        } finally {
            setIsSearchingCustomer(false);
        }
    };

    // Checkout Action
    const handleFinishSale = async () => {
        if (cart.length === 0) return;

        // Validar pagamento Cred30
        if (paymentMethod === 'CRED30_SALDO' || paymentMethod === 'CRED30_CREDITO') {
            if (!customerData || customerData.notFound) {
                alert('Busque um cliente Cred30 antes de usar esta forma de pagamento.');
                return;
            }
            if (paymentMethod === 'CRED30_SALDO' && customerData.balance < total) {
                alert(`Saldo insuficiente. Cliente tem R$ ${customerData.balance.toFixed(2)}.`);
                return;
            }
            if (paymentMethod === 'CRED30_CREDITO' && (!customerData.creditEligible || customerData.availableCredit < total)) {
                alert(`Limite de crédito insuficiente.`);
                return;
            }
        }

        setIsProcessing(true);

        try {
            const saleData = {
                items: cart.map(item => ({
                    productId: item.id,
                    productName: item.name,
                    quantity: item.quantity,
                    unitPrice: item.price
                })),
                paymentMethod,
                receivedAmount: receivedAmount ? parseFloat(receivedAmount) : total,
                customerId: customerData?.id || undefined,
                customerCpf: customerCpf || undefined,
                customerName: customerData?.name || undefined,
                installments: paymentMethod === 'CRED30_CREDITO' ? installments : 1,
                discount: 0
            };

            const res = await apiService.post<any>('/pdv/sales', saleData);

            if (res.success) {
                setLastSale(res.sale);
                setView('success');
                setCart([]);
            } else {
                alert('Erro ao finalizar venda: ' + (res.message || 'Erro desconhecido'));
            }
        } catch (error: any) {
            alert('Erro de conexão: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Customer View State
    const [isCustomerView, setIsCustomerView] = useState(false);

    // ... (lines 43-130)

    // --- CUSTOMER VIEW ---
    if (isCustomerView) {
        return (
            <div className="flex flex-col h-screen fixed inset-0 z-[60] bg-black text-white p-8">
                <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
                    <h2 className="text-4xl font-black tracking-tighter text-primary-500">RESUMO DA COMPRA</h2>
                    <button onClick={() => setIsCustomerView(false)} className="bg-zinc-800 px-6 py-3 rounded-xl font-bold uppercase text-xs hover:bg-zinc-700">
                        Fechar Tela Cliente
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-4">
                    {cart.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-xl bg-zinc-900/50 p-4 rounded-xl">
                            <div>
                                <span className="font-bold text-zinc-300">{item.quantity}x</span> {item.name}
                            </div>
                            <div className="font-bold">{formatCurrency(item.price * item.quantity)}</div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="text-center text-zinc-500 text-2xl mt-20">
                            Caixa Livre...
                        </div>
                    )}
                </div>

                <div className="mt-8 border-t border-zinc-800 pt-8">
                    <div className="flex justify-between items-end">
                        <span className="text-2xl font-bold text-zinc-400">TOTAL A PAGAR</span>
                        <span className="text-8xl font-black text-emerald-400 tracking-tighter">
                            {formatCurrency(total)}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // --- POS VIEW ---
    if (view === 'pos') {
        return (
            <div className="flex flex-col h-screen fixed inset-0 z-50 bg-zinc-950">
                {/* Header */}
                <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 -ml-2 text-zinc-400 hover:text-white">
                            <X size={24} />
                        </button>
                        <div className="font-bold text-white">PDV · CAIXA 01</div>
                    </div>

                    <button
                        onClick={() => setIsCustomerView(true)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition"
                    >
                        <Monitor size={14} /> Tela Cliente
                    </button>

                    <div className="w-8" />
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Área Principal — Frente de Caixa */}
                    <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
                        {/* Campo de Busca (estilo frente de caixa) */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                            <input
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-white font-medium text-lg focus:border-primary-500 outline-none placeholder:text-zinc-600"
                                placeholder="🔎 Código de barras, nome ou SKU..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                autoFocus
                                aria-label="Buscar produto por nome, código de barras ou SKU"
                            />

                            {/* Dropdown de sugestões — só aparece quando digita */}
                            {search.trim().length > 0 && filteredProducts.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-20 max-h-72 overflow-y-auto">
                                    {filteredProducts.map((product, idx) => (
                                        <button
                                            key={product.id}
                                            onClick={() => handleSelectProduct(product)}
                                            className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-primary-500/10 transition ${idx !== filteredProducts.length - 1 ? 'border-b border-zinc-800' : ''}`}
                                        >
                                            <div>
                                                <span className="font-bold text-white text-sm">{product.name}</span>
                                                {product.barcode && (
                                                    <span className="text-zinc-500 text-xs ml-2">COD: {product.barcode}</span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className="font-black text-primary-400">{formatCurrency(product.price)}</span>
                                                <span className="text-zinc-600 text-[10px] block">Est: {product.stock}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Nenhum resultado */}
                            {search.trim().length > 0 && filteredProducts.length === 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-20 p-4 text-center text-zinc-500 text-sm">
                                    Nenhum produto encontrado para "{search}"
                                </div>
                            )}
                        </div>

                        {/* Área central — Instrução visual quando caixa está livre */}
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 select-none">
                            <ShoppingCart size={80} strokeWidth={1} className="mb-4 opacity-30" />
                            <p className="text-lg font-bold uppercase tracking-wider opacity-40">Frente de Caixa</p>
                            <p className="text-sm opacity-30 mt-1">Escaneie ou digite o nome do produto</p>
                        </div>
                    </div>

                    {/* Carrinho (Direita/Bottom) */}
                    <div className="w-full md:w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col h-[40vh] md:h-auto shadow-2xl z-10">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="font-black text-white flex items-center gap-2">
                                <ShoppingCart size={18} /> Carrinho ({cart.reduce((a, b) => a + b.quantity, 0)})
                            </h3>
                            {cart.length > 0 && (
                                <button onClick={() => setCart([])} className="text-zinc-500 hover:text-red-400 text-xs uppercase font-bold">
                                    Limpar
                                </button>
                            )}
                        </div>

                        {/* Lista Itens */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2 opacity-50">
                                    <ShoppingCart size={48} />
                                    <p className="text-xs font-bold uppercase">Caixa Livre</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="flex items-center justify-between bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-white line-clamp-1">{item.name}</p>
                                            <p className="text-xs text-zinc-500">{formatCurrency(item.price)} un.</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center bg-zinc-800 rounded-lg">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="p-1 px-2 text-zinc-400 hover:text-white">-</button>
                                                <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="p-1 px-2 text-zinc-400 hover:text-white">+</button>
                                            </div>
                                            <button onClick={() => removeFromCart(item.id)} className="text-zinc-600 hover:text-red-400">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Total e Checkout */}
                        <div className="p-4 bg-zinc-950 border-t border-zinc-800 space-y-4">
                            <div className="flex justify-between items-end">
                                <span className="text-zinc-500 text-sm font-bold uppercase">Total a Pagar</span>
                                <span className="text-3xl font-black text-primary-400 tracking-tighter">{formatCurrency(total)}</span>
                            </div>
                            <button
                                onClick={() => total > 0 && setView('checkout')}
                                disabled={total === 0}
                                className="w-full bg-primary-500 text-black py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-primary-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Finalizar Venda
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- CHECKOUT VIEW ---
    if (view === 'checkout') {
        const isCred30 = paymentMethod === 'CRED30_SALDO' || paymentMethod === 'CRED30_CREDITO';
        const merchantFee = isCred30 ? Math.round(total * feeRate * 100) / 100 : 0;

        return (
            <div className="flex flex-col h-screen fixed inset-0 z-50 bg-zinc-950 p-6 max-w-lg mx-auto w-full overflow-y-auto">
                <div className="flex items-center mb-6">
                    <button onClick={() => { setView('pos'); setCustomerData(null); setCustomerPhone(''); }} className="p-2 -ml-2 rounded-xl hover:bg-zinc-900">
                        <X size={24} className="text-zinc-400" />
                    </button>
                    <h2 className="text-xl font-black text-white ml-2">Pagamento</h2>
                </div>

                <div className="text-center py-6 mb-6 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                    <p className="text-zinc-500 text-xs font-bold uppercase mb-1">Valor Total</p>
                    <p className="text-4xl font-black text-white">{formatCurrency(total)}</p>
                </div>

                <div className="space-y-6 flex-1">

                    {/* ========= BUSCA CLIENTE CRED30 ========= */}
                    <div className="space-y-3">
                        <label className="text-zinc-500 text-xs font-bold uppercase flex items-center gap-1">
                            <Phone size={12} /> Cliente Cred30 (Opcional)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="tel"
                                placeholder="(00) 00000-0000"
                                className="flex-1 bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-sm focus:border-primary-500 outline-none"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLookupCustomer()}
                                aria-label="Telefone do cliente Cred30"
                            />
                            <button
                                onClick={handleLookupCustomer}
                                disabled={isSearchingCustomer || customerPhone.replace(/\D/g, '').length < 10}
                                className="bg-primary-500 text-black px-4 rounded-xl font-bold text-xs uppercase disabled:opacity-50 hover:bg-primary-400 transition"
                            >
                                {isSearchingCustomer ? '...' : 'Buscar'}
                            </button>
                        </div>

                        {/* Resultado da busca */}
                        {customerData && !customerData.notFound && (
                            <div className="bg-emerald-900/20 border border-emerald-500/30 p-4 rounded-xl space-y-2">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                    <User size={16} /> {customerData.name}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-zinc-900/50 p-2 rounded-lg">
                                        <span className="text-zinc-500 block">Saldo</span>
                                        <span className="text-white font-bold">{formatCurrency(customerData.balance)}</span>
                                    </div>
                                    <div className="bg-zinc-900/50 p-2 rounded-lg">
                                        <span className="text-zinc-500 block">Limite Crédito</span>
                                        <span className={`font-bold ${customerData.creditEligible ? 'text-white' : 'text-zinc-600'}`}>
                                            {customerData.creditEligible ? formatCurrency(customerData.availableCredit) : 'Indisponível'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {customerData?.notFound && (
                            <div className="text-zinc-500 text-xs text-center py-2">Cliente não encontrado na plataforma.</div>
                        )}
                    </div>

                    {/* ========= FORMAS DE PAGAMENTO ========= */}
                    <div className="space-y-3">
                        <label className="text-zinc-500 text-xs font-bold uppercase">Forma de Pagamento</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'PIX', label: 'PIX', icon: Smartphone },
                                { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
                                { id: 'CARTAO_CREDITO', label: 'Crédito', icon: CreditCard },
                                { id: 'CARTAO_DEBITO', label: 'Débito', icon: CreditCard },
                            ].map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id as any)}
                                    className={`p-4 rounded-xl flex flex-col items-center gap-2 border transition-all ${paymentMethod === method.id
                                        ? 'bg-primary-500/10 border-primary-500 text-primary-400'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                                        }`}
                                >
                                    <method.icon size={20} />
                                    <span className="text-xs font-bold uppercase">{method.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Métodos Cred30 — só aparecem com cliente buscado */}
                        {customerData && !customerData.notFound && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <button
                                    onClick={() => setPaymentMethod('CRED30_SALDO')}
                                    disabled={customerData.balance < total}
                                    className={`p-4 rounded-xl flex flex-col items-center gap-2 border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${paymentMethod === 'CRED30_SALDO'
                                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                                        }`}
                                >
                                    <Wallet size={20} />
                                    <span className="text-xs font-bold uppercase">Saldo Cred30</span>
                                    <span className="text-[10px] text-zinc-500">{formatCurrency(customerData.balance)}</span>
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('CRED30_CREDITO')}
                                    disabled={!customerData.creditEligible || customerData.availableCredit < total}
                                    className={`p-4 rounded-xl flex flex-col items-center gap-2 border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${paymentMethod === 'CRED30_CREDITO'
                                        ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                                        }`}
                                >
                                    <CreditCard size={20} />
                                    <span className="text-xs font-bold uppercase">Crédito Cred30</span>
                                    <span className="text-[10px] text-zinc-500">
                                        {customerData.creditEligible ? formatCurrency(customerData.availableCredit) : 'Sem limite'}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Parcelas (só para crédito Cred30) */}
                    {paymentMethod === 'CRED30_CREDITO' && (
                        <div className="space-y-2">
                            <label className="text-zinc-500 text-xs font-bold uppercase">Parcelas</label>
                            <div className="flex gap-2 flex-wrap">
                                {[1, 2, 3, 6, 10, 12].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setInstallments(n)}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${installments === n
                                            ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                                            }`}
                                    >
                                        {n}x {formatCurrency(total / n)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dinheiro (Troco) */}
                    {paymentMethod === 'DINHEIRO' && (
                        <div className="space-y-3">
                            <label className="text-zinc-500 text-xs font-bold uppercase">Valor Recebido</label>
                            <input
                                type="number"
                                placeholder="0,00"
                                autoFocus
                                className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white font-bold text-lg focus:border-primary-500 outline-none"
                                value={receivedAmount}
                                onChange={e => setReceivedAmount(e.target.value)}
                            />
                            {change > 0 && (
                                <div className="bg-emerald-900/20 p-3 rounded-xl border border-emerald-500/20 flex justify-between items-center">
                                    <span className="text-emerald-500 font-bold text-sm">Troco:</span>
                                    <span className="text-emerald-400 font-black text-xl">{formatCurrency(change)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Taxa do comerciante (informativo) */}
                    {isCred30 && merchantFee > 0 && (
                        <div className="bg-amber-900/20 p-3 rounded-xl border border-amber-500/20 text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-amber-400 font-bold">Taxa de transação ({(feeRate * 100).toFixed(0)}%)</span>
                                <span className="text-amber-300 font-bold">-{formatCurrency(merchantFee)}</span>
                            </div>
                            <div className="flex justify-between text-zinc-500">
                                <span>Você receberá:</span>
                                <span className="text-white font-bold">{formatCurrency(total - merchantFee)}</span>
                            </div>
                        </div>
                    )}

                    {/* CPF na Nota */}
                    <div className="space-y-2">
                        <label className="text-zinc-500 text-xs font-bold uppercase">CPF na Nota (Opcional)</label>
                        <input
                            className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-sm focus:border-primary-500 outline-none"
                            placeholder="000.000.000-00"
                            value={customerCpf}
                            onChange={e => setCustomerCpf(e.target.value)}
                        />
                    </div>
                </div>

                <button
                    onClick={handleFinishSale}
                    disabled={isProcessing}
                    className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest mt-6 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                    {isProcessing ? 'PROCESSANDO...' : 'CONFIRMAR PAGAMENTO'}
                </button>
            </div>
        );
    }

    // --- SUCCESS VIEW ---
    if (view === 'success' && lastSale) {
        return (
            <div className="flex flex-col h-screen fixed inset-0 z-50 bg-emerald-600 items-center justify-center p-6 text-center">
                <div className="bg-white rounded-full p-6 shadow-2xl mb-8 animate-in zoom-in duration-300">
                    <CheckCircle size={64} className="text-emerald-600" />
                </div>

                <h2 className="text-3xl font-black text-white mb-2">VENDA APROVADA!</h2>
                <p className="text-emerald-100 text-sm font-medium opacity-80 mb-8">
                    Venda #{lastSale.number} finalizada com sucesso.
                </p>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 w-full max-w-sm mb-8 text-left border border-white/20">
                    <div className="flex justify-between mb-2">
                        <span className="text-emerald-100 text-sm">Total</span>
                        <span className="text-white font-black text-lg">{formatCurrency(lastSale.total)}</span>
                    </div>
                    {lastSale.change > 0 && (
                        <div className="flex justify-between border-t border-white/20 pt-2 mt-2">
                            <span className="text-emerald-100 text-sm">Troco</span>
                            <span className="text-white font-bold">{formatCurrency(lastSale.change)}</span>
                        </div>
                    )}
                </div>

                <div className="flex gap-4 w-full max-w-xs">
                    <button
                        onClick={() => { setView('pos'); setLastSale(null); }}
                        className="flex-1 bg-white text-emerald-600 font-black py-4 rounded-xl uppercase tracking-widest text-sm hover:bg-emerald-50 transition shadow-xl"
                    >
                        Nova Venda
                    </button>
                    {/* Botão de imprimir poderia entrar aqui no futuro */}
                </div>
            </div>
        );
    }

    return null;
};
