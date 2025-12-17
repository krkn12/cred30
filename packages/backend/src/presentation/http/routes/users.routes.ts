import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { User, UpdateUserRequest } from '../../../domain/entities/user.entity';
import { UserContext } from '../../../shared/types/hono.types';

const userRoutes = new Hono();

// Esquema de validação para atualização de usuário
const updateUserSchema = z.object({
  name: z.string().min(3).optional(),
  pixKey: z.string().min(5).optional(),
  secretPhrase: z.string().min(3).optional(),
});

// Obter perfil do usuário atual
userRoutes.get('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    
    return c.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Atualizar perfil do usuário
userRoutes.put('/profile', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = updateUserSchema.parse(body);
    
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);
    
    // Verificar se a nova frase secreta já existe em outro usuário
    if (validatedData.secretPhrase) {
      const existingUserResult = await pool.query(
        'SELECT id FROM users WHERE secret_phrase = $1 AND id != $2',
        [validatedData.secretPhrase, user.id]
      );
      
      if (existingUserResult.rows.length > 0) {
        return c.json({ success: false, message: 'Frase secreta já em uso' }, 409);
      }
    }
    
    // Preparar campos de atualização
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (validatedData.name) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(validatedData.name);
    }
    if (validatedData.pixKey) {
      updateFields.push(`pix_key = $${paramIndex++}`);
      updateValues.push(validatedData.pixKey);
    }
    if (validatedData.secretPhrase) {
      updateFields.push(`secret_phrase = $${paramIndex++}`);
      updateValues.push(validatedData.secretPhrase);
    }
    
    if (updateFields.length === 0) {
      return c.json({ success: false, message: 'Nenhum campo para atualizar' }, 400);
    }
    
    // Adicionar ID do usuário no final
    updateValues.push(user.id);
    
    // Atualizar usuário
    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, pix_key, balance, created_at, referral_code, is_admin
    `;
    
    const result = await pool.query(updateQuery, updateValues);
    
    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }
    
    const updatedUser = result.rows[0];
    
    return c.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: {
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          pixKey: updatedUser.pix_key,
          balance: parseFloat(updatedUser.balance),
          joinedAt: updatedUser.created_at,
          referralCode: updatedUser.referral_code,
          isAdmin: updatedUser.is_admin,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }
    
    console.error('Erro ao atualizar perfil:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Obter saldo do usuário
userRoutes.get('/balance', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    
    return c.json({
      success: true,
      data: {
        balance: user.balance,
      },
    });
  } catch (error) {
    console.error('Erro ao obter saldo:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Obter extrato de transações do usuário
userRoutes.get('/transactions', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);
    
    // Buscar transações do usuário
    const result = await pool.query(
      `SELECT id, type, amount, created_at as date, description, status, metadata
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );
    
    // Formatar transações para resposta
    const formattedTransactions = result.rows.map(transaction => ({
      id: transaction.id,
      type: transaction.type,
      amount: parseFloat(transaction.amount),
      date: transaction.date,
      description: transaction.description,
      status: transaction.status,
      metadata: transaction.metadata,
    }));
    
    return c.json({
      success: true,
      data: {
        transactions: formattedTransactions,
      },
    });
  } catch (error) {
    console.error('Erro ao obter transações:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

export { userRoutes };