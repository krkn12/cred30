import React from 'react';
import { Medal, Award, Trophy, Star } from 'lucide-react';

interface SellerReputationBadgeProps {
    reputation: 'NOVO' | 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE';
    sales: number;
    rating: number;
    showLabel?: boolean;
}

export const SellerReputationBadge: React.FC<SellerReputationBadgeProps> = ({
    reputation,
    sales,
    rating,
    showLabel = true
}) => {
    const getBadgeConfig = () => {
        switch (reputation) {
            case 'DIAMANTE':
                return {
                    icon: <Trophy size={14} className="text-cyan-400" />,
                    bg: "bg-cyan-500/10",
                    border: "border-cyan-500/30",
                    text: "text-cyan-400",
                    label: "MercadoLíder Platinum"
                };
            case 'OURO':
                return {
                    icon: <Award size={14} className="text-amber-400" />,
                    bg: "bg-amber-500/10",
                    border: "border-amber-500/30",
                    text: "text-amber-400",
                    label: "MercadoLíder Gold"
                };
            case 'PRATA':
                return {
                    icon: <Medal size={14} className="text-zinc-300" />,
                    bg: "bg-zinc-500/10",
                    border: "border-zinc-500/30",
                    text: "text-zinc-300",
                    label: "MercadoLíder Silver"
                };
            case 'BRONZE':
                return {
                    icon: <Medal size={14} className="text-orange-700" />,
                    bg: "bg-orange-900/10",
                    border: "border-orange-700/30",
                    text: "text-orange-700",
                    label: "Vendedor Bronze"
                };
            default:
                return {
                    icon: <Star size={14} className="text-zinc-500" />,
                    bg: "bg-zinc-800/50",
                    border: "border-zinc-700",
                    text: "text-zinc-500",
                    label: "Vendedor Novo"
                };
        }
    };

    const config = getBadgeConfig();

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border}`}>
            {config.icon}
            <div className="flex flex-col">
                <span className={`text-[10px] font-black uppercase tracking-widest ${config.text}`}>
                    {config.label}
                </span>
                {showLabel && (
                    <span className="text-[9px] text-zinc-500 font-medium">
                        {rating > 0 ? `${rating.toFixed(1)} ★ • ` : ''}{sales} vendas
                    </span>
                )}
            </div>
        </div>
    );
};
