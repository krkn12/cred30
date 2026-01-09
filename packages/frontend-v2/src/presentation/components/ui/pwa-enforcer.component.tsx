import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, Lock, AlertTriangle } from 'lucide-react';

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
    const isMobile = isMobileDevice();
    const isDesktop = isDesktopDevice();

    // ========================================
    // CLIENTE DESKTOP: BLOQUEIA acesso web (força PWA)
    // ========================================
    if (!isAdmin && isDesktop && !isInstalled) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="max-w-lg w-full">
                    {/* Card principal de bloqueio */}
                    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-red-500/30 rounded-3xl p-8 shadow-2xl shadow-red-900/20 text-center">
                        <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                            <Lock className="text-red-400" size={40} />
                        </div>

                        <h1 className="text-2xl font-black text-white mb-3 tracking-tight">
                            Acesso Bloqueado
                        </h1>

                        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                            Para sua segurança, o acesso ao Cred30 via navegador web em desktop não é permitido.
                            <br /><br />
                            <strong className="text-white">Instale o aplicativo oficial</strong> para continuar.
                        </p>

                        {/* Alerta de segurança */}
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-left">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                                <p className="text-amber-200/80 text-xs leading-relaxed">
                                    O aplicativo instalado oferece proteção adicional contra phishing,
                                    mantém suas sessões mais seguras e garante que você está acessando o sistema oficial.
                                </p>
                            </div>
                        </div>

                        {/* Botão de instalação */}
                        {isInstallable ? (
                            <button
                                onClick={promptInstall}
                                className="w-full bg-gradient-to-r from-primary-500 to-emerald-500 hover:from-primary-400 hover:to-emerald-400 text-black font-black py-5 rounded-[2rem] text-sm flex items-center justify-center gap-3 transition-all duration-500 shadow-xl shadow-primary-500/20 hover:shadow-primary-500/40 hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em] group"
                            >
                                <div className="p-2 bg-black/10 rounded-xl group-hover:rotate-12 transition-transform">
                                    <Download size={20} />
                                </div>
                                INSTALAR APLICATIVO CRED30
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-zinc-500 text-xs">
                                    Se o botão de instalação não aparecer, siga os passos abaixo:
                                </p>
                                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-left">
                                    <p className="text-xs text-zinc-400 mb-2 font-bold uppercase tracking-widest">Como instalar:</p>
                                    <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside">
                                        <li>Clique nos 3 pontos (⋮) no canto superior direito</li>
                                        <li>Selecione "Instalar Cred30" ou "Adicionar à área de trabalho"</li>
                                        <li>Confirme a instalação</li>
                                        <li>Abra o app instalado no seu desktop</li>
                                    </ol>
                                </div>
                            </div>
                        )}

                        <p className="text-[10px] text-zinc-600 mt-6 uppercase tracking-widest">
                            Proteção contra fraudes • Cred30 Seguro
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================
    // CLIENTE MOBILE SEM PWA: Mostra aviso para instalar
    // ========================================
    if (isMobile && !isInstalled && isInstallable) {
        return (
            <>
                {children}
                <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-in slide-in-from-bottom duration-500">
                    <div className="max-w-md mx-auto bg-gradient-to-br from-primary-950 to-primary-900 border border-primary-500/30 rounded-2xl p-5 shadow-2xl shadow-primary-900/50">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center shrink-0">
                                <Smartphone className="text-primary-400" size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-white font-bold text-base mb-1">Instale o App Cred30</h3>
                                <p className="text-primary-200/80 text-sm leading-relaxed mb-4">
                                    Para a melhor experiência, instale o aplicativo na sua tela inicial. É rápido e sem downloads!
                                </p>
                                <button
                                    onClick={promptInstall}
                                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition"
                                >
                                    <Download size={18} />
                                    Instalar Agora
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
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
        <div className="fixed top-0 left-0 right-0 z-[9998] p-3 bg-gradient-to-r from-primary-600 to-emerald-600 shadow-lg">
            <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Download size={20} className="text-white shrink-0" />
                    <p className="text-white text-sm font-medium">
                        {isIOS ? 'Adicione o Cred30 à sua tela de início!' : 'Adicione à tela inicial para acesso rápido!'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleInstallClick}
                        className="bg-white text-black px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl hover:bg-zinc-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Download size={12} strokeWidth={3} />
                        {isIOS ? 'Como Instalar' : 'Instalar'}
                    </button>
                    <button onClick={handleDismiss} className="text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-all">
                        <X size={18} />
                    </button>
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
