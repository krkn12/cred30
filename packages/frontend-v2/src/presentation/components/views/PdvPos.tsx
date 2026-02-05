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
    Monitor
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
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'CRED30'>('PIX');
    const [receivedAmount, setReceivedAmount] = useState('');
    const [customerCpf, setCustomerCpf] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastSale, setLastSale] = useState<any>(null);

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
        if (e.key === 'Enter') {
            const exactMatch = products.find(p =>
                p.barcode === search ||
                p.sku?.toLowerCase() === search.toLowerCase()
            );

            if (exactMatch) {
                addToCart(exactMatch);
                setSearch(''); // Limpa campo para o próximo item
            }
        }
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

    // Checkout Action
    const handleFinishSale = async () => {
        if (cart.length === 0) return;
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
                customerCpf: customerCpf || undefined,
                discount: 0
            };

            const res = await apiService.post<any>('/pdv/sales', saleData);

            if (res.success) {
                setLastSale(res.data.sale);
                setView('success');
                setCart([]);
            } else {
                alert('Erro ao finalizar venda: ' + res.message);
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
                    {/* Lista de Produtos (Esquerda/Topo) */}
                    <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
                        {/* Busca */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                            <input
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-white font-medium focus:border-primary-500 outline-none"
                                placeholder="Buscar produto..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                autoFocus
                            />
                        </div>

                        {/* Grid */}
                        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start pb-20 md:pb-0">
                            {filteredProducts.map(product => (
                                <button
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between items-start text-left h-32 hover:border-primary-500/50 hover:bg-zinc-800 transition active:scale-95 group"
                                >
                                    <div className="w-full">
                                        <div className="font-bold text-zinc-300 text-sm line-clamp-2 leading-tight group-hover:text-white">{product.name}</div>
                                        <div className="text-[10px] text-zinc-600 mt-1">Estoque: {product.stock}</div>
                                    </div>
                                    <div className="font-black text-white text-lg">{formatCurrency(product.price)}</div>
                                </button>
                            ))}
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
        return (
            <div className="flex flex-col h-screen fixed inset-0 z-50 bg-zinc-950 p-6 max-w-md mx-auto w-full">
                <div className="flex items-center mb-6">
                    <button onClick={() => setView('pos')} className="p-2 -ml-2 rounded-xl hover:bg-zinc-900">
                        <X size={24} className="text-zinc-400" />
                    </button>
                    <h2 className="text-xl font-black text-white ml-2">Pagamento</h2>
                </div>

                <div className="text-center py-6 mb-6 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                    <p className="text-zinc-500 text-xs font-bold uppercase mb-1">Valor Total</p>
                    <p className="text-4xl font-black text-white">{formatCurrency(total)}</p>
                </div>

                <div className="space-y-6 flex-1">
                    {/* Método de Pagamento */}
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
                    </div>

                    {/* Dinheiro (Troco) */}
                    {paymentMethod === 'DINHEIRO' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
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
