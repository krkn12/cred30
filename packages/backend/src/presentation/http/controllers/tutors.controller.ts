import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';
import { UserContext } from '../../../shared/types/hono.types';
import {
    PLATFORM_FEE_TAX_SHARE,
    PLATFORM_FEE_OPERATIONAL_SHARE,
    PLATFORM_FEE_OWNER_SHARE,
    PLATFORM_FEE_INVESTMENT_SHARE
} from '../../../shared/constants/business.constants';

// Constantes de Partilha
const TUTOR_SHARE = 0.80; // 80% para o professor
const PLATFORM_SHARE = 0.20; // 20% para a plataforma

// Schemas
const registerTutorSchema = z.object({
    bio: z.string().min(10).max(1000),
    pricePerHour: z.number().min(10).max(1000),
    subjects: z.string().min(3)
});

const requestClassSchema = z.object({
    tutorId: z.number(),
    subject: z.string().min(3),
    message: z.string().optional(),
    scheduledAt: z.string().datetime(), // ISO Date
    durationHours: z.number().min(1).max(4).default(1)
});

export class TutorsController {

    /**
     * Registrar-se como Tutor
     */
    static async register(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const body = await c.req.json();
            const data = registerTutorSchema.parse(body);
            const pool = getDbPool(c);

            await pool.query(`
                UPDATE users SET 
                    is_tutor = TRUE,
                    tutor_bio = $1,
                    tutor_price_per_hour = $2,
                    tutor_subjects = $3
                WHERE id = $4
            `, [data.bio, data.pricePerHour, data.subjects, user.id]);

            return c.json({ success: true, message: 'Perfil de tutor ativado com sucesso!' });
        } catch (e: any) {
            if (e instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos', errors: e.errors }, 400);
            return c.json({ success: false, message: e.message }, 500);
        }
    }

    /**
     * Listar Tutores
     */
    static async listTutors(c: Context) {
        try {
            const pool = getDbPool(c);
            const user = c.get('user') as UserContext; // Para excluir o próprio usuário da lista

            const result = await pool.query(`
                SELECT id, name, avatar_url, tutor_bio, tutor_price_per_hour, tutor_subjects, tutor_rating, is_verified
                FROM users 
                WHERE is_tutor = TRUE AND id != $1
                ORDER BY tutor_rating DESC, is_verified DESC
                LIMIT 50
            `, [user.id]);

            return c.json({ success: true, data: result.rows });
        } catch (e: any) {
            return c.json({ success: false, message: e.message }, 500);
        }
    }

    /**
     * Solicitar Aula (Cria pendência)
     */
    static async requestClass(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const body = await c.req.json();
            const data = requestClassSchema.parse(body);
            const pool = getDbPool(c);

            // Buscar Tutor para pegar o preço atual
            const tutorRes = await pool.query('SELECT tutor_price_per_hour FROM users WHERE id = $1 AND is_tutor = TRUE', [data.tutorId]);
            if (tutorRes.rows.length === 0) return c.json({ success: false, message: 'Tutor não encontrado.' }, 404);

            const priceSnapshot = parseFloat(tutorRes.rows[0].tutor_price_per_hour) * data.durationHours;

            // Verificar conflito de horário (simples)
            const conflictRes = await pool.query(`
                SELECT id FROM tutor_requests 
                WHERE tutor_id = $1 AND status IN ('APPROVED', 'PAID') 
                AND scheduled_at = $2
            `, [data.tutorId, data.scheduledAt]);

            if (conflictRes.rows.length > 0) {
                return c.json({ success: false, message: 'Este horário já está ocupado.' }, 400);
            }

            const result = await pool.query(`
                INSERT INTO tutor_requests (student_id, tutor_id, status, scheduled_at, duration_hours, subject, message, price_snapshot)
                VALUES ($1, $2, 'PENDING', $3, $4, $5, $6, $7)
                RETURNING id
            `, [user.id, data.tutorId, data.scheduledAt, data.durationHours, data.subject, data.message || '', priceSnapshot]);

            return c.json({ success: true, message: 'Solicitação enviada! Aguarde a aprovação do professor.', requestId: result.rows[0].id });
        } catch (e: any) {
            if (e instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos', errors: e.errors }, 400);
            return c.json({ success: false, message: e.message }, 500);
        }
    }

    /**
     * Professor Responde (Aprova/Rejeita)
     */
    static async respondRequest(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const requestId = c.req.param('id');
            const { action, meetingLink } = await c.req.json(); // action: 'APPROVE' | 'REJECT'
            const pool = getDbPool(c);

            const requestRes = await pool.query('SELECT * FROM tutor_requests WHERE id = $1 AND tutor_id = $2', [requestId, user.id]);
            if (requestRes.rows.length === 0) return c.json({ success: false, message: 'Solicitação não encontrada.' }, 404);

            const request = requestRes.rows[0];
            if (request.status !== 'PENDING') return c.json({ success: false, message: 'Solicitação não está pendente.' }, 400);

            if (action === 'REJECT') {
                await pool.query("UPDATE tutor_requests SET status = 'REJECTED' WHERE id = $1", [requestId]);
                return c.json({ success: true, message: 'Solicitação rejeitada.' });
            }

            if (action === 'APPROVE') {
                await pool.query(
                    "UPDATE tutor_requests SET status = 'APPROVED', meeting_link = $1 WHERE id = $2",
                    [meetingLink || null, requestId]
                );
                return c.json({ success: true, message: 'Solicitação aprovada! O aluno já pode realizar o pagamento.' });
            }

            return c.json({ success: false, message: 'Ação inválida.' }, 400);
        } catch (e: any) {
            return c.json({ success: false, message: e.message }, 500);
        }
    }

    /**
     * Aluno Paga (Processa pagamento)
     */
    static async payClass(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const requestId = c.req.param('id');
            const pool = getDbPool(c);

            await executeInTransaction(pool, async (client) => {
                // Lock na solicitação e no saldo
                const reqRes = await client.query('SELECT * FROM tutor_requests WHERE id = $1 FOR UPDATE', [requestId]);
                if (reqRes.rows.length === 0) throw new Error('Solicitação não encontrada.');
                const request = reqRes.rows[0];

                if (request.student_id !== user.id) throw new Error('Acesso negado.');
                if (request.status !== 'APPROVED') throw new Error('Solicitação não está pronta para pagamento (Precisa ser APROVADA pelo professor).');

                const amount = parseFloat(request.price_snapshot);
                const userBalanceRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                const balance = parseFloat(userBalanceRes.rows[0].balance);

                if (balance < amount) throw new Error('Saldo insuficiente.');

                // 1. Debitar Aluno
                await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, user.id]);

                // 2. Creditar Professor (Já desconta taxa da plataforma)
                const tutorAmount = amount * TUTOR_SHARE;
                const platformAmount = amount * PLATFORM_SHARE;

                await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [tutorAmount, request.tutor_id]);

                // 3. Distribuir Taxa da Plataforma (Service Fee)
                await client.query(`
                    UPDATE system_config SET 
                        system_balance = system_balance + $1,
                        total_tax_reserve = total_tax_reserve + $2,
                        total_operational_reserve = total_operational_reserve + $3,
                        total_owner_profit = total_owner_profit + $4,
                        investment_reserve = investment_reserve + $5
                `, [
                    platformAmount, // Balance total increment
                    platformAmount * PLATFORM_FEE_TAX_SHARE,
                    platformAmount * PLATFORM_FEE_OPERATIONAL_SHARE,
                    platformAmount * PLATFORM_FEE_OWNER_SHARE,
                    platformAmount * PLATFORM_FEE_INVESTMENT_SHARE
                ]);

                // 4. Atualizar Status
                await client.query("UPDATE tutor_requests SET status = 'PAID' WHERE id = $1", [requestId]);

                // 5. Registrar Transações
                // Do Aluno
                await client.query(`
                    INSERT INTO transactions (user_id, type, amount, description, status)
                    VALUES ($1, 'SERVICE_PAYMENT', $2, $3, 'COMPLETED')
                `, [user.id, -amount, `Aula Particular: ${request.subject}`]);

                // Do Professor
                await client.query(`
                    INSERT INTO transactions (user_id, type, amount, description, status)
                    VALUES ($1, 'SERVICE_RECEIVED', $2, $3, 'COMPLETED')
                `, [request.tutor_id, tutorAmount, `Aula Ministrada: ${request.subject}`]);

            });

            return c.json({ success: true, message: 'Pagamento confirmado! Aula agendada com sucesso.' });
        } catch (e: any) {
            return c.json({ success: false, message: e.message }, 500);
        }
    }

    /**
     * Meus Agendamentos (Aluno)
     */
    static async listMyAppointments(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT tr.*, u.name as tutor_name, u.email as tutor_email, u.tutor_bio
                FROM tutor_requests tr
                JOIN users u ON tr.tutor_id = u.id
                WHERE tr.student_id = $1
                ORDER BY tr.scheduled_at DESC
            `, [user.id]);

            return c.json({ success: true, data: result.rows });
        } catch (e: any) {
            return c.json({ success: false, message: e.message }, 500);
        }
    }

    /**
     * Minhas Aulas (Professor)
     */
    static async listMyClasses(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT tr.*, u.name as student_name, u.email as student_email
                FROM tutor_requests tr
                JOIN users u ON tr.student_id = u.id
                WHERE tr.tutor_id = $1
                ORDER BY tr.status = 'PENDING' DESC, tr.scheduled_at DESC
            `, [user.id]);

            return c.json({ success: true, data: result.rows });
        } catch (e: any) {
            return c.json({ success: false, message: e.message }, 500);
        }
    }
}
