import { useState, useEffect } from 'react';
import { ShieldCheck, Search, Clock, User, HardDrive, Layout, RefreshCw, AlertCircle, Download } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

export const AdminAudit = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await apiService.get('/admin/audit-logs') as any;
            if (res.success) {
                setLogs(res.logs);
            }
        } catch (error) {
            console.error('Erro ao carregar logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const blob = await apiService.admin.downloadAuditLogs();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `auditoria_cred30_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Erro ao exportar logs:', error);
            alert('Erro ao exportar logs. Tente novamente.');
        }
    };

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.user_name && log.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        log.entity_type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatValue = (val: any) => {
        if (!val) return '---';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <ShieldCheck className="text-primary-500" size={28} />
                        Logs de Auditoria
                    </h2>
                    <p className="text-zinc-500 text-sm">Rastreador de ações sensíveis e alterações no sistema</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-3 bg-primary-500/10 text-primary-400 border border-primary-500/20 rounded-xl hover:bg-primary-500/20 transition-all font-bold text-sm"
                    >
                        <Download size={18} />
                        Exportar CSV
                    </button>
                    <button
                        onClick={fetchLogs}
                        className="p-3 bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                    type="text"
                    placeholder="Filtrar por ação, usuário ou entidade..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-primary-500 outline-none transition"
                />
            </div>

            <div className="bg-zinc-950 border border-white/5 rounded-[2.5rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase font-black tracking-widest text-zinc-500">
                                <th className="px-6 py-5">Data/Hora</th>
                                <th className="px-6 py-5">Usuário</th>
                                <th className="px-6 py-5">Ação</th>
                                <th className="px-6 py-5">Entidade</th>
                                <th className="px-6 py-5">Dados</th>
                                <th className="px-6 py-5">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-8 bg-white/5" />
                                    </tr>
                                ))
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 italic">
                                        Nenhum log encontrado para o filtro aplicado.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="group hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2 text-zinc-400">
                                                <Clock size={12} />
                                                <span className="text-xs">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-500">
                                                    <User size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-white leading-none mb-1">{log.user_name || 'Sistema'}</p>
                                                    <p className="text-[10px] text-zinc-500 font-medium">#{log.user_id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="px-3 py-1 bg-primary-500/10 text-primary-400 border border-primary-500/20 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <Layout size={12} className="text-zinc-500" />
                                                <span className="text-xs text-zinc-300 font-medium">{log.entity_type || '---'} #{log.entity_id || ''}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="max-w-[200px] truncate group-hover:whitespace-normal group-hover:overflow-visible relative">
                                                <p className="text-[10px] text-zinc-500 font-mono bg-black/40 p-2 rounded border border-white/5">
                                                    {formatValue(log.new_values)}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2 text-zinc-500">
                                                <HardDrive size={12} />
                                                <span className="text-[10px] font-mono">{log.ip_address || '0.0.0.0'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4">
                <AlertCircle className="text-amber-500 shrink-0" size={24} />
                <div>
                    <h4 className="text-amber-500 font-bold text-sm mb-1">Atenção Especialista</h4>
                    <p className="text-zinc-500 text-xs">
                        Os logs de auditoria são imutáveis e servem para garantir a segurança da Fintech.
                        Qualquer alteração suspeita em saldos ou configurações do sistema deve ser investigada imediatamente.
                    </p>
                </div>
            </div>
        </div>
    );
};
