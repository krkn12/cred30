/**
 * Serviço de Verificação de Liquidez
 * Garante que o sistema tenha dinheiro suficiente para operações de saída
 */

import { Pool, PoolClient } from 'pg';

export interface LiquidityCheck {
    isLiquid: boolean;
    availableLiquidity: number;
    requestedAmount: number;
    message?: string;
}

/**
 * Verifica se há liquidez suficiente para uma operação de saída de capital
 * (resgate de cota ou saque)
 */
export async function checkLiquidity(
    client: Pool | PoolClient,
    requestedAmount: number
): Promise<LiquidityCheck> {
    // Buscar estado atual do sistema
    const configResult = await client.query(`
    SELECT 
      system_balance,
      profit_pool,
      COALESCE(total_tax_reserve, 0) + 
      COALESCE(total_operational_reserve, 0) + 
      COALESCE(total_owner_profit, 0) + 
      COALESCE(investment_reserve, 0) as total_reserves
    FROM system_config 
    LIMIT 1
  `);

    if (configResult.rows.length === 0) {
        return {
            isLiquid: false,
            availableLiquidity: 0,
            requestedAmount,
            message: 'Configuração do sistema não encontrada'
        };
    }

    const config = configResult.rows[0];
    const systemBalance = parseFloat(config.system_balance || '0');
    const profitPool = parseFloat(config.profit_pool || '0');
    const reserves = parseFloat(config.total_reserves || '0');

    // Buscar total de saldos dos usuários (dívidas do sistema)
    const userBalancesResult = await client.query(
        'SELECT COALESCE(SUM(balance), 0) as total FROM users'
    );
    const totalUserBalances = parseFloat(userBalancesResult.rows[0].total || '0');

    // Buscar total de cotas ativas (capital social - também é dívida potencial)
    const quotasResult = await client.query(
        "SELECT COALESCE(SUM(current_value), 0) as total FROM quotas WHERE status = 'ACTIVE'"
    );
    const totalQuotas = parseFloat(quotasResult.rows[0].total || '0');

    // Buscar empréstimos ativos (dinheiro que vai retornar)
    const loansResult = await client.query(
        "SELECT COALESCE(SUM(total_repayment - COALESCE((SELECT SUM(li.amount) FROM loan_installments li WHERE li.loan_id = loans.id), 0)), 0) as pending FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')"
    );
    const pendingLoanRepayments = parseFloat(loansResult.rows[0].pending || '0');

    // Cálculo de liquidez disponível
    // O caixa bruto menos: reservas, profit_pool (que será distribuído), e um buffer de segurança
    const safetyBuffer = systemBalance * 0.10; // 10% de buffer de segurança
    const availableLiquidity = systemBalance - reserves - profitPool - safetyBuffer;

    // Verificar se a operação é segura
    const isLiquid = availableLiquidity >= requestedAmount;

    console.log(`[LIQUIDITY_CHECK] Requested: R$ ${requestedAmount.toFixed(2)}, Available: R$ ${availableLiquidity.toFixed(2)}, Is Liquid: ${isLiquid}`);
    console.log(`[LIQUIDITY_CHECK] System Balance: R$ ${systemBalance.toFixed(2)}, Reserves: R$ ${reserves.toFixed(2)}, User Balances: R$ ${totalUserBalances.toFixed(2)}, Quotas: R$ ${totalQuotas.toFixed(2)}, Pending Loans: R$ ${pendingLoanRepayments.toFixed(2)}`);

    return {
        isLiquid,
        availableLiquidity: Math.max(0, availableLiquidity),
        requestedAmount,
        message: isLiquid
            ? undefined
            : `Liquidez temporariamente insuficiente. Disponível: R$ ${availableLiquidity.toFixed(2)}. Tente um valor menor ou aguarde novos aportes.`
    };
}

/**
 * Verifica liquidez e lança erro se insuficiente
 */
export async function requireLiquidity(
    client: Pool | PoolClient,
    requestedAmount: number
): Promise<void> {
    const check = await checkLiquidity(client, requestedAmount);

    if (!check.isLiquid) {
        throw new Error(check.message || 'Liquidez insuficiente');
    }
}
