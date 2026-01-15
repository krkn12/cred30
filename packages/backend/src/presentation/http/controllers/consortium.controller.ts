
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
                SELECT cg.*, 
                       (SELECT COUNT(*)::int FROM consortium_members cm WHERE cm.group_id = cg.id) as member_count
                FROM consortium_groups cg
                WHERE cg.status IN ('OPEN', 'ACTIVE') 
                ORDER BY cg.created_at DESC
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

                // 5. Calcula taxa administrativa e valor líquido para o pool
                const adminFeePercent = Number(group.admin_fee_percent || 10);
                const adminFee = entryCost * (adminFeePercent / 100);
                const poolContribution = entryCost - adminFee;

                // 6. Debita do usuário
                await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [entryCost, user.id]);

                // 7. Acumula no pool do grupo (valor líquido)
                await client.query(`
                    UPDATE consortium_groups 
                    SET current_pool = COALESCE(current_pool, 0) + $1 
                    WHERE id = $2
                `, [poolContribution, groupId]);

                // 8. Taxa administrativa vai para o fundo mútuo da plataforma
                await client.query(`
                    UPDATE system_config 
                    SET mutual_fund_balance = COALESCE(mutual_fund_balance, 0) + $1 
                    WHERE id = 1
                `, [adminFee]);

                // 9. Registra transação de saída (Débito do usuário)
                await client.query(`
                    INSERT INTO transactions (user_id, type, amount, description, status, created_at)
                    VALUES ($1, 'CONSORTIUM_ENTRY', $2, $3, 'APPROVED', NOW())
                `, [user.id, -entryCost, `Entrada Consórcio: ${group.name} (Cota ${nextQuota})`]);

                // 10. Registra receita da taxa admin
                await client.query(`
                    INSERT INTO transactions (user_id, type, amount, description, status, created_at)
                    VALUES ($1, 'CONSORTIUM_ADMIN_FEE', $2, $3, 'APPROVED', NOW())
                `, [user.id, adminFee, `Taxa Admin Consórcio: ${group.name}`]);

                // 11. Próximo vencimento = 30 dias a partir de hoje
                const nextDueDate = new Date();
                nextDueDate.setDate(nextDueDate.getDate() + 30);

                // 12. Insere membro com tracking de pagamentos
                await client.query(`
                    INSERT INTO consortium_members (group_id, user_id, quota_number, status, paid_installments, total_paid, next_due_date)
                    VALUES ($1, $2, $3, 'ACTIVE', 1, $4, $5)
                `, [groupId, user.id, nextQuota, entryCost, nextDueDate.toISOString().split('T')[0]]);

                return { success: true, message: `Bem-vindo ao grupo! Sua cota é #${nextQuota}. Pool: R$${poolContribution.toFixed(2)} | Taxa: R$${adminFee.toFixed(2)}` };
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

    // --- PAGAMENTOS MENSAIS ---

    static async payInstallment(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const { memberId } = await c.req.json();
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // 1. Validar Membro e Grupo
                const memberRes = await client.query(`
                    SELECT cm.*, cg.name as group_name, cg.monthly_installment_value, cg.admin_fee_percent, cg.id as group_id
                    FROM consortium_members cm
                    JOIN consortium_groups cg ON cm.group_id = cg.id
                    WHERE cm.id = $1 AND cm.user_id = $2
                `, [memberId, user.id]);

                if (memberRes.rows.length === 0) throw new Error('Membro não encontrado.');
                const member = memberRes.rows[0];

                // 2. Verificar Saldo
                const installmentValue = Number(member.monthly_installment_value);
                const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                if (Number(userRes.rows[0].balance) < installmentValue) {
                    throw new Error('Saldo insuficiente para pagar a parcela.');
                }

                // 3. Calcular Taxa Admin e Pool
                const adminFeePercent = Number(member.admin_fee_percent || 10);
                const adminFee = installmentValue * (adminFeePercent / 100);
                const poolContribution = installmentValue - adminFee;

                // 4. Executar Débito e Créditos
                await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [installmentValue, user.id]);

                await client.query(`
                    UPDATE consortium_groups 
                    SET current_pool = COALESCE(current_pool, 0) + $1 
                    WHERE id = $2
                `, [poolContribution, member.group_id]);

                await client.query(`
                    UPDATE system_config 
                    SET mutual_fund_balance = COALESCE(mutual_fund_balance, 0) + $1 
                    WHERE id = 1
                `, [adminFee]);

                // 5. Atualizar Membro
                const nextDueDate = new Date(member.next_due_date || new Date());
                nextDueDate.setMonth(nextDueDate.getMonth() + 1);

                await client.query(`
                    UPDATE consortium_members 
                    SET paid_installments = paid_installments + 1,
                        total_paid = COALESCE(total_paid, 0) + $1,
                        next_due_date = $2
                    WHERE id = $3
                `, [installmentValue, nextDueDate.toISOString().split('T')[0], memberId]);

                // 6. Registrar Transações
                await client.query(`
                    INSERT INTO transactions (user_id, type, amount, description, status, created_at)
                    VALUES ($1, 'CONSORTIUM_INSTALLMENT', $2, $3, 'APPROVED', NOW())
                `, [user.id, -installmentValue, `Parcela Consórcio: ${member.group_name} (${member.paid_installments + 1}ª)`]);

                return { success: true, message: 'Parcela paga com sucesso!' };
            });

            return c.json(result.data || { success: false, message: result.error });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 400);
        }
    }

    // --- ADMIN: GERENCIAMENTO DE ASSEMBLEIAS ---

    static async createAssembly(c: Context) {
        try {
            const { groupId, monthYear } = await c.req.json();
            const pool = getDbPool(c);

            const groupRes = await pool.query('SELECT current_assembly_number FROM consortium_groups WHERE id = $1', [groupId]);
            if (groupRes.rows.length === 0) return c.json({ success: false, message: 'Grupo não encontrado.' }, 404);

            const nextNumber = (groupRes.rows[0].current_assembly_number || 0) + 1;

            const assemblyRes = await pool.query(`
                INSERT INTO consortium_assemblies (group_id, assembly_number, month_year, status)
                VALUES ($1, $2, $3, 'OPEN_FOR_BIDS')
                RETURNING id
            `, [groupId, nextNumber, monthYear]);

            await pool.query('UPDATE consortium_groups SET current_assembly_number = $1 WHERE id = $2', [nextNumber, groupId]);

            return c.json({ success: true, assemblyId: assemblyRes.rows[0].id });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    static async closeAssembly(c: Context) {
        try {
            const { assemblyId, winnerMemberId, winningBidAmount } = await c.req.json();
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // 1. Buscar Assembleia
                const assemblyRes = await client.query('SELECT * FROM consortium_assemblies WHERE id = $1', [assemblyId]);
                if (assemblyRes.rows.length === 0) throw new Error('Assembleia não encontrada.');
                const assembly = assemblyRes.rows[0];

                // 2. Buscar Grupo
                const groupRes = await client.query('SELECT * FROM consortium_groups WHERE id = $1', [assembly.group_id]);
                const group = groupRes.rows[0];

                // 3. Se houver vencedor, processar contemplação
                if (winnerMemberId) {
                    const memberRes = await client.query('SELECT * FROM consortium_members WHERE id = $1', [winnerMemberId]);
                    const member = memberRes.rows[0];

                    // Transfere o valor da carta de crédito (total_value)
                    const creditValue = Number(group.total_value);

                    await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [creditValue, member.user_id]);

                    await client.query(`
                        INSERT INTO transactions (user_id, type, amount, description, status, created_at)
                        VALUES ($1, 'CONSORTIUM_CONTEMPLATION', $2, $3, 'APPROVED', NOW())
                    `, [member.user_id, creditValue, `Contemplação Consórcio: ${group.name}`]);

                    await client.query(`
                        UPDATE consortium_members 
                        SET status = 'CONTEMPLATED', contemplated_at = NOW()
                        WHERE id = $1
                    `, [winnerMemberId]);

                    // Desconta o lance do pool se for o caso, ou apenas registra
                    if (winningBidAmount) {
                        await client.query(`
                            UPDATE consortium_bids SET status = 'WINNER' 
                            WHERE assembly_id = $1 AND member_id = $2
                        `, [assemblyId, winnerMemberId]);
                    }
                }

                // 4. Fechar Assembleia
                await client.query(`
                    UPDATE consortium_assemblies 
                    SET status = 'FINISHED', 
                        winner_member_id = $1, 
                        winning_bid_amount = $2,
                        finished_at = NOW()
                    WHERE id = $3
                `, [winnerMemberId, winningBidAmount, assemblyId]);

                return { success: true };
            });

            return c.json(result.data || { success: false, message: result.error });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    static async listMembers(c: Context) {
        try {
            const groupId = c.req.param('groupId');
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT cm.*, u.name as user_name, u.email as user_email
                FROM consortium_members cm
                JOIN users u ON cm.user_id = u.id
                WHERE cm.group_id = $1
                ORDER BY cm.quota_number ASC
            `, [groupId]);

            return c.json({ success: true, data: result.rows });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
