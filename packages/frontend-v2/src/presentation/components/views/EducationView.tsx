import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, GraduationCap, Book, Video, ChevronRight, Plus, PlayCircle, Users, DollarSign, Star, X, Upload, Check, ShoppingCart } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface Course {
    id: number;
    title: string;
    description: string;
    price: number;
    category: string;
    instructor_name: string;
    instructor_verified: boolean;
    total_lessons: number;
    total_students: number;
    total_revenue: number;
    rating: number;
    thumbnail_url?: string;
    hasPurchased?: boolean;
    lessons?: Lesson[];
}

interface Lesson {
    id: number;
    title: string;
    description: string;
    duration_minutes: number;
    order_index: number;
    is_preview: boolean;
    youtube_url?: string;
}

interface EducationViewProps {
    onBack: () => void;
    onSuccess: (title: string, message: string) => void;
    onError?: (title: string, message: string) => void;
    onRefresh?: () => void;
    userBalance?: number;
}

type ViewMode = 'catalog' | 'my-courses' | 'my-teaching' | 'create-course' | 'course-detail' | 'watch-lesson';

export const EducationView = ({ onBack, onSuccess, onError }: EducationViewProps) => {
    const [viewMode, setViewMode] = useState<ViewMode>('catalog');
    const [courses, setCourses] = useState<Course[]>([]);
    const [myCourses, setMyCourses] = useState<Course[]>([]);
    const [myTeaching, setMyTeaching] = useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(false);
    const [showCreateCourse, setShowCreateCourse] = useState(false);
    const [showAddLesson, setShowAddLesson] = useState(false);

    // Form states
    const [courseForm, setCourseForm] = useState({ title: '', description: '', price: 0, category: 'GERAL' });
    const [lessonForm, setLessonForm] = useState({ title: '', description: '', youtubeUrl: '', durationMinutes: 0, isPreview: false });

    const loadCourses = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiService.get<any>('/education/courses');
            if (res.success) setCourses(res.data || []);
        } catch (e) {
            console.error('Erro ao carregar cursos:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMyCourses = useCallback(async () => {
        try {
            const res = await apiService.get<any>('/education/my-courses');
            if (res.success) setMyCourses(res.data || []);
        } catch (e) {
            console.error('Erro:', e);
        }
    }, []);

    const loadMyTeaching = useCallback(async () => {
        try {
            const res = await apiService.get<any>('/education/my-teaching');
            if (res.success) setMyTeaching(res.data || []);
        } catch (e) {
            console.error('Erro:', e);
        }
    }, []);

    const loadCourseDetail = useCallback(async (courseId: number) => {
        setLoading(true);
        try {
            const res = await apiService.get<any>(`/education/courses/${courseId}`);
            if (res.success) {
                setSelectedCourse(res.data);
                setViewMode('course-detail');
            }
        } catch (e) {
            console.error('Erro:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCourses();
        loadMyCourses();
        loadMyTeaching();
    }, [loadCourses, loadMyCourses, loadMyTeaching]);

    const handleCreateCourse = async () => {
        if (!courseForm.title || !courseForm.description) {
            onError?.('Erro', 'Preencha título e descrição');
            return;
        }
        setLoading(true);
        try {
            const res = await apiService.post<any>('/education/courses/create', courseForm);
            if (res.success) {
                onSuccess('Curso Criado!', 'Agora adicione as aulas.');
                setShowCreateCourse(false);
                setCourseForm({ title: '', description: '', price: 0, category: 'GERAL' });
                loadMyTeaching();
                setViewMode('my-teaching');
            } else {
                onError?.('Erro', res.message);
            }
        } catch (e: any) {
            onError?.('Erro', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddLesson = async () => {
        if (!selectedCourse || !lessonForm.title || !lessonForm.youtubeUrl) {
            onError?.('Erro', 'Preencha título e link do YouTube');
            return;
        }
        setLoading(true);
        try {
            const res = await apiService.post<any>('/education/courses/add-lesson', {
                courseId: selectedCourse.id,
                ...lessonForm
            });
            if (res.success) {
                onSuccess('Aula Adicionada!', 'Continue adicionando mais aulas.');
                setLessonForm({ title: '', description: '', youtubeUrl: '', durationMinutes: 0, isPreview: false });
                setShowAddLesson(false);
                loadCourseDetail(selectedCourse.id);
            } else {
                onError?.('Erro', res.message);
            }
        } catch (e: any) {
            onError?.('Erro', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBuyCourse = async () => {
        if (!selectedCourse) return;
        setLoading(true);
        try {
            const res = await apiService.post<any>(`/education/courses/${selectedCourse.id}/buy`, {});
            if (res.success) {
                onSuccess('Curso Adquirido!', 'Agora você pode assistir todas as aulas.');
                loadCourseDetail(selectedCourse.id);
                loadMyCourses();
            } else {
                onError?.('Erro', res.message);
            }
        } catch (e: any) {
            onError?.('Erro', e.message);
        } finally {
            setLoading(false);
        }
    };

    // Extrair ID do vídeo do YouTube
    const getYouTubeEmbedUrl = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        const videoId = match && match[2].length === 11 ? match[2] : null;
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    };

    // Render Course Card
    const CourseCard = ({ course, showStats = false }: { course: Course; showStats?: boolean }) => (
        <div
            onClick={() => loadCourseDetail(course.id)}
            className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-4 hover:border-purple-500/30 transition-all cursor-pointer group"
        >
            <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-400/30 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                    <GraduationCap className="w-8 h-8 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                        {course.title}
                    </h4>
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{course.description}</p>

                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            {course.total_lessons} aulas
                        </span>
                        {showStats ? (
                            <>
                                <span className="text-xs text-emerald-400 flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {course.total_students} alunos
                                </span>
                                <span className="text-xs text-amber-400 flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    R$ {parseFloat(String(course.total_revenue || 0)).toFixed(2)}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="text-xs text-slate-500">{course.instructor_name}</span>
                                <span className={`text-xs font-bold ${parseFloat(String(course.price)) === 0 ? 'text-emerald-400' : 'text-white'}`}>
                                    {parseFloat(String(course.price)) === 0 ? 'GRÁTIS' : `R$ ${parseFloat(String(course.price)).toFixed(2)}`}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors shrink-0" />
            </div>
        </div>
    );

    // Render Watch Lesson
    if (viewMode === 'watch-lesson' && selectedLesson && selectedCourse) {
        const embedUrl = getYouTubeEmbedUrl(selectedLesson.youtube_url || '');

        return (
            <div className="min-h-screen bg-black">
                <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-slate-700/50">
                    <div className="flex items-center justify-between p-4">
                        <button onClick={() => { setSelectedLesson(null); setViewMode('course-detail'); }} className="p-2 rounded-xl bg-slate-800/50 text-slate-300 hover:bg-slate-700/50">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-sm font-bold text-white line-clamp-1 flex-1 mx-4">{selectedLesson.title}</h1>
                        <div className="w-9" />
                    </div>
                </header>

                <div className="aspect-video w-full bg-slate-900">
                    {embedUrl ? (
                        <iframe
                            src={embedUrl}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                            Vídeo não disponível
                        </div>
                    )}
                </div>

                <div className="p-4">
                    <h2 className="text-lg font-bold text-white">{selectedLesson.title}</h2>
                    <p className="text-sm text-slate-400 mt-2">{selectedLesson.description}</p>
                </div>
            </div>
        );
    }

    // Render Course Detail
    if (viewMode === 'course-detail' && selectedCourse) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50">
                    <div className="flex items-center justify-between p-4">
                        <button onClick={() => { setSelectedCourse(null); setViewMode('catalog'); }} className="p-2 rounded-xl bg-slate-800/50 text-slate-300 hover:bg-slate-700/50">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-sm font-bold text-white line-clamp-1 flex-1 mx-4">{selectedCourse.title}</h1>
                        <div className="w-9" />
                    </div>
                </header>

                <main className="p-4 space-y-6">
                    {/* Course Info */}
                    <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-2xl p-6 border border-purple-500/30">
                        <h2 className="text-xl font-bold text-white">{selectedCourse.title}</h2>
                        <p className="text-sm text-slate-400 mt-2">{selectedCourse.description}</p>

                        <div className="flex items-center gap-4 mt-4 flex-wrap">
                            <span className="text-xs bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full">
                                {selectedCourse.total_lessons} aulas
                            </span>
                            <span className="text-xs text-slate-400">
                                Por {selectedCourse.instructor_name}
                                {selectedCourse.instructor_verified && <Check className="inline w-3 h-3 ml-1 text-blue-400" />}
                            </span>
                        </div>

                        {!selectedCourse.hasPurchased && (
                            <button
                                onClick={handleBuyCourse}
                                disabled={loading}
                                className="w-full mt-6 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                {parseFloat(String(selectedCourse.price)) === 0 ? 'OBTER GRÁTIS' : `COMPRAR POR R$ ${parseFloat(String(selectedCourse.price)).toFixed(2)}`}
                            </button>
                        )}

                        {selectedCourse.hasPurchased && (
                            <div className="mt-6 bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2">
                                <Check className="w-5 h-5 text-emerald-400" />
                                <span className="text-sm text-emerald-300 font-medium">Você possui este curso</span>
                            </div>
                        )}
                    </div>

                    {/* Lessons */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Aulas</h3>
                            {selectedCourse.hasPurchased && (
                                <button
                                    onClick={() => setShowAddLesson(true)}
                                    className="text-xs bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-lg flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Adicionar
                                </button>
                            )}
                        </div>

                        {selectedCourse.lessons && selectedCourse.lessons.length > 0 ? (
                            selectedCourse.lessons.map((lesson, index) => (
                                <div
                                    key={lesson.id}
                                    onClick={() => {
                                        if (selectedCourse.hasPurchased || lesson.is_preview) {
                                            setSelectedLesson(lesson);
                                            setViewMode('watch-lesson');
                                        }
                                    }}
                                    className={`bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex items-center gap-4 ${(selectedCourse.hasPurchased || lesson.is_preview) ? 'cursor-pointer hover:border-purple-500/30' : 'opacity-60'}`}
                                >
                                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 font-bold shrink-0">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium text-white line-clamp-1">{lesson.title}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            {lesson.duration_minutes > 0 && (
                                                <span className="text-xs text-slate-500">{lesson.duration_minutes} min</span>
                                            )}
                                            {lesson.is_preview && (
                                                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase font-bold">Preview</span>
                                            )}
                                        </div>
                                    </div>
                                    {(selectedCourse.hasPurchased || lesson.is_preview) && (
                                        <PlayCircle className="w-6 h-6 text-purple-400 shrink-0" />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-500 text-sm">
                                {selectedCourse.hasPurchased ? 'Nenhuma aula ainda. Adicione a primeira!' : 'Compre o curso para ver as aulas.'}
                            </div>
                        )}
                    </div>
                </main>

                {/* Modal Add Lesson */}
                {showAddLesson && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                        <div className="bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-white">Adicionar Aula</h3>
                                <button onClick={() => setShowAddLesson(false)} className="text-slate-500 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Título da Aula</label>
                                    <input
                                        type="text"
                                        value={lessonForm.title}
                                        onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white"
                                        placeholder="Ex: Introdução ao tema"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Link do YouTube (não-listado)</label>
                                    <input
                                        type="text"
                                        value={lessonForm.youtubeUrl}
                                        onChange={e => setLessonForm({ ...lessonForm, youtubeUrl: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white"
                                        placeholder="https://youtube.com/watch?v=..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Duração (min)</label>
                                        <input
                                            type="number"
                                            value={lessonForm.durationMinutes}
                                            onChange={e => setLessonForm({ ...lessonForm, durationMinutes: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pt-6">
                                        <input
                                            type="checkbox"
                                            checked={lessonForm.isPreview}
                                            onChange={e => setLessonForm({ ...lessonForm, isPreview: e.target.checked })}
                                            className="w-4 h-4"
                                        />
                                        <label className="text-sm text-slate-300">Aula grátis (preview)</label>
                                    </div>
                                </div>

                                <button
                                    onClick={handleAddLesson}
                                    disabled={loading}
                                    className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Salvando...' : 'Adicionar Aula'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50">
                <div className="flex items-center justify-between p-4">
                    <button onClick={onBack} className="p-2 rounded-xl bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-purple-400" />
                        Academia Cred30
                    </h1>
                    <button onClick={() => setShowCreateCourse(true)} className="p-2 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-4 pb-3 gap-2 overflow-x-auto scrollbar-hide">
                    {[
                        { id: 'catalog', label: 'Explorar' },
                        { id: 'my-courses', label: 'Meus Cursos' },
                        { id: 'my-teaching', label: 'Ensinar' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setViewMode(tab.id as ViewMode)}
                            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${viewMode === tab.id
                                ? 'bg-purple-500 text-white'
                                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Content */}
            <main className="p-4 space-y-4">
                {loading && courses.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">Carregando...</div>
                ) : (
                    <>
                        {viewMode === 'catalog' && (
                            <>
                                {/* Hero */}
                                <div className="relative bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-2xl p-6 border border-purple-500/30 overflow-hidden">
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-400/30">
                                                <Video className="w-6 h-6 text-purple-400" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-white">Aprenda e Ensine</h2>
                                                <p className="text-sm text-slate-400">Crie cursos usando YouTube</p>
                                            </div>
                                        </div>
                                        <p className="text-slate-300 text-sm leading-relaxed">
                                            Compre cursos com seu saldo ou crie os seus usando vídeos do YouTube (não-listado). 70% da venda vai para você!
                                        </p>
                                    </div>
                                </div>

                                {/* AdsTerra Banner */}
                                <a
                                    href="https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 hover:border-amber-500/40 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                                            <span className="text-xl">🎁</span>
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[9px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-black uppercase">Patrocinado</span>
                                            <p className="text-xs text-slate-400 mt-1">Ofertas exclusivas para estudantes</p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-amber-500" />
                                    </div>
                                </a>

                                {/* Courses List */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Cursos Disponíveis</h3>
                                    {courses.length > 0 ? (
                                        courses.map(course => <CourseCard key={course.id} course={course} />)
                                    ) : (
                                        <div className="text-center py-8 text-slate-500 text-sm">
                                            Nenhum curso disponível ainda. Seja o primeiro a criar!
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {viewMode === 'my-courses' && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Cursos que Comprei</h3>
                                {myCourses.length > 0 ? (
                                    myCourses.map(course => <CourseCard key={course.id} course={course} />)
                                ) : (
                                    <div className="text-center py-8 text-slate-500 text-sm">
                                        Você ainda não comprou nenhum curso.
                                    </div>
                                )}
                            </div>
                        )}

                        {viewMode === 'my-teaching' && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Meus Cursos (Instrutor)</h3>
                                {myTeaching.length > 0 ? (
                                    myTeaching.map(course => <CourseCard key={course.id} course={course} showStats />)
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-slate-500 text-sm mb-4">Você ainda não criou nenhum curso.</p>
                                        <button
                                            onClick={() => setShowCreateCourse(true)}
                                            className="bg-purple-500 hover:bg-purple-400 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 mx-auto"
                                        >
                                            <Plus className="w-5 h-5" /> Criar Meu Primeiro Curso
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Modal Create Course */}
            {showCreateCourse && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div className="bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white">Criar Novo Curso</h3>
                            <button onClick={() => setShowCreateCourse(false)} className="text-slate-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Título do Curso</label>
                                <input
                                    type="text"
                                    value={courseForm.title}
                                    onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white"
                                    placeholder="Ex: Aprenda a investir do zero"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Descrição</label>
                                <textarea
                                    value={courseForm.description}
                                    onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white h-24 resize-none"
                                    placeholder="Descreva o que o aluno vai aprender..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Preço (R$)</label>
                                    <input
                                        type="number"
                                        value={courseForm.price}
                                        onChange={e => setCourseForm({ ...courseForm, price: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white"
                                        placeholder="0 = grátis"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Categoria</label>
                                    <select
                                        value={courseForm.category}
                                        onChange={e => setCourseForm({ ...courseForm, category: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white"
                                    >
                                        <option value="GERAL">Geral</option>
                                        <option value="FINANCAS">Finanças</option>
                                        <option value="TECNOLOGIA">Tecnologia</option>
                                        <option value="NEGOCIOS">Negócios</option>
                                        <option value="MARKETING">Marketing</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <Upload className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-blue-300 font-medium">Como funciona?</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            1. Crie o curso aqui<br />
                                            2. Grave seus vídeos e suba no YouTube como "não-listado"<br />
                                            3. Cole os links das aulas no seu curso<br />
                                            4. Você recebe 70% de cada venda!
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleCreateCourse}
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                            >
                                {loading ? 'Criando...' : 'Criar Curso'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
