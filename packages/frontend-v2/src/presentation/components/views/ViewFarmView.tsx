import React, { useState, useEffect, useRef } from 'react';
import { Play, ChevronRight, X, Clock, Trophy, Zap, AlertTriangle, Loader2 } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}

interface VideoToWatch {
    id: string;
    title: string;
    videoUrl: string;
    platform: string;
    minWatchSeconds: number;
    viewerEarningPoints: number;
    promoterName: string;
    thumbnailUrl?: string; // Para o preview antes de começar
}

interface ViewFarmViewProps {
    onBack: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onRefresh: () => void;
}

export const ViewFarmView: React.FC<ViewFarmViewProps> = ({ onBack, onSuccess, onError, onRefresh }) => {
    const [currentVideo, setCurrentVideo] = useState<VideoToWatch | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isWatching, setIsWatching] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [dailyGoal, setDailyGoal] = useState({ current: 0, target: 10 });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [playerState, setPlayerState] = useState<number>(-1); // -1: unstarted, 0: ended, 1: playing, 2: paused
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const playerRef = useRef<any>(null);

    const loadNextVideo = async () => {
        setIsLoading(true);
        setCurrentVideo(null);
        setIsComplete(false);
        setIsWatching(false);
        setProgress(0);

        try {
            const res = await apiService.get<VideoToWatch>('/promo-videos/farm/next');
            if (res.success && res.data) {
                setCurrentVideo(res.data);
            } else if ((res as any).code === 'NO_VIDEOS_AVAILABLE') {
                onError('Esgotado', res.message);
                onBack(); // Retorna se não houver vídeos
            } else {
                onError('Erro', res.message || 'Erro ao carregar próximo vídeo');
            }
        } catch (error) {
            console.error('[FARM] Erro ao carregar vídeo:', error);
            onError('Erro', 'Falha na conexão com o servidor');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadNextVideo();

        // Load YouTube API
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (playerRef.current) {
                try {
                    playerRef.current.destroy();
                } catch (e) { /* ignore */ }
            }
        };
    }, []);

    // Timer Logic adjusted for playback state
    useEffect(() => {
        if (isWatching && playerState === 1 && !isComplete) {
            if (timerRef.current) clearInterval(timerRef.current);

            timerRef.current = setInterval(() => {
                setProgress(prev => {
                    if (prev >= (currentVideo?.minWatchSeconds || 0)) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        setIsComplete(true);
                        return currentVideo?.minWatchSeconds || 0;
                    }
                    return prev + 1;
                });
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isWatching, playerState, isComplete, currentVideo]);

    const startWatching = async () => {
        if (!currentVideo) return;

        try {
            const res = await apiService.post<any>(`/promo-videos/${currentVideo.id}/start-view`, {});
            if (!res.success) {
                onError('Erro', res.message);
                return;
            }

            setIsWatching(true);
            setProgress(0);
            setIsComplete(false);
        } catch (error: any) {
            onError('Erro', error.message || 'Erro ao iniciar visualização');
        }
    };

    const claimReward = async () => {
        if (!currentVideo || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const res = await apiService.post<any>(`/promo-videos/${currentVideo.id}/complete-view`, {
                watchTimeSeconds: progress
            });

            if (res.success) {
                onSuccess('Parabéns!', `Você ganhou ${currentVideo.viewerEarningPoints} pontos!`);
                setDailyGoal(prev => ({ ...prev, current: prev.current + 1 }));
                onRefresh();

                // Auto carregamento do próximo após 2 segundos
                setTimeout(() => {
                    loadNextVideo();
                    setIsSubmitting(false);
                }, 1500);
            } else {
                onError('Erro', res.message);
                setIsSubmitting(false);
            }
        } catch (error: any) {
            onError('Erro', error.message || 'Erro ao finalizar visualização');
            setIsSubmitting(false);
        }
    };

    const getVideoId = (url: string) => {
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        return ytMatch ? ytMatch[1] : null;
    };

    const renderPlayer = () => {
        if (!currentVideo) return null;

        const ytId = getVideoId(currentVideo.videoUrl);
        if (currentVideo.platform === 'YOUTUBE' && ytId) {
            return (
                <div className="w-full h-full rounded-2xl overflow-hidden bg-black">
                    <div id="farm-player" className="w-full h-full"></div>
                    <YouTubeInit
                        videoId={ytId}
                        onStateChange={(state: number) => setPlayerState(state)}
                        onReady={(player: any) => {
                            playerRef.current = player;
                            player.playVideo();
                        }}
                    />
                </div>
            );
        }

        return (
            <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center rounded-2xl p-6 text-center">
                <AlertTriangle size={48} className="text-amber-500 mb-4" />
                <p className="text-white font-bold mb-4">Esta plataforma requer visualização externa.</p>
                <a
                    href={currentVideo.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-primary-500 text-black px-6 py-3 rounded-full font-black uppercase tracking-widest text-xs"
                    onClick={() => {
                        if (!isWatching) startWatching();
                    }}
                >
                    ABRIR VÍDEO NO {currentVideo.platform}
                </a>
                <p className="mt-4 text-[10px] text-zinc-500 uppercase tracking-widest">
                    Após abrir, volte aqui e aguarde o contador para ganhar os pontos.
                </p>
            </div>
        );
    };

    if (isLoading && !currentVideo) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-4">
                <Loader2 className="text-primary-500 animate-spin" size={48} />
                <p className="text-zinc-500 font-black uppercase tracking-widest animate-pulse">Buscando próximo vídeo disponível...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-32 pt-4">
            {/* Header Fixo de Farm */}
            <div className="flex items-center justify-between mb-8 px-2">
                <button onClick={onBack} className="p-3 bg-surface border border-surfaceHighlight rounded-2xl text-zinc-400 hover:text-white transition">
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center">
                    <h2 className="text-lg font-black text-white italic tracking-tighter flex items-center gap-2">
                        <Zap size={20} className="text-yellow-400 fill-yellow-400" />
                        FARM DE VIEWS
                    </h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Modo Contínuo Ativado</p>
                </div>
                <div className="w-11" /> {/* Spacer */}
            </div>

            {/* Daily Goal */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Trophy size={80} />
                </div>

                <div className="flex justify-between items-end mb-3">
                    <div>
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Meta Diária</p>
                        <h3 className="text-xl font-black text-white">{dailyGoal.current} / {dailyGoal.target}</h3>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Recompensa Extra</p>
                        <p className="text-xs font-bold text-zinc-400">+500 pts ao completar</p>
                    </div>
                </div>

                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.3)] transition-all duration-1000"
                        style={{ width: `${Math.min(100, (dailyGoal.current / dailyGoal.target) * 100)}%` }}
                    />
                </div>
            </div>

            {/* Video Player Section */}
            <div className="space-y-6">
                <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative">
                    {isWatching ? renderPlayer() : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-zinc-900 to-black">
                            <img
                                src={currentVideo?.thumbnailUrl || `https://img.youtube.com/vi/${getVideoId(currentVideo?.videoUrl || '')}/mqdefault.jpg`}
                                className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm"
                                alt=""
                            />
                            <div className="relative z-10 text-center">
                                <p className="text-[10px] text-primary-400 font-black uppercase tracking-[0.2em] mb-4">Novo Vídeo Disponível</p>
                                <h3 className="text-xl font-bold text-white mb-6 line-clamp-2 max-w-xs">{currentVideo?.title}</h3>
                                <button
                                    onClick={startWatching}
                                    className="bg-primary-500 hover:bg-primary-400 text-black w-20 h-20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all hover:scale-110 active:scale-95 group"
                                >
                                    <Play size={32} className="fill-current transform translate-x-1" />
                                </button>
                                <p className="mt-6 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                    Assista por {currentVideo?.minWatchSeconds}s para ganhar {currentVideo?.viewerEarningPoints} pts
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Progress & Controls */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Tempo Restante</p>
                                <p className="text-lg font-black text-white">
                                    {Math.max(0, (currentVideo?.minWatchSeconds || 0) - progress)}s
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Recompensa</p>
                            <p className="text-xl font-black text-emerald-400">+{currentVideo?.viewerEarningPoints} PTS</p>
                        </div>
                    </div>

                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mb-8">
                        <div
                            className={`h-full transition-all duration-300 ${isComplete ? 'bg-emerald-500' : 'bg-primary-500 animate-pulse'}`}
                            style={{ width: `${Math.min(100, (progress / (currentVideo?.minWatchSeconds || 1)) * 100)}%` }}
                        />
                    </div>

                    <button
                        onClick={claimReward}
                        disabled={!isComplete || isSubmitting}
                        className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group ${isComplete
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_15px_30px_-5px_rgba(16,185,129,0.3)]'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                            }`}
                    >
                        {isSubmitting ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : isComplete ? (
                            <>RESGATAR RECOMPENSA <ChevronRight size={18} /></>
                        ) : (
                            'AGUARDE COMPLETAR...'
                        )}
                    </button>

                    {isComplete && !isSubmitting && (
                        <p className="text-center mt-4 text-[9px] text-emerald-500/80 font-black uppercase tracking-widest animate-bounce">
                            Tempo mínimo atingido! Clique para ganhar.
                        </p>
                    )}
                </div>
            </div>

            {/* Bottom Info */}
            <div className="mt-12 text-center space-y-2">
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Promovido por: <span className="text-zinc-400">{currentVideo?.promoterName}</span></p>
                <div className="flex items-center justify-center gap-2 text-[9px] text-zinc-700 font-bold uppercase tracking-tighter">
                    <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full" />
                    Validação em Tempo Real Ativa
                    <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full" />
                </div>
            </div>
        </div>
    );
};

// Helper component to initialize individual YouTube players
const YouTubeInit: React.FC<{
    videoId: string;
    onStateChange: (state: number) => void;
    onReady: (player: any) => void;
}> = ({ videoId, onStateChange, onReady }) => {
    useEffect(() => {
        const initPlayer = () => {
            new window.YT.Player('farm-player', {
                videoId: videoId,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    modestbranding: 1,
                    rel: 0,
                    iv_load_policy: 3,
                    fs: 0
                },
                events: {
                    onReady: (event: any) => onReady(event.target),
                    onStateChange: (event: any) => onStateChange(event.data)
                }
            });
        };

        if (window.YT && window.YT.Player) {
            initPlayer();
        } else {
            const originalOnReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (originalOnReady) originalOnReady();
                initPlayer();
            };
        }
    }, [videoId]);

    return null;
};
