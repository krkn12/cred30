const { Pool } = require('pg');
const { execSync } = require('child_process');

// Configuração do banco de dados
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'cred30user',
  password: process.env.DB_PASSWORD || 'cred30pass',
  database: process.env.DB_DATABASE || 'cred30'
});

async function resetDatabaseCompletely() {
  console.log('🧹 Resetando COMPLETAMENTE o banco de dados CRED30...');

  try {
    // Listar todas as tabelas para dropar
    const tablesResult = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);

    const tables = tablesResult.rows.map(row => row.tablename);
    console.log(`📋 Encontradas ${tables.length} tabelas: ${tables.join(', ')}`);

    // Dropar todas as tabelas em ordem correta (sem foreign key constraints)
    for (const table of tables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✅ Tabela ${table} removida`);
      } catch (error) {
        console.log(`⚠️ Erro ao remover tabela ${table}: ${error.message}`);
      }
    }

    // Dropar triggers
    const triggersResult = await pool.query(`
      SELECT triggername 
      FROM pg_trigger 
      WHERE tgrelid = 'public'::pg_class
    `);

    const triggers = triggersResult.rows.map(row => row.triggername);
    console.log(`📋 Encontrados ${triggers.length} triggers: ${triggers.join(', ')}`);

    for (const trigger of triggers) {
      try {
        await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON public`);
        console.log(`✅ Trigger ${trigger} removido`);
      } catch (error) {
        console.log(`⚠️ Erro ao remover trigger ${trigger}: ${error.message}`);
      }
    }

    // Dropar função
    try {
      await pool.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
      console.log('✅ Função update_updated_at_column removida');
    } catch (error) {
      console.log(`⚠️ Erro ao remover função: ${error.message}`);
    }

    // Recriar schema do zero
    console.log('🔄 Recriando schema do zero...');
    const fs = require('fs');
    const path = require('path');
    const initSqlPath = path.join(__dirname, 'init-db-fixed.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf8');
    
    await pool.query(initSql);
    console.log('✅ Schema recriado com sucesso!');

    // Inserir dados básicos
    console.log('🌱 Inserindo dados básicos...');
    await pool.query(`
      INSERT INTO app_settings (key, value, description) VALUES
      ('quota_price', '50', 'Preço unitário das cotas de investimento'),
      ('loan_interest_rate', '0.2', 'Taxa de juros dos empréstimos (20%)'),
      ('penalty_rate', '0.4', 'Taxa de multa por atraso (40%)'),
      ('admin_pix_key', 'admin@pix.local', 'Chave PIX do administrador'),
      ('min_loan_amount', '100', 'Valor mínimo de empréstimo'),
      ('max_loan_amount', '10000', 'Valor máximo de empréstimo')
      ON CONFLICT (key) DO NOTHING
    `);

    console.log('✅ Dados básicos inseridos com sucesso!');
    console.log('');
    console.log('🎉 Banco de dados resetado COMPLETAMENTE com sucesso!');
    console.log('📋 Estrutura criada:');
    console.log('   - users (usuários)');
    console.log('   - quotas (cotas de investimento)');
    console.log('   - loans (empréstimos)');
    console.log('   - loan_installments (parcelas)');
    console.log('   - transactions (transações)');
    console.log('   - withdrawals (saques)');
    console.log('   - app_settings (configurações)');
    console.log('');
    console.log('🚀 Agora você pode iniciar o backend normalmente!');

  } catch (error) {
    console.error('❌ Erro ao resetar banco de dados:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  resetDatabaseCompletely().catch(console.error);
}

module.exports = { resetDatabaseCompletely };