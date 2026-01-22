import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
    interface WindowEventMap {
        'beforeinstallprompt': BeforeInstallPromptEvent;
    }
}

/**
 * Detecta se está rodando como PWA instalado
 */
export const isPWAInstalled = (): boolean => {
    // Check display-mode
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;

    // iOS Safari standalone mode
    if ((navigator as any).standalone === true) return true;

    // Check if launched from home screen on Android
    if (document.referrer.includes('android-app://')) return true;

    return false;
};

/**
 * Detecta se é dispositivo móvel
 */
export const isMobileDevice = (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Detecta se é desktop
 */
export const isDesktopDevice = (): boolean => {
    return !isMobileDevice();
};

/**
 * Hook para gerenciar instalação do PWA
 */
export const usePWAInstall = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(isPWAInstalled());

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setIsInstallable(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Check on mount
        setIsInstalled(isPWAInstalled());

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const promptInstall = async () => {
        if (!deferredPrompt) return false;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setIsInstalled(true);
            setIsInstallable(false);
        }

        setDeferredPrompt(null);
        return outcome === 'accepted';
    };

    return { isInstallable, isInstalled, promptInstall, deferredPrompt };
};

interface PWAEnforcerProps {
    isAdmin: boolean;
    children: React.ReactNode;
}

/**
 * Componente que força PWA para clientes e bloqueia PWA para admins
 * 
 * Regras RÍGIDAS:
 * - Clientes em MOBILE: DEVEM usar o PWA (mostra aviso se não instalado)
 * - Clientes em DESKTOP: DEVEM usar o PWA/App instalado (BLOQUEIA acesso web)
 * - Admins: DEVEM usar a WEB (mostra aviso se estão no PWA)
 */
export const PWAEnforcer: React.FC<PWAEnforcerProps> = ({ isAdmin, children }) => {
    const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
    const isDesktop = isDesktopDevice();
    const [skipPWA, setSkipPWA] = useState(() => localStorage.getItem('skip-pwa-enforcement') === 'true');

    // ========================================
    // CLIENTE DESKTOP: SUGESTÃO de instalação (não bloqueia totalmente)
    // ========================================
    if (!isAdmin && isDesktop && !isInstalled && !skipPWA) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="max-w-lg w-full">
                    {/* Card principal de sugestão */}
                    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-primary-500/30 rounded-3xl p-8 shadow-2xl shadow-primary-900/20 text-center">
                        <div className="w-20 h-20 bg-primary-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary-500/20">
                            <Download className="text-primary-400" size={40} />
                        </div>

                        <h1 className="text-2xl font-black text-white mb-3 tracking-tight">
                            Melhore sua Experiência
                        </h1>

                        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                            O acesso via **Aplicativo Instalado (PWA)** é mais seguro e rápido.
                            Recomendamos a instalação para uma melhor performance.
                        </p>

                        {/* Botão de instalação */}
                        {isInstallable ? (
                            <button
                                onClick={promptInstall}
                                className="w-full bg-gradient-to-r from-primary-500 to-emerald-500 hover:from-primary-400 hover:to-emerald-400 text-black font-black py-5 rounded-[2rem] text-sm flex items-center justify-center gap-3 transition-all duration-500 shadow-xl shadow-primary-500/20 hover:shadow-primary-500/40 hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em] group"
                            >
                                <div className="p-2 bg-black/10 rounded-xl group-hover:rotate-12 transition-transform">
                                    <Download size={20} />
                                </div>
                                INSTALAR APLICATIVO AGORA
                            </button>
                        ) : (
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-left mb-6">
                                <p className="text-xs text-zinc-400 mb-2 font-bold uppercase tracking-widest">Como instalar:</p>
                                <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside">
                                    <li>Clique nos 3 pontos (⋮) no navegador</li>
                                    <li>Selecione "Instalar Cred30"</li>
                                </ol>
                            </div>
                        )}

                        <button
                            onClick={() => {
                                localStorage.setItem('skip-pwa-enforcement', 'true');
                                setSkipPWA(true);
                            }}
                            className="mt-6 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors pb-2 border-b border-transparent hover:border-zinc-800"
                        >
                            Continuar pelo Navegador
                        </button>

                        <p className="text-[10px] text-zinc-600 mt-6 uppercase tracking-widest">
                            Segurança Garantida • Cred30 Web
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Caso padrão: permite acesso normal
    return <>{children}</>;
};

/**
 * Banner persistente para mobile pedindo instalação do PWA
 * (Mostra em todas as telas até o usuário instalar ou dispensar)
 */
export const PWAInstallBanner: React.FC<{ onDismiss?: () => void }> = ({ onDismiss }) => {
    const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
    const [dismissed, setDismissed] = useState(() => {
        return localStorage.getItem('pwa-banner-dismissed') === 'true';
    });
    const isMobile = isMobileDevice();

    // No iOS, isInstallable será sempre falso. Vamos mostrar o banner mesmo assim.
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Não mostra em desktop (já está bloqueado pelo PWAEnforcer)
    // No mobile, mostra se não estiver instalado e (seja instalável OU seja iOS)
    if (!isMobile || isInstalled || (!isInstallable && !isIOS) || dismissed) {
        return null;
    }

    const handleDismiss = () => {
        localStorage.setItem('pwa-banner-dismissed', 'true');
        setDismissed(true);
        onDismiss?.();
    };

    const handleInstallClick = () => {
        if (isInstallable) {
            promptInstall();
        } else if (isIOS) {
            alert('Para instalar no iOS: toque no ícone de compartilhar (seta para cima) e selecione "Adicionar à Tela de Início".');
        }
    };

    return (
        <div className="fixed top-safe left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-sm mt-4">
            <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl ring-1 ring-white/5 animate-in slide-in-from-top duration-500">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400 border border-primary-500/20">
                            <Download size={20} />
                        </div>
                        <div>
                            <p className="text-white text-xs font-black uppercase tracking-tight">Instalar App</p>
                            <p className="text-[10px] text-zinc-500 font-medium">Acesso rápido e mais seguro</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleInstallClick}
                            className="bg-primary-500 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95"
                        >
                            {isIOS ? 'Como' : 'Instalar'}
                        </button>
                        <button onClick={handleDismiss} className="text-zinc-500 hover:text-white p-2">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Hook simples para checar se o usuário pode acessar
 * Útil para guards de rota
 */
export const useCanAccessApp = (isAdmin: boolean): { canAccess: boolean; reason: string } => {
    const isInstalled = isPWAInstalled();
    const isDesktop = isDesktopDevice();

    // Cliente em desktop sem PWA = bloqueado
    if (!isAdmin && isDesktop && !isInstalled) {
        return { canAccess: false, reason: 'desktop-requires-pwa' };
    }

    return { canAccess: true, reason: 'ok' };
};
