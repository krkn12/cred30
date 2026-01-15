import { useState, useEffect } from 'react';
import { ShieldCheck, Calendar, User, Info, FileText, Activity } from 'lucide-react';
import { apiService } from '../../../../application/services/api.service';

export const AdminCompliance = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [logsRes, statsRes] = await Promise.all([
                    apiService.get<any>('/admin/compliance/terms-acceptances'),
                    apiService.get<any>('/admin/compliance/stats')
                ]);

                if (logsRes.success) setLogs(logsRes.data);
                if (statsRes.success) setStats(statsRes.data);
            } catch (error) {
                console.error('Error fetching compliance data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                            <ShieldCheck className="text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Status da Blindagem</p>
                            <h3 className="text-xl font-bold text-white">Versão {stats?.termsVersion || '2.0'}</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${(stats?.users_with_current_terms / stats?.total_users) * 100}%` }}
                            />
                        </div>
                        <span className="text-xs text-zinc-400 font-bold">
                            {Math.round((stats?.users_with_current_terms / stats?.total_users) * 100)}% protegidos
                        </span>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                            <User className="text-blue-500" />
                        </div>
                        <div>
                            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Usuários Registrados</p>
                            <h3 className="text-2xl font-black text-white">{stats?.total_users}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center">
                            <Activity className="text-purple-500" />
                        </div>
                        <div>
                            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Risco Legal</p>
                            <h3 className="text-xl font-bold text-emerald-500">MÍNIMO</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <FileText size={20} className="text-zinc-500" /> Trilha de Auditoria (Audit Trail)
                        </h2>
                        <p className="text-xs text-zinc-500 mt-1">Registros de aceites digitais para prova jurídica contra fiscalizações.</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-zinc-800/50">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Usuário</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Data Aceite</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">IP / Local</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Dispositivo</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Versão</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {logs.map((log: any) => (
                                <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-white">{log.user_name}</p>
                                        <p className="text-[10px] text-zinc-500">{log.user_email}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-zinc-400">
                                            <Calendar size={14} />
                                            <span className="text-xs">{new Date(log.accepted_at).toLocaleString('pt-BR')}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-zinc-800 text-zinc-400 px-2 py-1 rounded text-[10px] font-mono">
                                            {log.ip_address}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] text-zinc-500 truncate max-w-[150px] inline-block">
                                            {log.user_agent}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                            v{log.terms_version}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {logs.length === 0 && (
                    <div className="p-12 text-center">
                        <p className="text-zinc-500">Nenhum registro de aceite encontrado.</p>
                    </div>
                )}
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl">
                <div className="flex gap-4">
                    <Info className="text-emerald-500 shrink-0" />
                    <div>
                        <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-1">Dica de Blindagem</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Mantenha esta trilha sempre atualizada. Em caso de fiscalização do Banco Central ou CVM, exporte os dados desta tabela para demonstrar que a plataforma opera como um clube privado de ajuda mútua com consentimento explícito dos membros.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
