import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, CornerDownRight, User } from 'lucide-react';
import { apiMarketplace } from '../../../application/services/api.marketplace';
import { toast } from 'sonner';

interface Question {
    id: number;
    listing_id: number;
    user_id: string;
    question: string;
    answer?: string;
    answered_at?: string;
    created_at: string;
    user_name?: string;
}

interface ItemQuestionsProps {
    listingId: number;
    currentUser: any;
    sellerId: string;
}

export const ItemQuestions: React.FC<ItemQuestionsProps> = ({ listingId, currentUser, sellerId }) => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [replyingTo, setReplyingTo] = useState<number | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const isSeller = currentUser?.id === sellerId;

    useEffect(() => {
        loadQuestions();
    }, [listingId]);

    const loadQuestions = async () => {
        setIsLoading(true);
        try {
            const res = await apiMarketplace.getQuestions(listingId);
            if (res.success && Array.isArray(res.data)) {
                setQuestions(res.data);
            }
        } catch (error) {
            console.error("Erro ao carregar perguntas:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAsk = async () => {
        if (!newQuestion.trim()) return;
        if (newQuestion.length < 5) {
            toast.error("Pergunta muito curta.");
            return;
        }

        setIsSending(true);
        try {
            const res = await apiMarketplace.askQuestion(listingId, newQuestion);
            if (res.success) {
                toast.success("Pergunta enviada!");
                setNewQuestion('');
                loadQuestions(); // Recarregar para mostrar a nova pergunta
            } else {
                toast.error(res.message);
            }
        } catch (error: any) {
            toast.error(error.message || "Erro ao enviar pergunta.");
        } finally {
            setIsSending(false);
        }
    };

    const handleAnswer = async (questionId: number) => {
        if (!replyText.trim()) return;

        setIsSending(true);
        try {
            const res = await apiMarketplace.answerQuestion(questionId, replyText);
            if (res.success) {
                toast.success("Resposta enviada!");
                setReplyText('');
                setReplyingTo(null);
                loadQuestions();
            } else {
                toast.error(res.message);
            }
        } catch (error: any) {
            toast.error(error.message || "Erro ao enviar resposta.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <MessageCircle size={16} className="text-primary-400" />
                Perguntas e Respostas
            </h3>

            {/* Caixa de Pergunta (apenas se não for o vendedor) */}
            {!isSeller && (
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="Escreva sua pergunta..."
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-primary-500/50 outline-none transition-colors"
                        onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                    />
                    <button
                        onClick={handleAsk}
                        disabled={isSending || !newQuestion.trim()}
                        className="bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-black p-3 rounded-xl transition-colors"
                    >
                        <Send size={20} />
                    </button>
                </div>
            )}

            {/* Lista de Perguntas */}
            <div className="space-y-4">
                {isLoading && <p className="text-center text-xs text-zinc-500 animate-pulse">Carregando perguntas...</p>}

                {!isLoading && questions.length === 0 && (
                    <div className="text-center py-8 border border-dashed border-zinc-800 rounded-2xl">
                        <p className="text-xs text-zinc-500 font-medium">Nenhuma pergunta ainda.</p>
                        {!isSeller && <p className="text-[10px] text-zinc-600 mt-1">Seja o primeiro a perguntar!</p>}
                    </div>
                )}

                {questions.map((q) => (
                    <div key={q.id} className="bg-zinc-900/30 border border-zinc-800/50 p-4 rounded-2xl hover:border-zinc-700 transition-colors">
                        <div className="flex items-start gap-3">
                            <div className="bg-zinc-800 p-1.5 rounded-full mt-0.5">
                                <MessageCircle size={12} className="text-zinc-400" />
                            </div>
                            <div className="flex-1 space-y-3">
                                <p className="text-sm text-white font-medium leading-relaxed">{q.question}</p>

                                {q.answer ? (
                                    <div className="flex items-start gap-3 pl-4 border-l-2 border-zinc-800 relative">
                                        <div className="absolute -left-[9px] top-0 text-zinc-600">
                                            <CornerDownRight size={14} />
                                        </div>
                                        <div>
                                            <p className="text-sm text-zinc-400 leading-relaxed">{q.answer}</p>
                                            <p className="text-[10px] text-zinc-600 mt-1">{new Date(q.answered_at!).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                ) : isSeller ? (
                                    <div className="pl-4 mt-2">
                                        {replyingTo === q.id ? (
                                            <div className="flex gap-2 animate-in slide-in-from-top-2">
                                                <input
                                                    type="text"
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    placeholder="Sua resposta..."
                                                    autoFocus
                                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-primary-500/50 outline-none"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAnswer(q.id)}
                                                />
                                                <button
                                                    onClick={() => handleAnswer(q.id)}
                                                    className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg"
                                                >
                                                    <Send size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setReplyingTo(q.id); setReplyText(''); }}
                                                className="text-[10px] font-bold text-primary-400 hover:text-primary-300 uppercase tracking-wider"
                                            >
                                                Responder
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-zinc-600 italic">Aguardando resposta do vendedor...</p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
