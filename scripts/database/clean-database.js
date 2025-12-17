// Script para limpar o banco de dados
import { pool } from './src/utils/db.js';

async function cleanDatabase() {
  console.log('🧹 Limpando banco de dados...');
  
  try {
    const client = await pool.connect();
    
    // Limpar todas as tabelas em ordem correta (respeitando foreign keys)
    console.log('📋 Removendo transações...');
    await client.query('DELETE FROM transactions');
    
    console.log('📋 Removendo empréstimos...');
    await client.query('DELETE FROM loans');
    
    console.log('📋 Removendo cotas...');
    await client.query('DELETE FROM quotas');
    
    console.log('📋 Removendo logs de auditoria...');
    await client.query('DELETE FROM admin_logs');
    
    console.log('📋 Removendo logs de rate limit...');
    await client.query('DELETE FROM rate_limit_logs');
    
    console.log('📋 Removendo configurações do sistema...');
    await client.query('DELETE FROM system_config');
    
    console.log('📋 Removendo usuários...');
    await client.query('DELETE FROM users');
    
    // Resetar sequências
    console.log('📋 Resetando sequências...');
    await client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE transactions_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE loans_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE quotas_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE admin_logs_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE rate_limit_logs_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE system_config_id_seq RESTART WITH 1');
    
    client.release();
    
    console.log('✅ Banco de dados limpo com sucesso!');
    console.log('🎉 Sistema pronto para o primeiro usuário se cadastrar como administrador.');
    
  } catch (error) {
    console.error('❌ Erro ao limpar banco de dados:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanDatabase();