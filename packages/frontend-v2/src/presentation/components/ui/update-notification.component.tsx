import React, { useState, useEffect } from 'react';
import { RefreshCw, Download } from 'lucide-react';

export const UpdateNotification: React.FC = () => {
    const [showUpdate, setShowUpdate] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            // Registrar o Service Worker
            navigator.serviceWorker.register('/sw.js').then(reg => {
                setRegistration(reg);

                // Se já tiver um SW esperando para ativar (atualização baixada)
                if (reg.waiting) {
                    setShowUpdate(true);
                }

                // Monitorar novas atualizações
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                setShowUpdate(true);
                            }
                        });
                    }
                });
            });

            // Recarregar a página quando o novo SW assumir o controle
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    window.location.reload();
                    refreshing = true;
                }
            });
        }
    }, []);

    const updateApp = () => {
        if (registration && registration.waiting) {
            // Enviar mensagem para o SW pular a espera e ativar imediatamente
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
            window.location.reload();
        }
    };

    if (!showUpdate) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-5">
            <div className="bg-zinc-900 border border-emerald-500/50 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between max-w-md mx-auto">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/20 p-2 rounded-full text-emerald-400">
                        <Download size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-sm">Atualização Disponível</p>
                        <p className="text-xs text-zinc-400">Nova versão do App pronta!</p>
                    </div>
                </div>
                <button
                    onClick={updateApp}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                    <RefreshCw size={14} /> ATUALIZAR
                </button>
            </div>
        </div>
    );
};
