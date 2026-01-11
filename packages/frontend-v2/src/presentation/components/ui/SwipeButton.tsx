
import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Check } from 'lucide-react';

interface SwipeButtonProps {
    onComplete: () => void;
    text?: string;
    completedText?: string;
    color?: string;
    reset?: boolean;
}

export const SwipeButton: React.FC<SwipeButtonProps> = ({
    onComplete,
    text = "Deslize para confirmar",
    completedText = "Confirmado!",
    color = "bg-emerald-500",
    reset = false
}) => {
    const [dragWidth, setDragWidth] = useState(0);
    const [isCompleted, setIsCompleted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const startX = useRef(0);

    useEffect(() => {
        if (reset) {
            setDragWidth(0);
            setIsCompleted(false);
        }
    }, [reset]);

    const handleStart = (clientX: number) => {
        if (isCompleted) return;
        isDragging.current = true;
        startX.current = clientX;
    };

    const handleMove = (clientX: number) => {
        if (!isDragging.current || !containerRef.current || isCompleted) return;

        const containerWidth = containerRef.current.offsetWidth;
        // Subtrair a largura do handle (aprox 50px)
        const maxDrag = containerWidth - 50;

        let move = clientX - startX.current;
        if (move < 0) move = 0;
        if (move > maxDrag) move = maxDrag;

        setDragWidth(move);

        // Se arrastou mais que 95%, completa
        if (move > maxDrag * 0.95) {
            completeSwipe();
        }
    };

    const handleEnd = () => {
        if (isCompleted) return;
        isDragging.current = false;

        // Se não completou, volta pro início
        if (containerRef.current) {
            const containerWidth = containerRef.current.offsetWidth;
            const maxDrag = containerWidth - 50;
            if (dragWidth < maxDrag * 0.95) {
                setDragWidth(0);
            }
        } else {
            setDragWidth(0);
        }
    };

    const completeSwipe = () => {
        isDragging.current = false;
        setIsCompleted(true);
        if (containerRef.current) {
            setDragWidth(containerRef.current.offsetWidth - 50);
        }
        onComplete();
    };

    // Touch Events
    const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
    const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
    const onTouchEnd = () => handleEnd();

    // Mouse Events (para desktop testing)
    const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX);
    const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();
    const onMouseLeave = () => handleEnd();

    return (
        <div
            className={`relative w-full h-14 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden select-none ${isCompleted ? color : ''} transition-colors duration-300`}
            ref={containerRef}
        >
            {/* Texto de Fundo */}
            <div className={`absolute inset-0 flex items-center justify-center font-bold uppercase text-sm tracking-wide z-10 transition-opacity duration-300 ${isCompleted ? 'text-white opacity-100' : 'text-zinc-500 opacity-100'}`}>
                {isCompleted ? completedText : text}
            </div>

            {/* Barra de Progresso (Fundo colorido atrás do handle) */}
            <div
                className={`absolute left-0 top-0 bottom-0 ${color} opacity-20`}
                style={{ width: dragWidth + 50 }}
            />

            {/* Handle (Botão deslizante) */}
            <div
                className={`absolute top-1 bottom-1 w-12 rounded-full bg-white flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg z-20 transition-transform duration-75`}
                style={{ transform: `translateX(${dragWidth}px)` }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
            >
                {isCompleted ? (
                    <Check className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
                ) : (
                    <ChevronRight className="w-6 h-6 text-zinc-800" />
                )}
            </div>
        </div>
    );
};
