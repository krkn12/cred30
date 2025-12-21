import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, ShieldCheck, DollarSign, Play } from 'lucide-react';

interface PromoVideoPlayerProps {
    duration: number; // Duration in seconds
    onComplete: () => void;
}

export const PromoVideoPlayer: React.FC<PromoVideoPlayerProps> = ({ duration, onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [slideIndex, setSlideIndex] = useState(0);

    const slides = [
        {
            icon: <TrendingUp size={64} className="text-emerald-400" />,
            title: "Crescimento Mútuo",
            text: "Seu patrimônio se fortalece com a comunidade. Adquira licenças e receba bônus de resultado.",
            color: "from-emerald-900/40 to-black"
        },
        {
            icon: <Users size={64} className="text-primary-400" />,
            title: "Força da Comunidade",
            text: "Uma rede de parceiros unidos. Aprovação de crédito feita por quem confia em você.",
            color: "from-blue-900/40 to-black"
        },
        {
            icon: <ShieldCheck size={64} className="text-purple-400" />,
            title: "Segurança Total",
            text: "Sistema transparente e auditável. Suas transações protegidas e garantidas por regras claras.",
            color: "from-purple-900/40 to-black"
        },
        {
            icon: <DollarSign size={64} className="text-yellow-400" />,
            title: "Ganhe Agora",
            text: "Complete tarefas, assista vídeos e aumente seu score para ter mais limite.",
            color: "from-yellow-900/40 to-black"
        }
    ];

    useEffect(() => {
        const intervalTime = 100; // Update every 100ms
        const totalSteps = (duration * 1000) / intervalTime;
        const stepSize = 100 / totalSteps;

        const timer = setInterval(() => {
            setProgress((prev) => {
                const next = prev + stepSize;
                if (next >= 100) {
                    clearInterval(timer);
                    onComplete();
                    return 100;
                }
                return next;
            });
        }, intervalTime);

        // Slide rotation
        const slideDuration = duration / slides.length;
        const slideTimer = setInterval(() => {
            setSlideIndex(prev => (prev + 1) % slides.length);
        }, slideDuration * 1000);

        return () => {
            clearInterval(timer);
            clearInterval(slideTimer);
        };
    }, [duration, onComplete, slides.length]);

    const currentSlide = slides[slideIndex];

    return (
        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
            {/* Animated Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${currentSlide.color} transition-colors duration-1000 ease-in-out`} />

            {/* Content Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500 key={slideIndex}">
                <div className="mb-6 animate-bounce">
                    {currentSlide.icon}
                </div>
                <h2 className="text-2xl font-bold text-white mb-4 tracking-tight drop-shadow-lg">
                    {currentSlide.title}
                </h2>
                <p className="text-zinc-300 text-sm leading-relaxed max-w-sm drop-shadow-md">
                    {currentSlide.text}
                </p>
            </div>

            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800">
                <div
                    className="h-full bg-primary-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] transition-all duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Timer Overlay */}
            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur px-3 py-1 rounded-full text-[10px] font-mono text-zinc-400 border border-white/10">
                PROMO: {Math.ceil(duration - (progress / 100) * duration)}s
            </div>

            {/* Watermark */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 opacity-50">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-[8px] uppercase tracking-widest text-white font-bold">Cred30 Ad</span>
            </div>
        </div>
    );
};
