import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { QUOTA_SHARE_VALUE } from '../../../shared/constants/business.constants';
import { executeInTransaction } from '../../../domain/services/transaction.service';

// Schema de validação
const investmentSchema = z.object({
    assetName: z.string().min(2).max(100),
    assetType: z.enum(['STOCK', 'FII', 'BOND', 'ETF', 'OTHER']),
    quantity: z.number().positive().optional(),
    unitPrice: z.number().positive(),
    totalInvested: z.number().positive(),
    broker: z.string().optional(),
    notes: z.string().optional(),
    investedAt: z.string().optional()
});

export class AdminInvestmentsController {

    /**
     * Listar todos os investimentos (ativos e vendidos)
     */
    static async listInvestments(c: Context) {
        try {
            const pool = getDbPool(c);

            const activeResult = await pool.query(`
        SELECT * FROM investments WHERE status = 'ACTIVE' ORDER BY invested_at DESC
      `);

            const soldResult = await pool.query(`
        SELECT * FROM investments WHERE status = 'SOLD' ORDER BY sold_at DESC
      `);

            const configResult = await pool.query('SELECT * FROM system_config LIMIT 1');
            const config = configResult.rows[0] || {};

            const statsRes = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE') as quotas_count,
                    (SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_loaned
            `);
            const stats = statsRes.rows[0];

            // FÓRMULA FINAL JOSIAS: Liquidez Real = (Cotas × 42) - Empréstimos
            const activeQuotasCount = Number(stats.quotas_count || 0);
            const totalCapitalSocial = activeQuotasCount * QUOTA_SHARE_VALUE;
            const totalEmprestimos = Number(stats.total_loaned || 0);

            const realLiquidity = totalCapitalSocial - totalEmprestimos;

            const availableReserve = parseFloat(config.investment_reserve || 0);
            const totalInvested = activeResult.rows.reduce((acc: any, inv: any) => acc + parseFloat(inv.total_invested), 0);
            const totalCurrentValue = activeResult.rows.reduce((acc: any, inv: any) => acc + parseFloat(inv.current_value || inv.total_invested), 0);

            const activeDividends = activeResult.rows.reduce((acc: any, inv: any) => acc + parseFloat(inv.dividends_received || 0), 0);
            const soldDividends = soldResult.rows.reduce((acc: any, inv: any) => acc + parseFloat(inv.dividends_received || 0), 0);
            const totalDividends = activeDividends + soldDividends;

            return c.json({
                success: true,
                data: {
                    investments: activeResult.rows.map(inv => ({
                        id: inv.id,
                        assetName: inv.asset_name,
                        assetType: inv.asset_type,
                        quantity: parseFloat(inv.quantity) || 0,
                        unitPrice: parseFloat(inv.unit_price),
                        totalInvested: parseFloat(inv.total_invested),
                        currentValue: parseFloat(inv.current_value || inv.total_invested),
                        dividendsReceived: parseFloat(inv.dividends_received || 0),
                        broker: inv.broker,
                        notes: inv.notes,
                        investedAt: inv.invested_at,
                        status: inv.status,
                        profitLoss: parseFloat(inv.current_value || inv.total_invested) - parseFloat(inv.total_invested),
                        profitLossPercent: ((parseFloat(inv.current_value || inv.total_invested) / parseFloat(inv.total_invested)) - 1) * 100
                    })),
                    sold: soldResult.rows.map(inv => ({
                        id: inv.id,
                        assetName: inv.asset_name,
                        assetType: inv.asset_type,
                        quantity: parseFloat(inv.quantity) || 0,
                        unitPrice: parseFloat(inv.unit_price),
                        totalInvested: parseFloat(inv.total_invested),
                        saleValue: parseFloat(inv.sale_value),
                        soldAt: inv.sold_at,
                        dividendsReceived: parseFloat(inv.dividends_received || 0),
                        broker: inv.broker,
                        status: inv.status,
                        profitLoss: parseFloat(inv.sale_value) - parseFloat(inv.total_invested),
                        profitLossPercent: ((parseFloat(inv.sale_value) / parseFloat(inv.total_invested)) - 1) * 100
                    })),
                    summary: {
                        availableReserve,
                        realLiquidity,
                        totalInvested,
                        totalCurrentValue,
                        totalDividends,
                        totalProfitLoss: totalCurrentValue - totalInvested,
                        totalProfitLossPercent: totalInvested > 0 ? ((totalCurrentValue / totalInvested) - 1) * 100 : 0
                    }
                }
            });
        } catch (error: any) {
            console.error('[INVESTMENTS] Erro ao listar:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Registrar novo investimento
     */
    static async createInvestment(c: Context) {
        try {
            const body = await c.req.json();
            const data = investmentSchema.parse(body);
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client) => {
                const reserveResult = await client.query(
                    'SELECT COALESCE(investment_reserve, 0) as reserve FROM system_config LIMIT 1 FOR UPDATE'
                );
                const availableReserve = parseFloat(reserveResult.rows[0]?.reserve || 0);

                if (data.totalInvested > availableReserve) {
                    throw new Error(`Saldo insuficiente na reserva de investimentos. Disponível: R$ ${availableReserve.toFixed(2)}`);
                }

                await client.query(
                    'UPDATE system_config SET investment_reserve = investment_reserve - $1',
                    [data.totalInvested]
                );

                const invResult = await client.query(`
          INSERT INTO investments (asset_name, asset_type, quantity, unit_price, total_invested, current_value, broker, notes, invested_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `, [
                    data.assetName,
                    data.assetType,
                    data.quantity || 0,
                    data.unitPrice,
                    data.totalInvested,
                    data.totalInvested,
                    data.broker || null,
                    data.notes || null,
                    data.investedAt ? new Date(data.investedAt) : new Date()
                ]);

                return { investmentId: invResult.rows[0].id };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            return c.json({
                success: true,
                message: `Investimento em ${data.assetName} registrado com sucesso!`,
                data: { id: result.data?.investmentId }
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            }
            console.error('[INVESTMENTS] Erro ao criar:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Atualizar valor atual do investimento
     */
    static async updateInvestment(c: Context) {
        try {
            const id = c.req.param('id');
            const body = await c.req.json();
            const { currentValue, dividendsReceived } = body;
            const pool = getDbPool(c);

            const updates: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (currentValue !== undefined) {
                updates.push(`current_value = $${paramIndex++}`);
                values.push(currentValue);
            }

            if (dividendsReceived !== undefined) {
                updates.push(`dividends_received = $${paramIndex++}`);
                values.push(dividendsReceived);
            }

            if (updates.length === 0) {
                return c.json({ success: false, message: 'Nenhum campo para atualizar' }, 400);
            }

            updates.push(`updated_at = NOW()`);
            values.push(id);

            await pool.query(
                `UPDATE investments SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
                values
            );

            return c.json({ success: true, message: 'Investimento atualizado!' });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Registrar dividendos recebidos
     */
    static async receiveDividends(c: Context) {
        try {
            const id = c.req.param('id');
            const body = await c.req.json();
            const { amount, reinvest } = body;

            if (!amount || amount <= 0) {
                return c.json({ success: false, message: 'Valor do dividendo inválido' }, 400);
            }

            const pool = getDbPool(c);

            await executeInTransaction(pool, async (client) => {
                await client.query(
                    'UPDATE investments SET dividends_received = dividends_received + $1, updated_at = NOW() WHERE id = $2',
                    [amount, id]
                );

                if (reinvest) {
                    await client.query(
                        'UPDATE system_config SET investment_reserve = COALESCE(investment_reserve, 0) + $1',
                        [amount]
                    );
                } else {
                    await client.query(
                        'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                        [amount, amount * 0.5]
                    );
                }
            });

            return c.json({
                success: true,
                message: reinvest
                    ? `Dividendos de R$ ${amount.toFixed(2)} reinvestidos!`
                    : `Dividendos de R$ ${amount.toFixed(2)} creditados no sistema!`
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Vender/Liquidar investimento
     */
    static async sellInvestment(c: Context) {
        try {
            const id = c.req.param('id');
            const body = await c.req.json();
            const { saleValue } = body;

            if (!saleValue || saleValue <= 0) {
                return c.json({ success: false, message: 'Valor de venda inválido' }, 400);
            }

            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client) => {
                const invResult = await client.query('SELECT * FROM investments WHERE id = $1 FOR UPDATE', [id]);
                if (invResult.rows.length === 0) {
                    throw new Error('Investimento não encontrado');
                }

                const investment = invResult.rows[0];
                const totalInvested = parseFloat(investment.total_invested);
                const profitLoss = saleValue - totalInvested;

                await client.query(
                    'UPDATE system_config SET investment_reserve = COALESCE(investment_reserve, 0) + $1',
                    [saleValue]
                );

                await client.query(
                    'UPDATE investments SET status = $1, sale_value = $2, sold_at = NOW(), updated_at = NOW() WHERE id = $3',
                    ['SOLD', saleValue, id]
                );

                return { assetName: investment.asset_name, profitLoss };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            const msg = result.data!.profitLoss >= 0
                ? `${result.data!.assetName} vendido com lucro de R$ ${result.data!.profitLoss.toFixed(2)}!`
                : `${result.data!.assetName} vendido com prejuízo de R$ ${Math.abs(result.data!.profitLoss).toFixed(2)}.`;

            return c.json({ success: true, message: msg });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Aporte manual na reserva de investimentos
     */
    static async addReserve(c: Context) {
        try {
            const body = await c.req.json();
            const { amount } = body;

            if (!amount || amount <= 0) {
                return c.json({ success: false, message: 'Valor inválido para aporte' }, 400);
            }

            const pool = getDbPool(c);

            await pool.query(
                'UPDATE system_config SET investment_reserve = COALESCE(investment_reserve, 0) + $1, updated_at = NOW()',
                [amount]
            );

            return c.json({
                success: true,
                message: `Aporte de R$ ${amount.toFixed(2)} registrado com sucesso na reserva!`
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
