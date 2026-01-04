import { useState, useEffect, useCallback } from 'react';
import {
    GraduationCap, Check, X, Play, User, Clock,
    BookOpen, Search, AlertCircle, RefreshCw, ExternalLink
} from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';
import { AcademyCourse } from '../../../../../domain/types/common.types';

export const AdminAcademy = () => {
    const [courses, setCourses] = useState<AcademyCourse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('PENDING');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchCourses = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getAdminAcademyCourses(filterStatus || undefined);
            setCourses(data);
        } catch (error) {
            console.error('Error fetching admin courses:', error);
        } finally {
            setIsLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    const handleUpdateStatus = async (id: number, status: 'APPROVED' | 'REJECTED') => {
        if (!confirm(`Deseja ${status === 'APPROVED' ? 'APROVAR' : 'REJEITAR'} este curso?`)) return;

        try {
            const res = await apiService.updateAcademyCourseStatus(id, status);
            if (res.success) {
                setCourses(prev => prev.filter(c => c.id !== id));
            }
        } catch (error: any) {
            alert('Erro ao atualizar status: ' + error.message);
        }
    };

    const filteredCourses = courses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.author_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header com Filtros */}
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-400">
                        <GraduationCap size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white">Gestão da Academia</h2>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Aprovação e Moderação de Cursos</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar curso ou autor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/40 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:border-primary-500/50 transition-colors outline-none"
                        />
                    </div>

                    <div className="flex bg-black/40 border border-zinc-800 rounded-2xl p-1">
                        {[
                            { id: 'PENDING', label: 'Pendentes' },
                            { id: 'APPROVED', label: 'Aprovados' },
                            { id: 'REJECTED', label: 'Rejeitados' },
                            { id: '', label: 'Todos' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setFilterStatus(tab.id)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === tab.id
                                    ? 'bg-zinc-800 text-white shadow-lg'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={fetchCourses}
                        disabled={isLoading}
                        className="p-3 bg-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-colors border border-zinc-700/50"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Lista de Cursos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-48 bg-zinc-900/50 rounded-3xl animate-pulse border border-zinc-800" />
                    ))
                ) : filteredCourses.length > 0 ? (
                    filteredCourses.map(course => (
                        <div key={course.id} className="group bg-zinc-900/40 hover:bg-zinc-900/60 transition-all border border-zinc-800 hover:border-zinc-700/50 rounded-3xl overflow-hidden flex flex-col sm:flex-row shadow-xl">
                            {/* Thumbnail Pequena */}
                            <div className="w-full sm:w-48 h-32 sm:h-auto relative bg-black shrink-0">
                                {course.video_url ? (
                                    <img
                                        src={`https://img.youtube.com/vi/${course.video_url.split('/').pop()}/mqdefault.jpg`}
                                        alt={course.title}
                                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                                        <Play size={40} />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                                    <span className="text-[10px] font-black text-white bg-primary-500/20 backdrop-blur-md px-2 py-1 rounded-md border border-primary-500/30">
                                        R$ {course.price}
                                    </span>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 p-5 flex flex-col justify-between gap-4">
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-800/50 px-2 py-0.5 rounded-full">
                                            {course.category || 'Geral'}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-zinc-500">
                                            <Clock size={12} />
                                            <span className="text-[10px] font-bold">{new Date(course.created_at || '').toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <h3 className="text-md font-black text-white leading-snug group-hover:text-primary-400 transition-colors">{course.title}</h3>
                                    <div className="flex items-center gap-2 mt-2 text-zinc-400">
                                        <User size={14} className="text-primary-500/50" />
                                        <span className="text-xs font-bold">{course.author_name}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <a
                                        href={course.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-zinc-700/50"
                                    >
                                        <ExternalLink size={14} /> Revisar Vídeo
                                    </a>

                                    {course.status === 'PENDING' && (
                                        <>
                                            <button
                                                onClick={() => handleUpdateStatus(course.id, 'APPROVED')}
                                                className="w-11 h-11 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black rounded-xl flex items-center justify-center transition-all border border-emerald-500/20 shadow-lg shadow-emerald-500/5"
                                                title="Aprovar de Curso"
                                            >
                                                <Check size={20} strokeWidth={3} />
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(course.id, 'REJECTED')}
                                                className="w-11 h-11 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl flex items-center justify-center transition-all border border-red-500/20 shadow-lg shadow-red-500/5"
                                                title="Rejeitar Curso"
                                            >
                                                <X size={20} strokeWidth={3} />
                                            </button>
                                        </>
                                    )}

                                    {course.status !== 'PENDING' && (
                                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${course.status === 'APPROVED'
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                            : 'bg-red-500/10 border-red-500/20 text-red-500'
                                            }`}>
                                            {course.status === 'APPROVED' ? 'Aprovado' : 'Rejeitado'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-24 text-center space-y-4 bg-zinc-900/20 border border-zinc-800/50 rounded-[3rem]">
                        <div className="w-20 h-20 bg-zinc-800/50 rounded-3xl flex items-center justify-center mx-auto text-zinc-600">
                            <BookOpen size={40} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white">Nenhum curso encontrado</h3>
                            <p className="text-zinc-500 text-sm font-medium">Tudo limpo por aqui! Nenhuma solicitação pendente.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Aviso de Moderação */}
            <div className="bg-primary-500/5 border border-primary-500/10 rounded-3xl p-6 flex items-start gap-4">
                <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400 shrink-0">
                    <AlertCircle size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-black text-white mb-1">Diretrizes de Moderação</h4>
                    <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                        Ao aprovar um curso, ele se torna visível para todos os membros na Loja da Academia.
                        Verifique se o link do vídeo está funcional e se o conteúdo está de acordo com as normas da cooperativa (sem promessas irreais ou pirâmides).
                    </p>
                </div>
            </div>
        </div>
    );
};
