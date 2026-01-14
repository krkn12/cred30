import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Star, DollarSign, Calendar, Clock, Video, Check, X, ShieldCheck, Search, ArrowLeft } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

// Tipos
interface Tutor {
    id: number;
    name: string;
    avatar_url?: string;
    tutor_bio: string;
    tutor_price_per_hour: string; // Vem como string do backend (decimal)
    tutor_subjects: string;
    tutor_rating: string;
    is_verified: boolean;
}

interface ClassRequest {
    id: number;
    status: 'PENDING' | 'APPROVED' | 'PAID' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
    scheduled_at: string;
    duration_hours: number;
    subject: string;
    message: string;
    price_snapshot: string;
    meeting_link?: string;
    tutor_name?: string; // Para aluno ver
    student_name?: string; // Para professor ver
    tutor_bio?: string;
}

export const TutorsView = ({ onBack, onSuccess, onError }: { onBack?: () => void, onSuccess?: (t: string, m: string) => void, onError?: (t: string, m: string) => void }) => {
    const [activeTab, setActiveTab] = useState<'find' | 'my-classes' | 'teaching'>('find');
    const [tutors, setTutors] = useState<Tutor[]>([]);
    const [myAppointments, setMyAppointments] = useState<ClassRequest[]>([]);
    const [myTeachingClasses, setMyTeachingClasses] = useState<ClassRequest[]>([]);
    const [loading, setLoading] = useState(false);

    // Filter
    const [searchTerm, setSearchTerm] = useState('');

    // Modal Request
    const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
    const [requestForm, setRequestForm] = useState({ date: '', time: '', hours: 1, subject: '', message: '' });

    // Modal Register Tutor
    const [showRegisterTutor, setShowRegisterTutor] = useState(false);
    const [registerForm, setRegisterForm] = useState({ bio: '', price: '50', subjects: '' });

    // --- Data Loading ---
    const loadTutors = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiService.get<any>('/tutors/list');
            if (res.success) setTutors(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMyAppointments = useCallback(async () => {
        try {
            const res = await apiService.get<any>('/tutors/my-appointments');
            if (res.success) setMyAppointments(res.data || []);
        } catch (e) { console.error(e); }
    }, []);

    const loadMyTeaching = useCallback(async () => {
        try {
            const res = await apiService.get<any>('/tutors/my-classes');
            if (res.success) setMyTeachingClasses(res.data || []);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        if (activeTab === 'find') loadTutors();
        if (activeTab === 'my-classes') loadMyAppointments();
        if (activeTab === 'teaching') loadMyTeaching();
    }, [activeTab, loadTutors, loadMyAppointments, loadMyTeaching]);


    // --- Actions ---

    const handleRegisterTutor = async () => {
        setLoading(true);
        try {
            const res = await apiService.post<any>('/tutors/register', {
                bio: registerForm.bio,
                pricePerHour: parseFloat(registerForm.price),
                subjects: registerForm.subjects
            });
            if (res.success) {
                onSuccess?.('Sucesso!', 'Você agora é um Tutor Cred30!');
                setShowRegisterTutor(false);
                setActiveTab('teaching');
            } else {
                onError?.('Erro', res.message);
            }
        } catch (e: any) {
            onError?.('Erro', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestClass = async () => {
        if (!selectedTutor) return;
        setLoading(true);
        try {
            // Combinar data e hora
            const scheduledAt = new Date(`${requestForm.date}T${requestForm.time}`).toISOString();

            const res = await apiService.post<any>('/tutors/request', {
                tutorId: selectedTutor.id,
                subject: requestForm.subject,
                message: requestForm.message,
                scheduledAt: scheduledAt,
                durationHours: requestForm.hours
            });

            if (res.success) {
                onSuccess?.('Solicitação Enviada!', 'Aguarde o professor aceitar.');
                setSelectedTutor(null);
                loadMyAppointments(); // Refresh
                setActiveTab('my-classes'); // Redirect
            } else {
                onError?.('Erro', res.message);
            }
        } catch (e: any) {
            onError?.('Erro', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRespondRequest = async (id: number, action: 'APPROVE' | 'REJECT', meetingLink?: string) => {
        setLoading(true);
        try {
            const res = await apiService.post<any>(`/tutors/request/${id}/respond`, { action, meetingLink });
            if (res.success) {
                onSuccess?.('Sucesso', 'Ação realizada.');
                loadMyTeaching();
            } else {
                onError?.('Erro', res.message);
            }
        } catch (e: any) {
            onError?.('Erro', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePayClass = async (id: number) => {
        if (!window.confirm('Confirmar pagamento desta aula? O valor será debitado do seu saldo.')) return;
        setLoading(true);
        try {
            const res = await apiService.post<any>(`/tutors/request/${id}/pay`, {});
            if (res.success) {
                onSuccess?.('Pagamento Confirmado!', 'Aula agendada com sucesso.');
                loadMyAppointments();
            } else {
                onError?.('Erro', res.message);
            }
        } catch (e: any) {
            onError?.('Erro', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pb-20">
            {/* Header */}
            <div className="bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50 p-4 sticky top-0 z-40">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition">
                                <ArrowLeft className="text-slate-400 w-5 h-5" />
                            </button>
                        )}
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <BookOpen className="text-emerald-400" />
                            Professores Particulares
                        </h1>
                    </div>
                    <button
                        onClick={() => setShowRegisterTutor(true)}
                        className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full font-bold hover:bg-emerald-500/20 transition"
                    >
                        Sou Professor?
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    {[
                        { id: 'find', label: 'Encontrar Professor' },
                        { id: 'my-classes', label: 'Minhas Aulas' },
                        { id: 'teaching', label: 'Painel do Tutor' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === tab.id ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <main className="p-4 space-y-6">

                {/* Find Tutors */}
                {activeTab === 'find' && (
                    <>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-slate-500 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar por professor ou matéria..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-4">
                            {tutors.filter(t =>
                                t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                t.tutor_subjects.toLowerCase().includes(searchTerm.toLowerCase())
                            ).map(tutor => (
                                <div key={tutor.id} className="bg-slate-800 rounded-2xl p-4 border border-slate-700 hover:border-emerald-500/30 transition flex flex-col sm:flex-row gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-2xl font-bold text-slate-500 shrink-0 overflow-hidden">
                                            {tutor.avatar_url ? <img src={tutor.avatar_url} alt={tutor.name} className="w-full h-full object-cover" /> : tutor.name[0]}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg flex items-center gap-2">
                                                {tutor.name}
                                                {tutor.is_verified && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                                            </h3>
                                            <div className="flex items-center gap-1 text-yellow-400 text-sm mb-1">
                                                <Star className="w-3 h-3 fill-current" />
                                                <span>{tutor.tutor_rating}</span>
                                            </div>
                                            <p className="text-slate-400 text-xs line-clamp-2 mb-2">{tutor.tutor_bio}</p>
                                            <div className="flex flex-wrap gap-1">
                                                {tutor.tutor_subjects && tutor.tutor_subjects.split(',').map((subj, i) => (
                                                    <span key={i} className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">{subj.trim()}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t sm:border-t-0 sm:border-l border-slate-700 pt-4 sm:pt-0 sm:pl-4 flex flex-col justify-center min-w-[120px]">
                                        <div className="text-center mb-3">
                                            <p className="text-xs text-slate-500">Valor Hora</p>
                                            <p className="text-xl font-bold text-emerald-400">R$ {parseFloat(tutor.tutor_price_per_hour).toFixed(2)}</p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedTutor(tutor)}
                                            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 rounded-xl text-sm transition"
                                        >
                                            Solicitar Aula
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {tutors.length === 0 && !loading && (
                                <div className="text-center py-10 text-slate-500">Nenhum professor encontrado.</div>
                            )}
                        </div>
                    </>
                )}

                {/* My Appointments (Student View) */}
                {activeTab === 'my-classes' && (
                    <div className="space-y-4">
                        {myAppointments.map(req => (
                            <div key={req.id} className="bg-slate-800 rounded-2xl p-4 border border-slate-700 relative overflow-hidden">
                                <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase rounded-bl-xl ${req.status === 'APPROVED' ? 'bg-blue-500 text-white' :
                                    req.status === 'PAID' ? 'bg-emerald-500 text-black' :
                                        req.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500' :
                                            'bg-red-500/20 text-red-500'
                                    }`}>
                                    {req.status === 'APPROVED' ? 'Aprovado - Pague Agora' :
                                        req.status === 'PAID' ? 'Confirmado' :
                                            req.status === 'PENDING' ? 'Aguardando Professor' : req.status}
                                </div>

                                <div className="flex items-start gap-3 mb-3">
                                    <div className="p-2 bg-slate-700 rounded-lg">
                                        <Calendar className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">{req.subject}</h4>
                                        <p className="text-xs text-slate-400">Com: {req.tutor_name}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 mb-4 bg-slate-900/50 p-2 rounded-lg">
                                    <div>
                                        <span className="block opacity-50">Data</span>
                                        <span className="font-mono">{new Date(req.scheduled_at).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span className="block opacity-50">Horário</span>
                                        <span className="font-mono">{new Date(req.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div>
                                        <span className="block opacity-50">Duração</span>
                                        <span>{req.duration_hours}h</span>
                                    </div>
                                    <div>
                                        <span className="block opacity-50">Valor</span>
                                        <span className="text-emerald-400 font-bold">R$ {parseFloat(req.price_snapshot).toFixed(2)}</span>
                                    </div>
                                </div>

                                {req.status === 'APPROVED' && (
                                    <button
                                        onClick={() => handlePayClass(req.id)}
                                        disabled={loading}
                                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 animate-pulse"
                                    >
                                        <DollarSign size={16} /> Pagar para Confirmar
                                    </button>
                                )}

                                {req.status === 'PAID' && req.meeting_link && (
                                    <a
                                        href={req.meeting_link}
                                        target="_blank"
                                        className="block w-full text-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold py-3 rounded-lg transition"
                                    >
                                        <Video className="inline w-4 h-4 mr-2" /> Acessar Link da Aula
                                    </a>
                                )}
                            </div>
                        ))}
                        {myAppointments.length === 0 && (
                            <div className="text-center py-10 text-slate-500">Nenhuma aula agendada.</div>
                        )}
                    </div>
                )}

                {/* My Teaching (Tutor View) */}
                {activeTab === 'teaching' && (
                    <div className="space-y-4">
                        {myTeachingClasses.length === 0 && (
                            <div className="bg-slate-800 p-6 rounded-2xl text-center">
                                <p className="text-slate-400 mb-4">Você ainda não tem solicitações de aula.</p>
                                <button onClick={() => setShowRegisterTutor(true)} className="text-emerald-400 hover:underline">Atualizar Perfil de Tutor</button>
                            </div>
                        )}

                        {myTeachingClasses.map(req => (
                            <div key={req.id} className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${req.status === 'PENDING' ? 'bg-yellow-500' :
                                                req.status === 'PAID' ? 'bg-emerald-500' : 'bg-slate-500'
                                                }`}></span>
                                            <h4 className="font-bold text-white text-sm">Solicitação #{req.id}</h4>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">Aluno: {req.student_name}</p>
                                        <p className="text-sm font-medium mt-1">{req.subject}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-emerald-400 font-bold text-lg">R$ {(parseFloat(req.price_snapshot) * 0.8).toFixed(2)}</p>
                                        <p className="text-[10px] text-slate-500">Seu lucro (80%)</p>
                                    </div>
                                </div>

                                <div className="bg-black/20 p-3 rounded-lg text-xs text-slate-300 mb-4">
                                    <span className="font-bold block text-slate-500 text-[10px] uppercase mb-1">Mensagem do Aluno</span>
                                    "{req.message || 'Sem mensagem'}"
                                </div>

                                <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(req.scheduled_at).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(req.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>{req.duration_hours}h</span>
                                </div>

                                {req.status === 'PENDING' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const link = prompt('Link da reunião (Meet/Google/Zoom):');
                                                if (link) handleRespondRequest(req.id, 'APPROVE', link);
                                            }}
                                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1"
                                        >
                                            <Check size={14} /> ACEITAR
                                        </button>
                                        <button
                                            onClick={() => handleRespondRequest(req.id, 'REJECT')}
                                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1"
                                        >
                                            <X size={14} /> RECUSAR
                                        </button>
                                    </div>
                                )}

                                {req.status === 'APPROVED' && (
                                    <div className="text-center text-xs text-yellow-500 bg-yellow-500/10 py-2 rounded-lg">
                                        Aguardando Pagamento do Aluno
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

            </main>

            {/* Modal Register Tutor */}
            {showRegisterTutor && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
                        <h3 className="text-lg font-bold text-white mb-4">Tornar-se Professor</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Suas Matérias (separadas por vírgula)</label>
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" value={registerForm.subjects} onChange={e => setRegisterForm({ ...registerForm, subjects: e.target.value })} placeholder="Matemática, Inglês, Programação..." />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Preço por Hora (R$)</label>
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" type="number" value={registerForm.price} onChange={e => setRegisterForm({ ...registerForm, price: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Mini Bio</label>
                                <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white h-20" value={registerForm.bio} onChange={e => setRegisterForm({ ...registerForm, bio: e.target.value })} placeholder="Conte sua experiência..." />
                            </div>
                            <button onClick={handleRegisterTutor} disabled={loading} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl mt-2">
                                {loading ? 'Salvando...' : 'Ativar Perfil'}
                            </button>
                            <button onClick={() => setShowRegisterTutor(false)} className="w-full text-slate-500 text-sm mt-2">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Request Class */}
            {selectedTutor && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-700 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-white mb-1">Solicitar Aula</h3>
                        <p className="text-sm text-slate-400 mb-4">Com {selectedTutor.name}</p>

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Data</label>
                                    <input type="date" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm" value={requestForm.date} onChange={e => setRequestForm({ ...requestForm, date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Hora</label>
                                    <input type="time" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm" value={requestForm.time} onChange={e => setRequestForm({ ...requestForm, time: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Duração (Horas)</label>
                                    <input type="number" min="1" max="4" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm" value={requestForm.hours} onChange={e => setRequestForm({ ...requestForm, hours: parseInt(e.target.value) || 1 })} />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Valor Estimado</label>
                                    <div className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-white text-sm font-bold flex items-center text-emerald-400">
                                        R$ {(parseFloat(selectedTutor.tutor_price_per_hour) * requestForm.hours).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Assunto / Matéria</label>
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm" value={requestForm.subject} onChange={e => setRequestForm({ ...requestForm, subject: e.target.value })} placeholder="Ex: Reforço de Inglês" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Mensagem para o Professor</label>
                                <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm h-16 resize-none" value={requestForm.message} onChange={e => setRequestForm({ ...requestForm, message: e.target.value })} placeholder="Olá, gostaria de ajuda com..." />
                            </div>

                            <div className="bg-yellow-500/10 text-yellow-500 text-[10px] p-2 rounded border border-yellow-500/20">
                                ℹ️ O professor precisa aprovar a solicitação antes de você realizar o pagamento.
                            </div>

                            <button onClick={handleRequestClass} disabled={loading} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl mt-2">
                                {loading ? 'Enviando...' : 'Enviar Solicitação'}
                            </button>
                            <button onClick={() => setSelectedTutor(null)} className="w-full text-slate-500 text-sm mt-2">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
