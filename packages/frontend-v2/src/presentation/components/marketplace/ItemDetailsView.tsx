import React from 'react';
import {
    ArrowLeft,
    Share2,
    Image as ImageIcon,
    MapPin,
    Clock,
    User,
    ShieldCheck,
    Package,
    Phone,
    Truck,
    Store,
    CheckCircle,
    Zap,
    Calendar
} from 'lucide-react';
import { DELIVERY_MIN_FEES } from './marketplace.constants';
import { FavoriteButton } from './FavoriteButton';
import { ItemQuestions } from './ItemQuestions';
import { SellerReputationBadge } from './SellerReputationBadge';
import { apiMarketplace } from '../../../application/services/api.marketplace';

interface ItemDetailsViewProps {
    item: any;
    currentUser: any;
    formatCurrency: (value: number) => string;
    onClose: () => void;
    onContact: (item: any) => void;
    onBuy: (data: any) => void;
    deliveryOption: string;
    setDeliveryOption: (opt: any) => void;
    offeredFee: string;
    setOfferedFee: (fee: string) => void;
    invitedCourierId: string;
    setInvitedCourierId: (id: string) => void;
    deliveryAddress: string;
    setDeliveryAddress: (addr: string) => void;
}

export const ItemDetailsView = ({
    item: initialItem,
    currentUser,
    formatCurrency,
    onClose,
    onContact,
    onBuy,
    deliveryOption,
    setDeliveryOption,
    offeredFee,
    setOfferedFee,
    invitedCourierId,
    setInvitedCourierId,
    deliveryAddress,
    setDeliveryAddress
}: ItemDetailsViewProps) => {
    const [item, setItem] = React.useState(initialItem);
    const [quantity, setQuantity] = React.useState(1);

    // New State for Variants & Images
    const [selectedImage, setSelectedImage] = React.useState(initialItem.image_url);
    const [selectedVariant, setSelectedVariant] = React.useState<any>(null);
    const [variants, setVariants] = React.useState<any[]>([]);
    const [additionalImages, setAdditionalImages] = React.useState<string[]>([]);
    const [isLoadingDetails, setIsLoadingDetails] = React.useState(true);

    // Food Options State
    const [selectedOptions, setSelectedOptions] = React.useState<any[]>([]);

    // Shipping State
    const [shippingCep, setShippingCep] = React.useState('');
    const [isCalculatingShipping, setIsCalculatingShipping] = React.useState(false);
    const [shippingQuote, setShippingQuote] = React.useState<any>(null);

    // Structured Address State
    const [addressForm, setAddressForm] = React.useState({
        cep: '',
        street: '',
        number: '',
        complement: '',
        district: '',
        city: '',
        state: ''
    });
    const [isLoadingCep, setIsLoadingCep] = React.useState(false);
    const [creditSimulation, setCreditSimulation] = React.useState<any>(null);
    const [selectedInstallments, setSelectedInstallments] = React.useState(1);
    const numberInputRef = React.useRef<HTMLInputElement>(null);

    // Rental State
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');
    const [rentalDays, setRentalDays] = React.useState(0);

    // Calculate Rental Days
    React.useEffect(() => {
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = end.getTime() - start.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setRentalDays(diffDays > 0 ? diffDays : 0);
        } else {
            setRentalDays(0);
        }
    }, [startDate, endDate]);

    // Sync Structured Address to deliveryAddress string
    React.useEffect(() => {
        if (addressForm.street) {
            const fullAddr = `${addressForm.street}, ${addressForm.number || 'S/N'} ${addressForm.complement ? `- ${addressForm.complement}` : ''} - ${addressForm.district}, ${addressForm.city}/${addressForm.state} - CEP: ${addressForm.cep}`;
            setDeliveryAddress(fullAddr);
            // Sync with shipping calc cep if not set
            if (!shippingCep && addressForm.cep.length === 8) {
                setShippingCep(addressForm.cep);
            }
        }
    }, [addressForm]);

    const fetchAddressByCep = async (cep: string) => {
        setIsLoadingCep(true);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                setAddressForm(prev => ({
                    ...prev,
                    street: data.logradouro,
                    district: data.bairro,
                    city: data.localidade,
                    state: data.uf
                }));
                // Focus number input
                setTimeout(() => numberInputRef.current?.focus(), 100);
            }
        } catch (error) {
            console.error('Error fetching CEP:', error);
        } finally {
            setIsLoadingCep(false);
        }
    };

    const handleCalculateShipping = async () => {
        if (shippingCep.length < 8) return;
        setIsCalculatingShipping(true);
        try {
            const res = await apiMarketplace.getShippingQuote(item.id, shippingCep);
            if (res.success) {
                setShippingQuote(res.data);
                if (deliveryOption === 'EXTERNAL_SHIPPING') {
                    setOfferedFee(res.data.fee.toString());
                }
            }
        } catch (err) {
            console.error("Error calculating shipping", err);
        } finally {
            setIsCalculatingShipping(false);
        }
    };

    // Fetch Details on Mount
    React.useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await apiMarketplace.getListingDetails(initialItem.id);
                if (res.success && res.data) {
                    const data = res.data;
                    setItem(prev => ({ ...prev, ...data }));
                    setVariants(data.variants || []);

                    // Setup Images
                    const images = data.images || [];
                    if (images.length > 0) {
                        setAdditionalImages(images);
                        setSelectedImage(images[0]);
                    } else {
                        setAdditionalImages(data.image_url ? [data.image_url] : []);
                    }
                }
            } catch (err) {
                console.error("Failed to load details", err);
            } finally {
                setIsLoadingDetails(false);
            }
        };
        fetchDetails();
    }, [initialItem.id]);

    // Auto-select first variant
    React.useEffect(() => {
        if (variants.length === 1 && !selectedVariant) {
            setSelectedVariant(variants[0]);
        }
    }, [variants]);

    // Auto-fill address info if available
    React.useEffect(() => {
        if (currentUser && !addressForm.cep) {
            const user = currentUser as any;
            if (user.address_zip) {
                const cleanCep = user.address_zip.replace(/\D/g, '');
                setAddressForm(prev => ({ ...prev, cep: cleanCep }));
                fetchAddressByCep(cleanCep);
            }
        }
    }, [currentUser]);

    // Handle initial Offered Fee based heavily on minimum
    const minFeeValue = DELIVERY_MIN_FEES[item.required_vehicle || 'MOTO'] || 5.00;
    React.useEffect(() => {
        if (!offeredFee || parseFloat(offeredFee) < minFeeValue) {
            setOfferedFee(minFeeValue.toFixed(2));
        }
    }, [item.required_vehicle]);

    const currentPrice = selectedVariant?.price ? parseFloat(selectedVariant.price) : parseFloat(item.price);
    const currentStock = selectedVariant ? selectedVariant.stock : (item.stock ? parseInt(item.stock) : 1);
    const isOutOfStock = currentStock <= 0;

    const deliveryFee = deliveryOption === 'COURIER_REQUEST'
        ? Math.max(parseFloat(offeredFee || '0'), minFeeValue) // Garante que nunca seja menor que o mínimo no cálculo final
        : deliveryOption === 'EXTERNAL_SHIPPING'
            ? (shippingQuote?.fee || (item.free_shipping ? 0 : parseFloat(item.shipping_cost || '35')))
            : 0;

    const isRental = item.module_type === 'RENTAL';
    const rentalPricePerDay = parseFloat(item.rental_price_per_day || item.price || '0');
    const securityDeposit = parseFloat(item.security_deposit || '0');

    const optionsTotal = selectedOptions.reduce((acc, opt: any) => acc + (opt.price || 0), 0);

    let totalAmount = 0;
    if (isRental) {
        totalAmount = (rentalPricePerDay * rentalDays) + securityDeposit + optionsTotal + deliveryFee;
    } else {
        totalAmount = ((currentPrice + optionsTotal) * quantity) + deliveryFee;
    }

    // Fetch Credit Simulation
    React.useEffect(() => {
        const fetchSimulation = async () => {
            if (totalAmount <= 0 || !currentUser) return;
            try {
                const res = await apiMarketplace.get<any>(`/pdv/simulate-credit?amount=${totalAmount}`);
                if (res.success) {
                    setCreditSimulation(res.data);
                }
            } catch (err) {
                console.error("Error fetching credit simulation", err);
            }
        };
        fetchSimulation();
    }, [totalAmount, currentUser]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
            <div className="max-w-xl mx-auto min-h-screen bg-zinc-950 flex flex-col">
                <div className="sticky top-0 z-10 p-4 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
                    <button onClick={onClose} className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition">
                        <ArrowLeft size={20} />
                    </button>
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Detalhes do Anúncio</span>
                    <div className="flex gap-2">
                        <button className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition"><Share2 size={18} /></button>
                    </div>
                </div>

                <div className="aspect-square bg-zinc-900 relative group">
                    {selectedImage ? (
                        <img src={selectedImage} alt={item.title} className="w-full h-full object-contain" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-800">
                            <ImageIcon size={64} />
                            <span className="text-xs font-bold uppercase mt-2">Sem imagem disponível</span>
                        </div>
                    )}

                    {/* Thumbnails Overlay */}
                    {additionalImages.length > 1 && (
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto no-scrollbar z-20">
                            {additionalImages.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={(e) => { e.stopPropagation(); setSelectedImage(img); }}
                                    className={`w-12 h-12 rounded-lg border-2 overflow-hidden bg-black transition-all shadow-lg ${selectedImage === img ? 'border-primary-500 scale-110' : 'border-zinc-700 opacity-70 hover:opacity-100'}`}
                                >
                                    <img src={img} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Botão de Favorito Flutuante */}
                    <div className="absolute top-4 right-4 z-20">
                        <FavoriteButton
                            listingId={item.id}
                            size={28}
                            className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full shadow-lg border border-white/10 hover:bg-black/60"
                        />
                    </div>

                    <div className="absolute top-4 left-6 z-20">
                        {item.is_boosted && (
                            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg flex items-center gap-1 uppercase tracking-wider">
                                <Zap size={10} fill="currentColor" /> Destaque
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 space-y-8 pb-32">
                    <div>
                        <div className="flex flex-wrap gap-2 mb-3">
                            <span className="text-[9px] font-black bg-primary-500/10 text-primary-400 px-2 py-1 rounded-lg border border-primary-500/20 uppercase tracking-widest leading-none">
                                {item.category}
                            </span>
                            {isOutOfStock && (
                                <span className="text-[9px] font-black bg-red-500/10 text-red-400 px-2 py-1 rounded-lg border border-red-500/20 uppercase tracking-widest leading-none">
                                    ESGOTADO
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight leading-tight">{item.title}</h1>
                        <div className="flex items-end gap-2 mt-2">
                            <p className="text-3xl font-black text-primary-400 tabular-nums">
                                {formatCurrency(currentPrice)}
                            </p>
                            {selectedVariant && selectedVariant.price && parseFloat(selectedVariant.price) !== parseFloat(item.price) && (
                                <span className="text-xs text-zinc-500 line-through mb-1.5">{formatCurrency(parseFloat(item.price))}</span>
                            )}
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                            <div className="flex items-center gap-1.5">
                                <MapPin size={12} className="text-emerald-500" />
                                {item.pickup_address ? item.pickup_address : (item.seller_address || 'Brasil')}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-zinc-600" />
                                Publicado {new Date(item.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    {/* VARIANTS SELECTOR */}
                    {isLoadingDetails && (
                        <div className="space-y-3 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800 animate-pulse">
                            <div className="h-3 w-32 bg-zinc-800 rounded mb-2"></div>
                            <div className="flex gap-2">
                                <div className="h-8 w-16 bg-zinc-800 rounded-xl"></div>
                                <div className="h-8 w-16 bg-zinc-800 rounded-xl"></div>
                            </div>
                        </div>
                    )}
                    {!isLoadingDetails && variants.length > 0 && (
                        <div className="space-y-3 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800">
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Opções Disponíveis</p>
                            <div className="flex flex-wrap gap-2">
                                {variants.map((variant) => (
                                    <button
                                        key={variant.id}
                                        onClick={() => setSelectedVariant(variant)}
                                        disabled={variant.stock <= 0}
                                        className={`
                                            px-3 py-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center min-w-[60px]
                                            ${selectedVariant?.id === variant.id
                                                ? 'bg-primary-500 text-black border-primary-500 shadow-lg shadow-primary-500/20 scale-105'
                                                : variant.stock <= 0
                                                    ? 'bg-zinc-950 text-zinc-700 border-zinc-800 cursor-not-allowed decoration-slice line-through'
                                                    : 'bg-zinc-950 text-zinc-300 border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900'}
                                        `}
                                    >
                                        <span>{variant.name || `${variant.color || ''} ${variant.size || ''}`}</span>
                                        {variant.stock <= 5 && variant.stock > 0 && (
                                            <span className="text-[8px] text-red-400 mt-0.5 font-black">Restam {variant.stock}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STORE PAUSED BANNER */}
                    {item.is_paused && (
                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                            <div className="bg-red-500 p-2 rounded-xl">
                                <Clock size={20} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-black text-red-500 uppercase tracking-tighter">ESTA LOJA ESTÁ PAUSADA AGORA</p>
                                <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mt-0.5">
                                    O vendedor não está aceitando novos pedidos no momento.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* RENTAL DATE SELECTOR */}
                    {isRental && (
                        <div className="space-y-4 bg-primary-500/5 border border-primary-500/20 p-5 rounded-3xl animate-in zoom-in duration-300">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-primary-400 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar size={14} /> Período do Aluguel
                                </h4>
                                {rentalDays > 0 && (
                                    <span className="bg-primary-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                                        {rentalDays} {rentalDays === 1 ? 'Dia' : 'Dias'}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] text-zinc-500 font-bold uppercase ml-1">Início</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-primary-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] text-zinc-500 font-bold uppercase ml-1">Fim</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        min={startDate || new Date().toISOString().split('T')[0]}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-primary-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] bg-black/40 p-3 rounded-xl border border-white/5">
                                <div className="flex flex-col">
                                    <span className="text-zinc-500 font-bold uppercase">Preço p/ Dia</span>
                                    <span className="text-white font-black">{formatCurrency(rentalPricePerDay)}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-zinc-500 font-bold uppercase">Calção (Segurança)</span>
                                    <span className="text-amber-400 font-black block">{formatCurrency(securityDeposit)}</span>
                                </div>
                            </div>

                            {item.minimum_rental_days > 1 && (
                                <p className="text-[9px] text-zinc-500 italic">
                                    * Este item exige um aluguel mínimo de {item.minimum_rental_days} dias.
                                </p>
                            )}
                        </div>
                    )}

                    {/* FOOD OPTIONS SELECTOR */}
                    {item.food_options && item.food_options.length > 0 && (
                        <div className="space-y-3 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800">
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center justify-between">
                                <span>Complete seu pedido (Opcionais)</span>
                                <span className="text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded text-[8px]">{selectedOptions.length} Selecionados</span>
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                                {item.food_options.map((opt: any, idx: number) => {
                                    const isSelected = selectedOptions.some(o => o.name === opt.name);
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedOptions(prev => prev.filter(o => o.name !== opt.name));
                                                } else {
                                                    setSelectedOptions(prev => [...prev, opt]);
                                                }
                                            }}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected ? 'bg-primary-500/10 border-primary-500/50 text-white' : 'bg-zinc-950/50 border-zinc-800 text-zinc-400'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-primary-500 border-primary-500' : 'bg-zinc-900 border-zinc-700'}`}>
                                                    {isSelected && <div className="w-2 h-2 bg-black rounded-full" />}
                                                </div>
                                                <span className="text-xs font-bold uppercase">{opt.name}</span>
                                            </div>
                                            <span className={`text-[10px] font-black ${isSelected ? 'text-primary-400' : 'text-zinc-500'}`}>+ {formatCurrency(opt.price)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center border border-white/5 relative">
                                <div className="w-full h-full rounded-2xl overflow-hidden">
                                    {item.seller_avatar ? (
                                        <img src={item.seller_avatar} className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={24} className="text-zinc-600 m-auto mt-2" />
                                    )}
                                </div>
                                {item.seller_verified && (
                                    <div className="absolute -top-1 -right-1 bg-emerald-500 p-1 rounded-full border-2 border-zinc-900">
                                        <ShieldCheck size={10} className="text-white" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white">{item.seller_name}</h4>
                                <div className="mt-1">
                                    <SellerReputationBadge
                                        reputation={item.seller_reputation || 'NOVO'}
                                        sales={item.sales_count || 0}
                                        rating={Number(item.seller_rating || 0)}
                                    />
                                </div>
                            </div>
                        </div>
                        <button className="text-[10px] font-black text-primary-400 hover:text-white transition uppercase tracking-widest">Ver Perfil</button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                <Package size={14} className="text-primary-400" /> Descrição Completa
                            </h4>
                            <span className={`text-[10px] font-bold ${isOutOfStock ? 'text-red-500' : 'text-emerald-400'}`}>
                                Estoque: {currentStock} unid.
                            </span>
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{item.description}</p>
                    </div>

                    {/* SELETOR DE QUANTIDADE (Disable if out of stock) */}
                    <div className={`bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex items-center justify-between ${isOutOfStock ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Quantidade</span>
                            <span className="text-xs text-zinc-400">Selecione quantos itens desejar</span>
                        </div>
                        <div className="flex items-center gap-3 bg-zinc-950 p-2 rounded-2xl border border-white/5">
                            <button
                                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                className="w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition"
                                disabled={quantity <= 1}
                            >
                                -
                            </button>
                            <span className="w-8 text-center text-white font-black">{quantity}</span>
                            <button
                                onClick={() => setQuantity(q => Math.min(currentStock, q + 1))}
                                className="w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition"
                                disabled={quantity >= currentStock}
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {item.seller_id !== currentUser?.id && item.type !== 'AFFILIATE' && !isOutOfStock && (
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
                                onClick={() => onContact(item)}
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
                                        <p className="text-[10px] text-zinc-500">
                                            Retire com o vendedor após a compra.
                                        </p>
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
                            <div className="bg-amber-900/10 border border-amber-500/20 rounded-2xl p-4 space-y-4 animate-in slide-in-from-top-2">
                                <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest">Calculadora de Frete Nacional</p>
                                <div className="flex gap-2">
                                    <input
                                        placeholder="Seu CEP (00000-000)"
                                        value={shippingCep}
                                        onChange={e => setShippingCep(e.target.value)}
                                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white"
                                    />
                                    <button
                                        onClick={handleCalculateShipping}
                                        disabled={isCalculatingShipping || shippingCep.length < 8}
                                        className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase disabled:opacity-50"
                                    >
                                        {isCalculatingShipping ? '...' : 'Calcular'}
                                    </button>
                                </div>

                                {shippingQuote && (
                                    <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-zinc-500 font-bold uppercase">Estimativa de Entrega</span>
                                            <span className="text-xs text-white font-black">{shippingQuote.deliveryEstimateDays} dias úteis</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[8px] text-zinc-500 font-bold uppercase">Valor</span>
                                            <span className="text-sm text-amber-400 font-black block">{formatCurrency(shippingQuote.fee)}</span>
                                        </div>
                                    </div>
                                )}

                                <p className="text-[9px] text-zinc-400 leading-relaxed">
                                    O cálculo é baseado na distância entre você e o vendedor via Motor de Logística Cred30.
                                </p>
                            </div>
                        )}

                        {deliveryOption === 'COURIER_REQUEST' && (
                            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Ajuda de Custo (Frete)</label>
                                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-lg font-black">
                                        MÍNIMO CALCULADO: {formatCurrency(minFeeValue)}
                                    </span>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">R$</span>
                                    <input
                                        type="number"
                                        min={minFeeValue}
                                        step="0.50"
                                        value={offeredFee}
                                        onChange={e => setOfferedFee(e.target.value)}
                                        onBlur={() => {
                                            if (parseFloat(offeredFee) < minFeeValue || !offeredFee) {
                                                setOfferedFee(minFeeValue.toFixed(2));
                                            }
                                        }}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                                <p className="text-[9px] text-zinc-500 mt-1">
                                    Você pode oferecer um valor maior para atrair entregadores mais rápido. O valor mínimo é calculado pelo sistema.
                                </p>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Convidar Entregador (Opcional)</label>
                                    <input value={invitedCourierId} onChange={e => setInvitedCourierId(e.target.value)} placeholder="ID do entregador" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] text-white" />
                                </div>
                            </div>
                        )}

                        {deliveryOption !== 'SELF_PICKUP' && (
                            <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 space-y-3">
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-2">
                                    <MapPin size={14} className="text-primary-400" /> Endereço de Entrega
                                </label>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <input
                                            placeholder="CEP"
                                            value={addressForm.cep}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                                                setAddressForm(prev => ({ ...prev, cep: val }));
                                                if (val.length === 8) fetchAddressByCep(val);
                                            }}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white text-center tracking-wider"
                                        />
                                    </div>
                                    <div className="col-span-2 relative">
                                        <input
                                            placeholder="Rua / Logradouro"
                                            value={addressForm.street}
                                            readOnly
                                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-400 cursor-not-allowed"
                                        />
                                        {isLoadingCep && <div className="absolute right-3 top-2"><div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-2">
                                    <div className="col-span-1">
                                        <input
                                            placeholder="Nº"
                                            ref={numberInputRef}
                                            value={addressForm.number}
                                            onChange={e => setAddressForm(prev => ({ ...prev, number: e.target.value }))}
                                            className={`w-full bg-zinc-900 border rounded-xl px-3 py-2 text-xs text-white text-center font-bold ${!addressForm.number && addressForm.street ? 'border-red-500/50 animate-pulse' : 'border-zinc-800'}`}
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <input
                                            placeholder="Complemento (Opcional)"
                                            value={addressForm.complement}
                                            onChange={e => setAddressForm(prev => ({ ...prev, complement: e.target.value }))}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        placeholder="Bairro"
                                        value={addressForm.district}
                                        readOnly
                                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-400"
                                    />
                                    <input
                                        placeholder="Cidade - UF"
                                        value={addressForm.city ? `${addressForm.city} - ${addressForm.state}` : ''}
                                        readOnly
                                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-400"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SEÇÃO DE PERGUNTAS E RESPOSTAS */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                        <ItemQuestions
                            listingId={item.id}
                            currentUser={currentUser}
                            sellerId={item.seller_id}
                        />
                    </div>

                    <div className="sticky bottom-6 mt-12 bg-black/80 backdrop-blur-xl border border-zinc-800 p-4 rounded-3xl space-y-3">
                        <div className="flex justify-between items-center px-2">
                            <p className="text-[10px] text-zinc-500 font-bold uppercase">Total À Vista</p>
                            <p className="text-xl font-black text-white">
                                {isRental && rentalDays === 0 ? 'Selecione o período' : formatCurrency(totalAmount)}
                            </p>
                        </div>

                        {/* SEÇÃO DE CRÉDITO UNIFICADO */}
                        {creditSimulation && (
                            <div className="bg-blue-900/10 border border-blue-500/20 rounded-3xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                        <Zap size={14} className="fill-blue-400" /> Opções de Crédito
                                    </h4>
                                    <span className="text-[9px] text-zinc-500 font-bold uppercase">Limite: {formatCurrency(creditSimulation.remainingLimit)}</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {creditSimulation.installmentOptions.map((opt: any) => (
                                        <button
                                            key={opt.installments}
                                            onClick={() => setSelectedInstallments(opt.installments)}
                                            className={`p-2 rounded-xl border transition-all text-center flex flex-col gap-1 ${selectedInstallments === opt.installments ? 'bg-blue-500/20 border-blue-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}
                                        >
                                            <span className="text-[10px] font-black">{opt.installments}x</span>
                                            <span className="text-[9px] font-bold">{formatCurrency(opt.installmentValue)}</span>
                                        </button>
                                    ))}
                                </div>

                                {selectedInstallments > 1 && (
                                    <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase font-black px-1">
                                        <span>Total parcelado:</span>
                                        <span className="text-white">
                                            {formatCurrency(creditSimulation.installmentOptions.find((o: any) => o.installments === selectedInstallments)?.total)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => onBuy({
                                    listingId: item.id,
                                    deliveryType: deliveryOption,
                                    deliveryFee: deliveryFee,
                                    deliveryAddress: deliveryAddress || 'Principal',
                                    invitedCourierId: invitedCourierId || undefined,
                                    quantity: quantity,
                                    selectedOptions: selectedOptions,
                                    paymentMethod: 'BALANCE',
                                    startDate,
                                    endDate,
                                    rentalDays
                                })}
                                disabled={item.is_paused || (isRental && rentalDays === 0)}
                                className={`flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] border border-zinc-800 transition-all active:scale-95 ${item.is_paused || (isRental && rentalDays === 0) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                            >
                                Pagar com Saldo
                            </button>

                            <button
                                onClick={() => {
                                    if (totalAmount > (creditSimulation?.remainingLimit || 0)) {
                                        alert(`Limite insuficiente. Seu limite disponível é ${formatCurrency(creditSimulation?.remainingLimit || 0)}`);
                                        return;
                                    }

                                    onBuy({
                                        listingId: item.id,
                                        deliveryType: deliveryOption,
                                        deliveryFee: deliveryFee,
                                        deliveryAddress: deliveryAddress || 'Principal',
                                        invitedCourierId: invitedCourierId || undefined,
                                        quantity: quantity,
                                        selectedOptions: selectedOptions,
                                        paymentMethod: 'CREDIT',
                                        installments: selectedInstallments,
                                        startDate,
                                        endDate,
                                        rentalDays
                                    });
                                }}
                                disabled={item.is_paused || !creditSimulation || totalAmount > (creditSimulation?.remainingLimit || 0) || (isRental && rentalDays === 0)}
                                className={`flex-1 bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-primary-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 ${item.is_paused || (isRental && rentalDays === 0) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                            >
                                <Zap size={14} />
                                {selectedInstallments > 1 ? `Pagar ${selectedInstallments}x` : 'Comprar Parcelado'}
                            </button>
                        </div>
                        <p className="text-[8px] text-zinc-600 font-bold uppercase text-center tracking-tighter">
                            Crédito unificado baseado em participação social e score. Juros dinâmicos conforme garantia.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
