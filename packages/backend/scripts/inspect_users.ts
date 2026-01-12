import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Carrega variáveis de ambiente do pacote backend
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function listUsers() {
  try {
    const res = await pool.query('SELECT id, name, email, created_at FROM users ORDER BY created_at DESC');
    console.log('--- Usuários no Banco de Dados ---');
    res.rows.forEach(u => {
      console.log(`${u.id} | ${u.name} | ${u.email}`);
    });
    console.log('----------------------------------');
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
  } finally {
    await pool.end();
  }
}

listUsers();
