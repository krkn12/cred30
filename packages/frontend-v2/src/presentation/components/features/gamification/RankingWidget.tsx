import { useEffect, useState } from 'react';
import { Crown, Trophy, User } from 'lucide-react';
import { apiService } from '../../../../application/services/api.service';


interface RankUser {
    id: string;
    name: string;
    points: number;
    isMe: boolean;
}

interface MyRank {
    position: number;
    points: number;
}

interface RankingData {
    top3: RankUser[];
    myRank: MyRank;
}

export const RankingWidget = () => {
    const [data, setData] = useState<RankingData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRanking();
    }, []);

    const loadRanking = async () => {
        try {
            const res = await apiService.get<any>('/users/ranking/farm');
            if (res.success) {
                setData(res.data);
            }
        } catch (error) {
            console.error('Erro ao carregar ranking:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="h-48 animate-pulse bg-zinc-900/50 rounded-3xl" />;
    if (!data) return null;

    const [first, second, third] = data.top3;

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-black border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-primary-500/10 blur-[60px] rounded-full pointer-events-none" />

                <div className="flex items-center gap-3 mb-8 relative z-10">
                    <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-400">
                        <Trophy size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">Top Farmers</h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Os maiores acumuladores da semana</p>
                    </div>
                </div>

                {/* PODIUM */}
                <div className="flex items-end justify-center gap-2 sm:gap-4 relative z-10">
                    {/* 2nd Place */}
                    {second && (
                        <div className="flex flex-col items-center mb-4">
                            <div className="mb-2 relative">
                                <div className="w-12 h-12 rounded-full border-2 border-zinc-400 bg-zinc-800 flex items-center justify-center overflow-hidden">
                                    <span className="text-lg font-black text-zinc-400">{second.name[0]}</span>
                                </div>
                                <div className="absolute -bottom-2 -right-1 bg-zinc-400 text-black text-[10px] font-black px-1.5 rounded-md border-2 border-zinc-900">
                                    2º
                                </div>
                            </div>
                            <div className="h-24 w-20 bg-gradient-to-t from-zinc-800 to-zinc-800/50 rounded-t-2xl flex flex-col items-center justify-end pb-3 border-x border-t border-zinc-700/50">
                                <p className="text-[10px] font-bold text-zinc-300 truncate max-w-[90%] px-1">{second.name.split(' ')[0]}</p>
                                <p className="text-[10px] font-black text-zinc-500">{second.points} pts</p>
                            </div>
                        </div>
                    )}

                    {/* 1st Place */}
                    {first && (
                        <div className="flex flex-col items-center z-10">
                            <div className="mb-2 relative">
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-400 animate-bounce">
                                    <Crown size={24} fill="currentColor" />
                                </div>
                                <div className="w-16 h-16 rounded-full border-2 border-amber-400 bg-zinc-800 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.2)]">
                                    <span className="text-2xl font-black text-amber-400">{first.name[0]}</span>
                                </div>
                                <div className="absolute -bottom-2 -right-1 bg-amber-400 text-black text-xs font-black px-2 py-0.5 rounded-md border-2 border-zinc-900">
                                    1º
                                </div>
                            </div>
                            <div className="h-32 w-24 bg-gradient-to-t from-amber-500/20 to-amber-500/5 rounded-t-2xl flex flex-col items-center justify-end pb-4 border-x border-t border-amber-500/20 relative overflow-hidden">
                                <div className="absolute inset-0 bg-amber-400/5 animate-pulse" />
                                <p className="text-xs font-black text-amber-400 truncate max-w-[90%] px-1">{first.name.split(' ')[0]}</p>
                                <p className="text-[10px] font-black text-amber-500/80">{first.points} pts</p>
                            </div>
                        </div>
                    )}

                    {/* 3rd Place */}
                    {third && (
                        <div className="flex flex-col items-center mb-2">
                            <div className="mb-2 relative">
                                <div className="w-12 h-12 rounded-full border-2 border-amber-700 bg-zinc-800 flex items-center justify-center overflow-hidden">
                                    <span className="text-lg font-black text-amber-700">{third.name[0]}</span>
                                </div>
                                <div className="absolute -bottom-2 -right-1 bg-amber-700 text-black text-[10px] font-black px-1.5 rounded-md border-2 border-zinc-900">
                                    3º
                                </div>
                            </div>
                            <div className="h-20 w-20 bg-gradient-to-t from-zinc-800 to-zinc-800/50 rounded-t-2xl flex flex-col items-center justify-end pb-3 border-x border-t border-zinc-700/50">
                                <p className="text-[10px] font-bold text-zinc-300 truncate max-w-[90%] px-1">{third.name.split(' ')[0]}</p>
                                <p className="text-[10px] font-black text-zinc-500">{third.points} pts</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* User Rank Bar */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                        <User size={18} className="text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-zinc-400 uppercase">Sua Posição</p>
                        <p className="text-lg font-black text-white">#{data.myRank.position}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-zinc-400 uppercase">Seus Pontos</p>
                    <p className="text-lg font-black text-primary-400">{data.myRank.points}</p>
                </div>
            </div>
        </div>
    );
};
