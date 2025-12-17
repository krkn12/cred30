const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'cred30user',
  password: 'cred30pass',
  database: 'cred30'
});

async function testBackendFixes() {
  const client = await pool.connect();
  try {
    console.log('=== TESTE DE CONSISTÊNCIA DO BANCO DE DADOS ===\n');
    
    // 1. Verificar estrutura de todas as tabelas
    const tables = ['users', 'quotas', 'loans', 'loan_installments', 'transactions'];
    const allTablesConsistent = [];
    
    for (const table of tables) {
      const structure = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = '${table}'
        AND (column_name = 'id' OR column_name = 'user_id' OR column_name = 'loan_id')
        ORDER BY ordinal_position
      `);
      
      console.log(`\n📋 Estrutura da tabela ${table}:`);
      console.table(structure.rows);
      
      // Verificar consistência dos tipos
      const idColumn = structure.rows.find(col => col.column_name === 'id');
      const userIdColumn = structure.rows.find(col => col.column_name === 'user_id');
      const loanIdColumn = structure.rows.find(col => col.column_name === 'loan_id');
      
      let isConsistent = true;
      let issues = [];
      
      // ID deve ser integer (exceto transactions que migramos)
      if (idColumn && !idColumn.data_type.includes('integer') && table !== 'transactions') {
        isConsistent = false;
        issues.push(`ID deveria ser integer, mas é ${idColumn.data_type}`);
      }
      
      // user_id deve ser integer
      if (userIdColumn && !userIdColumn.data_type.includes('integer')) {
        isConsistent = false;
        issues.push(`user_id deveria ser integer, mas é ${userIdColumn.data_type}`);
      }
      
      // loan_id deve ser integer
      if (loanIdColumn && !loanIdColumn.data_type.includes('integer')) {
        isConsistent = false;
        issues.push(`loan_id deveria ser integer, mas é ${loanIdColumn.data_type}`);
      }
      
      if (isConsistent) {
        console.log(`✅ Tabela ${table} está consistente`);
        allTablesConsistent.push(table);
      } else {
        console.log(`❌ Tabela ${table} tem problemas:`);
        issues.forEach(issue => console.log(`   - ${issue}`));
      }
    }
    
    // 2. Verificar foreign keys
    console.log('\n\n🔗 Verificando foreign keys...');
    const fkCheck = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_type
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name IN ('loans', 'quotas', 'transactions', 'loan_installments')
    `);
    
    console.log('Foreign keys encontradas:');
    console.table(fkCheck.rows);
    
    // 3. Verificar dados de teste
    console.log('\n\n📊 Verificando dados existentes...');
    
    for (const table of tables) {
      const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(countResult.rows[0].count);
      console.log(`${table}: ${count} registros`);
    }
    
    // 4. Testar inserção básica
    console.log('\n\n🧪 Testando operações básicas...');
    
    try {
      // Verificar se há usuário de teste
      const userResult = await client.query('SELECT id FROM users WHERE email = $1', ['test@example.com']);
      
      let testUserId;
      if (userResult.rows.length === 0) {
        // Criar usuário de teste
        const newUser = await client.query(`
          INSERT INTO users (name, email, password, secret_phrase, pix_key, balance)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, ['Test User', 'test@example.com', 'test', 'test', 'test-pix', 1000]);
        
        testUserId = newUser.rows[0].id;
        console.log(`✅ Usuário de teste criado com ID: ${testUserId}`);
      } else {
        testUserId = userResult.rows[0].id;
        console.log(`✅ Usuário de teste encontrado com ID: ${testUserId}`);
      }
      
      // Testar inserção de cota
      const quotaResult = await client.query(`
        INSERT INTO quotas (user_id, purchase_price, current_value, status)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [testUserId, 50, 50, 'ACTIVE']);
      
      console.log(`✅ Cota de teste criada com ID: ${quotaResult.rows[0].id}`);
      
      // Testar inserção de transação
      const transactionResult = await client.query(`
        INSERT INTO transactions (user_id, type, amount, description, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [testUserId, 'TEST', 100, 'Transação de teste', 'APPROVED']);
      
      console.log(`✅ Transação de teste criada com ID: ${transactionResult.rows[0].id}`);
      
      // Limpar dados de teste
      await client.query('DELETE FROM transactions WHERE user_id = $1 AND type = $2', [testUserId, 'TEST']);
      await client.query('DELETE FROM quotas WHERE user_id = $1 AND purchase_price = $2', [testUserId, 50]);
      
      console.log('✅ Dados de teste removidos');
      
    } catch (error) {
      console.error('❌ Erro ao testar operações básicas:', error.message);
    }
    
    // 5. Resumo final
    console.log('\n\n📋 RESUMO FINAL:');
    console.log(`✅ Tabelas consistentes: ${allTablesConsistent.length}/${tables.length}`);
    console.log(`✅ Foreign keys encontradas: ${fkCheck.rows.length}`);
    
    if (allTablesConsistent.length === tables.length) {
      console.log('\n🎉 BANCO DE DADOS TOTALMENTE CONSISTENTE!');
      console.log('O backend está pronto para funcionar corretamente.');
    } else {
      console.log('\n⚠️  Ainda há inconsistências a serem resolvidas.');
    }
    
  } catch (error) {
    console.error('Erro durante o teste:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testBackendFixes();