import { useState, useEffect, useRef } from 'react';
import {
    BookOpen, PlayCircle, Clock, Trophy, AlertTriangle,
    X as XIcon, MousePointerClick,
    ArrowLeft, ShoppingBag, GraduationCap, PlusCircle,
    ChevronRight, CreditCard, LayoutGrid, UserCheck,
    Lock, Star, Search
} from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import { AcademyCourse } from '../../../domain/types/common.types';

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}

interface EducationViewProps {
    onBack: () => void;
    onSuccess: (title: string, msg: string) => void;
}

const POINTS_PER_SECOND = 0.5;
const POINTS_TO_CURRENCY_RATE = 0.03 / 1000;

type AcademyTab = 'EARN' | 'MARKETPLACE' | 'MY_COURSES' | 'INSTRUCTOR';

export const EducationView = ({ onBack, onSuccess }: EducationViewProps) => {
    // Guias
    const [activeTab, setActiveTab] = useState<AcademyTab>('EARN');

    // Estados da Aula (Watch-to-Earn)
    const [selectedLesson, setSelectedLesson] = useState<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [sessionPoints, setSessionPoints] = useState(0);
    const [sessionTime, setSessionTime] = useState(0);
    const [playerState, setPlayerState] = useState<number>(-1);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const playerRef = useRef<any>(null);

    // Marketplace e Cursos
    const [courses, setCourses] = useState<AcademyCourse[]>([]);
    const [myCourses, setMyCourses] = useState<AcademyCourse[]>([]);
    const [instructorCourses, setInstructorCourses] = useState<AcademyCourse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');

    // Modais e Processos
    const [isBuyingCourse, setIsBuyingCourse] = useState<AcademyCourse | null>(null);
    const [isCreatingCourse, setIsCreatingCourse] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'balance' | 'pix' | 'card'>('balance');
    const [checkoutData, setCheckoutData] = useState<any>(null);

    // Anti-Cheat (Earn mode)
    const [isTabFocused, setIsTabFocused] = useState(true);
    const [lastInteraction, setLastInteraction] = useState(Date.now());
    const [showPresenceCheck, setShowPresenceCheck] = useState(false);
    const [presenceTimer, setPresenceTimer] = useState(0);
    const [isBlocked, setIsBlocked] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [inputCode, setInputCode] = useState('');

    const interactionTimeout = 120000;
    const presenceTimeout = 15000;

    // Categorias
    const categories = ['Todos', 'Gestão', 'Finanças', 'Vendas', 'Investimentos', 'Tecnologia'];

    // Cursos "Watch to Earn" (Originais)
    const earnLessons = [
        {
            id: 10001,
            title: "Crédito Consciente: O Guia do Associado",
            duration: "05:12",
            category: "Regras do Clube",
            videoUrl: "https://www.youtube.com/embed/Swl3eyTLpCk",
            thumbnail: "https://img.youtube.com/vi/Swl3eyTLpCk/mqdefault.jpg"
        },
        {
            id: 10002,
            title: "Como Escalar seu Ganhos no Cred30",
            duration: "03:45",
            category: "Educação Financeira",
            videoUrl: "https://www.youtube.com/embed/N-0_r7VaP5s",
            thumbnail: "https://img.youtube.com/vi/N-0_r7VaP5s/mqdefault.jpg"
        }
    ];

    useEffect(() => {
        fetchMarketplace();
        fetchMyCourses();
        if (activeTab === 'INSTRUCTOR') fetchInstructorCourses();
    }, [activeTab]);

    const fetchMarketplace = async () => {
        setIsLoading(true);
        try {
            const res = await apiService.get<AcademyCourse[]>('/education/courses');
            if (res.success) setCourses(res.data || []);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMyCourses = async () => {
        try {
            const res = await apiService.get<AcademyCourse[]>('/education/my-courses');
            if (res.success) setMyCourses(res.data || []);
        } catch (e) { }
    };

    const fetchInstructorCourses = async () => {
        try {
            const res = await apiService.get<AcademyCourse[]>('/education/instructor/courses');
            if (res.success) setInstructorCourses(res.data || []);
        } catch (e) { }
    };

    // Monitoramento de Foco e Interação (Específico para EARN mode)
    useEffect(() => {
        if (activeTab !== 'EARN' || !selectedLesson) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsTabFocused(false);
                setIsPlaying(false);
                if (playerRef.current) playerRef.current.pauseVideo();
            } else {
                setIsTabFocused(true);
                if (!isBlocked && !showPresenceCheck) {
                    setIsPlaying(true);
                    if (playerRef.current) playerRef.current.playVideo();
                }
            }
        };

        const handleInteraction = () => setLastInteraction(Date.now());

        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('mousemove', handleInteraction);
        window.addEventListener('keydown', handleInteraction);
        window.addEventListener('click', handleInteraction);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('mousemove', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
            window.removeEventListener('click', handleInteraction);
        };
    }, [activeTab, selectedLesson, isBlocked, showPresenceCheck]);

    // Loop de Pontos (EARN mode)
    useEffect(() => {
        let interval: any;
        if (activeTab === 'EARN' && selectedLesson && !isBlocked) {
            interval = setInterval(() => {
                if (!isTabFocused) return;
                const timeSinceLastInteraction = Date.now() - lastInteraction;

                if (timeSinceLastInteraction > interactionTimeout && !showPresenceCheck) {
                    setShowPresenceCheck(true);
                    setGeneratedCode(Math.floor(1000 + Math.random() * 9000).toString());
                    setInputCode('');
                    setPresenceTimer(presenceTimeout / 1000);
                    return;
                }

                if (showPresenceCheck) {
                    setPresenceTimer(prev => prev <= 1 ? (setIsBlocked(true), setShowPresenceCheck(false), 0) : prev - 1);
                    return;
                }

                if (isPlaying && playerState === 1) {
                    setSessionPoints(prev => prev + POINTS_PER_SECOND);
                    setSessionTime(prev => prev + 1);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeTab, selectedLesson, isPlaying, isTabFocused, lastInteraction, showPresenceCheck, isBlocked, playerState]);

    const handleBuyCourse = async (course: AcademyCourse) => {
        setIsLoading(true);
        try {
            const res = await apiService.post<any>(`/education/courses/${course.id}/buy`, {
                useBalance: paymentMethod === 'balance',
                paymentMethod: paymentMethod === 'balance' ? undefined : paymentMethod
            });

            if (res.success) {
                if (paymentMethod === 'balance') {
                    onSuccess("Sucesso!", "Curso adquirido com sucesso! Já está disponível em sua biblioteca.");
                    setIsBuyingCourse(null);
                    fetchMyCourses();
                    setActiveTab('MY_COURSES');
                } else {
                    setCheckoutData(res.data);
                    setIsCheckoutOpen(true);
                }
            }
        } catch (e: any) {
            onSuccess("Erro", e.message || "Falha na compra.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEarnLessonSelect = async (lesson: any) => {
        try {
            const res = await apiService.post<any>('/education/start-session', { lessonId: lesson.id });
            if (res.success) {
                setSessionId(res.data.sessionId);
                setSelectedLesson(lesson);
                setIsPlaying(true);
                setSessionPoints(0);
                setSessionTime(0);
                setIsBlocked(false);
            }
        } catch (e) { }
    };

    const handleExitLesson = async () => {
        if (activeTab === 'EARN' && sessionPoints > 50 && sessionId) {
            try {
                await apiService.post('/education/reward', {
                    points: Math.floor(sessionPoints),
                    lessonId: selectedLesson.id,
                    sessionId: sessionId
                });
                onSuccess("Sessão Finalizada", `Você ganhou R$ ${(sessionPoints * POINTS_TO_CURRENCY_RATE).toFixed(4)}!`);
            } catch (e) { }
        }
        setSelectedLesson(null);
        setSessionId(null);
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getVideoId = (url: string) => {
        const ytMatch = url.match(/(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/v\/)([\w-]+)/);
        return ytMatch ? ytMatch[1] : url.split('/').pop();
    };

    const filteredCourses = courses.filter(c =>
        (selectedCategory === 'Todos' || c.category === selectedCategory) &&
        (c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-6 pb-20 relative min-h-screen">
            {/* Header com Navegação */}
            {!selectedLesson && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition">
                            <XIcon size={24} className="text-zinc-400" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <GraduationCap className="text-blue-500" />
                                Cred30 Academy
                            </h1>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Educação e Marketplace Colaborativo</p>
                        </div>
                    </div>

                    <div className="flex overflow-x-auto pb-2 md:pb-0 gap-1 bg-black/20 p-1 rounded-xl scrollbar-hide">
                        <TabButton active={activeTab === 'EARN'} onClick={() => setActiveTab('EARN')} icon={<Trophy size={16} />} label="Earn" />
                        <TabButton active={activeTab === 'MARKETPLACE'} onClick={() => setActiveTab('MARKETPLACE')} icon={<ShoppingBag size={16} />} label="Loja" />
                        <TabButton active={activeTab === 'MY_COURSES'} onClick={() => setActiveTab('MY_COURSES')} icon={<BookOpen size={16} />} label="Meus Vídeos" />
                        <TabButton active={activeTab === 'INSTRUCTOR'} onClick={() => setActiveTab('INSTRUCTOR')} icon={<UserCheck size={16} />} label="Instrutor" />
                    </div>
                </div>
            )}

            {/* View principal */}
            {!selectedLesson ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {/* TABS CONTENT */}
                    {activeTab === 'EARN' && (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/5 border border-blue-500/20 p-4 md:p-6 rounded-3xl relative overflow-hidden">
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                                    <div className="space-y-2 text-center md:text-left">
                                        <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Assista e Ganhe</h2>
                                        <p className="text-sm text-blue-200/70 max-w-md">Estude conteúdos exclusivos e seja recompensado por cada minuto de aprendizado.</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="bg-black/40 backdrop-blur px-4 py-2 rounded-2xl border border-white/5 text-center">
                                            <span className="block text-[10px] uppercase font-bold text-zinc-500">Taxa</span>
                                            <span className="text-yellow-400 font-bold">30 pts/min</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] pointer-events-none"></div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {earnLessons.map(lesson => (
                                    <CourseCard key={lesson.id} course={lesson} onClick={() => handleEarnLessonSelect(lesson)} isEarn />
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'MARKETPLACE' && (
                        <div className="space-y-6">
                            {/* Busca e Filtros */}
                            <div className="flex flex-col md:flex-row gap-4 items-center bg-surface border border-surfaceHighlight p-4 rounded-2xl">
                                <div className="relative w-full md:flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Buscar cursos..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition"
                                    />
                                </div>
                                <div className="flex gap-2 w-full md:w-auto overflow-x-auto scrollbar-hide pb-1 md:pb-0">
                                    {categories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setSelectedCategory(cat)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-black/40 text-zinc-400 hover:text-white'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                                    {filteredCourses.length > 0 ? filteredCourses.map(course => (
                                        <CourseCard
                                            key={course.id}
                                            course={course}
                                            onClick={() => setIsBuyingCourse(course)}
                                            isMarketplace
                                            isOwned={myCourses.some(mc => mc.id === course.id)}
                                        />
                                    )) : (
                                        <div className="col-span-full py-20 text-center space-y-4 bg-surface border border-dashed border-white/10 rounded-3xl">
                                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto"><ShoppingBag className="text-zinc-600" /></div>
                                            <p className="text-zinc-500 text-sm">Nenhum curso encontrado nesta categoria.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'MY_COURSES' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {myCourses.length > 0 ? myCourses.map(course => (
                                    <CourseCard key={course.id} course={course} onClick={() => setSelectedLesson(course)} />
                                )) : (
                                    <div className="col-span-full py-20 text-center space-y-4">
                                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto"><Lock className="text-zinc-600" /></div>
                                        <p className="text-zinc-500 text-sm">Você ainda não adquiriu nenhum curso.</p>
                                        <button onClick={() => setActiveTab('MARKETPLACE')} className="text-blue-500 font-bold hover:underline">Explorar a Loja</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'INSTRUCTOR' && (
                        <div className="space-y-6">
                            <div className="bg-surface border border-surfaceHighlight p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-500"><GraduationCap size={32} /></div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">Área do Instrutor</h3>
                                        <p className="text-sm text-zinc-500">Crie cursos, compartilhe conhecimento e fature 82,5% por venda.</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsCreatingCourse(true)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-2xl transition">
                                    <PlusCircle size={20} /> Novo Curso
                                </button>
                            </div>

                            <h4 className="text-white font-bold uppercase text-[10px] tracking-widest pl-2">Meus Cursos Publicados</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {instructorCourses.map(course => (
                                    <CourseCard key={course.id} course={course} isInstructor />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Modo Sala de Aula */
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-300">
                    <div className="flex flex-col md:flex-row md:items-center justify-between bg-zinc-900 p-4 rounded-3xl gap-4">
                        <div className="flex items-center gap-4">
                            <button onClick={handleExitLesson} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-zinc-400">
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h3 className="text-white font-bold leading-tight line-clamp-1">{selectedLesson.title}</h3>
                                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{selectedLesson.category}</p>
                            </div>
                        </div>
                        {activeTab === 'EARN' && (
                            <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-2xl self-end md:self-auto">
                                <div className="flex flex-col items-center px-3 border-r border-white/5">
                                    <span className="text-[9px] text-zinc-500 uppercase font-black">Tempo</span>
                                    <span className="text-white font-mono font-bold text-sm tracking-tighter">{formatTime(sessionTime)}</span>
                                </div>
                                <div className="flex flex-col items-center px-3">
                                    <span className="text-[9px] text-zinc-500 uppercase font-black">Ganhos</span>
                                    <span className="text-emerald-400 font-mono font-bold text-sm tracking-tighter">R$ {(sessionPoints * POINTS_TO_CURRENCY_RATE).toFixed(4)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="aspect-video bg-black rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl relative">
                        {isBlocked ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-zinc-900 animate-in zoom-in duration-300">
                                <AlertTriangle size={48} className="text-red-500 mb-4" />
                                <h2 className="text-2xl font-bold text-white mb-2 italic uppercase">Sessão Bloqueada</h2>
                                <p className="text-zinc-400 text-sm mb-6 max-w-xs">Detectamos inatividade. Mantenha o foco para aprender e ganhar recompensas.</p>
                                <button onClick={handleExitLesson} className="bg-red-500 hover:bg-red-400 text-white font-black py-4 px-10 rounded-2xl transition uppercase text-xs italic tracking-widest shadow-lg shadow-red-900/40">Reiniciar</button>
                            </div>
                        ) : (
                            <div className="w-full h-full">
                                <YouTubeInit
                                    videoId={getVideoId(selectedLesson.video_url || selectedLesson.videoUrl)!}
                                    onStateChange={(state: number) => setPlayerState(state)}
                                    onReady={(player: any) => {
                                        playerRef.current = player;
                                        player.playVideo();
                                    }}
                                    playerId="edu-player"
                                />
                                <div id="edu-player" className="w-full h-full"></div>

                                {!isTabFocused && activeTab === 'EARN' && (
                                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
                                        <Clock size={48} className="text-yellow-500 mb-4 animate-pulse" />
                                        <h3 className="text-xl font-bold text-white uppercase italic tracking-tighter text-center">Contagem Pausada</h3>
                                        <p className="text-zinc-500 text-xs mt-2 uppercase tracking-widest">Volte para a aba para continuar ganhando</p>
                                    </div>
                                )}

                                {showPresenceCheck && (
                                    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
                                        <div className="bg-zinc-900 border border-blue-500/30 p-8 rounded-[3rem] w-full max-w-sm text-center shadow-2xl shadow-blue-500/10">
                                            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-400 border border-blue-500/20">
                                                <MousePointerClick size={32} />
                                            </div>
                                            <h3 className="text-2xl font-black text-white mb-2 uppercase italic italic-tighter">Você está aí?</h3>
                                            <p className="text-zinc-500 text-[11px] mb-8 uppercase tracking-widest font-bold">Confirme sua presença digitando o código:</p>

                                            <div className="bg-black/60 p-4 rounded-3xl mb-8 border border-white/5 flex justify-center items-center gap-3">
                                                {generatedCode.split('').map((digit, i) => (
                                                    <span key={i} className="text-3xl font-mono font-black text-blue-400 w-12 h-14 flex items-center justify-center bg-blue-500/10 rounded-2xl border border-white/5 shadow-inner">{digit}</span>
                                                ))}
                                            </div>

                                            <input
                                                type="tel"
                                                maxLength={4}
                                                value={inputCode}
                                                onChange={(e) => setInputCode(e.target.value.slice(0, 4))}
                                                className="w-full bg-zinc-800 border-2 border-zinc-700 text-white rounded-2xl p-4 text-center font-black text-3xl mb-4 focus:border-blue-500 outline-none transition uppercase tracking-[0.5em] placeholder-zinc-700"
                                                autoFocus
                                            />

                                            <div className="flex justify-between items-center text-[10px] font-black uppercase mb-8 px-4 text-zinc-500">
                                                <span className={presenceTimer < 5 ? "text-red-500 animate-pulse" : ""}>Tempo Restante: {presenceTimer}s</span>
                                                <span>{inputCode.length}/4</span>
                                            </div>

                                            <button
                                                onClick={() => { if (inputCode === generatedCode) { setShowPresenceCheck(false); setLastInteraction(Date.now()); setIsPlaying(true); } }}
                                                disabled={inputCode !== generatedCode}
                                                className={`w-full font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-xs italic ${inputCode === generatedCode ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/40' : 'bg-zinc-800 text-zinc-600 grayscale'}`}
                                            >
                                                Confirmar Presença
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Compra */}
            {isBuyingCourse && (
                <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md overflow-y-auto">
                    <div className="min-h-full flex items-end md:items-center justify-center p-4">
                        <div className="bg-zinc-900 w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
                            <div className="relative aspect-video bg-zinc-800">
                                <img src={isBuyingCourse.thumbnail_url || `https://img.youtube.com/vi/${getVideoId(isBuyingCourse.video_url)}/mqdefault.jpg`} alt="" className="w-full h-full object-cover opacity-50" />
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900"></div>
                                <button onClick={() => setIsBuyingCourse(null)} className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-full transition text-white">
                                    <XIcon size={20} />
                                </button>
                                <div className="absolute bottom-6 left-6 right-6">
                                    <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{isBuyingCourse.category}</span>
                                    <h3 className="text-white text-2xl font-black italic tracking-tighter leading-tight mt-1">{isBuyingCourse.title}</h3>
                                </div>
                            </div>

                            <div className="p-8 space-y-6">
                                <p className="text-zinc-400 text-sm leading-relaxed">{isBuyingCourse.description}</p>

                                <div className="flex items-center gap-6 py-4 border-y border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-zinc-500 uppercase font-black">Preço</span>
                                        <span className="text-white text-2xl font-black italic tracking-tighter">R$ {isBuyingCourse.price.toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-zinc-500 uppercase font-black">Alunos</span>
                                        <span className="text-zinc-400 font-bold">{isBuyingCourse.enrollment_count} matriculados</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] text-zinc-500 uppercase font-black pl-2">Método de Pagamento</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <PaymentOption active={paymentMethod === 'balance'} onClick={() => setPaymentMethod('balance')} icon={<LayoutGrid size={18} />} label="Saldo" />
                                        <PaymentOption active={paymentMethod === 'pix'} onClick={() => setPaymentMethod('pix')} icon={<ChevronRight size={18} />} label="PIX" />
                                        <PaymentOption active={paymentMethod === 'card'} onClick={() => setPaymentMethod('card')} icon={<CreditCard size={18} />} label="Cartão" />
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleBuyCourse(isBuyingCourse)}
                                    disabled={isLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 uppercase text-xs italic tracking-widest shadow-xl shadow-blue-900/40"
                                >
                                    {isLoading ? 'PROCESSANDO...' : 'COMPRAR AGORA'} <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Criação de Curso (Instrutor) */}
            {isCreatingCourse && (
                <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md overflow-y-auto">
                    <div className="min-h-full flex items-center justify-center p-4">
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                setIsLoading(true);
                                const formData = new FormData(e.currentTarget);
                                const data = Object.fromEntries(formData.entries());
                                try {
                                    const res = await apiService.post('/education/courses', data);
                                    if (res.success) {
                                        onSuccess("Sucesso!", "Curso enviado para moderação. Será aprovado em até 24h.");
                                        setIsCreatingCourse(false);
                                        fetchInstructorCourses();
                                    }
                                } catch (err: any) {
                                    onSuccess("Erro", err.message || "Falha ao criar curso.");
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            className="bg-zinc-900 w-full max-w-xl rounded-[2.5rem] border border-white/10 p-8 space-y-6 animate-in zoom-in duration-300"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xl font-black text-white italic uppercase">Criar Novo Curso</h3>
                                <button type="button" onClick={() => setIsCreatingCourse(false)} className="p-2 hover:bg-white/5 rounded-full transition text-zinc-500"><XIcon /></button>
                            </div>

                            <div className="space-y-4">
                                <InputField label="Título do Curso" name="title" placeholder="Ex: Do Zero ao Trader" required />
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Preço (R$)" name="price" type="number" step="0.01" placeholder="0.00" required />
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-black pl-2 mb-1 block">Categoria</label>
                                        <select name="category" className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none transition" required>
                                            {categories.filter(c => c !== 'Todos').map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <InputField label="Link do Vídeo (YouTube/Vimeo)" name="video_url" placeholder="https://youtube.com/..." required />
                                <InputField label="Thumbnail URL (Opcional)" name="thumbnail_url" placeholder="https://..." />
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-black pl-2 mb-1 block">Descrição</label>
                                    <textarea name="description" rows={4} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none transition resize-none" placeholder="O que seus alunos vão aprender?" required></textarea>
                                </div>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl flex items-start gap-3">
                                <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={18} />
                                <p className="text-[10px] text-yellow-500/80 leading-tight uppercase font-bold tracking-tight">
                                    Ao publicar, você concorda com a taxa de <strong className="text-yellow-500">17.5%</strong> do clube. 10% vão para os cotistas e 7.5% para manutenção da plataforma. Você recebe <strong className="text-yellow-500">82.5%</strong> líquido por venda.
                                </p>
                            </div>

                            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-5 rounded-2xl transition shadow-xl shadow-blue-900/40 uppercase text-xs italic tracking-widest">
                                {isLoading ? 'ENVIANDO...' : 'PUBLICAR CURSO'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Checkout Modal (Gateway) */}
            {isCheckoutOpen && checkoutData && (
                <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-2xl p-4 flex items-center justify-center">
                    <div className="bg-zinc-900 w-full max-w-sm rounded-[3rem] border border-white/10 p-8 text-center space-y-6">
                        <h3 className="text-2xl font-black text-white italic uppercase italic-tight">Finalizar Compra</h3>

                        {paymentMethod === 'pix' ? (
                            <div className="space-y-6">
                                <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl">
                                    <img src={checkoutData.qr_code_base64} alt="QR Code PIX" className="w-48 h-48" />
                                </div>
                                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                    <p className="text-zinc-500 text-[10px] uppercase font-bold mb-2">Pix Copia e Cola</p>
                                    <div className="flex items-center gap-2">
                                        <input readOnly value={checkoutData.pixCopiaECola} className="bg-transparent border-none text-blue-400 text-xs font-mono focus:ring-0 w-full" />
                                        <button onClick={() => { navigator.clipboard.writeText(checkoutData.pixCopiaECola); alert("Copiado!"); }} className="text-zinc-500 hover:text-white transition"><CreditCard size={18} /></button>
                                    </div>
                                </div>
                                <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-black animate-pulse text-blue-400">Aguardando confirmação do pagamento...</p>
                            </div>
                        ) : (
                            <div className="py-10">
                                <UserCheck className="w-16 h-16 text-blue-500 mx-auto animate-bounce" />
                                <p className="text-white font-bold mt-4">Processando no cartão...</p>
                                <p className="text-zinc-500 text-sm">Você será notificado assim que aprovado.</p>
                            </div>
                        )}

                        <button onClick={() => { setIsCheckoutOpen(false); setIsBuyingCourse(null); fetchMyCourses(); }} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-2xl transition uppercase text-xs italic">Fechar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// UI Components Helpers

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all whitespace-nowrap ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 scale-105' : 'text-zinc-500 hover:text-white'}`}>
        {icon} <span>{label}</span>
    </button>
);

const CourseCard = ({ course, onClick, isEarn, isMarketplace, isInstructor, isOwned }: { course: any, onClick?: () => void, isEarn?: boolean, isMarketplace?: boolean, isInstructor?: boolean, isOwned?: boolean }) => {
    const videoId = course.video_url ? (course.video_url as string).split('/').pop() : course.thumbnail?.split('/').slice(-2, -1)[0];

    return (
        <div onClick={onClick} className={`bg-surface border border-surfaceHighlight rounded-[2rem] overflow-hidden group hover:border-blue-500/30 transition-all duration-500 cursor-pointer w-full max-w-sm mx-auto sm:max-w-none ${isInstructor && 'opacity-80'}`}>
            <div className="aspect-video bg-zinc-900 relative overflow-hidden">
                <img
                    src={course.thumbnail_url || course.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                    alt={course.title}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-90 group-hover:scale-110 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent"></div>

                {isMarketplace && (
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[10px] text-white font-black italic tracking-widest border border-white/5">
                        {isOwned ? (
                            <span className="text-emerald-400">POSSUÍDO</span>
                        ) : (
                            <span>R$ {parseFloat(course.price).toFixed(2)}</span>
                        )
                        }
                    </div>
                )}

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/50 scale-75 group-hover:scale-100 transition-transform">
                        <PlayCircle className="text-white" size={32} />
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-3">
                <div className="flex justify-between items-start">
                    <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest">{course.category}</span>
                    {isEarn && <span className="text-[9px] text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded">WATCH TO EARN</span>}
                    {isInstructor && <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${course.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-yellow-500/10 text-yellow-500'}`}>{course.status}</span>}
                </div>

                <h3 className="text-white text-base font-bold leading-tight line-clamp-2 h-10">{course.title}</h3>

                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-zinc-600" />
                        <span>{course.duration || 'Acesso Vitalício'}</span>
                    </div>
                    {isMarketplace && !isOwned ? (
                        <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg font-black italic tracking-tighter">
                            ADQUIRIR <ChevronRight size={10} />
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <Star size={10} className="text-yellow-500 fill-yellow-500" />
                            <span className="font-bold text-zinc-400">{course.rating_avg > 0 ? course.rating_avg : '5.0'}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const PaymentOption = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${active ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-black/40 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>
        {icon}
        <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
    </button>
);

const InputField = ({ label, name, type = "text", placeholder, required, step }: any) => (
    <div>
        <label className="text-[10px] text-zinc-500 uppercase font-black pl-2 mb-1 block tracking-widest">{label}</label>
        <input
            type={type}
            name={name}
            step={step}
            placeholder={placeholder}
            required={required}
            className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition placeholder-zinc-700"
        />
    </div>
);

// Helper component to initialize individual YouTube players
const YouTubeInit = ({ videoId, onStateChange, onReady, playerId = 'edu-player' }: {
    videoId: string;
    onStateChange: (state: number) => void;
    onReady: (player: any) => void;
    playerId?: string;
}) => {
    useEffect(() => {
        const initPlayer = () => {
            // In case player already exists, destroy it first
            if (window.YT && window.YT.Player) {
                try {
                    new window.YT.Player(playerId, {
                        videoId: videoId,
                        playerVars: {
                            autoplay: 1,
                            controls: 1,
                            modestbranding: 1,
                            rel: 0,
                            iv_load_policy: 3,
                            origin: window.location.origin
                        },
                        events: {
                            onReady: (event: any) => onReady(event.target),
                            onStateChange: (event: any) => onStateChange(event.data)
                        }
                    });
                } catch (e) {
                    // Fallback para iframe simples se o objeto falhar
                    console.error("YouTube Player Error", e);
                }
            }
        };

        if (window.YT && window.YT.Player) {
            initPlayer();
        } else {
            const checkYT = setInterval(() => {
                if (window.YT && window.YT.Player) {
                    initPlayer();
                    clearInterval(checkYT);
                }
            }, 500);
            return () => clearInterval(checkYT);
        }
    }, [videoId, playerId]);

    return null;
};
