import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../../../application/services/api.service';
import { MessageSquare, User, Clock, Send, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface SupportChat {
    id: number;
    user_id: number;
    user_name: string;
    user_email: string;
    status: 'AI_ONLY' | 'PENDING_HUMAN' | 'ACTIVE_HUMAN' | 'CLOSED';
    last_message_at: string;
    created_at: string;
}

interface ChatMessage {
    id: number;
    chat_id: number;
    role: 'user' | 'assistant' | 'admin';
    content: string;
    created_at: string;
}

export const SupportAdminView = () => {
    const [chats, setChats] = useState<SupportChat[]>([]);
    const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadPendingChats();
        const interval = setInterval(loadPendingChats, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedChat) {
            loadMessages(selectedChat.id);
            const interval = setInterval(() => loadMessages(selectedChat.id), 5000);
            return () => clearInterval(interval);
        }
    }, [selectedChat?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadPendingChats = async () => {
        try {
            setIsLoading(true);
            const data = await apiService.getPendingSupportChats();
            setChats(data.chats || []);
        } catch (error) {
            console.error('Erro ao carregar chats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadMessages = async (chatId: number) => {
        try {
            const data = await apiService.getAdminChatHistory(chatId);
            if (data && data.messages) {
                setMessages(data.messages);
            }
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!selectedChat || !newMessage.trim() || isSending) return;

        try {
            setIsSending(true);
            await apiService.respondSupportChat(selectedChat.id, newMessage);
            setNewMessage('');
            await loadMessages(selectedChat.id);
            await loadPendingChats();
        } catch (error) {
            console.error('Erro ao enviar resposta:', error);
        } finally {
            setIsSending(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING_HUMAN': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'ACTIVE_HUMAN': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            default: return 'bg-zinc-800 text-zinc-400 border-zinc-700';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PENDING_HUMAN': return 'AGUARDANDO';
            case 'ACTIVE_HUMAN': return 'EM ATENDIMENTO';
            case 'AI_ONLY': return 'IA';
            case 'CLOSED': return 'FECHADO';
            default: return status;
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[700px] animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Lista de Chats */}
            <div className="lg:col-span-1 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/20">
                    <h3 className="text-lg font-bold text-white flex items-center gap-3">
                        <MessageSquare className="text-primary-400" size={20} />
                        Atendimentos
                    </h3>
                    <button onClick={loadPendingChats} className="p-2 hover:bg-zinc-800 rounded-lg transition text-zinc-400">
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {chats.length === 0 ? (
                        <div className="p-12 text-center text-zinc-500">
                            <CheckCircle size={40} className="mx-auto mb-4 opacity-20" />
                            <p className="font-medium">Nenhum chamado pendente.</p>
                        </div>
                    ) : (
                        chats.map((chat) => (
                            <button
                                key={chat.id}
                                onClick={() => setSelectedChat(chat)}
                                className={`w-full p-6 border-b border-zinc-800/50 flex flex-col gap-2 transition-all text-left ${selectedChat?.id === chat.id ? 'bg-primary-500/5 border-l-4 border-l-primary-500' : 'hover:bg-zinc-800/30'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-white font-bold text-sm truncate max-w-[150px]">{chat.user_name}</span>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${getStatusColor(chat.status)}`}>
                                        {getStatusLabel(chat.status)}
                                    </span>
                                </div>
                                <p className="text-[10px] text-zinc-500 truncate">{chat.user_email}</p>
                                <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 font-bold uppercase mt-1">
                                    <Clock size={10} />
                                    {new Date(chat.last_message_at).toLocaleTimeString()}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Janela de Chat */}
            <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
                {!selectedChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                            <MessageSquare size={40} className="text-zinc-600" />
                        </div>
                        <h4 className="text-white font-bold text-xl mb-2">Selecione um Atendimento</h4>
                        <p className="text-zinc-500 text-sm max-w-sm">Escolha um chamado na lista ao lado para começar a responder aos associados.</p>
                    </div>
                ) : (
                    <>
                        {/* Header Chat */}
                        <div className="p-6 border-b border-zinc-800 bg-zinc-800/20 flex gap-4 items-center">
                            <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-400 border border-primary-500/20">
                                <User size={24} />
                            </div>
                            <div>
                                <h4 className="text-white font-bold leading-tight">{selectedChat.user_name}</h4>
                                <p className="text-xs text-zinc-500">{selectedChat.user_email}</p>
                            </div>
                        </div>

                        {/* Mensagens */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/20 custom-scrollbar">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] space-y-1`}>
                                        <div className={`p-4 rounded-2xl text-sm ${msg.role === 'admin'
                                            ? 'bg-primary-500 text-black rounded-tr-none'
                                            : msg.role === 'assistant'
                                                ? 'bg-zinc-800 text-zinc-400 italic rounded-tl-none border border-zinc-700'
                                                : 'bg-zinc-800 text-white rounded-tl-none border border-zinc-700'
                                            }`}>
                                            {msg.content}
                                        </div>
                                        <p className={`text-[9px] text-zinc-600 font-bold uppercase ${msg.role === 'admin' ? 'text-right' : 'text-left'}`}>
                                            {msg.role === 'admin' ? 'VOCÊ' : msg.role === 'assistant' ? 'IA' : 'ASSOCIADO'} • {new Date(msg.created_at).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-6 border-t border-zinc-800 bg-zinc-900">
                            <div className="flex gap-4">
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder="Digite sua resposta..."
                                    className="flex-1 bg-black/40 border border-zinc-800 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-primary-500/50 transition-all resize-none h-14"
                                    disabled={isSending}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={isSending || !newMessage.trim()}
                                    className="bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-black p-4 rounded-2xl transition shadow-lg shrink-0"
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
