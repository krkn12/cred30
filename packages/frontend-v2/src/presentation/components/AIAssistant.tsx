import React, { useState } from 'react';

interface AIAssistantProps {
  appState: any;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ appState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage = { role: 'user', content: message };
    setMessages([...messages, newMessage]);

    // Simular resposta da IA
    setTimeout(() => {
      const aiResponse = {
        role: 'assistant',
        content: `Olá! Sou o assistente virtual do Cred30. Como posso ajudar você hoje?`
      };
      setMessages(prev => [...prev, newMessage, aiResponse]);
    }, 1000);

    setMessage('');
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-primary-500 hover:bg-primary-400 text-black p-3 rounded-full shadow-lg transition-all"
        title="Assistente IA"
      >
        🤖
      </button>

      {isOpen && (
        <div className="absolute bottom-16 right-0 w-96 bg-surface border border-surfaceHighlight rounded-2xl shadow-2xl">
          <div className="flex justify-between items-center p-4 border-b border-surfaceHighlight">
            <h3 className="text-white font-bold">Assistente Cred30</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-zinc-400 py-8">
                <p className="text-lg mb-2">👋 Olá!</p>
                <p>Sou o assistente virtual do Cred30.</p>
                <p className="text-sm mt-2">Posso ajudar com:</p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>• Informações sobre aportes</li>
                  <li>• Dúvidas sobre apoios</li>
                  <li>• Ajuda com o sistema</li>
                </ul>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user'
                      ? 'bg-primary-500 text-black'
                      : 'bg-surfaceHighlight text-white'
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-surfaceHighlight">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSend();
                  }
                }}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-background border border-surfaceHighlight rounded-lg px-3 py-2 text-white outline-none focus:border-primary-500"
              />
              <button
                onClick={handleSend}
                className="bg-primary-500 hover:bg-primary-400 text-black px-4 py-2 rounded-lg font-medium transition"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};