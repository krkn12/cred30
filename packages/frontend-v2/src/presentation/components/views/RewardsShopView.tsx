import { useState, useEffect, useCallback } from 'react';
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
    description?: string;
    pointsCost: number;
    type: 'GIFT_CARD' | 'COUPON' | 'PIX_CASHBACK' | 'MEMBERSHIP';
    brand?: string;
    value?: number;
    canAfford?: boolean;
}

// Mapeamento de ícones e cores por tipo/id
const getRewardStyle = (id: string, type: string) => {
    const styles: Record<string, { icon: any, color: string, bgColor: string }> = {
        'gc-amazon-10': { icon: ShoppingBag, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
        'gc-ifood-15': { icon: Coffee, color: 'text-red-400', bgColor: 'bg-red-500/10' },
        'gc-spotify-1m': { icon: Music, color: 'text-green-400', bgColor: 'bg-green-500/10' },
        'gc-netflix-25': { icon: Film, color: 'text-red-500', bgColor: 'bg-red-500/10' },
        'gc-uber-20': { icon: Fuel, color: 'text-zinc-100', bgColor: 'bg-zinc-800' },
        'gc-playstore-30': { icon: Gamepad2, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
        'gc-recarga-10': { icon: Smartphone, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    };

    if (styles[id]) return styles[id];

    // Fallback por tipo
    if (type === 'PIX_CASHBACK') return { icon: Zap, color: 'text-primary-400', bgColor: 'bg-primary-500/10' };
    if (type === 'MEMBERSHIP') return { icon: Crown, color: 'text-amber-400', bgColor: 'bg-amber-500/10' };
    if (type === 'COUPON') return { icon: Coffee, color: 'text-red-400', bgColor: 'bg-red-500/10' };

    return { icon: Gift, color: 'text-zinc-400', bgColor: 'bg-zinc-800' };
};

export const RewardsShopView = ({ state, onBack, onSuccess, onError, onRefresh }: RewardsShopViewProps) => {
    // Early return se o usuário ainda não carregou
    if (!state?.currentUser) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const user = state.currentUser;

    const [farmPoints, setFarmPoints] = useState(user.ad_points || 0);
    const [catalog, setCatalog] = useState<RewardItem[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'GIFT_CARD' | 'COUPON' | 'PIX_CASHBACK' | 'MEMBERSHIP'>('ALL');
    const [loading, setLoading] = useState<string | null>(null);
    const [confirmItem, setConfirmItem] = useState<RewardItem | null>(null);
    const [redeemedCodes, setRedeemedCodes] = useState<{ code: string, item: string }[]>([]);

    // Carregar catálogo da API
    const loadCatalog = useCallback(async () => {
        setLoadingCatalog(true);
        try {
            const res = await apiService.get<any>('/earn/rewards-catalog');
            if (res.success && res.data) {
                setFarmPoints(res.data.currentPoints || 0);
                setCatalog(res.data.catalog || []);
            }
        } catch (e) {
            console.error('Erro ao carregar catálogo:', e);
        } finally {
            setLoadingCatalog(false);
        }
    }, []);

    useEffect(() => {
        loadCatalog();
    }, [loadCatalog]);

    const filteredRewards = selectedCategory === 'ALL'
        ? catalog
        : catalog.filter(r => r.type === selectedCategory);

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
                await loadCatalog(); // Atualizar pontos
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
                {loadingCatalog ? (
                    <div className="col-span-2 flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                    </div>
                ) : filteredRewards.map(item => {
                    const canAfford = item.canAfford ?? (farmPoints >= item.pointsCost);
                    const isLoading = loading === item.id;
                    const style = getRewardStyle(item.id, item.type);
                    const IconComponent = style.icon;

                    return (
                        <div
                            key={item.id}
                            className={`relative bg-zinc-900/50 border rounded-2xl overflow-hidden group transition-all ${canAfford ? 'border-zinc-800 hover:border-primary-500/50' : 'border-zinc-800/50 opacity-60'
                                }`}
                        >
                            {/* Icon Area */}
                            <div className={`p-6 ${style.bgColor} flex items-center justify-center`}>
                                <IconComponent size={40} className={style.color} />
                            </div>

                            {/* Content */}
                            <div className="p-4 space-y-3">
                                <div>
                                    <h4 className="text-sm font-bold text-white leading-tight">{item.name}</h4>
                                    <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
                                        {item.description || (item.value ? `Valor: R$ ${item.value}` : '')}
                                    </p>
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
