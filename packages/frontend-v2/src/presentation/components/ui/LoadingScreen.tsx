import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface LoadingScreenProps {
    message?: string;
    fullScreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    message = "Sincronizando com a rede...",
    fullScreen = false
}) => {
    return (
        <div className={`flex flex-col items-center justify-center ${fullScreen ? 'fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm' : 'min-h-[400px] w-full'}`}>
            <div className="relative">
                {/* Outer Glow */}
                <div className="absolute inset-0 bg-primary-500 blur-[40px] opacity-20 animate-pulse" />

                {/* Main Spinner Area */}
                <div className="relative bg-zinc-900/50 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-6">
                    <div className="relative">
                        <Loader2 className="text-primary-500 animate-spin" size={64} strokeWidth={1.5} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles className="text-primary-400 animate-pulse" size={24} />
                        </div>
                    </div>

                    <div className="text-center">
                        <p className="text-xs font-black text-white uppercase tracking-[0.3em] animate-pulse mb-2">
                            {message}
                        </p>
                        <div className="flex gap-1 justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-500/40 animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-500/70 animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" />
                        </div>
                    </div>
                </div>
            </div>

            {fullScreen && (
                <p className="absolute bottom-12 text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
                    Sistema de Apoio Mútuo • Cred30 v2
                </p>
            )}
        </div>
    );
};
