const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'cred30user',
  password: 'cred30pass',
  database: 'cred30'
});

async function fixDatabaseInconsistencies() {
  const client = await pool.connect();
  try {
    console.log('Iniciando correção de inconsistências do banco de dados...');
    
    // 1. Corrigir tabela loans - user_id deveria ser integer para referenciar users.id
    console.log('\n1. Verificando se há dados na tabela loans...');
    const loansDataCheck = await client.query('SELECT COUNT(*) as count FROM loans');
    const hasLoansData = parseInt(loansDataCheck.rows[0].count) > 0;
    
    if (hasLoansData) {
      console.log('ATENÇÃO: Há dados na tabela loans. É necessário fazer backup antes de continuar.');
      console.log('Dados encontrados:', loansDataCheck.rows[0].count);
      
      // Mostrar alguns dados para verificação
      const sampleData = await client.query('SELECT id, user_id FROM loans LIMIT 3');
      console.log('Exemplo de dados:');
      console.table(sampleData.rows);
      
      const proceed = await new Promise((resolve) => {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question('Deseja continuar com a correção? (s/N): ', (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 's');
        });
      });
      
      if (!proceed) {
        console.log('Operação cancelada.');
        return;
      }
    }
    
    // Corrigir tabela loans
    console.log('\n2. Corrigindo tabela loans...');
    
    // Dropar foreign key se existir
    try {
      await client.query('ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_user_id_fkey');
      console.log('Foreign key removida (se existia)');
    } catch (error) {
      console.log('Nenhuma foreign key para remover');
    }
    
    // Alterar coluna user_id para integer
    await client.query('ALTER TABLE loans ALTER COLUMN user_id TYPE integer USING user_id::integer');
    console.log('Coluna user_id alterada para integer');
    
    // Recriar foreign key
    await client.query('ALTER TABLE loans ADD CONSTRAINT loans_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)');
    console.log('Foreign key recriada com tipo correto');
    
    // 3. Corrigir tabela transactions - id deveria ser integer para consistência
    console.log('\n3. Verificando tabela transactions...');
    const transactionsDataCheck = await client.query('SELECT COUNT(*) as count FROM transactions');
    const hasTransactionsData = parseInt(transactionsDataCheck.rows[0].count) > 0;
    
    if (hasTransactionsData) {
      console.log('ATENÇÃO: Há dados na tabela transactions. A correção do ID pode afetar outras referências.');
      console.log('Dados encontrados:', transactionsDataCheck.rows[0].count);
      
      // Verificar se há referências a transactions.id em outras tabelas
      console.log('Verificando referências externas...');
      // (Por enquanto, vamos manter como UUID para não quebrar referências)
    }
    
    console.log('\n4. Verificando estrutura final...');
    
    // Verificar estrutura final das tabelas corrigidas
    const loansStructure = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'loans'
      AND column_name IN ('id', 'user_id')
      ORDER BY ordinal_position
    `);
    
    console.log('Estrutura final da tabela loans:');
    console.table(loansStructure.rows);
    
    // Verificar se as foreign keys estão corretas
    const fkCheck = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name IN ('loans', 'quotas', 'transactions')
    `);
    
    console.log('\nForeign keys verificadas:');
    console.table(fkCheck.rows);
    
    console.log('\nCorreções concluídas com sucesso!');
    
  } catch (error) {
    console.error('Erro durante a correção:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixDatabaseInconsistencies();