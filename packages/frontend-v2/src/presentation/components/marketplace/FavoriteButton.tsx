import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
            className={`flex items-center justify-center transition-all active:scale-90 ${className}`}
            disabled={isLoading}
            aria-label={isFavorited ? "Desfavoritar" : "Favoritar"}
        >
            <AnimatePresence mode='wait'>
                {isFavorited ? (
                    <motion.div
                        key="filled"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                        <Heart size={size} className="fill-red-500 text-red-500 shadow-glow-red" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="outline"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                    >
                        <Heart size={size} className="text-zinc-400 hover:text-red-400 transition-colors" />
                    </motion.div>
                )}
            </AnimatePresence>
        </button>
    );
};
