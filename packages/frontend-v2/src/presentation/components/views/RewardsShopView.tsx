import { useState, useEffect } from 'react';
import {
    Gift, ArrowLeft, ShoppingBag, Smartphone, Coffee,
    Music, Gamepad2, Film, Fuel, Heart, Zap, Crown,
    ChevronRight, Loader2, Check, AlertTriangle, Star
} from 'lucide-react';
import { AppState } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';
import { ConfirmModal } from '../ui/ConfirmModal';

interface RewardsShopViewProps {
    state: AppState;
    onBack: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onRefresh: () => Promise<void>;
}

interface RewardItem {
    id: string;
    name: string;
    description: string;
    pointsCost: number;
    type: 'GIFT_CARD' | 'COUPON' | 'PIX_CASHBACK' | 'MEMBERSHIP';
    brand?: string;
    icon: any;
    color: string;
    bgColor: string;
    featured?: boolean;
    discount?: string;
    value?: string;
}

const REWARDS_CATALOG: RewardItem[] = [
    // Gift Cards
    {
        id: 'gc-amazon-10',
        name: 'Gift Card Amazon',
        description: 'Vale presente Amazon de R$ 10',
        pointsCost: 1000,
        type: 'GIFT_CARD',
        brand: 'Amazon',
        icon: ShoppingBag,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        value: 'R$ 10'
    },
    {
        id: 'gc-ifood-15',
        name: 'Cupom iFood',
        description: 'Desconto de R$ 15 no iFood',
        pointsCost: 1500,
        type: 'COUPON',
        brand: 'iFood',
        icon: Coffee,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        value: 'R$ 15',
        featured: true
    },
    {
        id: 'gc-spotify-1m',
        name: 'Spotify Premium',
        description: '1 mês de Spotify Premium',
        pointsCost: 2000,
        type: 'GIFT_CARD',
        brand: 'Spotify',
        icon: Music,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        value: '1 mês'
    },
    {
        id: 'gc-netflix-25',
        name: 'Gift Card Netflix',
        description: 'Vale presente Netflix R$ 25',
        pointsCost: 2500,
        type: 'GIFT_CARD',
        brand: 'Netflix',
        icon: Film,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        value: 'R$ 25'
    },
    {
        id: 'gc-uber-20',
        name: 'Crédito Uber',
        description: 'Crédito de R$ 20 no Uber',
        pointsCost: 2000,
        type: 'GIFT_CARD',
        brand: 'Uber',
        icon: Fuel,
        color: 'text-zinc-100',
        bgColor: 'bg-zinc-800',
        value: 'R$ 20'
    },
    {
        id: 'gc-playstore-30',
        name: 'Google Play',
        description: 'Gift Card Google Play R$ 30',
        pointsCost: 3000,
        type: 'GIFT_CARD',
        brand: 'Google',
        icon: Gamepad2,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        value: 'R$ 30'
    },
    {
        id: 'gc-recarga-10',
        name: 'Recarga Celular',
        description: 'Recarga de R$ 10 qualquer operadora',
        pointsCost: 1000,
        type: 'GIFT_CARD',
        brand: 'Recarga',
        icon: Smartphone,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        value: 'R$ 10'
    },
    // PIX Cashback
    {
        id: 'pix-5',
        name: 'PIX R$ 5',
        description: 'Receba R$ 5 via PIX na sua conta',
        pointsCost: 5000,
        type: 'PIX_CASHBACK',
        icon: Zap,
        color: 'text-primary-400',
        bgColor: 'bg-primary-500/10',
        value: 'R$ 5'
    },
    {
        id: 'pix-10',
        name: 'PIX R$ 10',
        description: 'Receba R$ 10 via PIX na sua conta',
        pointsCost: 9000,
        type: 'PIX_CASHBACK',
        icon: Zap,
        color: 'text-primary-400',
        bgColor: 'bg-primary-500/10',
        value: 'R$ 10',
        discount: '10% OFF'
    },
    // Membership
    {
        id: 'membership-pro-1m',
        name: 'PRO 1 Mês',
        description: 'Seja Cred30 PRO por 1 mês',
        pointsCost: 10000,
        type: 'MEMBERSHIP',
        icon: Crown,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        value: '1 mês',
        featured: true
    },
];

export const RewardsShopView = ({ state, onBack, onSuccess, onError, onRefresh }: RewardsShopViewProps) => {
    const user = state.currentUser!;
    const farmPoints = user.ad_points || 0;

    const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'GIFT_CARD' | 'COUPON' | 'PIX_CASHBACK' | 'MEMBERSHIP'>('ALL');
    const [loading, setLoading] = useState<string | null>(null);
    const [confirmItem, setConfirmItem] = useState<RewardItem | null>(null);
    const [redeemedCodes, setRedeemedCodes] = useState<{ code: string, item: string }[]>([]);

    const filteredRewards = selectedCategory === 'ALL'
        ? REWARDS_CATALOG
        : REWARDS_CATALOG.filter(r => r.type === selectedCategory);

    const handleRedeemReward = async (item: RewardItem) => {
        setLoading(item.id);
        try {
            const response = await apiService.post<any>('/earn/redeem-reward', {
                rewardId: item.id,
                pointsCost: item.pointsCost
            });

            if (response.success) {
                // Mostrar código resgatado
                if (response.code) {
                    setRedeemedCodes(prev => [...prev, { code: response.code, item: item.name }]);
                }
                onSuccess('Resgatado!', response.message || `Você resgatou: ${item.name}`);
                await onRefresh();
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message || 'Não foi possível resgatar a recompensa.');
        } finally {
            setLoading(null);
            setConfirmItem(null);
        }
    };

    const categories = [
        { id: 'ALL', label: 'Todos', icon: Gift },
        { id: 'GIFT_CARD', label: 'Gift Cards', icon: ShoppingBag },
        { id: 'COUPON', label: 'Cupons', icon: Coffee },
        { id: 'PIX_CASHBACK', label: 'PIX', icon: Zap },
        { id: 'MEMBERSHIP', label: 'PRO', icon: Crown },
    ];

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="text-zinc-400 hover:text-white transition p-2 -ml-2">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-black text-white flex items-center gap-2">
                        <Gift className="text-primary-400" /> Loja de Recompensas
                    </h1>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                        Troque seus pontos por benefícios
                    </p>
                </div>
            </div>

            {/* Saldo de Pontos */}
            <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-emerald-600 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-20">
                    <Star size={100} fill="currentColor" />
                </div>
                <div className="relative z-10">
                    <p className="text-primary-200 text-[10px] font-black uppercase tracking-widest mb-1">
                        Seus Pontos Farm
                    </p>
                    <h2 className="text-4xl font-black text-white tabular-nums mb-2">
                        {farmPoints.toLocaleString()} <span className="text-lg opacity-70">pts</span>
                    </h2>
                    <div className="flex items-center gap-2 text-primary-100 text-xs">
                        <Zap size={14} />
                        <span>Ganhe mais pontos assistindo vídeos e fazendo check-in diário</span>
                    </div>
                </div>
            </div>

            {/* Códigos Resgatados */}
            {redeemedCodes.length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Check size={16} className="text-emerald-400" />
                        <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Códigos Resgatados</span>
                    </div>
                    {redeemedCodes.map((rc, idx) => (
                        <div key={idx} className="bg-black/30 rounded-xl p-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-zinc-400">{rc.item}</p>
                                <p className="text-lg font-mono font-bold text-white tracking-wider">{rc.code}</p>
                            </div>
                            <button
                                onClick={() => navigator.clipboard.writeText(rc.code)}
                                className="text-[10px] text-primary-400 font-bold uppercase hover:text-white transition"
                            >
                                Copiar
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Categorias */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat.id
                            ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20'
                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                            }`}
                    >
                        <cat.icon size={14} />
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Grid de Recompensas */}
            <div className="grid grid-cols-2 gap-3">
                {filteredRewards.map(item => {
                    const canAfford = farmPoints >= item.pointsCost;
                    const isLoading = loading === item.id;

                    return (
                        <div
                            key={item.id}
                            className={`relative bg-zinc-900/50 border rounded-2xl overflow-hidden group transition-all ${canAfford ? 'border-zinc-800 hover:border-primary-500/50' : 'border-zinc-800/50 opacity-60'
                                }`}
                        >
                            {/* Badge Featured */}
                            {item.featured && (
                                <div className="absolute top-2 left-2 z-10">
                                    <span className="text-[8px] font-black bg-amber-500 text-black px-2 py-0.5 rounded-full uppercase">
                                        Popular
                                    </span>
                                </div>
                            )}
                            {/* Badge Discount */}
                            {item.discount && (
                                <div className="absolute top-2 right-2 z-10">
                                    <span className="text-[8px] font-black bg-emerald-500 text-black px-2 py-0.5 rounded-full uppercase">
                                        {item.discount}
                                    </span>
                                </div>
                            )}

                            {/* Icon Area */}
                            <div className={`p-6 ${item.bgColor} flex items-center justify-center`}>
                                <item.icon size={40} className={item.color} />
                            </div>

                            {/* Content */}
                            <div className="p-4 space-y-3">
                                <div>
                                    <h4 className="text-sm font-bold text-white leading-tight">{item.name}</h4>
                                    <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{item.description}</p>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] text-zinc-600 uppercase font-bold">Custo</p>
                                        <p className="text-sm font-black text-primary-400">
                                            {item.pointsCost.toLocaleString()} pts
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => canAfford && setConfirmItem(item)}
                                        disabled={!canAfford || isLoading}
                                        className={`p-2.5 rounded-xl transition-all ${canAfford
                                            ? 'bg-primary-500 text-black hover:bg-primary-400 active:scale-95'
                                            : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                            }`}
                                    >
                                        {isLoading ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <ChevronRight size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty State */}
            {filteredRewards.length === 0 && (
                <div className="text-center py-12">
                    <Gift size={48} className="text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-500 text-sm">Nenhuma recompensa nesta categoria.</p>
                </div>
            )}

            {/* Aviso de pontos insuficientes */}
            {farmPoints < 1000 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-400">Pontos Insuficientes</p>
                        <p className="text-xs text-zinc-400 mt-1">
                            Você precisa de pelo menos 1.000 pontos para resgatar recompensas.
                            Faça check-in diário e assista vídeos para acumular pontos!
                        </p>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação */}
            {confirmItem && (
                <ConfirmModal
                    isOpen={!!confirmItem}
                    onClose={() => setConfirmItem(null)}
                    onConfirm={() => handleRedeemReward(confirmItem)}
                    title={`Resgatar ${confirmItem.name}?`}
                    message={`Serão deduzidos ${confirmItem.pointsCost.toLocaleString()} pontos do seu saldo. Seu saldo atual: ${farmPoints.toLocaleString()} pts.`}
                    confirmText="RESGATAR AGORA"
                    type="success"
                />
            )}
        </div>
    );
};
