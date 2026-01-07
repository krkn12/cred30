import React, { useState, useEffect, memo, useCallback } from 'react';
import {
    Search,
    Tag,
    Image as ImageIcon,
    Zap,
    Sparkles,
    ChevronRight,
    ArrowLeft,
    ShieldCheck,
    Share2,
    Truck,
    CheckCircle2,
    History as HistoryIcon,
    Package,
    X as XIcon,
    MapPin,
    Phone,
    Navigation2,
    Loader2,
    ChevronDown,
    Store,
    CheckCircle,
    Plus,
    Clock,
    User,
    LayoutGrid,
    Ticket,
    Smartphone,
    Car,
    Home,
    Wrench,
    Shirt,
    AlertTriangle,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, any> = {
    'TODOS': LayoutGrid,
    'PARTICIPAÇÕES': Ticket,
    'ELETRÔNICOS': Smartphone,
    'VEÍCULOS': Car,
    'IMÓVEIS': Home,
    'SERVIÇOS': Wrench,
    'MODA': Shirt,
    'OUTROS': Package
};

import { useNavigate } from 'react-router-dom';
import { AppState } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';
import { ConfirmModal } from '../ui/ConfirmModal';
import { OfflineMarketplaceView } from './OfflineMarketplaceView';
import { useDebounce } from '../../hooks/use-performance';
import { LoadingScreen } from '../ui/LoadingScreen';
import { LoadingButton } from '../ui/LoadingButton';
import { OrderTrackingMap } from '../features/marketplace/OrderTrackingMap';

interface MarketplaceViewProps {
    state: AppState;
    onRefresh: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

// Componentes internos para anúncios (memoizados para evitar re-renders)
const AdBanner = memo(({ type, title, description, actionText }: any) => (
    <div className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] cursor-pointer ${type === 'BANNER'
        ? 'bg-gradient-to-br from-primary-600/20 to-purple-600/10 border-primary-500/20 shadow-lg shadow-primary-500/5'
        : 'bg-zinc-900/50 border-zinc-800'
        }`}>
        <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-black bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700 uppercase tracking-widest">Patrocinado</span>
            <Sparkles size={12} className="text-primary-400" />
        </div>
        {title && <h4 className="text-xs font-black text-white mb-1 uppercase tracking-tight">{title}</h4>}
        <p className="text-[10px] text-zinc-400 leading-tight mb-3">{description}</p>
        {actionText && (
            <button className="w-full py-2 bg-primary-500 hover:bg-primary-400 text-black text-[9px] font-black rounded-lg transition-all uppercase tracking-widest shadow-lg shadow-primary-500/20">
                {actionText}
            </button>
        )}
    </div>
));
AdBanner.displayName = 'AdBanner';

const NativeAdCard = memo(({ title, price, category, img }: any) => (
    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl overflow-hidden group hover:border-amber-500/30 transition-all flex flex-col relative">
        <div className="absolute top-2 left-2 z-10">
            <span className="text-[8px] font-black bg-amber-500 text-black px-1.5 py-0.5 rounded shadow-lg uppercase">OFERTA PARCEIRA</span>
        </div>
        <div className="aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden">
            <img src={img} alt={title} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" loading="lazy" />
        </div>
        <div className="p-4 flex-1 flex flex-col">
            <h3 className="font-bold text-white text-sm line-clamp-1 mb-1 uppercase tracking-tight">{title}</h3>
            <p className="text-[10px] text-zinc-500 mb-4 uppercase font-bold tracking-widest">{category}</p>
            <div className="mt-auto flex items-center justify-between">
                <span className="text-sm font-black text-amber-400">{price}</span>
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg group-hover:bg-amber-500 group-hover:text-black transition-all">
                    <ChevronRight size={14} />
                </div>
            </div>
        </div>
    </div>
));
NativeAdCard.displayName = 'NativeAdCard';

const ListingCard = memo(({ item, currentUserId, formatCurrency, onBoost, onDetails, onAddToCart }: any) => {
    const isOwner = item.seller_id === currentUserId;

    // Formatação da data (ex: Hoje, 14:30 ou 05 Jan)
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return `Hoje, ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        if (diffDays === 1) return `Ontem, ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    };

    return (
        <div
            onClick={() => onDetails(item)}
            className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-primary-500/50 transition-all cursor-pointer flex flex-col h-full animate-in fade-in duration-500 hover:shadow-2xl hover:shadow-primary-500/5"
        >
            {/* Imagem com Badges */}
            <div className="aspect-[4/3] bg-zinc-950 flex items-center justify-center relative overflow-hidden">
                {item.image_url ? (
                    <img
                        src={item.image_url.includes('cloudinary') ? item.image_url.replace('/upload/', '/upload/w_600,c_fill,g_auto,q_auto,f_auto/') : item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-800">
                        <ImageIcon size={40} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Sem Foto</span>
                    </div>
                )}

                {/* Badge Superior Esquerdo (Categoria) */}
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg text-[9px] text-white font-black uppercase border border-white/10 tracking-widest">
                    {item.category === 'PARTICIPAÇÕES' ? '🎫 COTA' : item.category}
                </div>

                {/* Badge Superior Direito (Destaque/Verificado) */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                    {item.is_boosted && (
                        <div className="bg-primary-500 text-black text-[8px] px-2 py-1 rounded-full font-black flex items-center gap-1 shadow-lg shadow-primary-500/20 animate-pulse">
                            <Zap size={10} /> DESTAQUE
                        </div>
                    )}
                    {item.asaas_wallet_id && (
                        <div className="bg-emerald-500 text-white text-[8px] px-2 py-1 rounded-full font-black flex items-center gap-1 shadow-lg shadow-emerald-500/20">
                            <ShieldCheck size={10} /> VERIFICADO
                        </div>
                    )}
                </div>
            </div>

            {/* Informações */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="mb-2">
                    <h3 className="font-bold text-white text-sm line-clamp-2 leading-tight min-h-[2.5rem] group-hover:text-primary-400 transition-colors">
                        {item.title}
                    </h3>
                </div>

                <div className="mt-auto space-y-3">
                    {/* Preço de Destaque */}
                    <div>
                        <p className="text-xl font-black text-white tabular-nums">
                            {item.price > 0 ? formatCurrency(parseFloat(item.price)) : 'Ver Preço'}
                        </p>
                        {item.category === 'PARTICIPAÇÕES' && (
                            <p className="text-[9px] text-primary-400 font-bold uppercase mt-0.5">Excedente Cooperativo Estimado</p>
                        )}
                    </div>

                    {/* Rodapé do Card (Localização e Data) */}
                    <div className="pt-3 border-t border-zinc-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-zinc-500">
                            <MapPin size={10} />
                            <span className="text-[10px] font-medium">{item.seller_address ? item.seller_address.split('-')[0].trim() : 'Brasil'}</span>
                        </div>
                        <span className="text-[10px] text-zinc-600 font-medium">
                            {formatDate(item.created_at)}
                        </span>
                    </div>

                    {/* Botão de Ação para Dono */}
                    {isOwner ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onBoost(item); }}
                            disabled={item.is_boosted}
                            className={`w-full text-[9px] font-black py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${item.is_boosted ? 'bg-zinc-800 text-zinc-500' : 'bg-primary-500/10 text-primary-400 hover:bg-primary-500 hover:text-black border border-primary-500/20'}`}
                        >
                            <Zap size={12} /> {item.is_boosted ? 'ANÚNCIO IMPULSIONADO' : 'IMPULSIONAR AGORA'}
                        </button>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAddToCart(item); }}
                            className="w-full text-[9px] font-black py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all bg-zinc-800 text-zinc-300 hover:bg-emerald-500 hover:text-white border border-white/5 hover:border-emerald-500/50"
                        >
                            <Plus size={12} /> ADICIONAR
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});
ListingCard.displayName = 'ListingCard';

export const MarketplaceView = ({ state, onRefresh, onSuccess, onError }: MarketplaceViewProps) => {
    const navigate = useNavigate();
    const [view, setView] = useState<'browse' | 'create' | 'my-orders' | 'details' | 'missions' | 'offline' | 'cart'>('browse');
    const [pendingOfflineSales, setPendingOfflineSales] = useState<any[]>(() => {
        const saved = localStorage.getItem('cred30_offline_sales');
        return saved ? JSON.parse(saved) : [];
    });
    const [listings, setListings] = useState<any[]>([]);
    const [myOrders, setMyOrders] = useState<any[]>([]);
    const [missions, setMissions] = useState<any[]>([]);
    const [deliveryOption, setDeliveryOption] = useState<'SELF_PICKUP' | 'COURIER_REQUEST' | 'EXTERNAL_SHIPPING'>('SELF_PICKUP');
    const [offeredFee, setOfferedFee] = useState<string>('5.00');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300); // Debounce de 300ms
    const [selectedCategory, setSelectedCategory] = useState('TODOS');
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const LIMIT = 20;
    const [confirmData, setConfirmData] = useState<any>(null);
    const [offlineVoucher, setOfflineVoucher] = useState<{ code: string, amount: number, item: string } | null>(null);
    const [redeemCode, setRedeemCode] = useState('');
    const [paymentMethod] = useState<'BALANCE'>('BALANCE');
    const [cart, setCart] = useState<{ sellerId: string | null; sellerName: string | null; items: any[] }>(() => {
        const saved = localStorage.getItem('cred30_cart');
        return saved ? JSON.parse(saved) : { sellerId: null, sellerName: null, items: [] };
    });

    const [trackingOrder, setTrackingOrder] = useState<any>(null);

    useEffect(() => {
        localStorage.setItem('cred30_cart', JSON.stringify(cart));
    }, [cart]);

    const addToCart = (item: any) => {
        if (cart.sellerId && cart.sellerId !== item.seller_id) {
            onError('Loja Diferente', `Você já tem itens da loja "${cart.sellerName}". Finalize a compra ou limpe o carrinho antes de comprar de "${item.seller_name}".`);
            return;
        }

        if (cart.items.some(i => i.id === item.id)) {
            onSuccess('Já no carrinho', 'Este item já está na sua lista.');
            return;
        }

        setCart(prev => ({
            sellerId: item.seller_id,
            sellerName: item.seller_name,
            items: [...prev.items, item]
        }));
        onSuccess('Adicionado', 'Item adicionado ao carrinho!');
    };

    const removeFromCart = (itemId: string) => {
        setCart(prev => {
            const newItems = prev.items.filter(i => i.id !== itemId);
            return {
                sellerId: newItems.length === 0 ? null : prev.sellerId,
                sellerName: newItems.length === 0 ? null : prev.sellerName,
                items: newItems
            };
        });
    };

    const clearCart = () => {
        setCart({ sellerId: null, sellerName: null, items: [] });
    };

    // Filtros de Localização
    const [selectedUF, setSelectedUF] = useState<string>('');
    const [selectedCity, setSelectedCity] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    const UFS = [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
        'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
        'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    ];

    const [newListing, setNewListing] = useState({
        title: '',
        description: '',
        price: '',
        category: 'ELETRÔNICOS',
        image_url: '',
        quotaId: null as number | null
    });

    const categories = ['PARTICIPAÇÕES', 'ELETRÔNICOS', 'VEÍCULOS', 'IMÓVEIS', 'SERVIÇOS', 'MODA', 'OUTROS'];
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSaveOfflineSale = (sale: any) => {
        const newSales = [...pendingOfflineSales, sale];
        setPendingOfflineSales(newSales);
        localStorage.setItem('cred30_offline_sales', JSON.stringify(newSales));
    };

    const handleSyncOffline = async () => {
        if (pendingOfflineSales.length === 0) return;
        try {
            setIsLoading(true);
            const response = await apiService.post('/marketplace/offline/sync', { transactions: pendingOfflineSales });
            if (response.success) {
                setPendingOfflineSales([]);
                localStorage.removeItem('cred30_offline_sales');
                onSuccess('Sincronizado!', 'Vendas offline enviadas com sucesso.');
                setView('my-orders');
            } else {
                onError('Erro', 'Falha ao sincronizar.');
            }
        } catch (error) {
            console.error(error);
            onError('Erro', 'Falha na conexão.');
        } finally {
            setIsLoading(false);
        }
    };

    const [deliveryAddress, setDeliveryAddress] = useState('');

    const fetchBrowseData = useCallback(async (isLoadMore = false) => {
        if (!isLoadMore) {
            setIsLoading(true);
            setOffset(0);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const currentOffset = isLoadMore ? offset + LIMIT : 0;
            const query = new URLSearchParams({
                limit: LIMIT.toString(),
                offset: currentOffset.toString(),
                category: selectedCategory,
                search: debouncedSearchQuery,
                uf: selectedUF,
                city: selectedCity
            }).toString();

            const response = await apiService.get<any>(`/marketplace/listings?${query}`);
            if (response.success) {
                const newListings = response.data.listings || [];
                setListings(prev => isLoadMore ? [...prev, ...newListings] : newListings);
                setHasMore(newListings.length === LIMIT);
                if (isLoadMore) setOffset(currentOffset);
            }
        } catch (error) {
            console.error('Erro ao buscar anúncios:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [offset, selectedCategory, debouncedSearchQuery]);

    const fetchData = useCallback(async () => {
        if (view === 'browse') {
            fetchBrowseData(false);
            return;
        }

        setIsLoading(true);
        try {
            if (view === 'my-orders') {
                const response = await apiService.get<any>('/marketplace/my-orders');
                if (response.success) {
                    const data = response.data;
                    setMyOrders(Array.isArray(data) ? data : (data?.orders || []));
                }
            } else if (view === 'missions') {
                const response = await apiService.get<any>('/marketplace/logistic/missions');
                if (response.success) {
                    setMissions(response.data);
                }
            }
        } catch (error) {
            console.error('Erro ao buscar dados do marketplace:', error);
        } finally {
            setIsLoading(false);
        }
    }, [view, fetchBrowseData]);

    useEffect(() => {
        fetchData();
    }, [view, selectedCategory, debouncedSearchQuery, selectedUF, selectedCity]); // Removi fetchData da dependência para evitar loops se não for browse

    const handleCreateListing = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload: any = {
                title: newListing.title,
                description: newListing.description,
                price: parseFloat(newListing.price),
                category: newListing.category,
                imageUrl: newListing.image_url || undefined
            };

            // Se for uma cota, enviar o ID
            if (newListing.quotaId) {
                payload.quotaId = newListing.quotaId;
            }

            const response = await apiService.post<any>('/marketplace/create', payload);
            if (response.success) {
                onSuccess('Sucesso', newListing.quotaId ? 'Sua cota-parte foi listada para repasse!' : 'Anúncio publicado!');
                setView('browse');
                setNewListing({ title: '', description: '', price: '', category: 'ELETRÔNICOS', image_url: '', quotaId: null });
                onRefresh();
            }
        } catch (error: any) {
            onError('Erro', error.message || 'Falha ao publicar anúncio');
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleBoostListing = async (listing: any) => {
        setConfirmData({
            isOpen: true,
            title: 'Impulsionar Anúncio?',
            message: `Confirme o pagamento do destaque de 7 dias (R$ 5,00) para "${listing.title}" usando seu saldo:`,
            confirmText: 'IMPULSIONAR AGORA',
            type: 'success',
            showPaymentMethods: true,
            onConfirm: async () => {
                try {
                    const res = await apiService.post<any>(`/marketplace/listings/${listing.id}/boost`, {
                        paymentMethod: 'BALANCE'
                    });
                    if (res.success) {
                        onSuccess('Impulsionado!', 'Seu anúncio terá prioridade nas buscas por 7 dias.');
                        fetchData();
                        setConfirmData(null);
                    }
                } catch (err: any) {
                    onError('Erro', err.message);
                }
            }
        });
    };

    const generateOfflineVoucher = (item: any) => {
        // Criar um código baseado no tempo e IDs (apenas para exibição, a segurança real é no sync posterior)
        const code = `CR30-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${item.id}`;
        setOfflineVoucher({ code, amount: item.price, item: item.title });

        // Registrar no sync service que esta compra foi iniciada offline
        import('../../../application/services/sync.service').then(({ syncService }) => {
            syncService.enqueue('BUY_MARKETPLACE', {
                listingId: item.id,
                offlineToken: code
            });
        });

        onSuccess('Voucher Gerado', 'Mostre este código ao vendedor para confirmar a compra offline.');
    };

    const handleRedeemOfflineCode = async () => {
        if (!redeemCode) return;

        // O vendedor registra o código recebido do comprador.
        // Como ambos estão offline, isso fica na fila de sincronização do vendedor.
        import('../../../application/services/sync.service').then(({ syncService }) => {
            syncService.enqueue('RELEASE_ESCROW', {
                verificationCode: redeemCode,
                note: 'Resgate via modo offline (Interior)'
            });
        });

        onSuccess('Código Registrado', 'O resgate foi agendado. O saldo cairá assim que você detectar internet.');
        setRedeemCode('');
        setView('browse');
    };
    void handleRedeemOfflineCode;

    const formatCurrency = (val: number) => {
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Loading principal
    if (isLoading && view === 'browse' && listings.length === 0) {
        return <LoadingScreen fullScreen message="Carregando Mercado..." />;
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header de Ação Superior (Estilo App Marketplace) */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                    <h2 className="text-2xl font-black text-white tracking-tighter">MERCADO</h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                        <MapPin size={10} className="text-primary-500" />
                        Brasil • {listings.length} anúncios ativos
                    </p>
                </div>

                {view !== 'details' && (
                    <button
                        onClick={() => setView('create')}
                        className="bg-primary-500 hover:bg-primary-400 text-black px-6 py-3 rounded-2xl font-black text-xs transition-all shadow-xl shadow-primary-500/20 active:scale-95 flex items-center gap-2 uppercase tracking-widest"
                    >
                        <Plus size={18} /> ANUNCIAR
                    </button>
                )}
            </div>

            {/* Abas de Navegação Secundária */}
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
                <button
                    onClick={() => setView('browse')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${view === 'browse' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                    Explorar
                </button>
                <button
                    onClick={() => setView('my-orders')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${view === 'my-orders' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                    Meus Pedidos
                </button>
                <button
                    onClick={() => navigate('/app/logistics')}
                    className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition text-zinc-500 hover:bg-zinc-800 hover:text-white"
                >
                    Entregas
                </button>
                <button
                    onClick={() => setView('offline')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${view === 'offline' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                    Offline
                </button>
                {cart.items.length > 0 && (
                    <button
                        onClick={() => setView('cart')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition overflow-hidden relative ${view === 'cart' ? 'bg-zinc-800 text-white shadow-sm' : 'text-primary-400 bg-primary-500/5'}`}
                    >
                        Carrinho ({cart.items.length})
                    </button>
                )}
            </div>

            {/* Protective Escrow Banner */}
            {view === 'browse' && (
                <div className="space-y-3">
                    <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-4">
                        <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-emerald-400">Compra Garantida Cred30</h4>
                            <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                                Seu dinheiro fica protegido conosco. Só liberamos o valor ao vendedor quando você confirmar que recebeu tudo ok.
                            </p>
                        </div>
                    </div>

                    {!state.currentUser?.asaas_wallet_id && (
                        <div className="bg-primary-500/5 border border-primary-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="bg-primary-500/10 p-2 rounded-xl text-primary-400">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-white">Seja um Vendedor Verificado</h4>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">Receba via PIX/Cartão e passe mais confiança.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/app/seller')}
                                className="bg-primary-500 hover:bg-primary-400 text-black px-3 py-1.5 rounded-lg text-[10px] font-black transition active:scale-95"
                            >
                                COMEÇAR
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Search and Filters - ESTILO OLX */}
            {view === 'browse' && (
                <div className="space-y-4">
                    {/* Barra de Busca Principal */}
                    <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-4 shadow-xl shadow-primary-500/10">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/50" size={20} />
                            <input
                                type="text"
                                placeholder="O que você está procurando?"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white rounded-xl pl-12 pr-12 py-4 text-base text-black font-medium focus:outline-none focus:ring-2 focus:ring-primary-300 placeholder:text-zinc-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                                >
                                    <XIcon size={18} />
                                </button>
                            )}
                        </div>

                        {/* Filtros Expansíveis */}
                        <div className="pt-2 px-1 flex items-center gap-2">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition ${showFilters || selectedUF ? 'text-white' : 'text-primary-200/70 hover:text-white'}`}
                            >
                                <MapPin size={12} /> {selectedUF ? `${selectedCity ? selectedCity + '-' : ''}${selectedUF}` : 'Filtrar por Localização'}
                                <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </button>

                            {(selectedUF || selectedCity) && (
                                <button
                                    onClick={() => { setSelectedUF(''); setSelectedCity(''); }}
                                    className="text-[9px] text-zinc-400 underline hover:text-white"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>

                        {showFilters && (
                            <div className="pt-2 grid grid-cols-3 gap-2 animate-in slide-in-from-top-2 duration-200">
                                <form className="col-span-1">
                                    <select
                                        value={selectedUF}
                                        onChange={(e) => setSelectedUF(e.target.value)}
                                        className="w-full bg-white/10 text-white text-xs rounded-lg p-2 font-medium focus:outline-none focus:ring-1 focus:ring-white/50"
                                    >
                                        <option value="" className="bg-zinc-900 text-zinc-500">Estado (UF)</option>
                                        {UFS.map(uf => (
                                            <option key={uf} value={uf} className="bg-zinc-900">{uf}</option>
                                        ))}
                                    </select>
                                </form>
                                <input
                                    type="text"
                                    placeholder="Cidade..."
                                    value={selectedCity}
                                    onChange={(e) => setSelectedCity(e.target.value)}
                                    className="col-span-2 bg-white/10 text-white text-xs rounded-lg p-2 font-medium placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/50"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
                        {['TODOS', ...categories].map((cat) => {
                            const Icon = CATEGORY_ICONS[cat] || Package;
                            const isSelected = selectedCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`
                                        flex flex-col items-center gap-2 min-w-[70px] p-2 rounded-xl transition-all
                                        ${isSelected
                                            ? 'scale-105'
                                            : 'opacity-60 hover:opacity-100 hover:bg-zinc-800/50'}
                                    `}
                                >
                                    <div className={`
                                        w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg
                                        ${isSelected
                                            ? 'bg-primary-500 text-black shadow-primary-500/20'
                                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}
                                    `}>
                                        <Icon size={20} className={isSelected ? 'animate-bounce-short' : ''} />
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                                        {cat === 'PARTICIPAÇÕES' ? 'Cotas' :
                                            cat === 'TODOS' ? 'Início' :
                                                cat.charAt(0) + cat.slice(1).toLowerCase()}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Banner Informativo Compacto */}
                    <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-3">
                        <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0" />
                        <p className="text-[11px] text-zinc-400">
                            <span className="text-emerald-400 font-bold">Compra Segura:</span> Parcele em até 24x ou negocie direto pelo WhatsApp
                        </p>
                    </div>
                </div>
            )}

            {/* Content Rendering */}
            {view === 'browse' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-300">
                    {(() => {
                        // Usar debouncedSearchQuery para evitar filtros excessivos durante digitação
                        if (listings.length === 0 && (debouncedSearchQuery || selectedCategory !== 'TODOS')) {
                            return (
                                <div className="col-span-full py-20 text-center animate-in fade-in zoom-in duration-300">
                                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                                        <Search size={32} className="text-zinc-700" />
                                    </div>
                                    <h3 className="text-white font-bold mb-1">Nenhum resultado encontrado</h3>
                                    <p className="text-zinc-500 text-xs">Tente ajustar sua busca ou filtro para encontrar o que precisa.</p>
                                    <button
                                        onClick={() => { setSearchQuery(''); setSelectedCategory('TODOS'); }}
                                        className="mt-6 text-primary-400 text-[10px] font-black uppercase tracking-widest hover:underline"
                                    >
                                        Limpar todos os filtros
                                    </button>
                                </div>
                            );
                        }

                        if (listings.length === 0) {
                            return (
                                <div className="col-span-full py-12 text-center">
                                    <Tag size={48} className="text-zinc-800 mx-auto mb-4" />
                                    <p className="text-zinc-500 text-sm">Nenhum item anunciado no momento.</p>
                                    <button onClick={() => setView('create')} className="text-primary-400 text-xs font-bold mt-2">Clique aqui para ser o primeiro!</button>
                                </div>
                            );
                        }

                        return (
                            <>
                                {/* Inserir Anúncio Adsterra no topo */}
                                <div className="col-span-1">
                                    <AdBanner
                                        type="BANNER"
                                        title="Ganhe + R$ 500 no Saldo"
                                        description="Confira como liberar bônus de parceiros assistindo vídeos."
                                        actionText="LIBERAR AGORA"
                                    />
                                </div>

                                {listings.map((item, index) => (
                                    <React.Fragment key={item.id}>
                                        <ListingCard
                                            item={item}
                                            currentUserId={state.currentUser?.id}
                                            formatCurrency={formatCurrency}
                                            onBoost={handleBoostListing}
                                            onDetails={(it: any) => {
                                                setSelectedItem(it);
                                                setView('details');
                                            }}
                                            onAddToCart={addToCart}
                                        />

                                        {(index + 1) % 3 === 0 && (
                                            <NativeAdCard
                                                title={index === 2 ? "Novo Cartão Black Sem Anuidade" : "Apoio Financeiro Parceiro"}
                                                price={index === 2 ? "GRÁTIS" : "SIMULAR"}
                                                category="OFERTA"
                                                img={index === 2 ? "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80" : "https://images.unsplash.com/photo-1554224155-16974a4005d1?auto=format&fit=crop&w=600&q=80"}
                                            />
                                        )}
                                    </React.Fragment>
                                ))}

                                <div className="col-span-1">
                                    <AdBanner
                                        type="TIP"
                                        description="Dica: Clique em anúncios parceiros para aumentar seu Score Cred30."
                                    />
                                </div>

                                {hasMore && (
                                    <div className="col-span-full pt-10 pb-6 flex flex-col items-center gap-4">
                                        <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent mb-4" />
                                        <button
                                            onClick={() => fetchBrowseData(true)}
                                            disabled={isLoadingMore}
                                            className="bg-zinc-900/50 hover:bg-zinc-800 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-4 border border-zinc-800 shadow-2xl group"
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
                                                    CARREGANDO...
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown size={18} className="text-primary-400 group-hover:translate-y-1 transition-transform" />
                                                    Ver mais ofertas
                                                </>
                                            )}
                                        </button>
                                        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                                            Mostrando {listings.length} resultados
                                        </p>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {view === 'cart' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 min-h-[50vh] animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-4 mb-8 pb-4 border-b border-zinc-800">
                        <button onClick={() => setView('browse')} className="p-2 -ml-2 hover:bg-zinc-800 rounded-xl transition text-zinc-400 hover:text-white">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Package className="text-primary-400" /> Carrinho de Compras
                            </h2>
                            {cart.sellerName && (
                                <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest mt-1">
                                    Vendedor: <span className="text-white">{cart.sellerName}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    {cart.items.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center">
                            <Package size={64} className="text-zinc-800 mb-4" />
                            <h3 className="text-white font-bold mb-2">Seu carrinho está vazio</h3>
                            <button onClick={() => setView('browse')} className="text-primary-400 text-xs font-bold uppercase tracking-widest hover:underline">
                                Voltar às compras
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="divide-y divide-zinc-800">
                                {cart.items.map((item, idx) => (
                                    <div key={idx} className="py-4 flex gap-4 items-center">
                                        <div className="w-16 h-16 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 shrink-0">
                                            {item.image_url ? (
                                                <img src={item.image_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon className="w-full h-full p-4 text-zinc-700" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                                            <p className="text-xs text-primary-400 font-bold mt-1">{formatCurrency(parseFloat(item.price))}</p>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.id)}
                                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                        >
                                            <XIcon size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-sm font-bold text-zinc-400">Total ({cart.items.length} itens)</span>
                                    <span className="text-2xl font-black text-white">
                                        {formatCurrency(cart.items.reduce((acc, i) => acc + parseFloat(i.price), 0))}
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-start">
                                        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-amber-200/80 leading-relaxed">
                                            Ao confirmar, o sistema processará {cart.items.length} pedidos individuais para o vendedor <strong>{cart.sellerName}</strong>.
                                            O pagamento será debitado do seu saldo.
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setConfirmData({
                                                isOpen: true,
                                                title: 'Finalizar Compra em Massa',
                                                message: `Confirmar compra de ${cart.items.length} itens da loja ${cart.sellerName}? Total: ${formatCurrency(cart.items.reduce((acc, i) => acc + parseFloat(i.price), 0))}`,
                                                confirmText: `PAGAR ${formatCurrency(cart.items.reduce((acc, i) => acc + parseFloat(i.price), 0))}`,
                                                type: 'success',
                                                onConfirm: async () => {
                                                    setIsLoading(true);
                                                    setConfirmData(null); // Fechar modal

                                                    let successCount = 0;
                                                    let failCount = 0;

                                                    for (const item of cart.items) {
                                                        try {
                                                            await apiService.post('/marketplace/buy', {
                                                                listingId: item.id,
                                                                deliveryType: 'SELF_PICKUP', // Default simples
                                                                paymentMethod: 'BALANCE',
                                                                deliveryAddress: 'Combinar com Vendedor'
                                                            });
                                                            successCount++;
                                                        } catch (e) {
                                                            console.error(e);
                                                            failCount++;
                                                        }
                                                    }

                                                    setIsLoading(false);
                                                    if (successCount > 0) {
                                                        onSuccess('Sucesso Parcial', `${successCount} itens comprados com sucesso! ${failCount > 0 ? `${failCount} falharam.` : ''}`);
                                                        clearCart();
                                                        setView('my-orders');
                                                    } else {
                                                        onError('Erro', 'Falha ao processar compras. Tente novamente.');
                                                    }
                                                }
                                            });
                                        }}
                                        className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-xl uppercase tracking-widest shadow-lg shadow-primary-500/20 active:scale-95 transition"
                                    >
                                        FINALIZAR COMPRA
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {view === 'create' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 animate-in slide-in-from-bottom duration-300">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        O que você quer vender?
                    </h3>
                    <form onSubmit={handleCreateListing} className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Título do Anúncio</label>
                            </div>
                            <input
                                type="text"
                                value={newListing.title}
                                onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                                placeholder="Ex: iPhone 13 Pro Max 256GB"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Descrição Detalhada</label>
                            <textarea
                                value={newListing.description}
                                onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white h-32 focus:outline-none focus:border-primary-500/50"
                                placeholder="Descreva o estado do produto, tempo de uso, acessórios inclusos..."
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Preço de Venda</label>
                                <input
                                    type="number"
                                    value={newListing.price}
                                    onChange={(e) => setNewListing({ ...newListing, price: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                                    placeholder="0,00"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Categoria</label>
                                <select
                                    value={newListing.category}
                                    onChange={(e) => setNewListing({ ...newListing, category: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Foto do Produto (Automático)</label>
                            <div className="flex gap-4 items-start">
                                <div className="w-24 h-24 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                                    {newListing.image_url ? (
                                        <img src={newListing.image_url} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon className="text-zinc-800" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (readerEvent) => {
                                                    const img = new Image();
                                                    img.onload = () => {
                                                        const canvas = document.createElement('canvas');
                                                        const ctx = canvas.getContext('2d');
                                                        const size = 600; // Standard Size
                                                        canvas.width = size;
                                                        canvas.height = size;

                                                        // Calculate crop (Cover)
                                                        const ratio = Math.max(size / img.width, size / img.height);
                                                        const centerShift_x = (size - img.width * ratio) / 2;
                                                        const centerShift_y = (size - img.height * ratio) / 2;

                                                        if (ctx) {
                                                            ctx.clearRect(0, 0, size, size);
                                                            ctx.drawImage(img, 0, 0, img.width, img.height,
                                                                centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);

                                                            // Compression
                                                            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                                            setNewListing(prev => ({ ...prev, image_url: dataUrl }));
                                                        }
                                                    };
                                                    img.src = readerEvent.target?.result as string;
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-primary-500/10 file:text-primary-400 hover:file:bg-primary-500/20"
                                    />
                                    <p className="text-[9px] text-zinc-600 mt-2">
                                        A imagem será automaticamente ajustada para o formato padrão do feed (Quadrado 600px).
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setView('browse')}
                                className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-bold rounded-2xl transition hover:bg-zinc-700 uppercase tracking-widest text-[10px]"
                            >
                                Cancelar
                            </button>
                            <LoadingButton
                                type="submit"
                                isLoading={isSubmitting}
                                loadingText="PUBLICANDO..."
                                className="flex-[2] py-4 bg-primary-500 text-black font-black rounded-2xl transition hover:bg-primary-400 shadow-lg shadow-primary-500/20 uppercase tracking-widest text-[10px]"
                            >
                                PUBLICAR ANÚNCIO AGORA
                            </LoadingButton>
                        </div>
                    </form>
                </div>
            )}

            {view === 'my-orders' && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white mb-4">Minhas Compras</h3>
                    {myOrders.length === 0 ? (
                        <div className="py-20 text-center bg-zinc-900 border border-zinc-800 rounded-3xl">
                            <HistoryIcon size={48} className="text-zinc-800 mx-auto mb-4" />
                            <p className="text-zinc-500 text-sm">Você ainda não realizou nenhuma compra.</p>
                            <button onClick={() => setView('browse')} className="text-primary-400 text-xs font-bold mt-2">Explorar Mercado</button>
                        </div>
                    ) : (
                        myOrders.map(order => (
                            <div key={order.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-4">
                                <div className="w-20 h-20 bg-zinc-950 rounded-xl overflow-hidden flex-shrink-0">
                                    <img src={order.listing_image} alt={order.listing_title} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-white text-sm">{order.listing_title}</h4>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${order.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary-500/10 text-primary-400'}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <p className="text-lg font-black text-white mt-1">{formatCurrency(parseFloat(order.amount))}</p>
                                    <div className="flex flex-wrap items-center gap-3 mt-4">
                                        <p className="text-[10px] text-zinc-500 uppercase font-bold">Pedido: #{order.id.toString().slice(-6)}</p>

                                        {/* Botão de Rastreio (se houver entregador e não estiver concluído) */}
                                        {order.courier_id && (order.status === 'WAITING_SHIPPING' || order.status === 'IN_TRANSIT') && (
                                            <button
                                                onClick={() => setTrackingOrder(order)}
                                                className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-lg text-[10px] font-black border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all"
                                            >
                                                <Navigation2 size={12} className="animate-pulse" /> RASTREAR
                                            </button>
                                        )}

                                        {/* Código de Confirmação para o Comprador */}
                                        {order.buyer_id === state.currentUser?.id && order.delivery_confirmation_code && order.delivery_status !== 'DELIVERED' && order.delivery_status !== 'NONE' && (
                                            <div className="bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-lg flex flex-col">
                                                <span className="text-[8px] text-indigo-400 font-black uppercase tracking-tighter">Código p/ Entregador</span>
                                                <span className="text-sm font-mono font-black text-white">{order.delivery_confirmation_code}</span>
                                            </div>
                                        )}

                                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 capitalize">
                                            {order.buyer_id === state.currentUser?.id ? 'Compra' : order.seller_id === state.currentUser?.id ? 'Venda' : 'Entrega'}
                                        </span>
                                        {/* Código de Coleta para o Vendedor */}
                                        {order.seller_id === state.currentUser?.id && order.pickup_code && order.delivery_status === 'ACCEPTED' && (
                                            <div className="bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg flex flex-col">
                                                <span className="text-[8px] text-amber-400 font-black uppercase tracking-tighter">Código p/ Entregador coeltar</span>
                                                <span className="text-sm font-mono font-black text-white">{order.pickup_code}</span>
                                            </div>
                                        )}

                                        {/* Código de Rastreio para Envio Externo */}
                                        {order.tracking_code && (
                                            <div className="bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 rounded-lg flex flex-col">
                                                <span className="text-[8px] text-blue-400 font-black uppercase tracking-tighter">Rastreamento Nacional</span>
                                                <span className="text-xs font-mono font-black text-white">{order.tracking_code}</span>
                                            </div>
                                        )}

                                        {order.courier_name && (
                                            <div className="flex flex-col gap-1 mt-4">
                                                <div className="flex items-center gap-2 text-[10px] text-amber-500 font-black">
                                                    <div className="flex items-center gap-1"><Truck size={12} /> {order.courier_name}</div>
                                                    <div className="flex items-center gap-1 text-zinc-500 font-mono font-normal">
                                                        <Phone size={10} /> {order.courier_phone}
                                                    </div>
                                                </div>
                                                {order.courier_vehicle_model && (
                                                    <div className="text-[9px] text-zinc-500 font-bold bg-zinc-800/50 px-2 py-1 rounded inline-flex items-center gap-2">
                                                        <span className="text-zinc-600 uppercase">{order.courier_vehicle_type}</span>
                                                        <span className="text-zinc-300">{order.courier_vehicle_model}</span>
                                                        {order.courier_vehicle_plate && (
                                                            <span className="bg-white/10 px-1 rounded text-white">{order.courier_vehicle_plate}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Ações de Ordem */}
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                                        {/* Vendedor: Informar Rastreio */}
                                        {order.seller_id === state.currentUser?.id && order.status === 'WAITING_SHIPPING' && order.delivery_type === 'EXTERNAL_SHIPPING' && (
                                            <button
                                                onClick={() => {
                                                    const code = prompt('Digite o código de rastreamento (Correios/Transportadora):');
                                                    if (code) {
                                                        apiService.post(`/marketplace/order/${order.id}/ship`, { trackingCode: code })
                                                            .then(() => { onSuccess('Sucesso', 'Produto enviado!'); fetchData(); })
                                                            .catch(err => onError('Erro', err.message));
                                                    }
                                                }}
                                                className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black px-4 py-2 rounded-lg transition-all uppercase tracking-widest"
                                            >
                                                Informar Envio
                                            </button>
                                        )}

                                        {/* Comprador: Confirmar Recebimento */}
                                        {order.buyer_id === state.currentUser?.id && order.status === 'IN_TRANSIT' && (
                                            <button
                                                onClick={() => {
                                                    setConfirmData({
                                                        isOpen: true,
                                                        title: 'Confirmar Recebimento?',
                                                        message: 'Ao confirmar, o dinheiro será liberado para o vendedor. Faça isso apenas se já estiver com o produto em mãos.',
                                                        confirmText: 'CONFIRMAR RECEBIMENTO',
                                                        type: 'success',
                                                        onConfirm: async () => {
                                                            try {
                                                                const res = await apiService.post<any>(`/marketplace/order/${order.id}/confirm-receipt`, {});
                                                                if (res.success) {
                                                                    onSuccess('Sucesso!', 'Pedido concluído e dinheiro liberado.');
                                                                    fetchData();
                                                                    setConfirmData(null);
                                                                }
                                                            } catch (err: any) {
                                                                onError('Erro', err.message);
                                                            }
                                                        }
                                                    });
                                                }}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black px-4 py-2 rounded-lg transition-all uppercase tracking-widest shadow-lg shadow-emerald-600/20"
                                            >
                                                Confirmar Recebimento
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {view === 'missions' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="bg-gradient-to-br from-indigo-900/40 to-indigo-600/10 border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Mural de Missões</h3>
                            <p className="text-sm text-zinc-400 max-w-sm">
                                Ganhe dinheiro extra ajudando outros membros com a logística. Aceite missões que cruzam com seu caminho.
                            </p>
                        </div>
                        <Truck className="absolute -right-4 -bottom-4 text-indigo-500/20 w-32 h-32 rotate-12" />
                    </div>

                    {missions.length === 0 ? (
                        <div className="py-20 text-center bg-zinc-900/50 border border-zinc-800 rounded-3xl">
                            <Truck size={48} className="text-zinc-800 mx-auto mb-4" />
                            <p className="text-zinc-500 text-sm">Nenhuma missão de logística disponível no momento.</p>
                            <p className="text-[10px] text-zinc-600 mt-2">Novas oportunidades aparecem quando membros solicitam apoio.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {missions.map(mission => (
                                <div key={mission.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row gap-5 items-start md:items-center group hover:border-indigo-500/40 transition-all">
                                    <div className="w-16 h-16 bg-zinc-950 rounded-xl overflow-hidden shrink-0 border border-zinc-800">
                                        <img src={mission.image_url} alt={mission.item_title} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded uppercase tracking-widest">TRANSPORTE</span>
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase">• {new Date(mission.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <h4 className="font-bold text-white text-base">{mission.item_title}</h4>
                                        <p className="text-xs text-zinc-400 mt-2 flex flex-col gap-2">
                                            <span className="flex flex-col gap-0.5">
                                                <span className="flex items-center gap-2"><MapPin size={12} className="text-amber-500" /> <span className="text-zinc-500">Coleta:</span> <strong>{mission.pickup_address}</strong> ({mission.seller_name.split(' ')[0]})</span>
                                                <span className="flex items-center gap-2 pl-5 text-[10px] text-zinc-500 font-mono"><Phone size={10} /> {mission.seller_phone}</span>
                                            </span>
                                            <span className="flex flex-col gap-0.5">
                                                <span className="flex items-center gap-2"><MapPin size={12} className="text-primary-500" /> <span className="text-zinc-500">Entrega:</span> <strong>{mission.delivery_address}</strong> ({mission.buyer_name.split(' ')[0]})</span>
                                                <span className="flex items-center gap-2 pl-5 text-[10px] text-zinc-500 font-mono"><Phone size={10} /> {mission.buyer_phone}</span>
                                            </span>
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-0 border-zinc-800">
                                        <div className="text-right">
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Recompensa</p>
                                            <p className="text-xl font-black text-emerald-400">{formatCurrency(parseFloat(mission.delivery_fee))}</p>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                setConfirmData({
                                                    isOpen: true,
                                                    title: 'Aceitar Missão?',
                                                    message: 'Você se compromete a retirar o produto com o vendedor e entregar ao comprador. Ao aceitar, enviaremos o código de coleta.',
                                                    confirmText: 'ACEITAR MISSÃO',
                                                    type: 'info',
                                                    onConfirm: async () => {
                                                        try {
                                                            const res = await apiService.post<any>(`/marketplace/logistic/mission/${mission.id}/accept`, {});
                                                            if (res.success) {
                                                                onSuccess('Missão Aceita!', `Dirija-se ao local de coleta. O vendedor lhe fornecerá o código de segurança para validar a retirada.`);
                                                                setConfirmData(null);
                                                                fetchData(); // refresh
                                                            }
                                                        } catch (err: any) {
                                                            onError('Erro', err.message);
                                                        }
                                                    }
                                                });
                                            }}
                                            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 px-6 rounded-xl transition shadow-lg shadow-indigo-600/20 text-xs uppercase tracking-widest"
                                        >
                                            Aceitar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {view === 'offline' && (
                <OfflineMarketplaceView
                    user={state.currentUser}
                    pendingSales={pendingOfflineSales}
                    onSaveSale={handleSaveOfflineSale}
                    onSync={handleSyncOffline}
                />
            )}


            {view === 'details' && selectedItem && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
                    <div className="max-w-xl mx-auto min-h-screen bg-zinc-950 flex flex-col">
                        {/* Header Fixo de Detalhes */}
                        <div className="sticky top-0 z-10 p-4 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
                            <button onClick={() => setView('browse')} className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition">
                                <ArrowLeft size={20} />
                            </button>
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Detalhes do Anúncio</span>
                            <div className="flex gap-2">
                                <button className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition"><Share2 size={18} /></button>
                            </div>
                        </div>

                        {/* Galeria de Imagem (Estilo OLX) */}
                        <div className="aspect-square bg-zinc-900 relative">
                            {selectedItem.image_url ? (
                                <img src={selectedItem.image_url} alt={selectedItem.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-800">
                                    <ImageIcon size={64} />
                                    <span className="text-xs font-bold uppercase mt-2">Sem imagem disponível</span>
                                </div>
                            )}
                            {/* Overlay de Preço na Imagem */}
                            <div className="absolute bottom-6 left-6 right-6">
                                <div className="bg-black/60 backdrop-blur-xl p-4 rounded-2xl border border-white/10 inline-block">
                                    <p className="text-2xl font-black text-primary-400 tabular-nums">
                                        {formatCurrency(parseFloat(selectedItem.price))}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-8 pb-32">
                            {/* Título e Tags */}
                            <div>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    <span className="text-[9px] font-black bg-primary-500/10 text-primary-400 px-2 py-1 rounded-lg border border-primary-500/20 uppercase tracking-widest leading-none">
                                        {selectedItem.category}
                                    </span>
                                    {selectedItem.is_boosted && (
                                        <span className="text-[9px] font-black bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-lg border border-indigo-500/20 uppercase tracking-widest leading-none flex items-center gap-1">
                                            <Zap size={10} /> Destaque
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-2xl font-black text-white tracking-tight leading-tight">{selectedItem.title}</h1>

                                {/* Info de Localização e Data */}
                                <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin size={12} className="text-primary-500" />
                                        {selectedItem.seller_address || 'Brasil'}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={12} className="text-zinc-600" />
                                        Publicado {new Date(selectedItem.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            {/* Cartão do Vendedor (Estilo Profissional) */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center border border-white/5 relative">
                                        <User size={24} className="text-zinc-600" />
                                        {selectedItem.asaas_wallet_id && (
                                            <div className="absolute -top-1 -right-1 bg-emerald-500 p-1 rounded-full border-2 border-zinc-900">
                                                <ShieldCheck size={10} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-white">{selectedItem.seller_name}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="flex items-center gap-0.5">
                                                {[1, 2, 3, 4, 5].map(i => (
                                                    <Sparkles key={i} size={8} className={i <= 4 ? "text-primary-400" : "text-zinc-800"} />
                                                ))}
                                            </div>
                                            <span className="text-[9px] text-zinc-500 font-bold uppercase">Membro desde 2024</span>
                                        </div>
                                    </div>
                                </div>
                                <button className="text-[10px] font-black text-primary-400 hover:text-white transition uppercase tracking-widest">Ver Perfil</button>
                            </div>

                            {/* Descrição */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <Package size={14} className="text-primary-400" /> Descrição Completa
                                </h4>
                                <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{selectedItem.description}</p>
                            </div>

                            {/* Contato P2P Direto via WhatsApp */}
                            {selectedItem.seller_id !== state.currentUser?.id && selectedItem.type !== 'AFFILIATE' && (
                                <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/40 border border-emerald-500/20 rounded-3xl p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Phone size={16} className="text-emerald-400" />
                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Negociação Direta</span>
                                        </div>
                                        <span className="text-[9px] text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded uppercase">Sem taxas</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                                        Converse diretamente com o vendedor via WhatsApp. Combinem pagamento e entrega entre vocês.
                                    </p>
                                    <button
                                        onClick={async () => {
                                            setConfirmData({
                                                isOpen: true,
                                                title: 'Liberar WhatsApp?',
                                                message: 'Deseja usar 3 pontos de farm para ver o contato do vendedor e negociar direto?',
                                                confirmText: 'LIBERAR POR 3 PTS',
                                                type: 'success',
                                                onConfirm: async () => {
                                                    try {
                                                        const res = await apiService.get<any>(`/marketplace/contact/${selectedItem.id}`);
                                                        if (res.success && res.data.whatsapp) {
                                                            window.open(res.data.whatsapp, '_blank');
                                                            onSuccess('Chat Aberto', 'O WhatsApp do vendedor foi aberto. Negocie diretamente!');
                                                            onRefresh(); // Atualizar saldo de pontos
                                                            setConfirmData(null);
                                                        } else {
                                                            onError('Indisponível', 'O vendedor não informou telefone de contato.');
                                                        }
                                                    } catch (err: any) {
                                                        onError('Erro', err.message);
                                                    }
                                                }
                                            });
                                        }}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                                    >
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center gap-2">
                                                <Phone size={18} />
                                                <span>Liberar WhatsApp</span>
                                            </div>
                                            <span className="text-[8px] opacity-70 mt-1">Custo: 3 Pontos de Farm</span>
                                        </div>
                                    </button>
                                    <p className="text-[8px] text-zinc-600 text-center">
                                        ⚠️ Transação P2P sem garantias da plataforma
                                    </p>
                                </div>
                            )}

                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-4">
                                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <Truck size={14} className="text-primary-400" /> Opções de Entrega
                                </h4>
                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        onClick={() => setDeliveryOption('SELF_PICKUP')}
                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${deliveryOption === 'SELF_PICKUP' ? 'bg-primary-500/10 border-primary-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400"><Store size={18} /></div>
                                            <div className="text-left">
                                                <p className="text-xs font-black text-white uppercase">Retirada Pessoal</p>
                                                <p className="text-[10px] text-zinc-500">Você vai até o vendedor.</p>
                                            </div>
                                        </div>
                                        {deliveryOption === 'SELF_PICKUP' && <CheckCircle size={16} className="text-primary-400" />}
                                    </button>

                                    <button
                                        onClick={() => setDeliveryOption('COURIER_REQUEST')}
                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${deliveryOption === 'COURIER_REQUEST' ? 'bg-primary-500/10 border-primary-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400"><Truck size={18} /></div>
                                            <div className="text-left">
                                                <p className="text-xs font-black text-white uppercase">Entregador Cred30</p>
                                                <p className="text-[10px] text-zinc-500">Para entregas na mesma região.</p>
                                            </div>
                                        </div>
                                        {deliveryOption === 'COURIER_REQUEST' && <CheckCircle size={16} className="text-primary-400" />}
                                    </button>

                                    <button
                                        onClick={() => setDeliveryOption('EXTERNAL_SHIPPING')}
                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${deliveryOption === 'EXTERNAL_SHIPPING' ? 'bg-primary-500/10 border-primary-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400"><Package size={18} /></div>
                                            <div className="text-left">
                                                <p className="text-xs font-black text-white uppercase">Envio Nacional</p>
                                                <p className="text-[10px] text-zinc-500">Correios ou Transportadoras (Interstadual).</p>
                                            </div>
                                        </div>
                                        {deliveryOption === 'EXTERNAL_SHIPPING' && <CheckCircle size={16} className="text-primary-400" />}
                                    </button>
                                </div>

                                {deliveryOption !== 'SELF_PICKUP' && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase">Endereço de Entrega</label>
                                        <input
                                            placeholder="Rua, Número, Bairro, Cidade - Estado"
                                            value={deliveryAddress}
                                            onChange={e => setDeliveryAddress(e.target.value)}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="sticky bottom-6 mt-12 bg-black border border-zinc-800 p-4 rounded-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                                <div className="flex-1 space-y-4 mb-4">
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Método de Pagamento</p>
                                        <div className="bg-primary-500/10 border border-primary-500/30 p-4 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                                                <p className="text-[10px] font-black text-white uppercase tracking-widest">Saldo Interno</p>
                                            </div>
                                            <p className="text-[10px] font-bold text-primary-400">{formatCurrency(state.currentUser?.balance || 0)}</p>
                                        </div>
                                    </div>


                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-xl font-black text-white">
                                                {(() => {
                                                    const base = parseFloat(selectedItem.price) + (deliveryOption === 'COURIER_REQUEST' ? parseFloat(offeredFee || '0') : deliveryOption === 'EXTERNAL_SHIPPING' ? 35.00 : 0);
                                                    return formatCurrency(base);
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl transition shadow-lg shadow-primary-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                                    onClick={() => {
                                        if (!navigator.onLine) {
                                            generateOfflineVoucher(selectedItem);
                                            return;
                                        }

                                        // Se for afiliado, abre link
                                        if (selectedItem.type === 'AFFILIATE') {
                                            window.open(selectedItem.affiliate_url, '_blank');
                                            onSuccess('Redirecionando', 'Aproveite a oferta do parceiro!');
                                            return;
                                        }

                                        // Confirmação de Compra com Delivery
                                        setConfirmData({
                                            isOpen: true,
                                            title: deliveryOption === 'COURIER_REQUEST' ? 'Confirmar Compra + Entrega' : 'Confirmar Compra',
                                            message: `Deseja comprar "${selectedItem.title}" via ${paymentMethod}?`,
                                            confirmText: 'CONFIRMAR AGORA',
                                            type: 'success',
                                            onConfirm: async () => {
                                                try {
                                                    const res = await apiService.post<any>('/marketplace/buy', {
                                                        listingId: selectedItem.id,
                                                        deliveryType: deliveryOption,
                                                        offeredDeliveryFee: deliveryOption === 'COURIER_REQUEST' ? parseFloat(offeredFee) : deliveryOption === 'EXTERNAL_SHIPPING' ? 35.00 : 0,
                                                        deliveryAddress: deliveryAddress || 'Endereço Principal',
                                                        contactPhone: (state.currentUser as any)?.phone || '000000000',
                                                        paymentMethod: 'BALANCE'
                                                    });
                                                    if (res.success) {
                                                        onSuccess('Sucesso!', 'Compra realizada. Veja detalhes em Seus Pedidos.');
                                                        setView('my-orders');
                                                        setConfirmData(null);
                                                    }
                                                } catch (err: any) {
                                                    onError('Erro', err.message);
                                                }
                                            }
                                        });
                                    }}
                                >
                                    {!navigator.onLine ? 'GERAR VOUCHER OFFLINE' : (selectedItem.type === 'AFFILIATE' ? 'Ver Oferta Parceira' : 'Comprar Agora')}
                                    <ChevronRight size={18} />
                                </button>
                            </div>

                            {selectedItem.type !== 'AFFILIATE' && (
                                <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Opções de Logística</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setDeliveryOption('SELF_PICKUP')}
                                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl border transition ${deliveryOption === 'SELF_PICKUP' ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-transparent border-zinc-800 text-zinc-500'}`}
                                        >
                                            Vou Retirar
                                        </button>
                                        <button
                                            onClick={() => setDeliveryOption('COURIER_REQUEST')}
                                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl border transition ${deliveryOption === 'COURIER_REQUEST' ? 'bg-indigo-900/40 border-indigo-500/50 text-indigo-300' : 'bg-transparent border-zinc-800 text-zinc-500'}`}
                                        >
                                            Entregador
                                        </button>
                                        <button
                                            onClick={() => setDeliveryOption('EXTERNAL_SHIPPING')}
                                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl border transition ${deliveryOption === 'EXTERNAL_SHIPPING' ? 'bg-blue-900/40 border-blue-500/50 text-blue-300' : 'bg-transparent border-zinc-800 text-zinc-500'}`}
                                        >
                                            Envio Nacional
                                        </button>
                                    </div>

                                    {deliveryOption === 'COURIER_REQUEST' && (
                                        <div className="animate-in slide-in-from-top duration-300">
                                            <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1">Oferta de Ajuda de Custo (R$)</label>
                                            <input
                                                type="number"
                                                value={offeredFee}
                                                onChange={(e) => setOfferedFee(e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                                                placeholder="Valor para o entregador (Ex: 10.00)"
                                            />
                                            <p className="text-[9px] text-zinc-600 mt-1 italic">Este valor será pago integralmente ao membro que realizar a entrega.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {offlineVoucher && (
                                <div className="mt-6 bg-primary-500/10 border border-primary-500/30 p-6 rounded-3xl animate-in zoom-in duration-300">
                                    <div className="text-center space-y-2">
                                        <p className="text-[10px] text-primary-400 font-black uppercase tracking-widest">Código de Pagamento Offline</p>
                                        <p className="text-4xl font-black text-white font-mono tracking-tighter">{offlineVoucher.code}</p>
                                        <p className="text-[11px] text-zinc-400 leading-tight">O vendedor deve digitar este código no "Modo Interior" do App dele para validar sua compra.</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-zinc-500 font-bold uppercase tracking-widest border-t border-zinc-800 pt-4">
                                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Transação Segura</span>
                                <span className="flex items-center gap-1"><Truck size={12} /> Entrega Combinada</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {confirmData && (
                <ConfirmModal
                    isOpen={confirmData.isOpen}
                    onClose={() => setConfirmData(null)}
                    onConfirm={() => {
                        if (confirmData.showPaymentMethods) {
                            confirmData.onConfirm(paymentMethod);
                        } else {
                            confirmData.onConfirm();
                        }
                    }}
                    title={confirmData.title}
                    message={confirmData.message}
                    confirmText={confirmData.confirmText}
                    type={confirmData.type}
                >
                    {confirmData.showPaymentMethods && (
                        <div className="space-y-4 mb-6">
                            <div className="space-y-2">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Método de Pagamento</p>
                                <div className="bg-primary-500/10 border border-primary-500/30 p-2 rounded-lg text-center">
                                    <p className="text-[9px] font-black text-primary-400 uppercase tracking-widest">Saldo Interno</p>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-zinc-800">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Total a Pagar</p>
                                <p className="text-xl font-black text-white">
                                    {(() => {
                                        const base = confirmData.title.includes('Impulsionar') ? 5.00 : parseFloat(selectedItem?.price || '0');
                                        return formatCurrency(base);
                                    })()}
                                </p>
                            </div>
                        </div>
                    )}
                </ConfirmModal>
            )}

            {trackingOrder && (
                <OrderTrackingMap
                    orderId={trackingOrder.id}
                    onClose={() => setTrackingOrder(null)}
                    userRole={trackingOrder.courier_id === state.currentUser?.id ? 'courier' : 'buyer'}
                />
            )}
        </div>
    );
};
