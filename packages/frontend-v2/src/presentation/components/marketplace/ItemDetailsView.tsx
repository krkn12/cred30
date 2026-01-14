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
    Zap
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

    const currentPrice = selectedVariant?.price ? parseFloat(selectedVariant.price) : parseFloat(item.price);
    const currentStock = selectedVariant ? selectedVariant.stock : (item.stock ? parseInt(item.stock) : 1);
    const isOutOfStock = currentStock <= 0;

    const deliveryFee = deliveryOption === 'COURIER_REQUEST' ? parseFloat(offeredFee || '0') : deliveryOption === 'EXTERNAL_SHIPPING' ? 35.00 : 0;
    const totalAmount = (currentPrice * quantity) + deliveryFee;

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
                                        MÍNIMO: {formatCurrency(DELIVERY_MIN_FEES[item.required_vehicle || 'MOTO'] || 5.00)}
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
                                {formatCurrency(totalAmount)}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => onBuy({
                                    listingId: item.id,
                                    deliveryType: deliveryOption,
                                    deliveryFee: deliveryOption === 'COURIER_REQUEST' ? parseFloat(offeredFee) : deliveryOption === 'EXTERNAL_SHIPPING' ? 35.00 : 0,
                                    deliveryAddress: deliveryAddress || 'Principal',
                                    invitedCourierId: invitedCourierId || undefined,
                                    quantity: quantity,
                                    paymentMethod: 'BALANCE'
                                })}
                                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] border border-zinc-800 transition-all active:scale-95"
                            >
                                Pagar com Saldo
                            </button>

                            <button
                                onClick={() => {
                                    const userScore = currentUser?.score || 0;
                                    const activeQuotas = currentUser?.quota_count || 0;

                                    if (userScore < 450 || activeQuotas < 1) {
                                        alert(`Requisitos para Crédito não atingidos.\nScore Mínimo: 450 (Seu: ${userScore})\nCotas Ativas: 1 (Sua: ${activeQuotas})`);
                                        return;
                                    }

                                    const installments = parseInt(window.prompt("Em quantas parcelas deseja pagar? (1x a 24x)", "1") || "0");
                                    if (installments < 1 || installments > 24) {
                                        alert("Número de parcelas inválido (mínimo 1, máximo 24).");
                                        return;
                                    }

                                    onBuy({
                                        listingId: item.id,
                                        deliveryType: deliveryOption,
                                        deliveryFee: deliveryOption === 'COURIER_REQUEST' ? parseFloat(offeredFee) : deliveryOption === 'EXTERNAL_SHIPPING' ? 35.00 : 0,
                                        deliveryAddress: deliveryAddress || 'Principal',
                                        invitedCourierId: invitedCourierId || undefined,
                                        quantity: quantity,
                                        paymentMethod: 'CREDIT',
                                        installments
                                    });
                                }}
                                className="flex-1 bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-primary-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Zap size={14} />
                                Comprar Parcelado
                            </button>
                        </div>
                        <p className="text-[8px] text-zinc-600 font-bold uppercase text-center tracking-tighter">
                            Crédito sujeito a análise de score (Min. 450) e participação social (1+ Cota)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
