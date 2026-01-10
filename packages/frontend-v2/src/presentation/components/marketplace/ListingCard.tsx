import React, { memo } from 'react';
import {
    Image as ImageIcon,
    Zap,
    MapPin,
    Plus
} from 'lucide-react';
import { VEHICLE_ICONS } from './marketplace.constants';

interface ListingCardProps {
    item: any;
    currentUserId: string;
    onBoost: (item: any) => void;
    onDetails: (item: any) => void;
    onAddToCart: (item: any) => void;
    formatCurrency: (value: number) => string;
}

const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return `Hoje, ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    if (diffDays === 1) return `Ontem, ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export const ListingCard = memo(({ item, currentUserId, onBoost, onDetails, onAddToCart, formatCurrency }: ListingCardProps) => {
    const isOwner = item.seller_id === currentUserId;

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
