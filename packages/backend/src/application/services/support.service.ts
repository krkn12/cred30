import { Pool, PoolClient } from 'pg';

export interface ChatMessage {
    id?: number;
    chatId: number;
    senderId?: number | null;
    role: 'user' | 'assistant' | 'admin';
    content: string;
    createdAt?: Date;
}

export interface SupportChat {
    id: number;
    userId: number;
    status: 'AI_ONLY' | 'PENDING_HUMAN' | 'ACTIVE_HUMAN' | 'CLOSED';
    lastMessageAt: Date;
    createdAt: Date;
}

export class SupportService {
    async getOrCreateChat(pool: Pool | PoolClient, userId: number): Promise<SupportChat> {
        // Buscar chat ativo
        const chatResult = await pool.query(
            `SELECT * FROM support_chats WHERE user_id = $1 AND status != 'CLOSED' ORDER BY last_message_at DESC LIMIT 1`,
            [userId]
        );

        if (chatResult.rows.length > 0) {
            return {
                id: chatResult.rows[0].id,
                userId: chatResult.rows[0].user_id,
                status: chatResult.rows[0].status,
                lastMessageAt: chatResult.rows[0].last_message_at,
                createdAt: chatResult.rows[0].created_at
            };
        }

        // Criar novo chat
        const newChatResult = await pool.query(
            `INSERT INTO support_chats (user_id, status) VALUES ($1, 'AI_ONLY') RETURNING *`,
            [userId]
        );

        return {
            id: newChatResult.rows[0].id,
            userId: newChatResult.rows[0].user_id,
            status: newChatResult.rows[0].status,
            lastMessageAt: newChatResult.rows[0].last_message_at,
            createdAt: newChatResult.rows[0].created_at
        };
    }

    async getChatHistory(pool: Pool | PoolClient, chatId: number): Promise<ChatMessage[]> {
        const result = await pool.query(
            `SELECT * FROM support_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
            [chatId]
        );

        return result.rows.map(row => ({
            id: row.id,
            chatId: row.chat_id,
            senderId: row.sender_id,
            role: row.role,
            content: row.content,
            createdAt: row.created_at
        }));
    }

    async addMessage(pool: Pool | PoolClient, chatId: number, role: 'user' | 'assistant' | 'admin', content: string, senderId?: number | null): Promise<ChatMessage> {
        const result = await pool.query(
            `INSERT INTO support_messages (chat_id, role, content, sender_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            [chatId, role, content, senderId || null]
        );

        await pool.query(
            `UPDATE support_chats SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [chatId]
        );

        return {
            id: result.rows[0].id,
            chatId: result.rows[0].chat_id,
            senderId: result.rows[0].sender_id,
            role: result.rows[0].role,
            content: result.rows[0].content,
            createdAt: result.rows[0].created_at
        };
    }

    async escalateToHuman(pool: Pool | PoolClient, chatId: number): Promise<void> {
        await pool.query(
            `UPDATE support_chats SET status = 'PENDING_HUMAN' WHERE id = $1`,
            [chatId]
        );
    }

    async processAiResponse(pool: Pool | PoolClient, chatId: number, userMessage: string): Promise<string> {
        const lowerMessage = userMessage.toLowerCase();

        // Lógica simples de palavras-chave para a IA
        let response = "";

        if (lowerMessage.includes('falar com atendente') || lowerMessage.includes('humano') || lowerMessage.includes('pessoa') || lowerMessage.includes('suporte direto')) {
            await this.escalateToHuman(pool, chatId);
            return "Entendido. Vou encaminhar sua conversa para um atendente humano. Por favor, aguarde um momento que logo alguém irá falar com você.";
        }

        if (lowerMessage.includes('cota') || lowerMessage.includes('aporte')) {
            response = "As cotas do Cred30 custam R$ 50,00 cada. Elas representam sua participação na cooperativa e geram excedentes operacionais baseados na produtividade da comunidade.";
        } else if (lowerMessage.includes('apoio') || lowerMessage.includes('empréstimo')) {
            response = "O apoio mútuo é um crédito baseado no seu score e nas suas cotas. A taxa de sustentabilidade é de 20% e você pode pagar em até 12 parcelas.";
        } else if (lowerMessage.includes('saque')) {
            response = "Os saques podem ser feitos via PIX do seu saldo disponível. Se você tiver cotas em valor igual ou superior ao saque, a taxa é Zero!";
        } else if (lowerMessage.includes('oi') || lowerMessage.includes('olá') || lowerMessage.includes('bom dia')) {
            response = "Olá! Sou o assistente virtual do Cred30. Como posso ajudar você hoje? Eu conheço sobre aportes, apoios, saques e funcionamento geral.";
        } else {
            response = "Ainda estou aprendendo sobre esse assunto específico. Para não te dar uma informação errada, gostaria de falar com um atendente humano? Se sim, clique no botão 'Falar com Atendente' acima ou digite 'humano' aqui embaixo.";
        }

        return response;
    }

    async getPendingHumanChats(pool: Pool | PoolClient): Promise<any[]> {
        const result = await pool.query(
            `SELECT c.*, u.name as user_name, u.email as user_email 
             FROM support_chats c
             JOIN users u ON c.user_id = u.id
             WHERE c.status IN ('PENDING_HUMAN', 'ACTIVE_HUMAN')
             ORDER BY c.last_message_at DESC`
        );
        return result.rows;
    }

    async respondAsAdmin(pool: Pool | PoolClient, chatId: number, adminId: number, content: string): Promise<ChatMessage> {
        // Mudar status para ACTIVE_HUMAN se estava PENDING
        await pool.query(
            `UPDATE support_chats SET status = 'ACTIVE_HUMAN' WHERE id = $1 AND status = 'PENDING_HUMAN'`,
            [chatId]
        );

        return this.addMessage(pool, chatId, 'admin', content, adminId);
    }
}

export const supportService = new SupportService();
