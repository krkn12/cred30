import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import {
  QUOTA_PRICE,
  QUOTA_SHARE_VALUE,
  QUOTA_ADM_FEE,
  PLATFORM_FEE_TAX_SHARE,
  PLATFORM_FEE_OPERATIONAL_SHARE,
  PLATFORM_FEE_OWNER_SHARE,
  PLATFORM_FEE_INVESTMENT_SHARE,
  PLATFORM_FEE_CORPORATE_SHARE,
  ONE_MONTH_MS,
  LOAN_GFC_FEE_RATE
} from '../../shared/constants/business.constants';
import { calculateGatewayCost } from '../../shared/utils/financial.utils';
import { updateScore, SCORE_REWARDS } from '../../application/services/score.service';
import { logAudit } from '../../application/services/audit.service';
import { notificationService } from '../../application/services/notification.service';
import { calculateUserLoanLimit } from '../../application/services/credit-analysis.service';

export interface TransactionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Executa uma operação dentro de uma transação database ACID
 */
export async function executeInTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>
): Promise<TransactionResult<T>> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await operation(client);

    await client.query('COMMIT');

    return {
      success: true,
      data: result
    };
  } catch (error: unknown) {
    await client.query('ROLLBACK');

    const logMessage = `\n[${new Date().toISOString()}] Erro na transação:\n${(error as any).stack || error}\n`;
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
      fs.appendFileSync(path.join(logDir, 'sql-error.log'), logMessage);
    } catch (logErr) {
      console.error('Falha ao escrever log de erro SQL:', logErr);
    }

    console.error('Erro na transação:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido na transação'
    };
  } finally {
    client.release();
  }
}

/**
 * Verifica e bloqueia saldo do usuário para operação
 */
export async function lockUserBalance(
  client: Pool | PoolClient,
  userId: string,
  amount: number,
  options?: { skipLockCheck?: boolean }
): Promise<{ success: boolean; currentBalance?: number; error?: string }> {
  try {
    const result = await client.query(
      'SELECT balance, security_lock_until FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    const userData = result.rows[0];
    const currentBalance = parseFloat(userData.balance);
    const lockUntil = userData.security_lock_until;

    // Trava de Segurança Global (Anti-Gasto de Saldo Suspeito / Lavagem Interna)
    if (lockUntil && new Date(lockUntil) > new Date()) {
      // Se a opção de pular a verificação de trava estiver ativa (ex: Compra de Cotas, Pagamento de Empréstimo)
      if (options?.skipLockCheck) {
        // Logar que a trava foi ignorada por ser uma operação permitida
        // console.log(`[SECURITY_BYPASS] Operação permitida durante trava de segurança para user ${userId}`);
      } else {
        return {
          success: false,
          error: `Seu saldo está sob proteção temporária e não pode ser usado no momento. Liberado em: ${new Date(lockUntil).toLocaleString('pt-BR')}`
        };
      }
    }

    if (currentBalance < amount) {
      return {
        success: false,
        currentBalance,
        error: `Saldo insuficiente. Saldo atual: R$ ${currentBalance.toFixed(2)}`
      };
    }

    return { success: true, currentBalance };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao verificar saldo'
    };
  }
}

/**
 * Bloqueia e retorna as configurações globais do sistema para atualização atômica
 */
export async function lockSystemConfig(client: Pool | PoolClient) {
  const result = await client.query('SELECT * FROM system_config FOR UPDATE');
  return result.rows[0];
}

export interface SystemReservesUpdate {
  tax?: number;
  operational?: number;
  owner?: number;
  mutual?: number;
  investment?: number;
  corporate?: number;
  gfc?: number;
  manualCosts?: number;
  profitPool?: number;
  systemBalance?: number;
}

/**
 * Incrementa as reservas do sistema de forma resiliente
 */
export async function incrementSystemReserves(
  client: Pool | PoolClient,
  updates: SystemReservesUpdate
) {
  const fields: string[] = [];
  const values: any[] = [];
  let pIndex = 1;

  if (updates.tax) { fields.push(`total_tax_reserve = total_tax_reserve + $${pIndex++}`); values.push(updates.tax); }
  if (updates.operational) { fields.push(`total_operational_reserve = total_operational_reserve + $${pIndex++}`); values.push(updates.operational); }
  if (updates.owner) { fields.push(`total_owner_profit = total_owner_profit + $${pIndex++}`); values.push(updates.owner); }
  if (updates.investment) { fields.push(`investment_reserve = COALESCE(investment_reserve, 0) + $${pIndex++}`); values.push(updates.investment); }
  if (updates.profitPool) { fields.push(`profit_pool = profit_pool + $${pIndex++}`); values.push(updates.profitPool); }
  if (updates.systemBalance) { fields.push(`system_balance = system_balance + $${pIndex++}`); values.push(updates.systemBalance); }
  if (updates.corporate) { fields.push(`total_corporate_investment_reserve = COALESCE(total_corporate_investment_reserve, 0) + $${pIndex++}`); values.push(updates.corporate); }
  if (updates.gfc) { fields.push(`credit_guarantee_fund = COALESCE(credit_guarantee_fund, 0) + $${pIndex++}`); values.push(updates.gfc); }
  if (updates.manualCosts) { fields.push(`total_manual_costs = COALESCE(total_manual_costs, 0) + $${pIndex++}`); values.push(updates.manualCosts); }

  if (updates.mutual) {
    // Detectar qual coluna de proteção mútua existe no banco atual
    const colCheck = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'system_config' AND column_name IN ('mutual_reserve', 'mutual_protection_fund')
      `);
    const columns = colCheck.rows.map(r => r.column_name);

    if (columns.includes('mutual_reserve')) {
      fields.push(`mutual_reserve = COALESCE(mutual_reserve, 0) + $${pIndex++}`);
      values.push(updates.mutual);
    } else if (columns.includes('mutual_protection_fund')) {
      fields.push(`mutual_protection_fund = COALESCE(mutual_protection_fund, 0) + $${pIndex++}`);
      values.push(updates.mutual);
    }
  }

  if (fields.length === 0) return;

  await client.query(`UPDATE system_config SET ${fields.join(', ')}`, values);
}

/**
 * Atualiza saldo do usuário de forma segura
 */
export async function updateUserBalance(
  client: Pool | PoolClient,
  userId: string,
  amount: number,
  operation: 'debit' | 'credit' = 'debit'
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const query = operation === 'debit'
      ? 'UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance'
      : 'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance';

    const result = await client.query(query, [amount, userId]);

    if (result.rows.length === 0) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    const newBalance = parseFloat(result.rows[0].balance);

    if (newBalance < 0) {
      throw new Error('Saldo negativo não permitido');
    }

    return { success: true, newBalance };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao atualizar saldo'
    };
  }
}

/**
 * Cria registro de transação com validação
 */
export async function createTransaction(
  client: Pool | PoolClient,
  userId: string,
  type: string,
  amount: number,
  description: string,
  status: string = 'PENDING',
  metadata?: any
): Promise<{ success: boolean; transactionId?: number; error?: string }> {
  try {
    // SECURITY ENFORCEMENT: Carteira Única (Single Entry/Exit)
    // Bloquear tentativas de pagamento externo direto para operações internas.
    // A única entrada de dinheiro permitida é via DEPOST (Depósito).
    const BALANCE_ONLY_TYPES = ['BUY_QUOTA', 'LOAN_PAYMENT', 'MARKET_PURCHASE', 'MARKET_BOOST', 'MEMBERSHIP_UPGRADE'];

    if (BALANCE_ONLY_TYPES.includes(type)) {
      // Se user não enviou metadata ou useBalance não é true
      if (!metadata || !metadata.useBalance) {
        return {
          success: false,
          error: 'Operação permitida apenas com Saldo Interno via App. Por favor, realize um depósito primeiro.'
        };
      }
    }

    const result = await client.query(
      `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [userId, type, amount, description, status, metadata ? JSON.stringify(metadata) : null]
    );

    return {
      success: true,
      transactionId: result.rows[0].id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar transação'
    };
  }
}

/**
 * Atualiza status de transação com validação de concorrência
 */
export async function updateTransactionStatus(
  client: Pool | PoolClient,
  transactionId: string | number,
  currentStatus: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await client.query(
      'UPDATE transactions SET status = $1 WHERE id = $2 AND status = $3',
      [newStatus, transactionId, currentStatus]
    );

    if (result.rowCount === 0) {
      return {
        success: false,
        error: 'Transação não encontrada ou já foi processada'
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao atualizar transação'
    };
  }
}

/**
 * Processa a aprovação ou rejeição de uma transação (BUY_QUOTA, WITHDRAWAL, etc)
 */
export const processTransactionApproval = async (client: PoolClient, id: string, action: 'APPROVE' | 'REJECT') => {
  console.log(`[DEBUG] processTransactionApproval CHAMADO! ID: ${id}, Action: ${action}`);
  // 1. Buscar transação com bloqueio (aceita PENDING ou PENDING_CONFIRMATION para saques)
  const transactionResult = await client.query(
    'SELECT * FROM transactions WHERE id = $1 AND status IN ($2, $3) FOR UPDATE',
    [id, 'PENDING', 'PENDING_CONFIRMATION']
  );

  if (transactionResult.rows.length === 0) {
    throw new Error('Transação não encontrada ou já processada');
  }

  const transaction = transactionResult.rows[0];

  if (action === 'REJECT') {
    // Saques não debitam saldo na solicitação (usam limite de crédito), 
    // portanto não há saldo para devolver nem caixa operacional para ajustar na rejeição.
    if (transaction.type === 'WITHDRAWAL') {
      // Devolver saldo ao usuário caso o saque seja rejeitado
      await updateUserBalance(client, transaction.user_id, Math.abs(parseFloat(transaction.amount)), 'credit');
      console.log(`[REJECT_WITHDRAWAL] R$ ${transaction.amount} devolvidos ao usuário ${transaction.user_id}`);
    }

    if (transaction.type === 'BUY_QUOTA') {
      const metadata = transaction.metadata || {};
      if (metadata.useBalance) {
        await updateUserBalance(client, transaction.user_id, parseFloat(transaction.amount), 'credit');
      }
    }

    if (transaction.type === 'LOAN_PAYMENT') {
      const metadata = transaction.metadata || {};
      if (metadata.useBalance && metadata.loanId) {
        await updateUserBalance(client, transaction.user_id, parseFloat(transaction.amount), 'credit');
        await client.query('UPDATE loans SET status = $1 WHERE id = $2', ['APPROVED', metadata.loanId]);
      }
    }

    const updateRes = await client.query(
      'UPDATE transactions SET status = $1, processed_at = $2 WHERE id = $3',
      ['REJECTED', new Date(), id]
    );

    if (updateRes.rowCount === 0) {
      console.error(`[DEBUG_DB] FALHA ao atualizar status para REJECTED para transação ${id}. Nenhuma linha afetada.`);
      throw new Error('Falha ao atualizar status da transação no banco de dados');
    }

    console.log(`[DEBUG_DB] Transação ${id} marcada como REJECTED com sucesso.`);

    // Audit Log
    await logAudit(client, {
      userId: transaction.user_id,
      action: 'TRANSACTION_REJECTED',
      entityType: 'transaction',
      entityId: id,
      oldValues: { status: transaction.status },
      newValues: { status: 'REJECTED' }
    });

    return { success: true, status: 'REJECTED' };
  }

  // APROVAÇÃO
  if (transaction.type === 'BUY_QUOTA') {
    let metadata: any = transaction.metadata || {};
    // Garantir que metadata seja objeto se for string
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    let qty = metadata.quantity || Math.floor(parseFloat(transaction.amount) / QUOTA_PRICE);
    if (qty <= 0) qty = 1;

    for (let i = 0; i < qty; i++) {
      await client.query(
        `INSERT INTO quotas (user_id, purchase_price, current_value, purchase_date, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [transaction.user_id, QUOTA_PRICE, QUOTA_SHARE_VALUE, new Date()]
      );
    }

    await updateScore(client, transaction.user_id, SCORE_REWARDS.QUOTA_PURCHASE * qty, `Compra de ${qty} cotas`);

    // --- PAGAMENTO DE BÔNUS DE INDICAÇÃO (R$ 5,00) ---
    // Apenas se for dinheiro novo (não useBalance), ou conforme regra de negócio global.
    // Como a transação foi aprovada e dinheiro entrou (ou saldo foi debitado), pagamos o bônus.

    // 1. Verificar se usuário tem indicador
    const userRes = await client.query('SELECT referred_by, name FROM users WHERE id = $1', [transaction.user_id]);
    const buyer = userRes.rows[0];

    if (buyer?.referred_by) {
      const referrerRes = await client.query('SELECT id FROM users WHERE referral_code = $1', [buyer.referred_by]);

      if (referrerRes.rows.length > 0) {
        const referrerId = referrerRes.rows[0].id;
        const bonusAmount = 5.00;
        // --- PAGAMENTO DE BÔNUS DE INDICAÇÃO (R$ 5,00) ---
        // REGRA: Só libera se tiver gerado lucros (profit_pool)
        const sysRes = await client.query('SELECT profit_pool FROM system_config LIMIT 1');
        const profitPool = parseFloat(sysRes.rows[0].profit_pool);

        if (profitPool >= bonusAmount) {
          // Creditar Bônus
          await updateUserBalance(client, referrerId, bonusAmount, 'credit');

          // Deduzir do Pool de Lucros (Bônus é pago com o lucro gerado)
          await client.query(
            'UPDATE system_config SET profit_pool = profit_pool - $1',
            [bonusAmount]
          );

          // Registrar Transação do Bônus
          await createTransaction(
            client,
            referrerId,
            'REFERRAL_BONUS',
            bonusAmount,
            `Bônus por indicação: ${buyer.name} comprou cota(s)`,
            'APPROVED'
          );
        } else {
          // Se não houver lucro no momento, o bônus fica registrado como PENDING (aguardando lucro)
          await createTransaction(
            client,
            referrerId,
            'REFERRAL_BONUS',
            bonusAmount,
            `Bônus por indicação: ${buyer.name} comprou cota(s) (AGUARDANDO RESULTADOS DO SISTEMA)`,
            'PENDING'
          );
        }
      }
    }

    if (!metadata.useBalance) {
      const paymentMethod = metadata.paymentMethod || 'pix';
      // Extrair o valor base (o que o sistema realmente quer receber)
      const serviceFee = metadata.serviceFee ? parseFloat(metadata.serviceFee) : 0;
      const baseCost = metadata.baseCost ? parseFloat(metadata.baseCost) : (parseFloat(transaction.amount) - (metadata.userFee ? parseFloat(metadata.userFee) : 0) - serviceFee);

      const gatewayCost = calculateGatewayCost(baseCost, paymentMethod);

      await client.query(
        'UPDATE transactions SET gateway_cost = $1 WHERE id = $2',
        [gatewayCost, transaction.id]
      );

      // Atualizar caixa do sistema
      // O gateway cost é subtraído conforme regra atual.

      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1 - $2, total_gateway_costs = total_gateway_costs + $2',
        [parseFloat(transaction.amount), gatewayCost]
      );

      // Distribuir a Taxa de Serviço e Principal
      const totalAdmFee = qty * QUOTA_ADM_FEE;
      const principalAmount = qty * QUOTA_SHARE_VALUE;

      const taxAmount = totalAdmFee * PLATFORM_FEE_TAX_SHARE;
      const operationalAmount = totalAdmFee * PLATFORM_FEE_OPERATIONAL_SHARE;
      const ownerAmount = totalAdmFee * PLATFORM_FEE_OWNER_SHARE;
      const growthAmount = totalAdmFee * PLATFORM_FEE_INVESTMENT_SHARE;
      const corporateAmount = totalAdmFee * PLATFORM_FEE_CORPORATE_SHARE;

      await incrementSystemReserves(client, {
        tax: taxAmount,
        operational: operationalAmount,
        owner: ownerAmount,
        mutual: growthAmount,
        corporate: corporateAmount,
        investment: principalAmount,
        systemBalance: parseFloat(transaction.amount) // Adiciona o valor bruto ao caixa
      });
    }
  }

  if (transaction.type === 'LOAN_PAYMENT') {
    let metadata: any = transaction.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    if (metadata.loanId) {
      const loanResult = await client.query('SELECT * FROM loans WHERE id = $1 FOR UPDATE', [metadata.loanId]);
      if (loanResult.rows.length > 0) {
        const loan = loanResult.rows[0];
        let gatewayCost = 0;

        if (!metadata.useBalance) {
          const paymentMethod = metadata.paymentMethod || 'pix';
          const baseAmount = metadata.baseAmount ? parseFloat(metadata.baseAmount) : parseFloat(transaction.amount);
          gatewayCost = calculateGatewayCost(baseAmount, paymentMethod);

          await client.query('UPDATE transactions SET gateway_cost = $1 WHERE id = $2', [gatewayCost, transaction.id]);
          await client.query('UPDATE system_config SET total_gateway_costs = total_gateway_costs + $1', [gatewayCost]);
        }

        // Usamos o valor líquido do pagamento (sem a taxa de gateway que o cliente pagou)
        const userFee = metadata.userFee ? parseFloat(metadata.userFee) : 0;
        const actualPaymentAmount = metadata.baseAmount ? parseFloat(metadata.baseAmount) : (parseFloat(transaction.amount) - userFee);
        const loanPrincipal = parseFloat(loan.amount);
        const loanTotal = parseFloat(loan.total_repayment);

        const principalPortion = actualPaymentAmount * (loanPrincipal / loanTotal);
        const interestPortion = actualPaymentAmount - principalPortion;

        // CORREÇÃO CRÍTICA (Fluxo de Caixa Contábil):
        // 1. O PRINCIPAL recebido deve voltar para a investment_reserve (de onde o empréstimo saiu).
        // 2. O JUROS recebido é LUCRO. Ele deve ser dividido:
        //    - 80% vai para o profit_pool (Para os usuários/dividendos).
        //    - 20% é retido como Taxa de Administração sobre o lucro (Para o sistema).

        const interestUserShare = interestPortion * 0.80; // 80% dos juros para usuários
        const interestSystemFee = interestPortion * 0.20; // 20% dos juros para o sistema

        // A. Se pagamento externo (PIX): O dinheiro entra agora no caixa
        if (!metadata.useBalance) {
          await client.query(
            'UPDATE system_config SET system_balance = system_balance + $1',
            [actualPaymentAmount]
          );
        }

        // B. Reabastecer a Reserva de Investimento com o Principal recuperado (Contabilidade)
        // Isso garante que o fundo de empréstimos seja "giratório" e sustentável
        await client.query(
          'UPDATE system_config SET investment_reserve = investment_reserve + $1',
          [principalPortion]
        );

        // C. Distribuir os Juros (Lucro)
        // C1. Parte dos Usuários
        await client.query(
          'UPDATE system_config SET profit_pool = profit_pool + $1',
          [interestUserShare]
        );

        // C2. Parte do Sistema (Taxa sobre o lucro do empréstimo)
        // Distribuída conforme regra 25/25/25/25
        if (interestSystemFee > 0) {
          await incrementSystemReserves(client, {
            tax: interestSystemFee * PLATFORM_FEE_TAX_SHARE,
            operational: interestSystemFee * PLATFORM_FEE_OPERATIONAL_SHARE,
            owner: interestSystemFee * PLATFORM_FEE_OWNER_SHARE,
            investment: interestSystemFee * PLATFORM_FEE_INVESTMENT_SHARE,
            corporate: interestSystemFee * PLATFORM_FEE_CORPORATE_SHARE
          });
        }

        console.log(`[LOAN_PAYMENT_DISTRIBUTION]
          Total Recebido: ${actualPaymentAmount.toFixed(2)}
          Principal Recuperado (InvestReserve): ${principalPortion.toFixed(2)}
          Lucro Total (Juros): ${interestPortion.toFixed(2)}
          -> Usuários (80%): ${interestUserShare.toFixed(2)}
          -> Taxa Adm (20%): ${interestSystemFee.toFixed(2)}`
        );

        const isInstallment = metadata.paymentType === 'installment' || metadata.isInstallment === true;
        const isFullPayment = metadata.paymentType === 'full_payment' || (!isInstallment && loan.status === 'PAYMENT_PENDING');

        if (isFullPayment) {
          // Registrar ou Atualizar a parcela no cronograma
          if (metadata.installmentId) {
            await client.query(
              'UPDATE loan_installments SET amount = $1, status = $2, use_balance = $3, paid_at = NOW() WHERE id = $4',
              [actualPaymentAmount, 'PAID', metadata.useBalance || false, metadata.installmentId]
            );
          } else {
            await client.query(
              'INSERT INTO loan_installments (loan_id, amount, use_balance, created_at, status, paid_at) VALUES ($1, $2, $3, $4, $5, NOW())',
              [metadata.loanId, actualPaymentAmount, metadata.useBalance || false, new Date(), 'PAID']
            );
          }
          await client.query('UPDATE loans SET status = $1 WHERE id = $2', ['PAID', metadata.loanId]);
          console.log(`[LOAN_PAYMENT] Empréstimo ${metadata.loanId} quitado integralmente. Registro de pagamento criado.`);
        } else if (isInstallment) {
          if (metadata.installmentId) {
            await client.query(
              'UPDATE loan_installments SET amount = $1, status = $2, use_balance = $3, paid_at = NOW() WHERE id = $4',
              [actualPaymentAmount, 'PAID', metadata.useBalance || false, metadata.installmentId]
            );
          } else {
            await client.query(
              'INSERT INTO loan_installments (loan_id, amount, use_balance, created_at, status, paid_at) VALUES ($1, $2, $3, $4, $5, NOW())',
              [metadata.loanId, actualPaymentAmount, metadata.useBalance || false, new Date(), 'PAID']
            );
          }

          // Amortização Real: Diminuir o saldo devedor total e o principal
          await client.query(
            'UPDATE loans SET total_repayment = total_repayment - $1, amount = amount - $2 WHERE id = $3',
            [actualPaymentAmount, principalPortion, metadata.loanId]
          );

          // Verificar se completou o pagamento
          const paidInstallmentsResult = await client.query(
            'SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as paid_amount FROM loan_installments WHERE loan_id = $1',
            [metadata.loanId]
          );
          const totalPaid = parseFloat(paidInstallmentsResult.rows[0].paid_amount);

          if (totalPaid >= loanTotal - 0.01) { // Margem para erro de arredondamento
            await client.query('UPDATE loans SET status = $1 WHERE id = $2', ['PAID', metadata.loanId]);
            console.log(`[LOAN_PAYMENT] Empréstimo ${metadata.loanId} quitado via parcelas.`);
          } else {
            // Garantir que o status volte para APPROVED se estava PENDING
            await client.query('UPDATE loans SET status = $1 WHERE id = $2', ['APPROVED', metadata.loanId]);
            console.log(`[LOAN_PAYMENT] Parcela de R$ ${actualPaymentAmount} registrada para Empréstimo ${metadata.loanId}.`);
          }
        }

        await updateScore(client, transaction.user_id, SCORE_REWARDS.LOAN_PAYMENT_ON_TIME, 'Pagamento de empréstimo');
      }
    }
  }

  // UPGRADE PRO
  if (transaction.type === 'MEMBERSHIP_UPGRADE') {
    // 1. Ativar Plano PRO para o usuário
    await client.query('UPDATE users SET membership_type = $1 WHERE id = $2', ['PRO', transaction.user_id]);

    // 2. Distribuir o valor (regra 25/25/25/25)
    const upgradeFee = Math.abs(parseFloat(transaction.amount));

    await incrementSystemReserves(client, {
      tax: upgradeFee * PLATFORM_FEE_TAX_SHARE,
      operational: upgradeFee * PLATFORM_FEE_OPERATIONAL_SHARE,
      owner: upgradeFee * PLATFORM_FEE_OWNER_SHARE,
      investment: upgradeFee * PLATFORM_FEE_INVESTMENT_SHARE,
      corporate: upgradeFee * PLATFORM_FEE_CORPORATE_SHARE
    });

    // Só aumenta o saldo do sistema se houver entrada real de dinheiro (não useBalance)
    if (transaction.metadata && !(typeof transaction.metadata === 'object' ? transaction.metadata : JSON.parse(transaction.metadata)).useBalance) {
      await client.query('UPDATE system_config SET system_balance = system_balance + $1', [upgradeFee]);
    }

    // 3. Bônus de Score por se tornar PRO
    await updateScore(client, transaction.user_id, 100, 'Upgrade para Plano Cred30 PRO');

    console.log(`[UPGRADE_PRO] Usuário ${transaction.user_id} agora é PRO via transação ${id}`);
  }

  // COMPRA NO MARKETPLACE
  if (transaction.type === 'MARKET_PURCHASE') {
    let metadata: any = transaction.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    if (metadata.orderId) {
      // 1. Atualizar status do pedido para 'Aguardando Envio'
      await client.query(
        "UPDATE marketplace_orders SET status = 'WAITING_SHIPPING', updated_at = NOW() WHERE id = $1",
        [metadata.orderId]
      );

      // 2. Se houver taxa de gateway externa (PIX/Cartão), contabilizar
      if (metadata.externalReference || metadata.gatewayId) {
        const paymentMethod = metadata.paymentMethod || 'pix';
        const baseAmount = parseFloat(transaction.amount);
        const gatewayCost = calculateGatewayCost(baseAmount, paymentMethod as any);

        await client.query(
          'UPDATE transactions SET gateway_cost = $1 WHERE id = $2',
          [gatewayCost, transaction.id]
        );

        await client.query(
          'UPDATE system_config SET system_balance = system_balance + $1 - $2, total_gateway_costs = total_gateway_costs + $2',
          [parseFloat(transaction.amount), gatewayCost]
        );
      }

      console.log(`[MARKET_PURCHASE] Pedido ${metadata.orderId} aprovado via transação ${id}`);
    }
  }

  // IMPULSIONAMENTO NO MARKETPLACE
  if (transaction.type === 'MARKET_BOOST') {
    let metadata: any = transaction.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    if (metadata.listingId) {
      // 1. Ativar o Boost no anúncio
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await client.query(
        'UPDATE marketplace_listings SET is_boosted = TRUE, boost_expires_at = $1 WHERE id = $2',
        [expiresAt, metadata.listingId]
      );

      // 2. Distribuir a taxa (85% para cotistas / 15% Operacional)
      // Se for pagamento externo, considerar o gateway fee
      const boostFee = Math.abs(parseFloat(transaction.amount));
      const gatewayCost = 0;

      /* Gateway externo removido - processamento interno apenas
      if (metadata.asaas_id || metadata.external_reference) { 
        const paymentMethod = metadata.paymentMethod || 'pix';
        gatewayCost = calculateGatewayCost(boostFee, paymentMethod as any);

        await client.query(
          'UPDATE transactions SET gateway_cost = $1 WHERE id = $2',
          [gatewayCost, transaction.id]
        );

        await client.query(
          'UPDATE system_config SET total_gateway_costs = total_gateway_costs + $1',
          [gatewayCost]
        );
      }
      */

      // Valor líquido para distribuição (depois do gateway cost)
      const netBoostFee = boostFee - gatewayCost;

      await incrementSystemReserves(client, {
        tax: netBoostFee * PLATFORM_FEE_TAX_SHARE,
        operational: netBoostFee * PLATFORM_FEE_OPERATIONAL_SHARE,
        owner: netBoostFee * PLATFORM_FEE_OWNER_SHARE,
        investment: netBoostFee * PLATFORM_FEE_INVESTMENT_SHARE,
        corporate: netBoostFee * PLATFORM_FEE_CORPORATE_SHARE
      });

      // Aumentar saldo do sistema apenas pelo valor bruto que entrou via gateway
      if (metadata.asaas_id || metadata.external_reference) {
        await client.query('UPDATE system_config SET system_balance = system_balance + $1', [boostFee]);
      }

      console.log(`[MARKET_BOOST] Anúncio ${metadata.listingId} impulsionado via transação ${id}`);
    }
  }

  // SAQUE (Dedução real do caixa operacional)
  if (transaction.type === 'WITHDRAWAL') {
    let metadata: any = transaction.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    const netAmount = parseFloat(metadata.netAmount || transaction.amount);
    const feeAmount = parseFloat(metadata.feeAmount || '0');

    // --- RE-VALIDAÇÃO DE LIQUIDEZ REAL (Somente Warning) ---
    // Não vamos bloquear a aprovação técnica da transação aqui, pois o usuário já teve o saldo debitado na solicitação.
    // Se não houver liquidez no caixa do banco (Asaas), o Admin verá isso na fila de pagamentos "PENDING_PAYMENT" e não conseguirá pagar.
    // Bloquear aqui causaria um estado inconsistente onde o usuário vê "Erro 500" mas o dinheiro já saiu da conta dele (Pending).

    const configRes = await client.query("SELECT system_balance, total_tax_reserve, total_operational_reserve, total_owner_profit FROM system_config LIMIT 1");
    const config = configRes.rows[0] || {};

    const totalReserves = (parseFloat(config.total_tax_reserve || '0')) +
      (parseFloat(config.total_operational_reserve || '0')) +
      (parseFloat(config.total_owner_profit || '0'));

    const realLiquidity = (parseFloat(config.system_balance || '0')) - totalReserves;

    // Apenas logar aviso se liquidez estiver baixa, mas prosseguir para criar o registro de pagamento pendente
    if (netAmount > realLiquidity) {
      console.warn(`[WARNING] Saque aprovado com liquidez apertada. Disponível: ${realLiquidity}, Solicitado: ${netAmount}`);
    }

    // 1. Subtrair o valor enviado (líquido) do saldo real do sistema
    // PIX Manual - sem custo de gateway externo
    const totalDeduction = netAmount;

    await client.query(
      'UPDATE system_config SET system_balance = system_balance - $1',
      [totalDeduction]
    );

    // 2. Se houver taxa cobrada do usuário (ex: R$ 2,00), aplicar a regra de divisão: 25/25/25/25
    if (feeAmount > 0) {
      await incrementSystemReserves(client, {
        tax: feeAmount * PLATFORM_FEE_TAX_SHARE,
        operational: feeAmount * PLATFORM_FEE_OPERATIONAL_SHARE,
        owner: feeAmount * PLATFORM_FEE_OWNER_SHARE,
        investment: feeAmount * PLATFORM_FEE_INVESTMENT_SHARE,
        corporate: feeAmount * PLATFORM_FEE_CORPORATE_SHARE
      });
    }

    // CORREÇÃO: O system_balance foi debitado pelo netAmount acima. 
    // A taxa (feeAmount) nunca saiu do caixa, então não precisamos adicioná-la de volta.
    // Ela já está no system_balance remanescente.
    console.log('DEBUG - Saque processado contabilmente (PIX Manual):', {
      netAmount,
      feeAmount,
      totalDeduction
    });
  }

  // DEPÓSITO (Crédito real no saldo do usuário)
  if (transaction.type === 'DEPOSIT') {
    const depositAmount = parseFloat(transaction.amount);
    let metadata: any = transaction.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    // 1. Creditar saldo no usuário
    await updateUserBalance(client, transaction.user_id, depositAmount, 'credit');

    // 2. Atualizar data do último depósito para controle de carência anti-fraude (72h)
    // A coluna last_deposit_at não existe no banco, verificação de segurança baseada em transactions aprovadas deve ser implementada no futuro.
    // await client.query('UPDATE users SET last_deposit_at = NOW() WHERE id = $1', [transaction.user_id]);

    // 3. Verificação de Divergência de Nome (Anti-Lavagem Interna)
    const userRes = await client.query('SELECT name FROM users WHERE id = $1', [transaction.user_id]);
    const userName = userRes.rows[0]?.name;
    const senderName = metadata.senderName;

    if (senderName && userName) {
      const normalizedSender = senderName.trim().toLowerCase();
      const normalizedOwner = userName.trim().toLowerCase();

      // Se o nome for diferente, aplicamos uma trava de gasto de 24h por segurança
      if (normalizedSender !== normalizedOwner) {
        const lockUntil = new Date();
        lockUntil.setHours(lockUntil.getHours() + 24);

        await client.query('UPDATE users SET security_lock_until = $1 WHERE id = $2', [lockUntil, transaction.user_id]);
        console.log(`[SECURITY] Divergência de nome detectada (${senderName} vs ${userName}). Saldo travado por 24h para o usuário ${transaction.user_id}`);

        await client.query(
          "UPDATE transactions SET metadata = metadata || $1::jsonb, description = description || ' [⚠️ NOME DIVERGENTE - TRAVA 24H APLICADA]' WHERE id = $2",
          [JSON.stringify({ name_mismatch: true, lock_applied: true }), transaction.id]
        );
      }
    }

    // 4. Adicionar ao saldo real do sistema
    await client.query(
      'UPDATE system_config SET system_balance = system_balance + $1',
      [depositAmount]
    );

    console.log(`[DEPOSIT_APPROVED] R$ ${depositAmount} creditados ao usuário ${transaction.user_id}`);
  }

  console.log(`[DEBUG_DB] Finalizando aprovação da transação ${id}. Atualizando status...`);

  const updateRes = await client.query(
    'UPDATE transactions SET status = $1, processed_at = $2, payout_status = $3 WHERE id = $4',
    ['APPROVED', new Date(), transaction.type === 'WITHDRAWAL' ? 'PENDING_PAYMENT' : 'NONE', id]
  );

  if (updateRes.rowCount === 0) {
    console.error(`[DEBUG_DB] FALHA ao atualizar status para APPROVED para transação ${id}. Nenhuma linha afetada.`);
    throw new Error('Falha ao aprovar transação no banco de dados: nenhuma linha afetada');
  }

  console.log(`[DEBUG_DB] Status atualizado no banco para APPROVED (ID: ${id})`);

  // Audit Log
  await logAudit(client, {
    userId: transaction.user_id,
    action: 'TRANSACTION_APPROVED',
    entityType: 'transaction',
    entityId: id,
    oldValues: { status: 'PENDING' },
    newValues: { status: 'APPROVED', type: transaction.type }
  });

  // Notificar usuário em tempo real
  notificationService.notifyUser(transaction.user_id, 'Status da Transação', `Sua transação de ${transaction.type} foi APROVADA!`);

  console.log(`[DEBUG] Transação ${id} aprovada com sucesso. Retornando.`);
  return { success: true, status: 'APPROVED' };
};

/**
 * Processa a aprovação ou rejeição de um empréstimo (LOAN)
 */
export const processLoanApproval = async (client: PoolClient, id: string, action: 'APPROVE' | 'REJECT') => {
  const loanResult = await client.query(
    'SELECT * FROM loans WHERE id = $1 AND status = $2 FOR UPDATE',
    [id, 'PENDING']
  );

  if (loanResult.rows.length === 0) {
    throw new Error('Empréstimo não encontrado ou já processado');
  }

  const loan = loanResult.rows[0];

  if (action === 'REJECT') {
    await client.query('UPDATE loans SET status = $1, approved_at = $2 WHERE id = $3', ['REJECTED', new Date(), id]);

    // Audit Log
    await logAudit(client, {
      userId: loan.user_id,
      action: 'LOAN_REJECTED',
      entityType: 'loan',
      entityId: id,
      oldValues: { status: 'PENDING' },
      newValues: { status: 'REJECTED' }
    });

    return { success: true, status: 'REJECTED' };
  }

  // --- RE-VALIDAÇÃO DE SEGURANÇA NA APROVAÇÃO ---
  // Recalcular limite e caixa disponível NO MOMENTO da aprovação
  const availableLimit = await calculateUserLoanLimit(client, loan.user_id);

  // Buscar dívidas ativas atuais (caso ele tenha pedido outro empréstimo nesse meio tempo)
  const activeLoansResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM loans 
     WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING') AND id != $2`,
    [loan.user_id, id]
  );
  const currentDebt = parseFloat(activeLoansResult.rows[0].total);
  const realAvailable = availableLimit - currentDebt;

  const metadata = loan.metadata || {};
  const guarantorId = metadata.guarantorId;

  // Se NÃO tiver fiador, respeita o limite individual. 
  // Se TIVER fiador, o limite é expandido (assumindo que o fiador cobre o risco).
  if (!guarantorId && parseFloat(loan.amount) > realAvailable) {
    throw new Error(`Aprovação bloqueada: Limite insuficiente no momento (Disponível: R$ ${realAvailable.toFixed(2)}).`);
  }

  // === CORREÇÃO: USAR DADOS PRÉ-CALCULADOS DO METADATA ===
  // metadata já foi declarado acima para verificação do fiador

  const netAmount = parseFloat(metadata.disbursedAmount || loan.amount); // Valor líquido a cair na conta
  const grossAmount = parseFloat(loan.amount);
  const originationFee = parseFloat(metadata.originationFee || 0);

  // === CORREÇÃO: VERIFICAR LIQUIDEZ REAL DO SISTEMA ===
  // O dinheiro SAI do caixa real no momento da aprovação.
  const configRes = await client.query('SELECT system_balance, total_tax_reserve, total_operational_reserve, total_owner_profit FROM system_config LIMIT 1 FOR UPDATE');
  const config = configRes.rows[0];

  const totalReserves = parseFloat(config.total_tax_reserve || '0') +
    parseFloat(config.total_operational_reserve || '0') +
    parseFloat(config.total_owner_profit || '0');

  const systemBalance = parseFloat(config.system_balance || '0');
  const availableLiquidity = systemBalance - totalReserves;

  if (netAmount > availableLiquidity) {
    throw new Error(`Liquidez insuficiente no sistema. Disponível: R$ ${availableLiquidity.toFixed(2)}, Solicitado: R$ ${netAmount.toFixed(2)}`);
  }

  // === DÉBITO REAL DO CAIXA (O dinheiro SAI agora) ===
  // O netAmount é o que o usuário vai receber. A originationFee já foi distribuída no requestLoan.
  // IMPORTANTE: NÃO subtrair da investment_reserve, pois a cota ainda "vale" esse dinheiro (recebível).
  await client.query(
    'UPDATE system_config SET system_balance = system_balance - $1',
    [netAmount]
  );

  // === CAPITALIZAÇÃO DO FGC (Fundo de Garantia de Crédito) ===
  // Creditamos o fundo com a taxa calculada no momento da solicitação (salva no metadata)
  const gfcFee = parseFloat(metadata.gfcFee || '0');
  if (gfcFee > 0) {
    await client.query(
      'UPDATE system_config SET credit_guarantee_fund = COALESCE(credit_guarantee_fund, 0) + $1',
      [gfcFee]
    );
    console.log(`[FGC] Fundo de Garantia de Crédito capitalizado com R$ ${gfcFee.toFixed(2)} para o empréstimo ${id}`);
  }

  // Creditar no saldo do usuário
  await updateUserBalance(client, loan.user_id, netAmount, 'credit');

  // Audit e Transação
  await client.query('UPDATE loans SET status = $1, approved_at = $2, payout_status = $3 WHERE id = $4', ['APPROVED', new Date(), 'NONE', id]);

  // === GERAÇÃO DO CRONOGRAMA DE PARCELAS ===
  const loanTotalRepayment = parseFloat(loan.total_repayment);
  const numInstallments = loan.installments;
  const standardInstallment = Math.floor((loanTotalRepayment / numInstallments) * 100) / 100;
  let remainingTotal = loanTotalRepayment;

  for (let i = 1; i <= numInstallments; i++) {
    const dueDate = new Date();
    dueDate.setTime(dueDate.getTime() + (i * ONE_MONTH_MS));

    const currentInstallmentAmount = (i === numInstallments)
      ? Math.round(remainingTotal * 100) / 100
      : standardInstallment;

    await client.query(
      `INSERT INTO loan_installments (loan_id, installment_number, amount, expected_amount, due_date, status, created_at)
       VALUES ($1, $2, $3, $3, $4, 'PENDING', NOW())`,
      [id, i, currentInstallmentAmount, dueDate]
    );

    remainingTotal -= currentInstallmentAmount;
  }
  console.log(`[LOAN_APPROVED] ${numInstallments} parcelas geradas para o empréstimo ${id} (Soma total garantida: R$ ${loanTotalRepayment.toFixed(2)})`);

  await createTransaction(
    client,
    loan.user_id,
    'LOAN_APPROVED',
    netAmount,
    `Apoio Mútuo Aprovado - Valor Líquido Creditado`,
    'APPROVED',
    {
      loanId: id,
      grossAmount,
      originationFee,
      netAmount,
      totalRepayment: parseFloat(loan.total_repayment),
      installments: loan.installments,
      creditedToBalance: true
    }
  );

  // Audit Log
  await logAudit(client, {
    userId: loan.user_id,
    action: 'LOAN_APPROVED',
    entityType: 'loan',
    entityId: id,
    oldValues: { status: 'PENDING' },
    newValues: { status: 'APPROVED', amount: loan.amount }
  });

  // Notificar usuário
  notificationService.notifyUser(loan.user_id, 'Empréstimo Aprovado', `Seu empréstimo de R$ ${parseFloat(loan.amount).toFixed(2)} foi aprovado e creditado!`);

  return { success: true, status: 'APPROVED' };
};