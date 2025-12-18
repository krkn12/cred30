import React, { useState } from 'react';
import { Gamepad2, Bike, Smartphone, Tv, Car, Trophy, Cookie, RotateCw, Info, Volume2, VolumeX } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import { soundManager } from '../../../shared/utils/sound.utils';

interface SlotMachineProps {
    onBalanceUpdate: () => void;
    currentBalance: number;
}

// Mapeamento de Símbolos para Ícones
const SymbolIcon = ({ symbol }: { symbol: string }) => {
    switch (symbol) {
        case '🍬': return <Cookie size={40} className="text-pink-400 drop-shadow-[0_0_5px_rgba(244,114,182,0.8)]" />;
        case '⚽': return <Trophy size={40} className="text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]" />;
        case '🚲': return <Bike size={40} className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />;
        case '📱': return <Smartphone size={40} className="text-purple-400 drop-shadow-[0_0_5px_rgba(192,132,252,0.8)]" />;
        case '📺': return <Tv size={40} className="text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]" />;
        case '🚗': return <Car size={40} className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" />;
        default: return <span className="text-4xl">{symbol}</span>;
    }
}

export const SlotMachine: React.FC<SlotMachineProps> = ({ onBalanceUpdate, currentBalance }) => {
    const [reels, setReels] = useState(['🍬', '🚲', '📺']);
    const [isSpinning, setIsSpinning] = useState(false);
    const [lastBatchResult, setLastBatchResult] = useState<{ totalMoney: number; totalPoints: number; wins: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(false);

    const SPIN_COST = 0.05; // Custo do Pacote

    const handleToggleMute = () => {
        const muted = soundManager.toggleMute();
        setIsMuted(muted);
    };

    const handleSpin = async () => {
        if (currentBalance < SPIN_COST) {
            setError('Saldo insuficiente para jogar! Recarregue sua conta.');
            soundManager.playError();
            return;
        }

        setIsSpinning(true);
        setError(null);
        setLastBatchResult(null);
        soundManager.playCoin();

        // Efeito visual de girar
        const spinInterval = setInterval(() => {
            setReels(prev => prev.map(() => ['🍬', '⚽', '🚲', '📱', '📺', '🚗'][Math.floor(Math.random() * 6)]));
            soundManager.playSpin(); // Som de giro a cada tick
        }, 100);

        try {
            const result = await apiService.spinSlot();

            clearInterval(spinInterval);

            if (result.success && result.data) {
                // Mostrar o último resultado do batch nos rolos
                const lastSpin = result.data.batchResults[result.data.batchResults.length - 1];
                setReels(lastSpin.reels);

                setLastBatchResult({
                    totalMoney: result.data.totalMoneyWon,
                    totalPoints: result.data.totalPointsWon,
                    wins: result.data.winCount
                });

                // Tocar som de vitória se ganhou dinheiro
                if (result.data.totalMoneyWon > 0) {
                    if (result.data.totalMoneyWon >= 1.00) {
                        soundManager.playJackpot();
                    } else {
                        soundManager.playWin();
                    }
                }

                onBalanceUpdate(); // Atualiza saldo global
            } else {
                setError(result.message || 'Erro ao processar jogada.');
            }
        } catch (e: any) {
            clearInterval(spinInterval);
            setError(e.message || 'Erro de conexão.');
        } finally {
            setIsSpinning(false);
        }
    };

    return (
        <div className="max-w-md mx-auto relative pb-20">
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-8 text-center relative overflow-hidden mb-6 shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-pink-600"></div>

                {/* Toggle Mute */}
                <button
                    onClick={handleToggleMute}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition z-10 bg-black/20 p-2 rounded-full backdrop-blur-sm"
                    title={isMuted ? "Ativar Som" : "Mudo"}
                >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                <div className="flex justify-center mb-6">
                    <div className="bg-purple-900/30 p-4 rounded-full text-purple-400 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.3)] animate-pulse">
                        <Gamepad2 size={40} />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">Super Slot 20x</h2>
                <p className="text-zinc-400 mb-6 text-sm">
                    Gire <strong>20 vezes seguidas</strong> por apenas <strong className="text-emerald-400">R$ {SPIN_COST.toFixed(2)}</strong>!
                    <br /><span className="text-[10px] opacity-70">Símbolos: Produtos Reais (Tv, Celular, Bike...)</span>
                </p>

                {/* Slot Display */}
                <div className="bg-gradient-to-b from-zinc-900 to-black border-4 border-yellow-600/50 rounded-xl p-4 mb-8 relative shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                    <div className="flex justify-center gap-2 sm:gap-4">
                        {reels.map((symbol, i) => (
                            <div key={i} className="w-20 h-24 bg-gradient-to-b from-zinc-800 to-zinc-900 border-2 border-zinc-700 rounded-lg flex items-center justify-center shadow-lg transform transition-transform hover:scale-105">
                                <SymbolIcon symbol={symbol} />
                            </div>
                        ))}
                    </div>

                    {/* Payline */}
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500/30 -translate-y-1/2 pointer-events-none blur-[1px]"></div>
                </div>

                {/* Status Message */}
                <div className="min-h-20 mb-4 flex flex-col items-center justify-center">
                    {isSpinning ? (
                        <div className="flex items-center gap-2 text-yellow-400 font-bold text-lg">
                            <RotateCw className="animate-spin" /> Processando 20 Jogadas...
                        </div>
                    ) : lastBatchResult ? (
                        <div className="animate-bounce bg-emerald-900/20 w-full rounded-xl p-2 border border-emerald-500/30">
                            <p className="text-white text-sm mb-1">{lastBatchResult.wins} vitórias em 20 giros!</p>
                            <p className="text-emerald-400 font-bold text-2xl">Ganhou R$ {lastBatchResult.totalMoney.toFixed(2)}</p>
                            <p className="text-zinc-500 text-xs">+{lastBatchResult.totalPoints} pontos</p>
                        </div>
                    ) : error ? (
                        <p className="text-red-400 text-sm bg-red-900/20 px-4 py-2 rounded-lg">{error}</p>
                    ) : (
                        <p className="text-zinc-500 text-sm flex items-center gap-1 justify-center">
                            <Info size={14} /> Combine 3 iguais!
                        </p>
                    )}
                </div>

                {/* Controls */}
                <button
                    onClick={handleSpin}
                    disabled={isSpinning}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-2 ${isSpinning
                        ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:brightness-110 shadow-purple-500/40 border border-purple-400/30'
                        }`}
                >
                    {isSpinning ? 'Rodando...' : (
                        <>
                            <span>GIRAR 20x</span>
                            <span className="bg-black/20 text-sm px-2 py-1 rounded">R$ {SPIN_COST.toFixed(2)}</span>
                        </>
                    )}
                </button>

                {/* Paytable Mini */}
                <div className="mt-8 border-t border-surfaceHighlight pt-6">
                    <h3 className="text-zinc-400 text-xs uppercase tracking-widest mb-4">Prêmios (3x)</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 text-xs text-zinc-300">
                        <div className="bg-surfaceHighlight/30 p-2 rounded flex flex-col items-center gap-1"><Cookie size={16} className="text-pink-400" /> R$ 0,01</div>
                        <div className="bg-surfaceHighlight/30 p-2 rounded flex flex-col items-center gap-1"><Trophy size={16} className="text-yellow-400" /> R$ 0,02</div>
                        <div className="bg-surfaceHighlight/30 p-2 rounded flex flex-col items-center gap-1"><Bike size={16} className="text-cyan-400" /> R$ 0,05</div>
                        <div className="bg-surfaceHighlight/30 p-2 rounded flex flex-col items-center gap-1"><Smartphone size={16} className="text-purple-400" />R$ 0,20</div>
                        <div className="bg-surfaceHighlight/30 p-2 rounded flex flex-col items-center gap-1"><Tv size={16} className="text-emerald-400" /> R$ 1,00</div>
                        <div className="bg-gradient-to-r from-red-900/50 to-red-600/50 border border-red-500/50 p-2 rounded flex flex-col items-center gap-1 font-bold text-white"><Car size={16} /> R$ 10,00</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
