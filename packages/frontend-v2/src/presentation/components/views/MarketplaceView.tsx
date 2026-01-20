import React, { useState, useEffect, useCallback } from 'react';
import { OrderCard } from '../marketplace/OrderCard';
import {
    Search,
    Tag,
    ArrowLeft,
    ShieldCheck,
    History as HistoryIcon,
    Package,
    X as XIcon,
    MapPin,
    Navigation2,
    ChevronDown,
    Plus,
    Loader2,
    Image as ImageIcon,
    AlertTriangle,
    Store,
    Bike,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { AppState } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';
import { ConfirmModal } from '../ui/ConfirmModal';
import { OfflineMarketplaceView } from './OfflineMarketplaceView';
import { useDebounce } from '../../hooks/use-performance';
import { LoadingScreen } from '../ui/LoadingScreen';
import { OrderTrackingMap } from '../features/marketplace/OrderTrackingMap';
import { useLocation } from '../../hooks/use-location';
import { useGps } from '../../hooks/use-gps';

// Modularized Components & Constants
import { CATEGORY_ICONS, MARKETPLACE_CATEGORIES } from '../marketplace/marketplace.constants';
import { ListingCard } from '../marketplace/ListingCard';
import { MissionsView } from '../marketplace/MissionsView';
import { ItemDetailsView } from '../marketplace/ItemDetailsView';
import { CreateListingView } from '../marketplace/CreateListingView';
import { AvailableDeliveriesMap } from '../features/logistics/AvailableDeliveriesMap';
// Modularized Components & Constants

interface MarketplaceViewProps {
    state: AppState;
    onRefresh: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const MarketplaceView = ({ state, onRefresh, onSuccess, onError }: MarketplaceViewProps) => {
    const navigate = useNavigate();
    const isGuest = !state.currentUser;


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

    // Cart Delivery State
    const [cartDeliveryOption, setCartDeliveryOption] = useState<'SELF_PICKUP' | 'COURIER_REQUEST' | 'EXTERNAL_SHIPPING'>('SELF_PICKUP');
    const [cartDeliveryAddress, setCartDeliveryAddress] = useState('');
    const [cartOfferedFee, setCartOfferedFee] = useState('10.00'); // Default bundle fee
    const [cartGpsLocation, setCartGpsLocation] = useState<{ lat: number, lng: number } | null>(null);

    const [gpsLocation, setGpsLocation] = useState<{ city: string, state: string, neighborhood: string, accuracy?: number } | null>(null);
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
    const [redeemCode, setRedeemCode] = useState('');
    const [paymentMethod] = useState<'BALANCE'>('BALANCE');
    const [cart, setCart] = useState<{ sellerId: string | null; sellerName: string | null; items: any[] }>(() => {
        const saved = localStorage.getItem('cred30_cart');
        return saved ? JSON.parse(saved) : { sellerId: null, sellerName: null, items: [] };
    });
    const [invitedCourierId, setInvitedCourierId] = useState('');

    const [trackingOrder, setTrackingOrder] = useState<any>(null);
    const [courierPricePerKm, setCourierPricePerKm] = useState<number>(2.0);
    const [showMissionsMap, setShowMissionsMap] = useState(false);
    const { getLocation, isLoading: isGpsLoading } = useGps(onSuccess, onError);

    const addToCart = (item: any) => {
        if (isGuest) {
            navigate('/auth');
            return;
        }

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

    const { ufs, cities, fetchCities } = useLocation();

    // Filtros de Localização
    const [selectedUF, setSelectedUF] = useState<string>('');
    const [selectedCity, setSelectedCity] = useState<string>('');
    const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('');
    const debouncedNeighborhood = useDebounce(selectedNeighborhood, 1000);
    const [showFilters, setShowFilters] = useState(false);

    // Effect to load cities when UF changes
    useEffect(() => {
        if (selectedUF) {
            fetchCities(selectedUF);
        }
    }, [selectedUF]);

    const [newListing, setNewListing] = useState<{
        title: string;
        description: string;
        price: string;
        category: string;
        image_url: string;
        images: string[];
        variants: { name?: string; color?: string; size?: string; stock: number; price?: number }[];
        quotaId: number | null;
        requiredVehicle: 'BIKE' | 'MOTO' | 'CAR' | 'TRUCK';
        stock: string;
        pickupAddress: string;
    }>({
        title: '',
        description: '',
        price: '',
        category: 'ELETRÔNICOS',
        image_url: '',
        images: [],
        variants: [],
        quotaId: null,
        requiredVehicle: 'MOTO',
        stock: '1',
        pickupAddress: ''
    });

    const categories = MARKETPLACE_CATEGORIES;
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
                city: selectedCity,
                neighborhood: debouncedNeighborhood
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
    }, [offset, selectedCategory, debouncedSearchQuery, selectedUF, selectedCity, debouncedNeighborhood]);

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

                // Buscar status e preço por KM do entregador
                const courierRes = await apiService.get<any>('/logistics/status');
                if (courierRes.success && courierRes.data) {
                    setCourierPricePerKm(courierRes.data.pricePerKm || 2.0);
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
    }, [view, selectedCategory, debouncedSearchQuery, selectedUF, selectedCity, debouncedNeighborhood]); // Removi fetchData da dependência para evitar loops se não for browse

    const handleCreateListing = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload: any = {
                title: newListing.title,
                description: newListing.description,
                price: parseFloat(newListing.price),
                category: newListing.category,
                imageUrl: newListing.image_url || undefined,
                images: newListing.images,
                variants: newListing.variants,
                requiredVehicle: newListing.requiredVehicle,
                stock: parseInt(newListing.stock),
                ...(gpsLocation ? gpsLocation : {})
            };

            // Se for uma cota, enviar o ID
            if (newListing.quotaId) {
                payload.quotaId = newListing.quotaId;
            }

            const response = await apiService.post<any>('/marketplace/create', payload);
            if (response.success) {
                onSuccess('Sucesso', newListing.quotaId ? 'Sua cota-parte foi listada para repasse!' : 'Anúncio publicado!');
                setView('browse');
                setNewListing({
                    title: '', description: '', price: '', category: 'ELETRÔNICOS',
                    image_url: '', images: [], variants: [],
                    quotaId: null, requiredVehicle: 'MOTO', stock: '1', pickupAddress: ''
                });
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



    const handleUseMyLocation = async () => {
        const corrected = await getLocation();
        if (corrected) {
            setSelectedUF(corrected.state);
            setTimeout(() => {
                if (corrected.city) setSelectedCity(corrected.city);
                if (corrected.neighborhood) setSelectedNeighborhood(corrected.neighborhood);
            }, 800);
            setShowFilters(true);
        }
    };

    const handleGetListingGPS = async () => {
        const corrected = await getLocation({ highAccuracy: true });
        if (corrected) {
            setGpsLocation(corrected);
        }
    };

    const handleGetCartGPS = async () => {
        const corrected = await getLocation();
        if (corrected) {
            setCartGpsLocation({ lat: corrected.lat || 0, lng: corrected.lng || 0 });

            let addressText = "Minha Localização Atual (GPS)";
            if (corrected.neighborhood) addressText = `${corrected.neighborhood}, ${corrected.city} - ${corrected.state}`;

            setCartDeliveryAddress(addressText);
        }
    };

    // Loading principal
    if (!state) {
        return <LoadingScreen message="Carregando marketplace..." />;
    }

    if ((isLoading || isGpsLoading) && view === 'browse' && listings.length === 0) {
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
                        {selectedCity ? `${selectedCity}, ${selectedUF}` : (selectedUF || 'Brasil')} • {listings.length} anúncios ativos
                    </p>
                </div>

                {view !== 'details' && (
                    <button
                        onClick={() => {
                            if (isGuest) {
                                navigate('/auth');
                                return;
                            }
                            const userQuotas = state.quotas.filter(q => q.userId === state.currentUser?.id).length;
                            const userScore = state.currentUser?.score || 0;
                            const isSeller = state.currentUser?.is_seller;

                            if (!isSeller && userQuotas < 1 && userScore < 300) {
                                onError('Requisito de Confiança', 'Para proteger a comunidade, apenas Membros Investidores (1+ Cotas) ou com Alto Score (>300) podem criar anúncios.');
                                return;
                            }
                            setView('create');
                        }}
                        className="bg-primary-500 hover:bg-primary-400 text-black px-6 py-3 rounded-2xl font-black text-xs transition-all shadow-xl shadow-primary-500/20 active:scale-95 flex items-center gap-2 uppercase tracking-widest"
                    >
                        <Plus size={18} /> ANUNCIAR
                    </button>
                )}
            </div>

            {isGuest && view === 'browse' && (
                <div className="bg-gradient-to-br from-primary-600 to-blue-700 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-x-10 -translate-y-10 blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                    <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="text-center sm:text-left">
                            <h3 className="text-xl font-black text-white tracking-tighter">BEM-VINDO AO CLUBE! 🚀</h3>
                            <p className="text-white/80 text-xs font-medium mt-1">Você está no modo visitante. Cadastre-se para comprar parcelado, ganhar pontos farm e taxas de 3,5%!</p>
                        </div>
                        <button
                            onClick={() => navigate('/auth')}
                            className="bg-white text-primary-600 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/20"
                        >
                            CRIAR CONTA GRÁTIS
                        </button>
                    </div>
                </div>
            )}

            {/* Abas de Navegação Secundária */}
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
                <button
                    onClick={() => setView('browse')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${view === 'browse' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                    Explorar
                </button>
                <button
                    onClick={() => {
                        if (isGuest) navigate('/auth');
                        else setView('my-orders');
                    }}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${view === 'my-orders' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                    Meus Pedidos
                </button>
                <button
                    onClick={() => {
                        if (isGuest) navigate('/auth');
                        else navigate('/app/logistics');
                    }}
                    className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition text-zinc-500 hover:bg-zinc-800 hover:text-white"
                >
                    Entregas
                </button>
                <button
                    onClick={() => {
                        if (isGuest) navigate('/auth');
                        else setView('offline');
                    }}
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
                                onClick={handleUseMyLocation}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary-500/10 text-primary-400 text-[9px] font-black uppercase tracking-wider hover:bg-primary-500 hover:text-black transition-all"
                                title="Usar minha localização atual"
                            >
                                <Navigation2 size={10} /> Perto de Mim
                            </button>

                            <div className="h-4 w-px bg-white/10 mx-1" />

                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition ${showFilters || selectedUF ? 'text-white' : 'text-primary-200/70 hover:text-white'}`}
                            >
                                <MapPin size={12} /> {selectedUF ? `${selectedCity ? selectedCity + '-' : ''}${selectedUF}` : 'Filtrar por Localização'}
                                <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </button>

                            {(selectedUF || selectedCity || selectedNeighborhood) && (
                                <button
                                    onClick={() => { setSelectedUF(''); setSelectedCity(''); setSelectedNeighborhood(''); }}
                                    className="text-[9px] text-zinc-400 underline hover:text-white"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>

                        {showFilters && (
                            <div className="pt-2 animate-in slide-in-from-top-2 duration-200 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="col-span-1">
                                        <select
                                            value={selectedUF}
                                            onChange={(e) => { setSelectedUF(e.target.value); setSelectedCity(''); setSelectedNeighborhood(''); }}
                                            className="w-full bg-zinc-800 text-white text-xs rounded-lg p-3 font-medium focus:outline-none focus:ring-1 focus:ring-primary-400 border border-zinc-700"
                                        >
                                            <option value="" className="bg-zinc-900 text-zinc-500">Filtrar Estado</option>
                                            {ufs.map(uf => (
                                                <option key={uf.id} value={uf.sigla} className="bg-zinc-900">{uf.nome} ({uf.sigla})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-1">
                                        <select
                                            value={selectedCity}
                                            onChange={(e) => setSelectedCity(e.target.value)}
                                            disabled={!selectedUF}
                                            className="w-full bg-zinc-800 text-white text-xs rounded-lg p-3 font-medium focus:outline-none focus:ring-1 focus:ring-primary-400 border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <option value="" className="bg-zinc-900 text-zinc-500">{!selectedUF ? 'UF 1º' : 'Todas Cidades'}</option>
                                            {cities.map(city => (
                                                <option key={city.id} value={city.nome} className="bg-zinc-900">{city.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={selectedNeighborhood}
                                    onChange={(e) => setSelectedNeighborhood(e.target.value)}
                                    placeholder="Filtrar por Bairro..."
                                    className="w-full bg-zinc-800 text-white text-xs rounded-lg p-3 font-medium focus:outline-none focus:ring-1 focus:ring-primary-400 border border-zinc-700 placeholder:text-zinc-600"
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
                                    <button
                                        onClick={() => {
                                            const userQuotas = state.quotas.filter(q => q.userId === state.currentUser?.id).length;
                                            const userScore = state.currentUser?.score || 0;
                                            if (userQuotas < 1 && userScore < 300) {
                                                onError('Requisito de Confiança', 'Para proteger a comunidade, apenas Membros Investidores (1+ Cotas) ou com Alto Score (>300) podem criar anúncios.');
                                                return;
                                            }
                                            setView('create');
                                        }}
                                        className="text-primary-400 text-xs font-bold mt-2"
                                    >
                                        Clique aqui para ser o primeiro!
                                    </button>
                                </div>
                            );
                        }

                        return (
                            <>
                                {/* Anúncios desativados para experiência limpa */}
                                {/*
                                <div className="col-span-1">
                                    <AdBanner
                                        type="BANNER"
                                        title="Ganhe + R$ 500 no Saldo"
                                        description="Confira como liberar bônus de parceiros assistindo vídeos."
                                        actionText="LIBERAR AGORA"
                                    />
                                </div>
                                */}

                                {listings.map((item) => (
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

                                        {/* Anúncios nativos desativados */}
                                        {/*
                                        {(index + 1) % 3 === 0 && (
                                            <NativeAdCard
                                                title={index === 2 ? "Novo Cartão Black Sem Anuidade" : "Apoio Financeiro Parceiro"}
                                                price={index === 2 ? "GRÁTIS" : "SIMULAR"}
                                                category="OFERTA"
                                                img={index === 2 ? "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80" : "https://images.unsplash.com/photo-1554224155-16974a4005d1?auto=format&fit=crop&w=600&q=80"}
                                            />
                                        )}
                                        */}
                                    </React.Fragment>
                                ))}

                                {/* AdBanner desativado */}
                                {/*
                                <div className="col-span-1">
                                    <AdBanner
                                        type="TIP"
                                        description="Dica: Clique em anúncios parceiros para aumentar seu Score Cred30."
                                    />
                                </div>
                                */}

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
                                    {/* --- Seletor de Entrega no Carrinho --- */}
                                    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-4">
                                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                            <Package size={16} className="text-primary-400" />
                                            Método de Recebimento
                                        </h4>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setCartDeliveryOption('SELF_PICKUP')}
                                                className={`p-3 rounded-lg text-xs font-bold uppercase tracking-wide border transition flex flex-col items-center gap-2 ${cartDeliveryOption === 'SELF_PICKUP'
                                                    ? 'bg-primary-500/10 border-primary-500 text-primary-400'
                                                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                                                    }`}
                                            >
                                                <Store size={20} />
                                                Retirar no Local
                                            </button>
                                            <button
                                                onClick={() => setCartDeliveryOption('COURIER_REQUEST')}
                                                className={`p-3 rounded-lg text-xs font-bold uppercase tracking-wide border transition flex flex-col items-center gap-2 ${cartDeliveryOption === 'COURIER_REQUEST'
                                                    ? 'bg-primary-500/10 border-primary-500 text-primary-400'
                                                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                                                    }`}
                                            >
                                                <Bike size={20} />
                                                Pedir Entregador
                                            </button>
                                        </div>

                                        {cartDeliveryOption === 'COURIER_REQUEST' && (
                                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                                    <p className="text-[10px] text-blue-200">
                                                        Você está solicitando entrega para {cart.items.length} itens.
                                                        Certifique-se que o entregador consiga transportar tudo.
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] text-zinc-400 font-bold uppercase mb-1 block">Onde entregar?</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={cartDeliveryAddress}
                                                            onChange={(e) => setCartDeliveryAddress(e.target.value)}
                                                            placeholder="Endereço completo (Rua, Número, Bairro)"
                                                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500"
                                                        />
                                                        <button
                                                            onClick={handleGetCartGPS}
                                                            className="bg-zinc-800 text-white p-2 rounded-lg hover:bg-zinc-700 active:scale-95 transition"
                                                            title="Usar GPS"
                                                        >
                                                            <MapPin size={18} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] text-zinc-400 font-bold uppercase mb-1 block">Oferta pela Entrega (R$)</label>
                                                    <input
                                                        type="number"
                                                        value={cartOfferedFee}
                                                        onChange={(e) => setCartOfferedFee(e.target.value)}
                                                        placeholder="Ex: 10.00"
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500"
                                                    />
                                                    <p className="text-[9px] text-zinc-500 mt-1">Valor sugerido para o trajeto total.</p>
                                                </div>
                                            </div>
                                        )}

                                        {cartDeliveryOption === 'SELF_PICKUP' && (
                                            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                                                <p className="text-[10px] text-zinc-400">
                                                    Você deverá ir até o vendedor para buscar os produtos. O endereço será revelado após o pagamento.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-start">
                                        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-amber-200/80 leading-relaxed">
                                            Ao confirmar, o sistema processará {cart.items.length} pedidos individuais para o vendedor <strong>{cart.sellerName}</strong>.
                                            O pagamento será debitado do seu saldo.
                                        </p>
                                    </div>

                                    <button
                                        disabled={cartDeliveryOption === 'COURIER_REQUEST' && (!cartDeliveryAddress || !cartOfferedFee)}
                                        onClick={async () => {
                                            const total = cart.items.reduce((acc, i) => acc + parseFloat(i.price), 0);
                                            const fee = cartDeliveryOption === 'COURIER_REQUEST' ? parseFloat(cartOfferedFee || '0') : 0;
                                            const finalTotal = total + fee;

                                            setConfirmData({
                                                isOpen: true,
                                                title: 'Finalizar Pedido (Lote)',
                                                message: `Confirmar compra de ${cart.items.length} itens? \nProdutos: ${formatCurrency(total)}\nEntrega: ${formatCurrency(fee)}\nTotal: ${formatCurrency(finalTotal)}`,
                                                confirmText: `PAGAR ${formatCurrency(finalTotal)}`,
                                                type: 'success',
                                                onConfirm: async () => {
                                                    setIsLoading(true);
                                                    setConfirmData(null);

                                                    try {
                                                        const res = await apiService.post('/marketplace/buy', {
                                                            listingIds: cart.items.map(i => i.id),
                                                            deliveryType: cartDeliveryOption,
                                                            paymentMethod: 'BALANCE',
                                                            deliveryAddress: cartDeliveryAddress || 'Retirada no Local',
                                                            contactPhone: (state.currentUser as any)?.phone || '000000000',
                                                            deliveryLat: cartGpsLocation?.lat || 0,
                                                            deliveryLng: cartGpsLocation?.lng || 0,
                                                            offeredDeliveryFee: cartOfferedFee,
                                                            invitedCourierId: invitedCourierId,
                                                            pickupLat: cart.items[0].pickup_lat,
                                                            pickupLng: cart.items[0].pickup_lng
                                                        });

                                                        if (res.success) {
                                                            onSuccess('Sucesso!', 'Seu lote de itens foi processado com sucesso!');
                                                            clearCart();
                                                            setView('my-orders');
                                                        }
                                                    } catch (e: any) {
                                                        onError('Erro no Lote', e.message);
                                                    } finally {
                                                        setIsLoading(false);
                                                    }
                                                }
                                            });
                                        }}
                                        className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-xl uppercase tracking-widest shadow-lg shadow-primary-500/20 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        PAGAR LOTE AGORA
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {view === 'create' && (
                <CreateListingView
                    newListing={newListing}
                    setNewListing={setNewListing}
                    onSubmit={handleCreateListing}
                    onCancel={() => setView('browse')}
                    onGetGPS={handleGetListingGPS}
                    gpsLocation={gpsLocation}
                    setGpsLocation={setGpsLocation}
                    isSubmitting={isSubmitting}
                />
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
                            <OrderCard
                                key={order.id}
                                order={order}
                                currentUser={state.currentUser}
                                apiService={apiService}
                                onSuccess={onSuccess}
                                onError={onError}
                                setConfirmData={setConfirmData}
                                fetchData={fetchData}
                                setTrackingOrder={setTrackingOrder}
                                formatCurrency={formatCurrency}
                            />
                        ))
                    )}
                </div>
            )}

            {view === 'missions' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowMissionsMap(true)}
                            className="bg-primary-500 hover:bg-primary-400 text-black font-black text-[10px] px-4 py-2 rounded-xl uppercase transition flex items-center gap-2 shadow-lg shadow-primary-500/20"
                        >
                            <MapPin size={14} /> Ver Entregas no Mapa
                        </button>
                    </div>
                    <MissionsView
                        missions={missions}
                        currentUserId={state.currentUser?.id || ''}
                        formatCurrency={formatCurrency}
                        pricePerKm={courierPricePerKm}
                        onUpdatePrice={async (newPrice) => {
                            try {
                                const res = await apiService.post('/logistics/update-price', { pricePerKm: newPrice });
                                if (res.success) {
                                    setCourierPricePerKm(newPrice);
                                    onSuccess('Sucesso', 'Preço por KM atualizado!');
                                }
                            } catch (err: any) {
                                onError('Erro', err.message);
                            }
                        }}
                        onAccept={(mission: any) => {
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
                                            onSuccess('Missão Aceita!', 'Agora você pode ver os detalhes na aba Logística.');
                                            fetchData();
                                        }
                                    } catch (err: any) {
                                        onError('Erro', err.message);
                                    } finally {
                                        setConfirmData(null);
                                    }
                                }
                            });
                        }}
                    />
                </div>
            )}

            {/* Mapa de Entregas Disponíveis */}
            {showMissionsMap && (
                <AvailableDeliveriesMap
                    deliveries={missions.map(m => ({
                        ...m,
                        order_id: m.id // Mapiando mission id para order_id esperado pelo componente
                    }))}
                    onClose={() => setShowMissionsMap(false)}
                    onAccept={async (id) => {
                        try {
                            const res = await apiService.post<any>(`/marketplace/logistic/mission/${id}/accept`, {});
                            if (res.success) {
                                onSuccess('Missão Aceita!', 'Siga para o ponto de coleta.');
                                fetchData();
                            }
                        } catch (err: any) {
                            onError('Erro', err.message);
                        }
                    }}
                    onIgnore={(id) => {
                        // Apenas remove da visualização local se desejar, ou ignora
                        setMissions(prev => prev.filter(m => m.id !== id));
                    }}
                />
            )}
            {/* Visualização Offline */}
            {view === 'offline' && (
                <OfflineMarketplaceView
                    user={state.currentUser}
                    pendingSales={pendingOfflineSales}
                    onSaveSale={handleSaveOfflineSale}
                    onSync={handleSyncOffline}
                />
            )}

            {view === 'details' && selectedItem && (
                <ItemDetailsView
                    item={selectedItem}
                    currentUser={state.currentUser}
                    formatCurrency={formatCurrency}
                    onClose={() => setView('browse')}
                    onContact={(item: any) => {
                        if (isGuest) {
                            navigate('/auth');
                            return;
                        }
                        setConfirmData({
                            isOpen: true,
                            title: 'Liberar WhatsApp?',
                            message: 'Deseja usar 3 pontos de farm para ver o contato do vendedor e negociar direto?',
                            confirmText: 'LIBERAR POR 3 PTS',
                            type: 'success',
                            onConfirm: async () => {
                                try {
                                    const res = await apiService.get<any>(`/marketplace/contact/${item.id}`);
                                    if (res.success && res.data.whatsapp) {
                                        window.open(res.data.whatsapp, '_blank');
                                        onSuccess('Chat Aberto', 'O WhatsApp do vendedor foi aberto. Negocie diretamente!');
                                        setConfirmData(null);
                                        onRefresh();
                                    } else {
                                        onError('Indisponível', 'O vendedor não informou telefone de contato.');
                                    }
                                } catch (err: any) {
                                    onError('Erro', err.message);
                                }
                            }
                        });
                    }}
                    onBuy={async (data: any) => {
                        // Tentar pegar localização para frete se necessário
                        let deliveryCoords = { lat: 0, lng: 0 };
                        if (navigator.geolocation) {
                            const pos = await new Promise<any>((resolve) => {
                                navigator.geolocation.getCurrentPosition(resolve, () => resolve(null));
                            });
                            if (pos) {
                                deliveryCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                            }
                        }

                        setConfirmData({
                            isOpen: true,
                            title: 'Confirmar Compra',
                            message: `Deseja comprar "${selectedItem.title}"?`,
                            confirmText: 'CONFIRMAR AGORA',
                            type: 'success',
                            onConfirm: async () => {
                                try {
                                    const payload = {
                                        listingId: data.listingId,
                                        deliveryType: data.deliveryType,
                                        offeredDeliveryFee: data.deliveryFee,
                                        deliveryAddress: data.deliveryAddress,
                                        contactPhone: (state.currentUser as any).phone || '',
                                        invitedCourierId: data.invitedCourierId,
                                        deliveryLat: deliveryCoords.lat,
                                        deliveryLng: deliveryCoords.lng,
                                        pickupLat: selectedItem.pickup_lat,
                                        pickupLng: selectedItem.pickup_lng,
                                        quantity: data.quantity || 1,
                                    };

                                    let res;
                                    if (data.paymentMethod === 'CREDIT') {
                                        res = await apiService.buyMarketplaceOnCredit({
                                            ...payload,
                                            installments: data.installments
                                        });
                                    } else {
                                        res = await apiService.buyMarketplaceListing(payload);
                                    }

                                    if (res.success) {
                                        onSuccess('Sucesso!', res.message || 'Compra realizada com sucesso!');
                                        setView('my-orders');
                                        setConfirmData(null);
                                        await onRefresh();
                                    } else {
                                        onError('Atenção', res.message || 'Erro ao processar compra.');
                                    }
                                } catch (err: any) {
                                    onError('Erro', err.message);
                                }
                            }
                        });
                    }}
                    deliveryOption={deliveryOption}
                    setDeliveryOption={setDeliveryOption}
                    offeredFee={offeredFee}
                    setOfferedFee={setOfferedFee}
                    invitedCourierId={invitedCourierId}
                    setInvitedCourierId={setInvitedCourierId}
                    deliveryAddress={deliveryAddress}
                    setDeliveryAddress={setDeliveryAddress}
                />
            )}


            {confirmData && (
                <ConfirmModal
                    isOpen={confirmData.isOpen}
                    onClose={() => setConfirmData(null)}
                    onConfirm={() => confirmData.onConfirm(paymentMethod)}
                    title={confirmData.title}
                    message={confirmData.message}
                    confirmText={confirmData.confirmText}
                    type={confirmData.type}
                >
                    {confirmData.showPaymentMethods && (
                        <div className="space-y-4 mb-6">
                            <div className="pt-2 border-t border-zinc-800">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Saldo Interno</p>
                                <p className="text-xl font-black text-white">
                                    {formatCurrency(state.currentUser?.balance || 0)}
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

