import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bug, AlertCircle, Clock, CheckCircle, RefreshCw, ChevronRight, MessageSquare } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface BugReport {
    id: number;
    title: string;
    category: string;
    severity: string;
    status: string;
    created_at: string;
    admin_notes: string | null;
    resolved_at: string | null;
}

interface MyBugReportsViewProps {
    onBack: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const MyBugReportsView: React.FC<MyBugReportsViewProps> = ({ onBack, onSuccess: _onSuccess, onError }) => {
    const [reports, setReports] = useState<BugReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        try {
            const data = await apiService.getMyBugReports();
            setReports(data || []);
        } catch (e: any) {
            onError('Erro', e.message || 'Não foi possível carregar os relatórios.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open':
                return <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">Em Aberto</span>;
            case 'in_progress':
                return <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">Em Análise</span>;
            case 'resolved':
                return <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">Resolvido</span>;
            case 'closed':
                return <span className="bg-zinc-500/20 text-zinc-400 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">Fechado</span>;
            default:
                return <span className="bg-zinc-500/20 text-zinc-400 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">{status}</span>;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'text-red-500';
            case 'high': return 'text-orange-500';
            case 'medium': return 'text-yellow-500';
            default: return 'text-zinc-500';
        }
    };

    const getCategoryLabel = (category: string) => {
        const labels: Record<string, string> = {
            'general': 'Geral',
            'payment': 'Pagamentos',
            'ui': 'Interface',
            'performance': 'Performance',
            'other': 'Outro'
        };
        return labels[category] || category;
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="text-zinc-400 hover:text-white transition">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Bug className="text-red-400" />
                        Meus Relatórios
                    </h1>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Acompanhe seus Bug Reports</p>
                </div>
            </div>

            {/* Refresh Button */}
            <button
                onClick={loadReports}
                disabled={loading}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition"
            >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Atualizar
            </button>

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-12">
                    <RefreshCw className="animate-spin text-primary-500" size={32} />
                </div>
            )}

            {/* Empty State */}
            {!loading && reports.length === 0 && (
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bug className="text-zinc-500" size={32} />
                    </div>
                    <h3 className="text-white font-bold mb-2">Nenhum Relatório</h3>
                    <p className="text-zinc-500 text-sm">
                        Você ainda não reportou nenhum bug. Use o botão de bug no menu para reportar problemas.
                    </p>
                </div>
            )}

            {/* Reports List */}
            {!loading && reports.length > 0 && (
                <div className="space-y-3">
                    {reports.map(report => (
                        <div
                            key={report.id}
                            onClick={() => setSelectedReport(report)}
                            className="bg-surface border border-surfaceHighlight rounded-2xl p-4 cursor-pointer hover:border-primary-500/30 transition-all group"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertCircle size={14} className={getSeverityColor(report.severity)} />
                                        <span className="text-white font-bold text-sm truncate">{report.title}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                        <span>{getCategoryLabel(report.category)}</span>
                                        <span>•</span>
                                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {getStatusBadge(report.status)}
                                    <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Report Detail Modal */}
            {selectedReport && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[500] p-0 sm:p-4 animate-in fade-in duration-300"
                    onClick={() => setSelectedReport(null)}
                >
                    <div
                        className="bg-[#0A0A0A] border-t sm:border border-surfaceHighlight rounded-t-[2.5rem] sm:rounded-3xl p-6 w-full sm:max-w-md relative animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 sm:duration-300 max-h-[80vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden opacity-50" />

                        <div className="space-y-4">
                            {/* Header */}
                            <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedReport.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                    selectedReport.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                        selectedReport.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-zinc-800 text-zinc-400'
                                    }`}>
                                    <Bug size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-bold">{selectedReport.title}</h3>
                                    <p className="text-[10px] text-zinc-500 uppercase font-bold">
                                        #{selectedReport.id} • {getCategoryLabel(selectedReport.category)}
                                    </p>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="bg-zinc-900/50 rounded-xl p-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Status</span>
                                    {getStatusBadge(selectedReport.status)}
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Severidade</span>
                                    <span className={`text-xs font-bold uppercase ${getSeverityColor(selectedReport.severity)}`}>
                                        {selectedReport.severity}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Reportado em</span>
                                    <span className="text-xs text-zinc-300 flex items-center gap-1">
                                        <Clock size={12} />
                                        {new Date(selectedReport.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                {selectedReport.resolved_at && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-zinc-500 uppercase font-bold">Resolvido em</span>
                                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                                            <CheckCircle size={12} />
                                            {new Date(selectedReport.resolved_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Admin Notes */}
                            {selectedReport.admin_notes && (
                                <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MessageSquare size={14} className="text-primary-400" />
                                        <span className="text-[10px] text-primary-400 uppercase font-bold">Resposta da Equipe</span>
                                    </div>
                                    <p className="text-sm text-zinc-300 leading-relaxed">{selectedReport.admin_notes}</p>
                                </div>
                            )}

                            {/* Close Button */}
                            <button
                                onClick={() => setSelectedReport(null)}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold text-sm transition"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyBugReportsView;
