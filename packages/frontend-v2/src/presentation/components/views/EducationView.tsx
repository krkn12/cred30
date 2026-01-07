import { ArrowLeft, GraduationCap, Book, Video, Award, ChevronRight, Star } from 'lucide-react';

interface EducationViewProps {
    onBack: () => void;
    onSuccess: (title: string, message: string) => void;
}

export const EducationView = ({ onBack }: EducationViewProps) => {
    const courses = [
        {
            id: 1,
            title: 'Introdução ao Apoio Mútuo',
            description: 'Aprenda os fundamentos do sistema de cooperativa de crédito Cred30.',
            duration: '30 min',
            progress: 0,
            totalLessons: 5,
            completedLessons: 0,
            icon: Book,
        },
        {
            id: 2,
            title: 'Gestão Financeira Pessoal',
            description: 'Organize suas finanças e alcance seus objetivos.',
            duration: '45 min',
            progress: 0,
            totalLessons: 8,
            completedLessons: 0,
            icon: Award,
        },
        {
            id: 3,
            title: 'Estratégias de Capital para Iniciantes',
            description: 'Primeiros passos no mundo do associativismo.',
            duration: '60 min',
            progress: 0,
            totalLessons: 10,
            completedLessons: 0,
            icon: Star,
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50">
                <div className="flex items-center justify-between p-4">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-xl bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-purple-400" />
                        Academia Cred30
                    </h1>
                    <div className="w-9" />
                </div>
            </header>

            {/* Content */}
            <main className="p-4 space-y-6">
                {/* Hero Section */}
                <div className="relative bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-2xl p-6 border border-purple-500/30 overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-400/30">
                                <Video className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Aprenda e Ganhe</h2>
                                <p className="text-sm text-slate-400">Complete cursos e ganhe pontos</p>
                            </div>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            Expanda seu conhecimento financeiro com nossos cursos exclusivos.
                            Ao completar cada módulo, você ganha pontos que podem ser convertidos em saldo!
                        </p>
                    </div>
                </div>

                {/* Courses List */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Cursos Disponíveis</h3>

                    {courses.map((course) => (
                        <div
                            key={course.id}
                            className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-4 hover:border-purple-500/30 transition-all cursor-pointer group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-400/30 group-hover:scale-105 transition-transform">
                                    <course.icon className="w-6 h-6 text-purple-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h4 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                                                {course.title}
                                            </h4>
                                            <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                                                {course.description}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                                    </div>

                                    <div className="flex items-center gap-4 mt-3">
                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                            <Video className="w-3 h-3" />
                                            {course.duration}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {course.completedLessons}/{course.totalLessons} aulas
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                                            style={{ width: `${course.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Coming Soon */}
                <div className="text-center py-8">
                    <p className="text-slate-500 text-sm">
                        Mais cursos em breve! 🎓
                    </p>
                </div>
            </main>
        </div>
    );
};
