import { Pool, PoolClient } from 'pg';

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
  } catch (error) {
    await client.query('ROLLBACK');
    
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
  client: PoolClient,
  userId: string,
  amount: number
): Promise<{ success: boolean; currentBalance?: number; error?: string }> {
  try {
    const result = await client.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    const currentBalance = parseFloat(result.rows[0].balance);
    
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
 * Atualiza saldo do usuário de forma segura
 */
export async function updateUserBalance(
  client: PoolClient,
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
  client: PoolClient,
  userId: string,
  type: string,
  amount: number,
  description: string,
  status: string = 'PENDING',
  metadata?: any
): Promise<{ success: boolean; transactionId?: number; error?: string }> {
  try {
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
  client: PoolClient,
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