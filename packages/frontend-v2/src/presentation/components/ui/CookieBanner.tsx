import React, { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';

export const CookieBanner: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('lgpd_consent');
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('lgpd_consent', 'true');
        localStorage.setItem('lgpd_consent_date', new Date().toISOString());
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-auto md:right-8 md:w-96 z-[200] animate-in slide-in-from-bottom-5 duration-500">
            <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] shadow-2xl shadow-black/50 ring-1 ring-white/5">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center text-primary-400">
                        <ShieldCheck size={24} />
                    </div>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="text-zinc-500 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <h3 className="text-white font-bold mb-2">Sua Privacidade</h3>
                <p className="text-zinc-400 text-xs leading-relaxed mb-6">
                    O Cred30 utiliza tecnologias necessárias para o funcionamento e segurança da sua carteira, em conformidade com a LGPD. Ao continuar, você aceita nossa política de dados.
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={handleAccept}
                        className="flex-1 bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary-500/20 text-sm"
                    >
                        Entendido e Aceito
                    </button>
                    <a
                        href="/privacy"
                        className="px-4 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 flex items-center justify-center rounded-xl transition-all text-xs font-medium"
                    >
                        Ver Política
                    </a>
                </div>
            </div>
        </div>
    );
};
