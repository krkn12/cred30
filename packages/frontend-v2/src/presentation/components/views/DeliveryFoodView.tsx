import { useState, useEffect, useCallback } from 'react';
import {
    Search,
    ArrowLeft,
    MapPin,
    Star,
    Clock,
    Bike,
    Pizza,
    Beer,
    Coffee,
    Utensils,
    Beef,
    Fish,
    IceCream,
    Flame
} from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import { LoadingScreen } from '../ui/LoadingScreen';

interface DeliveryFoodViewProps {
    onBack: () => void;
    onSelectItem: (item: any) => void;
    city?: string;
    state?: string;
}

const CATEGORY_ICONS: Record<string, any> = {
    'Pizza': Pizza,
    'Beef': Beef,
    'Beer': Beer,
    'Coffee': Coffee,
    'Utensils': Utensils,
    'Fish': Fish,
    'IceCream': IceCream,
    'Flame': Flame
};

const isStoreOpen = (openingHours: any): boolean => {
    if (!openingHours || Object.keys(openingHours).length === 0) return true;
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    const hours = openingHours[currentDay];
    if (!hours || !hours.open || !hours.close) return false;

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);
    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;

    if (closeMin < openMin) { // Over midnight
        return currentTime >= openMin || currentTime <= closeMin;
    }
    return currentTime >= openMin && currentTime <= closeMin;
};

export const DeliveryFoodView = ({ onBack, onSelectItem, city, state }: DeliveryFoodViewProps) => {
    const [categories, setCategories] = useState<any[]>([]);
    const [venues, setVenues] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVenue, setSelectedVenue] = useState<any>(null);
    const [venueProducts, setVenueProducts] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [catRes, venueRes] = await Promise.all([
                apiService.marketplace.getFoodCategories(),
                apiService.marketplace.getVenues(selectedCategory || undefined, city, state)
            ]);

            if (catRes.success) setCategories(catRes.data);
            if (venueRes.success) setVenues(venueRes.data);
        } catch (error) {
            console.error('Error fetching delivery data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedCategory, city, state]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleVenueClick = async (venue: any) => {
        setIsLoading(true);
        setSelectedVenue(venue);
        try {
            // Reutilizamos getListings filtrando pelo seller_id
            const response = await apiService.get<any>(`/marketplace/listings?seller_id=${venue.id}&limit=50`);
            if (response.success) {
                setVenueProducts(response.data.listings.filter((l: any) => l.is_food));
            }
        } catch (error) {
            console.error('Error fetching menu:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !selectedVenue && venues.length === 0) {
        return <LoadingScreen message="Abrindo Cardápios..." />;
    }

    return (
        <div className="flex flex-col min-h-screen bg-black animate-in fade-in duration-300">
            {/* Header Estilo App */}
            <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-900 p-4">
                <div className="flex items-center gap-4">
                    <button onClick={selectedVenue ? () => setSelectedVenue(null) : onBack} className="p-2 text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex-1">
                        {!selectedVenue ? (
                            <>
                                <h2 className="text-primary-500 text-[10px] font-black uppercase tracking-widest">Entregar em</h2>
                                <div className="flex items-center gap-1">
                                    <MapPin size={12} className="text-zinc-500" />
                                    <span className="text-white text-sm font-bold truncate">
                                        {city ? `${city}, ${state}` : 'Sua Localização'}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 className="text-white font-black text-lg truncate tracking-tight">{selectedVenue.merchant_name || selectedVenue.name}</h2>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                    <Star size={10} className="text-yellow-500 fill-yellow-500" />
                                    <span>{selectedVenue.rating.toFixed(1)}</span>
                                    <span>•</span>
                                    <span>{selectedVenue.restaurant_category}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {!selectedVenue && (
                    <div className="mt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar pratos ou restaurantes"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all font-medium"
                        />
                    </div>
                )}
            </div>

            <div className="p-4 space-y-8">
                {/* Visualização de Cardápio da Loja */}
                {selectedVenue ? (
                    <div className="space-y-6">
                        <div className="relative h-40 rounded-3xl overflow-hidden group">
                            <img
                                src={selectedVenue.avatar_url || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"}
                                alt="Banner"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                            <div className="absolute bottom-4 left-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl border-2 border-primary-500 overflow-hidden bg-zinc-800 shadow-2xl">
                                        <img src={selectedVenue.avatar_url || "https://api.dicebear.com/7.x/initials/svg?seed=" + selectedVenue.name} alt="Logo" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-xl tracking-tighter">{selectedVenue.merchant_name || selectedVenue.name}</h3>
                                        <div className="flex items-center gap-3 text-zinc-400 text-xs font-bold">
                                            <span className="flex items-center gap-1 text-primary-400"><Clock size={12} /> 25-40 min</span>
                                            <span className="flex items-center gap-1"><Bike size={12} /> R$ 5,90</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-white font-black text-xs uppercase tracking-[0.2em]">Destaques do Cardápio</h4>
                            <div className="grid grid-cols-1 gap-4">
                                {venueProducts.length === 0 ? (
                                    <div className="text-center py-10 text-zinc-500 text-sm">Nenhum item disponível agora.</div>
                                ) : (
                                    venueProducts.map(product => (
                                        <button
                                            key={product.id}
                                            onClick={() => onSelectItem(product)}
                                            className="flex gap-4 p-4 rounded-3xl bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-800/60 transition-all group active:scale-95"
                                        >
                                            <div className="flex-1 text-left">
                                                <h5 className="text-white font-bold text-base group-hover:text-primary-400 transition-colors">{product.title}</h5>
                                                <p className="text-zinc-500 text-xs line-clamp-2 mt-1 leading-relaxed">{product.description}</p>
                                                <div className="mt-3 text-emerald-400 font-black text-lg">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                                                </div>
                                            </div>
                                            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-zinc-800 shadow-xl flex-shrink-0">
                                                <img src={product.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80"} alt={product.title} className="w-full h-full object-cover" />
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Categorias */}
                        <div className="space-y-4">
                            <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] px-2 flex items-center justify-between">
                                Categorias
                                <span className="text-primary-500 font-bold tracking-normal capitalize">Ver tudo</span>
                            </h3>
                            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                                {categories.map(cat => {
                                    const IconNode = CATEGORY_ICONS[cat.icon] || Utensils;
                                    const isActive = selectedCategory === cat.slug;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategory(isActive ? null : cat.slug)}
                                            className={`flex flex-col items-center gap-2 min-w-[80px] group transition-all ${isActive ? 'scale-110' : ''}`}
                                        >
                                            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all ${isActive ? 'bg-primary-500 text-black shadow-xl shadow-primary-500/20' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 group-hover:bg-zinc-800'}`}>
                                                <IconNode size={28} />
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-white' : 'text-zinc-500'}`}>{cat.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Banner Promocional */}
                        <div className="bg-gradient-to-r from-red-600 to-orange-500 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden group">
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black text-white leading-tight">MATA A FOME <br />COM O CLUBE! 🍔</h3>
                                <p className="text-white/80 text-xs font-bold mt-2 uppercase tracking-widest">Entrega Grátis na 1ª compra</p>
                                <button className="mt-4 bg-white text-red-600 px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform">PEÇO AGORA</button>
                            </div>
                            <Flame size={120} className="absolute -right-4 -bottom-4 text-white/10 -rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
                        </div>

                        {/* Lista de Restaurantes */}
                        <div className="space-y-4">
                            <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] px-2">Lojas Disponíveis</h3>
                            <div className="grid grid-cols-1 gap-4">
                                {venues.length === 0 ? (
                                    <div className="text-center py-20">
                                        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                                            <Utensils size={32} className="text-zinc-700" />
                                        </div>
                                        <p className="text-zinc-500 text-sm font-medium">Nenhum restaurante aberto na sua região no momento.</p>
                                    </div>
                                ) : (
                                    venues.map(venue => (
                                        <button
                                            key={venue.id}
                                            onClick={() => handleVenueClick(venue)}
                                            className="flex items-center gap-4 p-4 rounded-3xl bg-zinc-900/40 border border-zinc-800/40 hover:bg-zinc-800 hover:border-zinc-700 transition-all group"
                                        >
                                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-800 shadow-xl border border-zinc-700 flex-shrink-0">
                                                <img src={venue.avatar_url || "https://api.dicebear.com/7.x/initials/svg?seed=" + venue.name} alt={venue.merchant_name} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <div className="flex items-center justify-between">
                                                    <h4 className={`font-black text-base transition-colors uppercase tracking-tight ${isStoreOpen(venue.opening_hours) ? 'text-white group-hover:text-primary-400' : 'text-zinc-600'}`}>
                                                        {venue.merchant_name || venue.name}
                                                    </h4>
                                                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border ${isStoreOpen(venue.opening_hours)
                                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                                        : 'bg-red-500/10 border-red-500/20 text-red-500'
                                                        }`}>
                                                        {isStoreOpen(venue.opening_hours) ? 'Aberto' : 'Fechado'}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">
                                                    <div className="flex items-center gap-0.5 text-yellow-500">
                                                        <Star size={10} className="fill-yellow-500" />
                                                        <span>{venue.rating.toFixed(1)}</span>
                                                    </div>
                                                    <span>•</span>
                                                    <span>{venue.restaurant_category}</span>
                                                    <span>•</span>
                                                    <span className="text-zinc-400">{venue.neighborhood || 'Delivery'}</span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-emerald-400 text-[9px] font-black bg-emerald-400/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">Entrega R$ 5,00</span>
                                                    <span className="text-zinc-600 text-[9px] font-bold">20-30 min</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
