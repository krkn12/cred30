import React from 'react';
import { RefreshCw, Download } from 'lucide-react';

import { useRegisterSW } from 'virtual:pwa-register/react';

export const UpdateNotification: React.FC = () => {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            if (r) {
                // Checar atualizações a cada 30 minutos (proativo)
                setInterval(() => {
                    r.update();
                }, 1000 * 60 * 30);

                // Checar sempre que o usuário volta para o App (foreground)
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') {
                        r.update();
                    }
                });
            }
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    if (!offlineReady && !needRefresh) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-5">
            <div className="bg-zinc-900 border border-emerald-500/50 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between max-w-md mx-auto ring-1 ring-emerald-500/20">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/20 p-2 rounded-full text-emerald-400">
                        <Download size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-sm">
                            {needRefresh ? 'Atualização Disponível' : 'Pronto para Offline'}
                        </p>
                        <p className="text-xs text-zinc-400">
                            {needRefresh
                                ? 'Uma nova versão do App está pronta para instalação.'
                                : 'O App foi baixado e agora funciona offline!'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {needRefresh && (
                        <button
                            onClick={() => updateServiceWorker(true)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <RefreshCw size={14} /> ATUALIZAR
                        </button>
                    )}
                    <button
                        onClick={close}
                        className="text-zinc-500 hover:text-white text-xs p-2"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
