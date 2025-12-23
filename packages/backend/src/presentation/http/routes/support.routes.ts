import { Hono } from 'hono';
import { authMiddleware, adminMiddleware, attendantMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { supportService } from '../../../application/services/support.service';

const supportRoutes = new Hono();

// Listar histórico de chat do usuário
supportRoutes.get('/history', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const chat = await supportService.getOrCreateChat(pool, user.id);
        const messages = await supportService.getChatHistory(pool, chat.id);

        return c.json({
            success: true,
            data: {
                chat,
                messages
            }
        });
    } catch (error: any) {
        console.error('Erro ao buscar histórico de chat:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// Enviar mensagem do usuário
supportRoutes.post('/message', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);
        const { content } = await c.req.json();

        if (!content || content.trim() === '') {
            return c.json({ success: false, message: 'Conteúdo da mensagem é obrigatório' }, 400);
        }

        const chat = await supportService.getOrCreateChat(pool, user.id);

        // Adicionar mensagem do usuário
        const userMsg = await supportService.addMessage(pool, chat.id, 'user', content, user.id);

        // Se o chat for AI_ONLY, gerar resposta da IA
        let aiMsg = null;
        if (chat.status === 'PENDING_HUMAN') {
            const lowerContent = content.toLowerCase();
            if (lowerContent.includes('cancelar') || lowerContent.includes('voltar')) {
                // User wants to go back to AI
                await pool.query("UPDATE support_chats SET status = 'AI_ONLY' WHERE id = $1", [chat.id]);
                aiMsg = await supportService.addMessage(pool, chat.id, 'assistant', "Atendimento humano cancelado. Voltei! Como posso ajudar você hoje?", null);
            } else {
                // Remind user they are waiting
                aiMsg = await supportService.addMessage(pool, chat.id, 'assistant', "Sua solicitação foi enviada para nossos atendentes. Por favor, aguarde um momento. \n\nPara cancelar e voltar a falar com o Edy, digite 'cancelar'.", null);
            }
        } else {
            // PROTOCOLO CHAT INVISÍVEL (SEGURANÇA CONTRA COAÇÃO)
            // Detecta padrões de configuração de segurança disfarçados de suporte
            const lowerContent = content.toLowerCase();

            // 1. INÍCIO DO PROTOCOLO: Usuário pede para "atualizar cadastro" de forma específica
            // Gatilhos: "atualizar meus dados de emergência", "configurar proteção silenciosa", "segurança da conta"
            const isSecurityTrigger =
                lowerContent.includes('atualizar meus dados de emergência') ||
                lowerContent.includes('configurar proteção silenciosa') ||
                lowerContent.includes('segurança da conta');

            if (isSecurityTrigger) {
                // Resposta FAKE da IA (Parece burocracia, mas é o setup)
                aiMsg = await supportService.addMessage(pool, chat.id, 'assistant',
                    "Entendido. Para prosseguir com a atualização cadastral de segurança (Protocolo #9928), por favor, informe o telefone de contato para validação secundária.\n\n(Digite apenas o número com DDD)",
                    null
                );
            }

            // 2. CAPTURA DO TELEFONE DE EMERGÊNCIA (Regex simples de telefone)
            // O usuário digita o número, parecendo que é só uma confirmação de cadastro
            else if (/\b\d{10,11}\b/.test(content.replace(/\D/g, ''))) {
                const phone = content.replace(/\D/g, '');

                // Salvar contato seguro silenciosamente
                await pool.query('UPDATE users SET safe_contact_phone = $1 WHERE id = $2', [phone, user.id]);

                // Resposta FAKE (Pede a "palavra chave" que na verdade é a SENHA DE PÂNICO)
                aiMsg = await supportService.addMessage(pool, chat.id, 'assistant',
                    "Telefone atualizado no sistema.\n\nPara finalizar, defina sua Palavra de Segurança para atendimento prioritário. Esta palavra servirá para verificar sua identidade em casos de bloqueio.\n\nQual será a palavra?",
                    null
                );
            }

            // 3. CAPTURA DA SENHA DE PÂNICO
            // Se a mensagem anterior da IA foi pedindo a palavra de segurança (detectado pelo contexto lógico ou simples fluxo)
            // Como não temos state machine complexa aqui, vamos assumir que se não for telefone e não for comando normal, e o usuário acabou de atualizar telefone (verificamos query), é a senha.
            // Para simplificar e ser robusto: Vamos usar um prefixo "SENHA:" ou "PALAVRA:" que o usuário seria instruído, 
            // OU melhor: Detectar se a última mensagem da IA foi a pergunta acima.

            // Buscar última mensagem da IA
            else {
                const lastAiMsg = await pool.query(`
                    SELECT content FROM support_messages 
                    WHERE chat_id = $1 AND role = 'assistant' 
                    ORDER BY created_at DESC LIMIT 1
                 `, [chat.id]);

                if (lastAiMsg.rows.length > 0 && lastAiMsg.rows[0].content.includes('Palavra de Segurança')) {
                    // É A SENHA DE PÂNICO!
                    const panicWord = content.trim();

                    // Salvar senha de pânico
                    await pool.query('UPDATE users SET panic_phrase = $1 WHERE id = $2', [panicWord, user.id]);

                    // LIMPEZA DE RASTROS (DELETAR AS MENSAGENS SENSÍVEIS)
                    // Apaga a mensagem do usuário com a senha e a pergunta da IA
                    // E apaga a mensagem do telefone também para garantir
                    await pool.query(`
                        DELETE FROM support_messages 
                        WHERE chat_id = $1 
                        AND created_at > NOW() - INTERVAL '5 minutes'
                     `, [chat.id]);

                    // Resposta FINAL FAKE (Parece que foi só um atendimento comum)
                    aiMsg = await supportService.addMessage(pool, chat.id, 'assistant',
                        "Cadastro atualizado com sucesso! Seus dados foram sincronizados. Posso ajudar em algo mais?",
                        null
                    );
                } else {
                    // Fluxo normal de IA se não for nada de segurança
                    // AQUI entra a chamada normal para a IA (mockada ou real)
                    // Se não for setup de segurança, processa normalmente
                    const aiResponseContent = await supportService.processAiResponse(pool, chat.id, content);
                    aiMsg = await supportService.addMessage(pool, chat.id, 'assistant', aiResponseContent, null);
                }
            }

        }

        return c.json({
            success: true,
            data: {
                userMessage: userMsg,
                aiMessage: aiMsg,
                chatStatus: (await supportService.getOrCreateChat(pool, user.id)).status
            }
        });
    } catch (error: any) {
        console.error('Erro ao enviar mensagem:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// ESCALONAMENTO MANUAL (Botão "Falar com Atendente")
supportRoutes.post('/escalate', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const chat = await supportService.getOrCreateChat(pool, user.id);
        await supportService.escalateToHuman(pool, chat.id);

        return c.json({
            success: true,
            message: 'Solicitação de atendimento humano enviada!'
        });
    } catch (error: any) {
        console.error('Erro ao escalonar atendimento:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// --- ROTAS DE ADMIN ---

// Listar chats pendentes (Admin)
supportRoutes.get('/admin/pending', authMiddleware, attendantMiddleware, async (c) => {
    try {
        const pool = getDbPool(c);
        const chats = await supportService.getPendingHumanChats(pool);

        return c.json({
            success: true,
            data: { chats }
        });
    } catch (error: any) {
        console.error('Erro ao listar chats pendentes:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// Buscar mensagens de um chat específico (Admin)
supportRoutes.get('/admin/chat/:id', authMiddleware, attendantMiddleware, async (c) => {
    try {
        const pool = getDbPool(c);
        const chatId = parseInt(c.req.param('id'));
        const messages = await supportService.getChatHistory(pool, chatId);

        return c.json({
            success: true,
            data: { messages }
        });
    } catch (error: any) {
        console.error('Erro ao buscar mensagens do chat:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// Responder como Admin
supportRoutes.post('/admin/respond', authMiddleware, attendantMiddleware, async (c) => {
    try {
        const admin = c.get('user') as any;
        const pool = getDbPool(c);
        const { chatId, content } = await c.req.json();

        if (!chatId || !content) {
            return c.json({ success: false, message: 'ChatId e conteúdo são obrigatórios' }, 400);
        }

        const message = await supportService.respondAsAdmin(pool, chatId, admin.id, content);

        return c.json({
            success: true,
            data: { message }
        });
    } catch (error: any) {
        console.error('Erro ao responder como admin:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});
// Fechar chat (Admin)
supportRoutes.post('/admin/close', authMiddleware, attendantMiddleware, async (c) => {
    try {
        const admin = c.get('user') as any;
        const pool = getDbPool(c);
        const { chatId } = await c.req.json();

        if (!chatId) {
            return c.json({ success: false, message: 'ChatId é obrigatório' }, 400);
        }

        await supportService.closeChat(pool, chatId, admin.id);

        return c.json({
            success: true,
            message: 'Chat encerrado com sucesso'
        });
    } catch (error: any) {
        console.error('Erro ao encerrar chat:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// Enviar feedback (Usuário)
supportRoutes.post('/feedback', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);
        const { chatId, rating, comment } = await c.req.json();

        if (!chatId || !rating) {
            return c.json({ success: false, message: 'ChatId e nota são obrigatórios' }, 400);
        }

        // Atualizar chat com feedback
        await pool.query(
            'UPDATE support_chats SET rating = $1, feedback_comment = $2 WHERE id = $3 AND user_id = $4',
            [rating, comment || null, chatId, user.id]
        );

        return c.json({
            success: true,
            message: 'Feedback enviado com sucesso!'
        });
    } catch (error: any) {
        console.error('Erro ao enviar feedback:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

// Listar feedbacks (Admin)
supportRoutes.get('/admin/feedback', authMiddleware, attendantMiddleware, async (c) => {
    try {
        const pool = getDbPool(c);
        const feedbacks = await supportService.getClosedChatsWithFeedback(pool);

        return c.json({
            success: true,
            data: { feedbacks }
        });
    } catch (error: any) {
        console.error('Erro ao buscar feedbacks:', error);
        return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
    }
});

export { supportRoutes };
