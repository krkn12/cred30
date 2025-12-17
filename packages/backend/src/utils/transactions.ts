import { Pool, PoolClient } from 'pg';

// Interface para resultado de operações
export interface TransactionResult {
  success: boolean;
  error?: string;
  data?: any;
}

// Interface para parâmetros de transação
export interface CreateTransactionParams {
  userId: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  metadata?: any;
}

// Executar operações dentro de uma transação
export async function executeInTransaction(
  pool: Pool, 
  callback: (client: PoolClient) => Promise<any>
): Promise<TransactionResult> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    
    return { success: true, data: result };
  } catch (error) {
    await client.query('ROLLBACK');
    
    console.error('Erro na transação:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  } finally {
    client.release();
  }
}

// Atualizar saldo do usuário
export async function updateUserBalance(
  client: PoolClient,
  userId: string,
  amount: number,
  operation: 'credit' | 'debit'
): Promise<void> {
  const query = operation === 'credit' 
    ? 'UPDATE users SET balance = balance + $1 WHERE id = $2'
    : 'UPDATE users SET balance = balance - $1 WHERE id = $2';
  
  await client.query(query, [amount, userId]);
}

// Criar transação
export async function createTransaction(
  client: PoolClient,
  userId: string,
  type: string,
  amount: number,
  description: string,
  status: string,
  metadata?: any
): Promise<void> {
  await client.query(
    `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, amount, description, status, JSON.stringify(metadata || {})]
  );
}

// Atualizar status da transação
export async function updateTransactionStatus(
  client: PoolClient,
  transactionId: number,
  currentStatus: string,
  newStatus: string
): Promise<TransactionResult> {
  try {
    const result = await client.query(
      `UPDATE transactions 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = $3
       RETURNING id`,
      [newStatus, transactionId, currentStatus]
    );
    
    if (result.rows.length === 0) {
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

// Buscar transações do usuário
export async function getUserTransactions(
  pool: Pool,
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM transactions 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  
  return result.rows;
}

// Buscar transações pendentes (admin)
export async function getPendingTransactions(
  pool: Pool,
  type?: string
): Promise<any[]> {
  let query = `
    SELECT t.*, u.name as user_name, u.email as user_email
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.status = 'PENDING'
  `;
  
  const params: any[] = [];
  
  if (type) {
    query += ' AND t.type = $1';
    params.push(type);
  }
  
  query += ' ORDER BY t.created_at DESC';
  
  const result = await pool.query(query, params);
  return result.rows;
}

// Calcular saldo total do sistema
export async function calculateSystemBalance(pool: Pool): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) * $1, 0) as total_quotas_value
     FROM quotas`,
    [50] // QUOTA_PRICE
  );
  
  return parseFloat(result.rows[0].total_quotas_value);
}

// Verificar limite de saque
export function validateWithdrawalAmount(amount: number, balance: number): TransactionResult {
  const MIN_WITHDRAWAL = 10;
  const MAX_WITHDRAWAL = 50000;
  
  if (amount < MIN_WITHDRAWAL) {
    return {
      success: false,
      error: `Valor mínimo de saque é R$ ${MIN_WITHDRAWAL.toFixed(2)}`
    };
  }
  
  if (amount > MAX_WITHDRAWAL) {
    return {
      success: false,
      error: `Valor máximo de saque é R$ ${MAX_WITHDRAWAL.toFixed(2)}`
    };
  }
  
  if (amount > balance) {
    return {
      success: false,
      error: 'Saldo insuficiente para saque'
    };
  }
  
  return { success: true };
}

// Calcular taxa de saque
export function calculateWithdrawalFee(amount: number): number {
  const FEE_PERCENTAGE = 0.02;
  const FEE_FIXED = 5.00;
  
  return Math.max(amount * FEE_PERCENTAGE, FEE_FIXED);
}