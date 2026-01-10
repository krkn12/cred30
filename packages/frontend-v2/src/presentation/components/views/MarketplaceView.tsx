import React, { useState, useEffect, memo, useCallback } from 'react';
import { OrderCard } from '../marketplace/OrderCard';
import {
    Search,
    Tag,
    Image as ImageIcon,
    Zap,
    Sparkles,
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
    Bike,
} from 'lucide-react';

const VEHICLE_ICONS: Record<string, any> = {
    'BIKE': Bike,
    'MOTO': Zap,
    'CAR': Car,
    'TRUCK': Truck
};

const DELIVERY_MIN_FEES: Record<string, number> = {
    'BIKE': 5.00,
    'MOTO': 10.00,
    'CAR': 30.00,
    'TRUCK': 80.00
};

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
import { useLocation } from '../../hooks/use-location';

interface MarketplaceViewProps {
    state: AppState;
    onRefresh: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}



const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const ListingCard = memo(({ item, currentUserId, onBoost, onDetails, onAddToCart }: any) => {
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

                {/* Badge Superior Direito (Destaque/Tipo Veículo) */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                    {item.is_boosted && (
                        <div className="bg-primary-500 text-black text-[8px] px-2 py-1 rounded-full font-black flex items-center gap-1 shadow-lg shadow-primary-500/20 animate-pulse">
                            <Zap size={10} /> DESTAQUE
                        </div>
                    )}
                    {item.item_type !== 'DIGITAL' && (
                        <div className="bg-zinc-900/80 backdrop-blur-md text-white text-[8px] px-2 py-1 rounded-full font-black flex items-center gap-1 border border-white/10 shadow-lg">
                            {React.createElement(VEHICLE_ICONS[item.required_vehicle || 'MOTO'] || Zap, { size: 10 })}
                            {item.required_vehicle || 'MOTO'}
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
                            <span className="text-[10px] font-medium truncate max-w-[120px]" title={`${item.seller_address_neighborhood || ''} - ${item.seller_address_city || ''}/${item.seller_address_state || ''}`}>
                                {item.seller_address_neighborhood
                                    ? `${item.seller_address_neighborhood} - ${item.seller_address_city}/${item.seller_address_state}`
                                    : (item.seller_address_city
                                        ? `${item.seller_address_city}/${item.seller_address_state}`
                                        : (item.seller_address ? item.seller_address.split('-')[0].trim() : 'Brasil'))}
                            </span>
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

    // Defensive check
    if (!state) {
        return <LoadingScreen message="Carregando marketplace..." />;
    }

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
    const [gpsLocation, setGpsLocation] = useState<{ city: string, state: string, neighborhood: string } | null>(null);
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
        quotaId: number | null;
        requiredVehicle: 'BIKE' | 'MOTO' | 'CAR' | 'TRUCK';
    }>({
        title: '',
        description: '',
        price: '',
        category: 'ELETRÔNICOS',
        image_url: '',
        quotaId: null,
        requiredVehicle: 'MOTO'
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
                requiredVehicle: newListing.requiredVehicle,
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
                setNewListing({ title: '', description: '', price: '', category: 'ELETRÔNICOS', image_url: '', quotaId: null, requiredVehicle: 'MOTO' });
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



    const handleUseMyLocation = () => {
        if (!navigator.geolocation) {
            onError('Erro', 'Geolocalização não suportada.');
            return;
        }

        setIsLoading(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                // Nominatim API (Free)
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();

                if (data.address) {
                    const stateName = data.address.state;
                    const cityName = data.address.city || data.address.town || data.address.municipality;
                    const suburb = data.address.suburb || data.address.neighbourhood;

                    // Tentar encontrar a sigla do estado
                    // Como ufs é carregado do useLocation, devemos ter acesso.
                    // Assumindo que a API do IBGE retorna nomes parecidos com OSM.
                    // Vamos tentar buscar pelo nome.
                    const foundUF = ufs.find(u =>
                        u.nome.toLowerCase() === stateName?.toLowerCase() ||
                        u.sigla.toLowerCase() === stateName?.toLowerCase()
                    );

                    if (foundUF) {
                        setSelectedUF(foundUF.sigla);
                        // Delay para dar tempo de carregar as cidades (se necessário) ou apenas setar.
                        // O hook useLocation limpa cidades quando UF muda?
                        // Vamos setar com timeout para garantir.
                        setTimeout(() => {
                            if (cityName) setSelectedCity(cityName);
                            if (suburb) setSelectedNeighborhood(suburb);
                        }, 800);

                        setShowFilters(true);
                        onSuccess('Localização Definida', `${cityName || 'Cidade'} - ${foundUF.sigla}`);
                    } else {
                        onError('Ops', `Estado não reconhecido: ${stateName}`);
                    }
                }
            } catch (error) {
                console.error(error);
                onError('Erro', 'Falha ao buscar endereço GPS.');
            } finally {
                setIsLoading(false);
            }
        }, (err) => {
            console.warn(err);
            setIsLoading(false);
            onError('Erro no GPS', 'Verifique se a permissão de localização está ativa.');
        });
    };

    const handleGetListingGPS = () => {
        if (!navigator.geolocation) {
            onError('Erro', 'Geolocalização não suportada.');
            return;
        }

        setIsLoading(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();

                if (data.address) {
                    const stateName = data.address.state;
                    const cityName = data.address.city || data.address.town || data.address.municipality;
                    const neighborhood = data.address.suburb || data.address.neighbourhood;

                    const foundUF = ufs.find(u =>
                        u.nome.toLowerCase() === stateName?.toLowerCase() ||
                        u.sigla.toLowerCase() === stateName?.toLowerCase()
                    );

                    if (cityName && foundUF) {
                        setGpsLocation({
                            city: cityName,
                            state: foundUF.sigla,
                            neighborhood: neighborhood || ''
                        });
                        onSuccess('Localização Definida', `Seu anúncio será em: ${neighborhood ? neighborhood + ' - ' : ''}${cityName}/${foundUF.sigla}`);
                    } else {
                        onError('Erro', 'Não conseguimos identificar sua cidade/estado com precisão.');
                    }
                }
            } catch (error) {
                console.error(error);
                onError('Erro', 'Falha ao buscar GPS.');
            } finally {
                setIsLoading(false);
            }
        }, (err) => {
            console.warn(err);
            setIsLoading(false);
            onError('Erro', 'Permissão de localização negada.');
        });
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
                                    <button onClick={() => setView('create')} className="text-primary-400 text-xs font-bold mt-2">Clique aqui para ser o primeiro!</button>
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
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-start">
                                        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-amber-200/80 leading-relaxed">
                                            Ao confirmar, o sistema processará {cart.items.length} pedidos individuais para o vendedor <strong>{cart.sellerName}</strong>.
                                            O pagamento será debitado do seu saldo.
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            const total = cart.items.reduce((acc, i) => acc + parseFloat(i.price), 0);

                                            setConfirmData({
                                                isOpen: true,
                                                title: 'Finalizar Pedido (Lote)',
                                                message: `Confirmar compra de ${cart.items.length} itens da loja ${cart.sellerName}? Total: ${formatCurrency(total)}`,
                                                confirmText: `PAGAR ${formatCurrency(total)}`,
                                                type: 'success',
                                                onConfirm: async () => {
                                                    setIsLoading(true);
                                                    setConfirmData(null);

                                                    try {
                                                        const res = await apiService.post('/marketplace/buy', {
                                                            listingIds: cart.items.map(i => i.id),
                                                            deliveryType: 'SELF_PICKUP', // No carrinho simplificamos para retirada ou o usuário compra avulso para frete complexo
                                                            paymentMethod: 'BALANCE',
                                                            deliveryAddress: 'A combinar (Lote)',
                                                            contactPhone: (state.currentUser as any)?.phone || '000000000'
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
                                        className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-xl uppercase tracking-widest shadow-lg shadow-primary-500/20 active:scale-95 transition"
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
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 animate-in slide-in-from-bottom duration-300">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        O que você quer vender?
                    </h3>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex gap-3 text-left">
                        <MapPin size={20} className="text-blue-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-blue-100">Localização do Anúncio</p>
                            <p className="text-xs text-blue-200/70 mt-1 leading-relaxed">
                                Defina onde seu produto está para aparecer para compradores próximos.
                            </p>

                            <button
                                type="button"
                                onClick={handleGetListingGPS}
                                className={`mt-3 w-full sm:w-auto ${gpsLocation ? 'bg-emerald-500 text-white' : 'bg-blue-500 hover:bg-blue-400 text-white'} px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition shadow-lg`}
                            >
                                {gpsLocation ? <CheckCircle2 size={14} /> : <Navigation2 size={14} />}
                                {gpsLocation ? 'LOCALIZAÇÃO DEFINIDA' : 'USAR LOCALIZAÇÃO ATUAL (GPS)'}
                            </button>

                            {gpsLocation ? (
                                <p className="text-[10px] sent-blue-200 font-bold mt-2 flex items-center gap-1">
                                    <MapPin size={10} /> {gpsLocation.neighborhood ? `${gpsLocation.neighborhood} - ` : ''}{gpsLocation.city}/{gpsLocation.state}
                                </p>
                            ) : (
                                <p className="text-[10px] text-blue-200/50 mt-2">
                                    *Isso atualizará a localização do seu perfil de vendedor.
                                </p>
                            )}
                        </div>
                    </div>

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

                        {/* VEÍCULO REQUERIDO PARA ENTREGA */}
                        {newListing.category !== 'PARTICIPAÇÕES' && (
                            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-2xl p-4 space-y-3">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                                    <Truck size={12} className="text-primary-400" /> Veículo necessário para o frete
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['BIKE', 'MOTO', 'CAR', 'TRUCK'] as const).map((v) => {
                                        const Icon = VEHICLE_ICONS[v];
                                        const isSelected = newListing.requiredVehicle === v;
                                        return (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => {
                                                    setNewListing({ ...newListing, requiredVehicle: v });
                                                    // Sugerir frete mínimo se já estiver no checkout, mas aqui é criação
                                                }}
                                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${isSelected ? 'bg-primary-500/10 border-primary-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}
                                            >
                                                <Icon size={16} />
                                                <span className="text-[8px] font-black uppercase">{v}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[9px] text-zinc-500 italic mt-1 leading-tight">
                                    Isso ajuda o entregador a saber se o item cabe no veículo dele.
                                </p>
                            </div>
                        )}

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
                                            {(() => {
                                                const VehicleIcon = VEHICLE_ICONS[mission.required_vehicle as keyof typeof VEHICLE_ICONS] || Truck;
                                                return (
                                                    <div className="flex items-center gap-1 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                                                        <VehicleIcon size={10} className="text-primary-400" />
                                                        <span className="text-[9px] text-zinc-400 font-bold uppercase">{mission.required_vehicle || 'MOTO'}</span>
                                                    </div>
                                                );
                                            })()}
                                            {mission.invited_courier_id === state.currentUser?.id && (
                                                <span className="text-[10px] font-black bg-amber-500 text-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">CONVITE</span>
                                            )}
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
                                                                onRefresh();
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
                        <div className="sticky top-0 z-10 p-4 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
                            <button onClick={() => setView('browse')} className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition">
                                <ArrowLeft size={20} />
                            </button>
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Detalhes do Anúncio</span>
                            <div className="flex gap-2">
                                <button className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition"><Share2 size={18} /></button>
                            </div>
                        </div>

                        <div className="aspect-square bg-zinc-900 relative">
                            {selectedItem.image_url ? (
                                <img src={selectedItem.image_url} alt={selectedItem.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-800">
                                    <ImageIcon size={64} />
                                    <span className="text-xs font-bold uppercase mt-2">Sem imagem disponível</span>
                                </div>
                            )}
                            <div className="absolute bottom-6 left-6 right-6">
                                <div className="bg-black/60 backdrop-blur-xl p-4 rounded-2xl border border-white/10 inline-block">
                                    <p className="text-2xl font-black text-primary-400 tabular-nums">
                                        {formatCurrency(parseFloat(selectedItem.price))}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-8 pb-32">
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

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <Package size={14} className="text-primary-400" /> Descrição Completa
                                </h4>
                                <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{selectedItem.description}</p>
                            </div>

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
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                                    >
                                        <Phone size={18} />
                                        <span>Liberar WhatsApp</span>
                                    </button>
                                </div>
                            )}

                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-4">
                                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <Truck size={14} className="text-primary-400" /> Opções de Entrega
                                </h4>
                                <div className="grid grid-cols-1 gap-2">
                                    <button onClick={() => setDeliveryOption('SELF_PICKUP')} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${deliveryOption === 'SELF_PICKUP' ? 'bg-primary-500/10 border-primary-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400"><Store size={18} /></div>
                                            <div className="text-left">
                                                <p className="text-xs font-black text-white uppercase">Retirada Pessoal</p>
                                                <p className="text-[10px] text-zinc-500">Você vai até o vendedor.</p>
                                            </div>
                                        </div>
                                        {deliveryOption === 'SELF_PICKUP' && <CheckCircle size={16} className="text-primary-400" />}
                                    </button>
                                    <button onClick={() => setDeliveryOption('COURIER_REQUEST')} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${deliveryOption === 'COURIER_REQUEST' ? 'bg-primary-500/10 border-primary-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400"><Truck size={18} /></div>
                                            <div className="text-left">
                                                <p className="text-xs font-black text-white uppercase">Entregador Cred30</p>
                                                <p className="text-[10px] text-zinc-500">Para entregas na mesma região.</p>
                                            </div>
                                        </div>
                                        {deliveryOption === 'COURIER_REQUEST' && <CheckCircle size={16} className="text-primary-400" />}
                                    </button>
                                    <button onClick={() => setDeliveryOption('EXTERNAL_SHIPPING')} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${deliveryOption === 'EXTERNAL_SHIPPING' ? 'bg-primary-500/10 border-primary-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400"><Package size={18} /></div>
                                            <div className="text-left">
                                                <p className="text-xs font-black text-white uppercase">Envio Nacional</p>
                                                <p className="text-[10px] text-zinc-500">Correios ou Transportadoras.</p>
                                            </div>
                                        </div>
                                        {deliveryOption === 'EXTERNAL_SHIPPING' && <CheckCircle size={16} className="text-primary-400" />}
                                    </button>
                                </div>

                                {deliveryOption === 'EXTERNAL_SHIPPING' && (
                                    <div className="bg-amber-900/10 border border-amber-500/20 rounded-2xl p-4 space-y-2 animate-in slide-in-from-top-2">
                                        <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest">Aviso de Envio Nacional</p>
                                        <p className="text-[9px] text-zinc-400 leading-relaxed">
                                            A taxa de <span className="text-white">R$ 35,00</span> cobre o custo médio de postagem via Correios/Transportadora. O vendedor será responsável por postar o produto e informar o rastreio.
                                        </p>
                                    </div>
                                )}

                                {deliveryOption === 'COURIER_REQUEST' && (
                                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-4 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Ajuda de Custo (Frete)</label>
                                            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-lg font-black">
                                                MÍNIMO: {formatCurrency(DELIVERY_MIN_FEES[selectedItem.required_vehicle || 'MOTO'] || 5.00)}
                                            </span>
                                        </div>
                                        <input type="number" value={offeredFee} onChange={e => setOfferedFee(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white" />
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Convidar Entregador (Opcional)</label>
                                            <input value={invitedCourierId} onChange={e => setInvitedCourierId(e.target.value)} placeholder="ID do entregador" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] text-white" />
                                        </div>
                                    </div>
                                )}

                                {deliveryOption !== 'SELF_PICKUP' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase">Endereço de Entrega</label>
                                        <input placeholder="Endereço completo" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white" />
                                    </div>
                                )}
                            </div>

                            <div className="sticky bottom-6 mt-12 bg-black border border-zinc-800 p-4 rounded-3xl">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Total</p>
                                    <p className="text-xl font-black text-white">
                                        {formatCurrency(parseFloat(selectedItem.price) + (deliveryOption === 'COURIER_REQUEST' ? parseFloat(offeredFee || '0') : deliveryOption === 'EXTERNAL_SHIPPING' ? 35.00 : 0))}
                                    </p>
                                </div>
                                <button
                                    onClick={async () => {
                                        setConfirmData({
                                            isOpen: true,
                                            title: 'Confirmar Compra',
                                            message: `Deseja comprar "${selectedItem.title}"?`,
                                            confirmText: 'CONFIRMAR AGORA',
                                            type: 'success',
                                            onConfirm: async () => {
                                                try {
                                                    const res = await apiService.post<any>('/marketplace/buy', {
                                                        listingId: selectedItem.id,
                                                        deliveryType: deliveryOption,
                                                        offeredDeliveryFee: deliveryOption === 'COURIER_REQUEST' ? parseFloat(offeredFee) : deliveryOption === 'EXTERNAL_SHIPPING' ? 35.00 : 0,
                                                        deliveryAddress: deliveryAddress || 'Principal',
                                                        contactPhone: (state.currentUser as any).phone || '',
                                                        invitedCourierId: invitedCourierId || undefined,
                                                        paymentMethod: 'BALANCE'
                                                    });
                                                    if (res.success) {
                                                        onSuccess('Sucesso!', 'Compra realizada!');
                                                        setView('my-orders');
                                                        setConfirmData(null);
                                                    }
                                                } catch (err: any) {
                                                    onError('Erro', err.message);
                                                }
                                            }
                                        });
                                    }}
                                    className="w-full bg-primary-500 text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs"
                                >
                                    Comprar Agora
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
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

