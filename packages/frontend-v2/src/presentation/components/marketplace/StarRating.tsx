import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
    rating: number; // 0 a 5
    size?: number;
    editable?: boolean;
    onChange?: (newRating: number) => void;
    showCount?: boolean;
    count?: number;
}

export const StarRating: React.FC<StarRatingProps> = ({
    rating,
    size = 14,
    editable = false,
    onChange,
    showCount = false,
    count = 0
}) => {
    const stars = [1, 2, 3, 4, 5];

    return (
        <div className="flex items-center gap-1">
            <div className="flex">
                {stars.map((star) => {
                    const isFilled = star <= Math.round(rating); // Arredonda para inteiro para preenchimento simples

                    return (
                        <div
                            key={star}
                            className={`${editable ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
                            onClick={() => editable && onChange && onChange(star)}
                        >
                            <Star
                                size={size}
                                className={`${isFilled ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'} transition-colors`}
                                fill={isFilled ? "currentColor" : "none"}
                            />
                        </div>
                    );
                })}
            </div>
            {showCount && count > 0 && (
                <span className="text-[10px] text-zinc-500 ml-1 font-medium">({count})</span>
            )}
        </div>
    );
};
