import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutDashboard,
    Package,
    Smartphone,
    TrendingUp,
    Plus,
    Monitor,
    Settings,
    LogOut,
    Store
} from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface PdvDashboardProps {
    subscription: any;
    onOpenPos: () => void; // Função para abrir a tela de caixa
    onCancelSubscription: () => void;
}

export const PdvDashboard = ({ subscription, onOpenPos, onCancelSubscription }: PdvDashboardProps) => {
    const [tab, setTab] = useState<'overview' | 'products' | 'devices' | 'settings'>('overview');
    const [stats, setStats] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Estados para novo produto
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [newProduct, setNewProduct] = useState<any>({ name: '', price: '', stock: '', sku: '', barcode: '', costPrice: '' });
    const [pricingCalculator, setPricingCalculator] = useState({ opsCostPercent: '', profitPercent: '' });

    // Estados para novo dispositivo
    const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
    const [newDeviceName, setNewDeviceName] = useState('');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Carregar produtos
            const prodRes = await apiService.get<any>('/pdv/products');
            const prodData = prodRes?.data || prodRes;
            if (prodData && Array.isArray(prodData.products)) {
                setProducts(prodData.products);
            } else {
                setProducts([]);
            }

            // Carregar dispositivos
            const devRes = await apiService.get<any>('/pdv/devices');
            const devData = devRes?.data || devRes;
            if (devData && Array.isArray(devData.devices)) {
                setDevices(devData.devices);
            }

            // Carregar vendas (hoje)
            const salesRes = await apiService.get<any>('/pdv/sales');
            const salesData = salesRes?.data || salesRes;
            if (salesData && salesData.totals) {
                setStats(salesData.totals);
            }
        } catch (error) {
            console.error('Erro ao carregar dados PDV:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateProduct = async () => {
        if (!newProduct.name || !newProduct.price) return;
        try {
            await apiService.post('/pdv/products', {
                name: newProduct.name,
                price: parseFloat(newProduct.price),
                stock: parseFloat(newProduct.stock || '0'),
                sku: newProduct.sku,
                barcode: newProduct.barcode,
                costPrice: newProduct.costPrice ? parseFloat(newProduct.costPrice) : undefined
            });
            setIsAddProductOpen(false);
            setNewProduct({ name: '', price: '', stock: '', sku: '', barcode: '', costPrice: '' });
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleRegisterDevice = async () => {
        if (!newDeviceName) return;
        try {
            await apiService.post('/pdv/devices', {
                deviceName: newDeviceName,
                deviceType: 'DESKTOP' // Pode ser melhorado para detectar
            });
            setIsAddDeviceOpen(false);
            setNewDeviceName('');
            fetchData();
        } catch (error) {
            alert('Erro ao registrar: ' + (error as any).message); // TODO: Usar toast melhor
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="space-y-6 pb-20">
            {/* Header com Status do Plano */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Gestão PDV</h2>
                    <p className="text-zinc-500 text-xs flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${subscription.status === 'ACTIVE' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                        Plano {subscription.planName} • {subscription.activeDevices}/{subscription.maxDevices} Dispositivos
                    </p>
                </div>
                <button
                    onClick={onOpenPos}
                    className="bg-primary-500 text-black px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary-500/20 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Store size={16} /> Abrir Caixa
                </button>
            </div>

            {/* Abas de Navegação */}
            <div className="flex p-1 bg-zinc-900 rounded-xl overflow-x-auto no-scrollbar">
                {[
                    { id: 'overview', icon: LayoutDashboard, label: 'Visão Geral' },
                    { id: 'products', icon: Package, label: 'Produtos' },
                    { id: 'devices', icon: Smartphone, label: 'Dispositivos' },
                    { id: 'settings', icon: Settings, label: 'Ajustes' },
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setTab(item.id as any)}
                        className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${tab === item.id
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <item.icon size={14} />
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Conteúdo das Abas */}
            <div className="min-h-[300px]">

                {/* --- VISÃO GERAL --- */}
                {tab === 'overview' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                                <div className="flex items-center gap-2 text-zinc-500 mb-2">
                                    <TrendingUp size={16} className="text-emerald-400" />
                                    <span className="text-xs font-bold uppercase">Vendas Hoje</span>
                                </div>
                                <p className="text-2xl font-black text-white">
                                    {stats ? formatCurrency(stats.total) : '...'}
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    {stats?.count || 0} transações realizadas
                                </p>
                            </div>
                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                                <div className="flex items-center gap-2 text-zinc-500 mb-2">
                                    <Package size={16} className="text-primary-400" />
                                    <span className="text-xs font-bold uppercase">Produtos</span>
                                </div>
                                <p className="text-2xl font-black text-white">{products.length}</p>
                                <p className="text-xs text-zinc-500 mt-1">Itens cadastrados</p>
                            </div>
                        </div>

                        {/* Gráfico ou Lista Recente Simples */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                            <h3 className="text-sm font-bold text-zinc-300 mb-4">Acesso Rápido</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setTab('products')} className="p-3 bg-zinc-800 rounded-xl text-left hover:bg-zinc-700 transition">
                                    <Plus size={20} className="text-primary-400 mb-2" />
                                    <p className="font-bold text-sm text-white">Novo Produto</p>
                                </button>
                                <button onClick={() => setTab('devices')} className="p-3 bg-zinc-800 rounded-xl text-left hover:bg-zinc-700 transition">
                                    <Monitor size={20} className="text-blue-400 mb-2" />
                                    <p className="font-bold text-sm text-white">Conectar Caixa</p>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- PRODUTOS --- */}
                {tab === 'products' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-zinc-300">Catálogo ({products.length})</h3>
                            <button
                                onClick={() => setIsAddProductOpen(!isAddProductOpen)}
                                className="text-primary-400 text-xs font-bold uppercase flex items-center gap-1 hover:text-primary-300"
                            >
                                <Plus size={14} /> Adicionar
                            </button>
                        </div>

                        {isAddProductOpen && (
                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        placeholder="Nome do Produto"
                                        className="col-span-2 w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-sm focus:border-primary-500 outline-none text-white"
                                        value={newProduct.name}
                                        onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                    />
                                    <input
                                        placeholder="Código / SKU (Opcional)"
                                        className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-sm focus:border-primary-500 outline-none text-white"
                                        value={newProduct.sku || ''}
                                        onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
                                    />
                                    <input
                                        placeholder="Cód. Barras (Opcional)"
                                        className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-sm focus:border-primary-500 outline-none text-white"
                                        value={newProduct.barcode || ''}
                                        onChange={e => setNewProduct({ ...newProduct, barcode: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Preço Venda</label>
                                        <input
                                            type="number"
                                            placeholder="R$ 0,00"
                                            className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-sm focus:border-primary-500 outline-none text-white font-bold text-emerald-400"
                                            value={newProduct.price}
                                            onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Preço Custo</label>
                                        <input
                                            type="number"
                                            placeholder="R$ 0,00"
                                            className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-sm focus:border-primary-500 outline-none text-white"
                                            value={newProduct.costPrice || ''}
                                            onChange={e => {
                                                const cost = e.target.value;
                                                setNewProduct({ ...newProduct, costPrice: cost });

                                                // Recalcular se houver config de margem
                                                if (cost && pricingCalculator.opsCostPercent && pricingCalculator.profitPercent) {
                                                    const costVal = parseFloat(cost);
                                                    const ops = parseFloat(pricingCalculator.opsCostPercent) || 0;
                                                    const profit = parseFloat(pricingCalculator.profitPercent) || 0;
                                                    const markup = (ops + profit) / 100;
                                                    const finalPrice = costVal * (1 + markup);
                                                    setNewProduct(prev => ({ ...prev, costPrice: cost, price: finalPrice.toFixed(2) }));
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Estoque</label>
                                        <input
                                            type="number"
                                            placeholder="qtd"
                                            className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-sm focus:border-primary-500 outline-none text-white"
                                            value={newProduct.stock}
                                            onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Calculadora de Precificação Inteligente */}
                                <div className="bg-zinc-950/30 border border-zinc-800 p-3 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp size={14} className="text-primary-400" />
                                        <span className="text-xs font-bold text-zinc-300 uppercase">Calculadora Inteligente</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Custos Operacionais %</label>
                                            <input
                                                type="number"
                                                placeholder="Ex: 20%"
                                                className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-xs text-white outline-none focus:border-primary-500"
                                                value={pricingCalculator.opsCostPercent}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setPricingCalculator({ ...pricingCalculator, opsCostPercent: val });
                                                    if (newProduct.costPrice && val && pricingCalculator.profitPercent) {
                                                        const cost = parseFloat(newProduct.costPrice);
                                                        const ops = parseFloat(val) || 0;
                                                        const profit = parseFloat(pricingCalculator.profitPercent) || 0;
                                                        const markup = (ops + profit) / 100;
                                                        const finalPrice = cost * (1 + markup);
                                                        setNewProduct(prev => ({ ...prev, price: finalPrice.toFixed(2) }));
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Lucro Desejado %</label>
                                            <input
                                                type="number"
                                                placeholder="Ex: 30%"
                                                className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-xs text-white outline-none focus:border-primary-500"
                                                value={pricingCalculator.profitPercent}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setPricingCalculator({ ...pricingCalculator, profitPercent: val });
                                                    if (newProduct.costPrice && pricingCalculator.opsCostPercent && val) {
                                                        const cost = parseFloat(newProduct.costPrice);
                                                        const ops = parseFloat(pricingCalculator.opsCostPercent) || 0;
                                                        const profit = parseFloat(val) || 0;
                                                        const markup = (ops + profit) / 100;
                                                        const finalPrice = cost * (1 + markup);
                                                        setNewProduct(prev => ({ ...prev, price: finalPrice.toFixed(2) }));
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                    {pricingCalculator.opsCostPercent && pricingCalculator.profitPercent && newProduct.costPrice && (
                                        <p className="text-[10px] text-zinc-500 text-center pt-1 border-t border-zinc-800/50 mt-1">
                                            Markup Aplicado: <span className="text-white font-bold">{parseFloat(pricingCalculator.opsCostPercent) + parseFloat(pricingCalculator.profitPercent)}%</span> sobre o custo.
                                        </p>
                                    )}
                                </div>

                                {/* Margem de Lucro Calculada */}
                                {newProduct.price && newProduct.costPrice && (
                                    <div className="flex items-center gap-4 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                                        <span className="text-xs text-zinc-500">Margem Estimada:</span>
                                        <span className={`text-xs font-bold ${(parseFloat(newProduct.price) - parseFloat(newProduct.costPrice)) > 0
                                            ? 'text-emerald-400'
                                            : 'text-red-400'
                                            }`}>
                                            {formatCurrency(parseFloat(newProduct.price) - parseFloat(newProduct.costPrice))}
                                            {' '}
                                            ({(((parseFloat(newProduct.price) - parseFloat(newProduct.costPrice)) / parseFloat(newProduct.price)) * 100).toFixed(1)}%)
                                        </span>
                                    </div>
                                )}

                                <button
                                    onClick={handleCreateProduct}
                                    className="w-full bg-white text-black font-bold py-3 rounded-xl text-xs uppercase"
                                >
                                    Salvar Produto
                                </button>
                            </div>
                        )}

                        <div className="space-y-2">
                            {products.length === 0 ? (
                                <div className="text-center py-8 text-zinc-500 text-xs">
                                    Nenhum produto cadastrado.
                                </div>
                            ) : (
                                products.map(prod => (
                                    <div key={prod.id} className="bg-zinc-900/50 border border-zinc-800/50 p-3 rounded-xl flex items-center justify-between group hover:bg-zinc-800 transition">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 font-bold text-xs group-hover:bg-zinc-700">
                                                {prod.sku ? prod.sku.substring(0, 3) : prod.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">{prod.name}</p>
                                                <div className="flex gap-2 text-[10px] text-zinc-500">
                                                    <span>{prod.sku || 'S/ SKU'}</span>
                                                    <span>•</span>
                                                    <span>Estoque: {prod.stock}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-white">{formatCurrency(prod.price)}</p>
                                            {prod.costPrice && (
                                                <p className="text-[10px] text-emerald-500">
                                                    Lucro: {formatCurrency(prod.price - prod.costPrice)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* --- DISPOSITIVOS --- */}
                {tab === 'devices' && (
                    <div className="space-y-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                            <h3 className="text-sm font-bold text-white mb-2">Conectar Nova Máquina</h3>
                            <p className="text-xs text-zinc-500 mb-4">
                                Cadastre um computador ou tablet para usar como caixa.
                            </p>

                            {isAddDeviceOpen ? (
                                <div className="space-y-3">
                                    <input
                                        placeholder="Nome do Caixa (ex: Caixa 01)"
                                        className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-sm focus:border-primary-500 outline-none text-white"
                                        value={newDeviceName}
                                        onChange={e => setNewDeviceName(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsAddDeviceOpen(false)}
                                            className="flex-1 bg-zinc-800 text-white font-bold py-3 rounded-xl text-xs uppercase"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleRegisterDevice}
                                            className="flex-1 bg-primary-500 text-black font-bold py-3 rounded-xl text-xs uppercase"
                                        >
                                            Gerar Token
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAddDeviceOpen(true)}
                                    disabled={devices.length >= subscription.maxDevices}
                                    className="w-full bg-zinc-800 text-white font-bold py-3 rounded-xl text-xs uppercase flex items-center justify-center gap-2 hover:bg-zinc-700 disabled:opacity-50"
                                >
                                    <Plus size={16} /> Novo Dispositivo
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {devices.map(dev => (
                                <div key={dev.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-white">{dev.name}</p>
                                            <p className="text-[10px] text-zinc-500 uppercase font-bold">{dev.type}</p>
                                        </div>
                                        <div className={`px-2 py-1 rounded-full text-[10px] font-bold ${dev.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {dev.isActive ? 'ATIVO' : 'INATIVO'}
                                        </div>
                                    </div>

                                    <div className="bg-black/40 rounded-lg p-3 font-mono text-[10px] text-zinc-400 break-all border border-zinc-800/50">
                                        TOKEN: ••••••••••••••••••••••••
                                    </div>
                                    <p className="text-[10px] text-zinc-600 mt-2 text-center">
                                        Use este token para logar na máquina do caixa.
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- SETTINGS --- */}
                {tab === 'settings' && (
                    <div className="space-y-4">
                        <div className="bg-red-900/10 border border-red-500/20 rounded-2xl p-4">
                            <h3 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">
                                <LogOut size={16} /> Zona de Perigo
                            </h3>
                            <p className="text-xs text-zinc-400 mb-4">
                                Cancelar sua assinatura irá bloquear o acesso ao PDV ao final do ciclo atual.
                            </p>
                            <button
                                onClick={onCancelSubscription}
                                className="w-full border border-red-500/30 text-red-400 font-bold py-3 rounded-xl text-xs uppercase hover:bg-red-500/10 transition"
                            >
                                Cancelar Assinatura PDV
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
