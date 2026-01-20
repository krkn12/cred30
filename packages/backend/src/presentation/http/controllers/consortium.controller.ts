
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

            const {
                name, totalValue, durationMonths, adminFeePercent,
                startDate, reserveFeePercent, fixedBidPercent,
                maxEmbeddedBidPercent, minMembersToStart,
                annualAdjustmentPercent
            } = await c.req.json();
            const pool = getDbPool(c);

            // Geração Automática do Identificador (Ex: GRP-001)
            const countRes = await pool.query('SELECT COUNT(*) as total FROM consortium_groups');
            const nextNum = (parseInt(countRes.rows[0].total) + 1).toString().padStart(3, '0');
            const groupIdentifier = `GRP-${nextNum}`;

            // Calcula parcela: (Valor + Taxa + Reserva) / Prazo
            // Nota: O fundo de reserva é calculado sobre o valor da carta
            const adminFee = Number(totalValue) * (Number(adminFeePercent) / 100);
            const reserveFee = Number(totalValue) * (Number(reserveFeePercent || 1) / 100);
            const installmentValue = (Number(totalValue) + adminFee + reserveFee) / Number(durationMonths);

            const result = await pool.query(
                `INSERT INTO consortium_groups 
                (name, total_value, duration_months, admin_fee_percent, monthly_installment_value, 
                 start_date, status, reserve_fee_percent, fixed_bid_percent, 
                 max_embedded_bid_percent, min_members_to_start, group_identifier, annual_adjustment_percent)
                VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', $7, $8, $9, $10, $11, $12)
                RETURNING *`,
                [
                    name, totalValue, durationMonths, adminFeePercent, installmentValue,
                    startDate, reserveFeePercent || 1, fixedBidPercent || 30,
                    maxEmbeddedBidPercent || 30, minMembersToStart || 10,
                    groupIdentifier, annualAdjustmentPercent || 0
                ]
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
                WHERE cg.status IN ('OPEN', 'ACTIVE', 'COMPLETED') 
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
                SELECT cm.*, cg.name as group_name, cg.total_value, cg.monthly_installment_value, 
                       cg.status as group_status, cg.current_assembly_number, cg.current_pool,
                       (SELECT u.name FROM consortium_assemblies ca 
                        JOIN consortium_members win_cm ON ca.winner_member_id = win_cm.id
                        JOIN users u ON win_cm.user_id = u.id
                        WHERE ca.group_id = cg.id AND ca.status = 'FINISHED'
                        ORDER BY ca.assembly_number DESC LIMIT 1) as last_winner_name
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

                // Divisão da taxa: 80% para cotistas (profit_pool), 20% para o projeto (owner_profit)
                const cotistasShare = adminFee * 0.8;
                const platformShare = adminFee * 0.2;

                // 6. Debita do usuário
                await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [entryCost, user.id]);

                // 7. Acumula no pool do grupo (valor líquido + reserva)
                await client.query(`
                    UPDATE consortium_groups 
                    SET current_pool = COALESCE(current_pool, 0) + $1,
                        current_pool_available = COALESCE(current_pool_available, 0) + $1
                    WHERE id = $2
                `, [poolContribution, groupId]);

                // 8. Taxas divididas entre cotistas e plataforma
                await client.query(`
                    UPDATE system_config 
                    SET profit_pool = COALESCE(profit_pool, 0) + $1,
                        total_owner_profit = COALESCE(total_owner_profit, 0) + $2
                    WHERE id = 1
                `, [cotistasShare, platformShare]);

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
                    SET current_pool = COALESCE(current_pool, 0) + $1,
                        current_pool_available = COALESCE(current_pool_available, 0) + $1
                    WHERE id = $2
                `, [poolContribution, member.group_id]);

                // Divisão da taxa: 80% para cotistas (profit_pool), 20% para o projeto (owner_profit)
                const cotistasShare = adminFee * 0.8;
                const platformShare = adminFee * 0.2;

                await client.query(`
                    UPDATE system_config 
                    SET profit_pool = COALESCE(profit_pool, 0) + $1,
                        total_owner_profit = COALESCE(total_owner_profit, 0) + $2
                    WHERE id = 1
                `, [cotistasShare, platformShare]);

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
                    const totalCredit = Number(group.total_value);
                    const bidAmount = Number(winningBidAmount || 0);

                    // Se for lance embutido, precisamos saber o quanto foi descontado
                    // No momento simplificado, assumimos que se bids.is_embedded estiver true, descontamos do crédito
                    const bidRes = await client.query('SELECT * FROM consortium_bids WHERE assembly_id = $1 AND member_id = $2', [assemblyId, winnerMemberId]);
                    const bid = bidRes.rows[0];

                    let finalCreditValue = totalCredit;
                    if (bid && bid.is_embedded) {
                        finalCreditValue = totalCredit - Number(bid.embedded_amount || 0);
                    }

                    // BLOQUEIO DE SEGURANÇA: Não libera o saldo na conta do usuário ainda
                    // O crédito agora precisa de aprovação manual da garantia no Admin
                    /* 
                    await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [finalCreditValue, member.user_id]);
                    */

                    // Apenas atualiza o status do crédito para PENDING
                    await client.query(`
                        UPDATE consortium_members 
                        SET status = 'CONTEMPLATED', 
                            contemplated_at = NOW(),
                            credit_status = 'PENDING'
                        WHERE id = $1
                    `, [winnerMemberId]);

                    // Deduz o prêmio do saldo disponível do grupo (reserva o valor)
                    await client.query(`
                        UPDATE consortium_groups 
                        SET current_pool_available = current_pool_available - $1
                        WHERE id = $2
                    `, [totalCredit, group.id]);

                    await client.query(`
                        INSERT INTO transactions (user_id, type, amount, description, status, created_at)
                        VALUES ($1, 'CONSORTIUM_CONTEMPLATION', $2, $3, 'PENDING', NOW())
                    `, [member.user_id, finalCreditValue, `Crédito Consórcio: ${group.name}${bid?.is_embedded ? ' (Lance Embutido)' : ''} - Aguardando Garantia`]);

                    if (bid) {
                        await client.query(`
                            UPDATE consortium_bids SET status = 'WINNER' 
                            WHERE id = $1
                        `, [bid.id]);
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

    static async approveCredit(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            if (!user.isAdmin) return c.json({ success: false, message: 'Acesso negado.' }, 403);

            const { memberId, guaranteeDescription } = await c.req.json();
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // 1. Validar Membro e se foi Contemplado
                const memberRes = await client.query('SELECT * FROM consortium_members WHERE id = $1 FOR UPDATE', [memberId]);
                if (memberRes.rows.length === 0) throw new Error('Membro não encontrado.');
                const member = memberRes.rows[0];

                if (member.status !== 'CONTEMPLATED') throw new Error('Este membro ainda não foi contemplado.');
                if (member.credit_status === 'APPROVED') throw new Error('Crédito já foi liberado.');

                // 2. Buscar o valor do crédito (considerando lance embutido)
                const groupRes = await client.query('SELECT total_value FROM consortium_groups WHERE id = $1', [member.group_id]);
                const group = groupRes.rows[0];

                const bidRes = await client.query('SELECT * FROM consortium_bids WHERE member_id = $1 AND status = \'WINNER\'', [memberId]);
                const bid = bidRes.rows[0];

                let finalCreditValue = Number(group.total_value);
                if (bid && bid.is_embedded) {
                    finalCreditValue -= Number(bid.embedded_amount || 0);
                }

                // 3. Liberar o saldo na conta e aprovar status
                await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [finalCreditValue, member.user_id]);
                await client.query(`
                    UPDATE consortium_members 
                    SET credit_status = 'APPROVED', 
                        guarantee_description = $1,
                        credit_limit_released = $2
                    WHERE id = $3
                `, [guaranteeDescription, finalCreditValue, memberId]);

                // 4. Atualizar transação de pendente para aprovado
                await client.query(`
                    UPDATE transactions 
                    SET status = 'APPROVED', 
                        description = description || ' (Garantia Aprovada)' 
                    WHERE user_id = $1 AND type = 'CONSORTIUM_CONTEMPLATION' AND status = 'PENDING'
                `, [member.user_id]);

                return { success: true, message: 'Crédito liberado com sucesso após validação de garantia.' };
            });

            return c.json(result.success ? result : { success: false, message: result.error });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    static async addMemberDocument(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const { memberId, documentType, documentUrl } = await c.req.json();
            const pool = getDbPool(c);

            // Se for usuário comum, só pode enviar para si mesmo
            if (!user.isAdmin) {
                const memberCheck = await pool.query('SELECT id FROM consortium_members WHERE id = $1 AND user_id = $2', [memberId, user.id]);
                if (memberCheck.rows.length === 0) return c.json({ success: false, message: 'Não autorizado' }, 403);
            }

            await pool.query(`
                INSERT INTO consortium_member_documents (member_id, document_type, document_url, status)
                VALUES ($1, $2, $3, 'PENDING')
            `, [memberId, documentType, documentUrl]);

            return c.json({ success: true, message: 'Documento enviado para análise.' });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    static async getPerformanceStats(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            if (!user.isAdmin) return c.json({ success: false, message: 'Acesso negado.' }, 403);

            const pool = getDbPool(c);

            // 1. Total arrecadado em todos os pools
            const poolRes = await pool.query('SELECT SUM(current_pool) as total_pool, SUM(current_pool_available) as total_available FROM consortium_groups');

            // 2. Lucro da plataforma (config)
            const statsRes = await pool.query('SELECT total_owner_profit, profit_pool FROM system_config WHERE id = 1');

            // 3. Contagens
            const countsRes = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM consortium_groups) as total_groups,
                    (SELECT COUNT(*) FROM consortium_members) as total_members,
                    (SELECT COUNT(*) FROM consortium_members WHERE status = 'CONTEMPLATED') as total_contemplated
            `);

            return c.json({
                success: true,
                data: {
                    totalPool: Number(poolRes.rows[0].total_pool || 0),
                    totalAvailable: Number(poolRes.rows[0].total_available || 0),
                    ownerProfit: Number(statsRes.rows[0].total_owner_profit || 0),
                    investorsProfit: Number(statsRes.rows[0].profit_pool || 0),
                    totalGroups: Number(countsRes.rows[0].total_groups || 0),
                    totalMembers: Number(countsRes.rows[0].total_members || 0),
                    totalContemplated: Number(countsRes.rows[0].total_contemplated || 0)
                }
            });
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

    // --- INTERAÇÃO COM ASSEMBLEIAS ---

    static async getActiveAssembly(c: Context) {
        try {
            const groupId = c.req.param('groupId');
            const pool = getDbPool(c);

            // Pega a assembleia atual ou a última para o grupo
            const result = await pool.query(`
                SELECT ca.*, cg.name as group_name, cg.total_value, cg.current_pool
                FROM consortium_assemblies ca
                JOIN consortium_groups cg ON ca.group_id = cg.id
                WHERE ca.group_id = $1
                ORDER BY ca.assembly_number DESC
                LIMIT 1
            `, [groupId]);

            if (result.rows.length === 0) return c.json({ success: true, data: null });

            const assembly = result.rows[0];

            // Buscar lances
            const bidsRes = await pool.query(`
                SELECT cb.*, u.name as user_name,
                       (SELECT COUNT(*) FROM consortium_votes cv WHERE cv.target_bid_id = cb.id AND cv.vote = true) as votes_yes,
                       (SELECT COUNT(*) FROM consortium_votes cv WHERE cv.target_bid_id = cb.id AND cv.vote = false) as votes_no
                FROM consortium_bids cb
                JOIN consortium_members cm ON cb.member_id = cm.id
                JOIN users u ON cm.user_id = u.id
                WHERE cb.assembly_id = $1
                ORDER BY cb.amount DESC
            `, [assembly.id]);

            return c.json({
                success: true,
                data: {
                    ...assembly,
                    bids: bidsRes.rows
                }
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    static async getAssembly(c: Context) {
        try {
            const assemblyId = c.req.param('id');
            const pool = getDbPool(c);

            const assemblyRes = await pool.query(`
                SELECT ca.*, cg.name as group_name, cg.total_value, cg.current_pool
                FROM consortium_assemblies ca
                JOIN consortium_groups cg ON ca.group_id = cg.id
                WHERE ca.id = $1
            `, [assemblyId]);

            if (assemblyRes.rows.length === 0) return c.json({ success: false, message: 'Assembleia não encontrada' }, 404);
            const assembly = assemblyRes.rows[0];

            const bidsRes = await pool.query(`
                SELECT cb.*, u.name as user_name,
                       (SELECT COUNT(*) FROM consortium_votes cv WHERE cv.target_bid_id = cb.id AND cv.vote = true) as votes_yes,
                       (SELECT COUNT(*) FROM consortium_votes cv WHERE cv.target_bid_id = cb.id AND cv.vote = false) as votes_no
                FROM consortium_bids cb
                JOIN consortium_members cm ON cb.member_id = cm.id
                JOIN users u ON cm.user_id = u.id
                WHERE cb.assembly_id = $1
                ORDER BY cb.amount DESC
            `, [assemblyId]);

            return c.json({
                success: true,
                data: {
                    ...assembly,
                    bids: bidsRes.rows
                }
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    static async placeBid(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const { assemblyId, memberId, amount, bidType, isEmbedded, embeddedAmount } = await c.req.json();
            const pool = getDbPool(c);

            // Validar se o membro pertence ao usuário
            const memberCheck = await pool.query('SELECT id FROM consortium_members WHERE id = $1 AND user_id = $2', [memberId, user.id]);
            if (memberCheck.rows.length === 0) return c.json({ success: false, message: 'Membro inválido ou não autorizado' }, 403);

            // Verificar se a assembleia está aberta para lances
            const assemblyRes = await pool.query('SELECT status FROM consortium_assemblies WHERE id = $1', [assemblyId]);
            if (assemblyRes.rows.length === 0) return c.json({ success: false, message: 'Assembleia não encontrada' }, 404);
            if (assemblyRes.rows[0].status !== 'OPEN_FOR_BIDS') return c.json({ success: false, message: 'Assembleia não aceita lances no momento.' }, 400);

            // Se não for embutido, verificar saldo
            if (!isEmbedded) {
                const userBal = await pool.query('SELECT balance FROM users WHERE id = $1', [user.id]);
                if (Number(userBal.rows[0].balance) < Number(amount)) {
                    return c.json({ success: false, message: 'Saldo insuficiente para ofertar este lance.' }, 400);
                }
            }

            await pool.query(`
                INSERT INTO consortium_bids (assembly_id, member_id, amount, status, bid_type, is_embedded, embedded_amount)
                VALUES ($1, $2, $3, 'PENDING', $4, $5, $6)
                ON CONFLICT (assembly_id, member_id) DO UPDATE SET 
                    amount = $3, 
                    bid_type = $4, 
                    is_embedded = $5, 
                    embedded_amount = $6
            `, [assemblyId, memberId, amount, bidType || 'FREE', isEmbedded || false, embeddedAmount || 0]);

            return c.json({ success: true, message: 'Lance registrado com sucesso!' });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    static async withdraw(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const { memberId } = await c.req.json();
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // 1. Validar Membro
                const memberRes = await client.query(`
                    SELECT * FROM consortium_members WHERE id = $1 AND user_id = $2 FOR UPDATE
                `, [memberId, user.id]);

                if (memberRes.rows.length === 0) throw new Error('Membro não encontrado.');
                const member = memberRes.rows[0];

                if (member.status === 'CONTEMPLATED') throw new Error('Cotas contempladas não podem ser canceladas desta forma.');
                if (member.status === 'WITHDRAWN') throw new Error('Esta cota já foi cancelada.');

                // 2. Calcular Multa e Reembolso
                const totalPaidToPool = Number(member.total_paid || 0);
                const penaltyAmount = totalPaidToPool * 0.20; // 20% de multa
                const refundAmount = totalPaidToPool - penaltyAmount;

                // 3. Registrar Retirada
                await client.query(`
                    INSERT INTO consortium_withdrawals (member_id, total_paid_to_pool, penalty_amount, refund_amount_due, status)
                    VALUES ($1, $2, $3, $4, 'PENDING')
                `, [memberId, totalPaidToPool, penaltyAmount, refundAmount]);

                // 4. Atualizar Membro
                await client.query(`UPDATE consortium_members SET status = 'WITHDRAWN' WHERE id = $1`, [memberId]);

                // 5. O valor da multa vai para o lucro da plataforma (ou fundo de reserva conforme regra)
                // Aqui vamos colocar como plataforma para o Josias ver o lucro
                await client.query(`
                    UPDATE system_config SET total_owner_profit = total_owner_profit + $1 WHERE id = 1
                `, [penaltyAmount]);

                return {
                    success: true,
                    message: `Cancelamento realizado. Reembolso pendente de R$ ${refundAmount.toFixed(2)} (Multa de R$ ${penaltyAmount.toFixed(2)} aplicada).`
                };
            });

            return c.json(result.data || { success: false, message: result.error });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    static async voteOnBid(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const { bidId, vote } = await c.req.json();
            const pool = getDbPool(c);

            // Pegar assembly_id através do bid
            const bidRes = await pool.query('SELECT assembly_id FROM consortium_bids WHERE id = $1', [bidId]);
            if (bidRes.rows.length === 0) return c.json({ success: false, message: 'Lance não encontrado' }, 404);
            const assemblyId = bidRes.rows[0].assembly_id;

            // Verificar se a assembleia está em fase de votação (ou permitindo votos)
            // No modelo simplificado, permitimos votar enquanto aberta

            await pool.query(`
                INSERT INTO consortium_votes (assembly_id, voter_id, target_bid_id, vote)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (assembly_id, voter_id, target_bid_id) DO UPDATE SET vote = $4
            `, [assemblyId, user.id, bidId, vote]);

            return c.json({ success: true, message: 'Voto registrado!' });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    // --- REAJUSTE ANUAL ---

    static async adjustAnnualValue(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            if (!user.isAdmin) return c.json({ success: false, message: 'Acesso negado.' }, 403);

            const { groupId, adjustmentPercent, customNewValue } = await c.req.json();
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // 1. Buscar grupo
                const groupRes = await client.query('SELECT * FROM consortium_groups WHERE id = $1 FOR UPDATE', [groupId]);
                if (groupRes.rows.length === 0) throw new Error('Grupo não encontrado.');
                const group = groupRes.rows[0];

                const oldTotalValue = Number(group.total_value);
                let newTotalValue = oldTotalValue;

                if (customNewValue) {
                    newTotalValue = Number(customNewValue);
                } else if (adjustmentPercent) {
                    newTotalValue = oldTotalValue * (1 + (Number(adjustmentPercent) / 100));
                } else {
                    const groupAdjPercent = Number(group.annual_adjustment_percent || 0);
                    if (groupAdjPercent === 0) throw new Error('Nenhuma porcentagem de reajuste definida para este grupo.');
                    newTotalValue = oldTotalValue * (1 + (groupAdjPercent / 100));
                }

                const finalPercent = ((newTotalValue / oldTotalValue) - 1) * 100;

                // 2. Recalcular Parcela: (Novo Valor + Taxas) / Prazo Total
                // Mantemos as taxas originais do grupo
                const adminFee = newTotalValue * (Number(group.admin_fee_percent) / 100);
                const reserveFee = newTotalValue * (Number(group.reserve_fee_percent || 1) / 100);
                const newInstallmentValue = (newTotalValue + adminFee + reserveFee) / Number(group.duration_months);

                // 3. Atualizar Grupo
                await client.query(`
                    UPDATE consortium_groups 
                    SET total_value = $1, 
                        monthly_installment_value = $2,
                        updated_at = NOW()
                    WHERE id = $3
                `, [newTotalValue, newInstallmentValue, groupId]);

                // 4. Registrar Histórico
                await client.query(`
                    INSERT INTO consortium_adjustment_history (group_id, old_value, new_value, adjustment_percent)
                    VALUES ($1, $2, $3, $4)
                `, [groupId, oldTotalValue, newTotalValue, finalPercent]);

                return {
                    success: true,
                    message: `Reajuste aplicado! Valor: R$${newTotalValue.toFixed(2)} | Parcela: R$${newInstallmentValue.toFixed(2)}`
                };
            });

            return c.json(result.data || { success: false, message: result.error });

        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
