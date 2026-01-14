import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { apiMarketplace } from '../../../application/services/api.marketplace';

interface FavoriteButtonProps {
    listingId: number;
    initialFavorited?: boolean;
    size?: number;
    className?: string;
    onToggle?: (newState: boolean) => void;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
    listingId,
    initialFavorited = false,
    size = 20,
    className = "",
    onToggle
}) => {
    const [isFavorited, setIsFavorited] = useState(initialFavorited);
    const [isLoading, setIsLoading] = useState(false);

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Evita abrir o detalhe do item ao clicar no coração
        if (isLoading) return;

        // Optimistic UI update
        const newState = !isFavorited;
        setIsFavorited(newState);
        if (onToggle) onToggle(newState);

        setIsLoading(true);
        try {
            await apiMarketplace.toggleFavorite(listingId);
            // Sucesso: mantém o estado atualizado
        } catch (error) {
            // Erro: reverte
            console.error("Erro ao favoritar:", error);
            setIsFavorited(!newState);
            if (onToggle) onToggle(!newState);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleToggle}
            className={`flex items-center justify-center transition-transform active:scale-90 ${className}`}
            disabled={isLoading}
            aria-label={isFavorited ? "Desfavoritar" : "Favoritar"}
        >
            <Heart
                size={size}
                className={`transition-colors duration-300 ${isFavorited ? 'fill-red-500 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-zinc-400 hover:text-red-400'}`}
            />
        </button>
    );
};
