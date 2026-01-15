
import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction } from '../../../domain/services/transaction.service';
import { PoolClient } from 'pg';
import { UserContext } from '../../../shared/types/hono.types';

export class ConsortiumController {

    // --- GRUPOS (Admin) ---

    static async createGroup(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            if (!user.isAdmin) return c.json({ success: false, message: 'Acesso negado.' }, 403);

            const { name, totalValue, durationMonths, adminFeePercent, startDate } = await c.req.json();
            const pool = getDbPool(c);

            // Calcula parcela: (Valor + Taxa) / Prazo
            const totalWithFee = Number(totalValue) * (1 + (Number(adminFeePercent) / 100));
            const installmentValue = totalWithFee / Number(durationMonths);

            const result = await pool.query(
                `INSERT INTO consortium_groups 
                (name, total_value, duration_months, admin_fee_percent, monthly_installment_value, start_date, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
                RETURNING *`,
                [name, totalValue, durationMonths, adminFeePercent, installmentValue, startDate]
            );

            return c.json({ success: true, group: result.rows[0] });

        } catch (error: any) {
            console.error('Erro ao criar grupo:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    // --- GRUPOS (Leitura) ---

    static async listGroups(c: Context) {
        try {
            const pool = getDbPool(c);
            const result = await pool.query(`
                SELECT * FROM consortium_groups 
                WHERE status IN ('OPEN', 'ACTIVE') 
                ORDER BY created_at DESC
            `);
            return c.json({ success: true, data: result.rows });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    static async myConsortiums(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT cm.*, cg.name as group_name, cg.total_value, cg.monthly_installment_value, cg.status as group_status,
                       cg.current_assembly_number
                FROM consortium_members cm
                JOIN consortium_groups cg ON cm.group_id = cg.id
                WHERE cm.user_id = $1
            `, [user.id]);

            return c.json({ success: true, data: result.rows });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    // --- AÇÕES DO USUÁRIO ---

    static async joinGroup(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const { groupId } = await c.req.json();
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // 1. Verifica Grupo e Status
                const groupRes = await client.query('SELECT * FROM consortium_groups WHERE id = $1 FOR UPDATE', [groupId]);
                if (groupRes.rows.length === 0) throw new Error('Grupo não encontrado.');
                const group = groupRes.rows[0];

                if (group.status !== 'OPEN') throw new Error('Este grupo não aceita mais adesões.');

                // 2. Verifica se já está no grupo
                const existing = await client.query(
                    'SELECT id FROM consortium_members WHERE group_id = $1 AND user_id = $2',
                    [groupId, user.id]
                );
                if (existing.rows.length > 0) throw new Error('Você já participa deste grupo.');

                // 3. Verifica Saldo para 1ª Parcela (Entrada)
                const entryCost = Number(group.monthly_installment_value);
                const userBal = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);

                if (Number(userBal.rows[0].balance) < entryCost) {
                    throw new Error(`Saldo insuficiente. A entrada custa R$ ${entryCost.toFixed(2)}.`);
                }

                // 4. Determina número da cota (Sequencial)
                const quotaRes = await client.query('SELECT COUNT(*) as total FROM consortium_members WHERE group_id = $1', [groupId]);
                const nextQuota = Number(quotaRes.rows[0].total) + 1;

                // 5. Executa Pagamento e Adesão
                await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [entryCost, user.id]);

                // Registra transação de saída (Débito)
                await client.query(`
                    INSERT INTO transactions (id, user_id, type, amount, description, status, created_at)
                    VALUES (gen_random_uuid(), $1, 'CONSORTIUM_ENTRY', $2, $3, 'APPROVED', NOW())
                `, [user.id, -entryCost, `Entrada Consórcio: ${group.name} (Cota ${nextQuota})`]);

                await client.query(`
                    INSERT INTO consortium_members (group_id, user_id, quota_number, status)
                    VALUES ($1, $2, $3, 'ACTIVE')
                `, [groupId, user.id, nextQuota]);

                return { success: true, message: `Bem-vindo ao grupo! Sua cota é #${nextQuota}.` };
            });

            if (result.success) {
                return c.json(result.data);
            } else {
                return c.json({ success: false, message: result.error }, 400);
            }

        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 400);
        }
    }

    // --- ASSEMBLEIA & LANCES ---

    static async getAssembly(c: Context) {
        try {
            const groupId = c.req.param('groupId');
            const pool = getDbPool(c);

            // Pega a assembleia atual ou a última
            const result = await pool.query(`
                SELECT ca.*, 
                       (SELECT json_agg(json_build_object('amount', cb.amount, 'status', cb.status, 'member_quota', cm.quota_number)) 
                        FROM consortium_bids cb 
                        JOIN consortium_members cm ON cb.member_id = cm.id
                        WHERE cb.assembly_id = ca.id) as bids
                FROM consortium_assemblies ca
                WHERE ca.group_id = $1
                ORDER BY ca.assembly_number DESC
                LIMIT 1
            `, [groupId]);

            if (result.rows.length === 0) {
                return c.json({ success: true, assembly: null, message: 'Nenhuma assembleia ativa.' });
            }

            return c.json({ success: true, assembly: result.rows[0] });

        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    static async placeBid(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const { assemblyId, amount } = await c.req.json();
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // 1. Validar Assembleia
                const assemblyRes = await client.query('SELECT * FROM consortium_assemblies WHERE id = $1', [assemblyId]);
                if (assemblyRes.rows.length === 0) throw new Error('Assembleia não encontrada.');
                const assembly = assemblyRes.rows[0];

                if (assembly.status !== 'OPEN_FOR_BIDS') throw new Error('A fase de lances está fechada.');

                // 2. Validar Membro
                const memberRes = await client.query(
                    'SELECT * FROM consortium_members WHERE group_id = $1 AND user_id = $2',
                    [assembly.group_id, user.id]
                );
                if (memberRes.rows.length === 0) throw new Error('Você não faz parte deste grupo.');
                const member = memberRes.rows[0];

                if (member.status !== 'ACTIVE') throw new Error('Apenas membros ativos podem dar lances.');

                // 3. Validar Score (Anti-Default Rule)
                // Assumindo que o score está na tabela users. Se não, precisaria de join.
                const userRes = await client.query('SELECT score, balance FROM users WHERE id = $1', [user.id]);
                if (userRes.rows[0].score < 300) {
                    throw new Error('Score insuficiente. Mínimo de 300 pontos para dar lances.');
                }
                if (parseFloat(userRes.rows[0].balance) < Number(amount)) {
                    throw new Error('Você precisa ter o valor do lance em saldo para garantir a oferta.');
                }

                // 4. Registrar Lance
                // Verifica se já deu lance
                const existingBid = await client.query(
                    'SELECT id FROM consortium_bids WHERE assembly_id = $1 AND member_id = $2',
                    [assemblyId, member.id]
                );

                if (existingBid.rows.length > 0) {
                    await client.query(
                        'UPDATE consortium_bids SET amount = $1 WHERE id = $2',
                        [amount, existingBid.rows[0].id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO consortium_bids (assembly_id, member_id, amount, status)
                         VALUES ($1, $2, $3, 'PENDING')`,
                        [assemblyId, member.id, amount]
                    );
                }

                return { success: true, message: 'Lance registrado com sucesso!' };
            });

            if (result.success) {
                return c.json(result.data);
            } else {
                return c.json({ success: false, message: result.error }, 400);
            }

        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 400);
        }
    }

    static async voteOnBid(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const { assemblyId, bidId, vote } = await c.req.json(); // vote: true (Sim) or false (Não)
            const pool = getDbPool(c);

            await pool.query(
                `INSERT INTO consortium_votes (assembly_id, voter_id, target_bid_id, vote)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (assembly_id, voter_id, target_bid_id) 
                 DO UPDATE SET vote = EXCLUDED.vote`,
                [assemblyId, user.id, bidId, vote]
            );

            return c.json({ success: true, message: 'Voto registrado.' });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
