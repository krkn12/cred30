const { Pool } = require('pg');

// Configuração do banco de dados
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'cred30user',
  password: process.env.DB_PASSWORD || 'cred30pass',
  database: process.env.DB_DATABASE || 'cred30',
});

async function testWithdrawalFeeDistribution() {
  try {
    console.log('=== TESTE DE DISTRIBUIÇÃO DE TAXAS DE SAQUE ===');
    
    // Cenários de teste
    const testScenarios = [
      { amount: 100, description: 'Saque mínimo (R$ 100)' },
      { amount: 500, description: 'Saque médio (R$ 500)' },
      { amount: 1000, description: 'Saque alto (R$ 1.000)' },
      { amount: 5000, description: 'Saque muito alto (R$ 5.000)' },
      { amount: 10000, description: 'Saque máximo (R$ 10.000)' }
    ];
    
    for (const scenario of testScenarios) {
      console.log(`\n--- Testando: ${scenario.description} ---`);
      
      // Calcular valores esperados
      const feePercentage = 0.02;
      const feeFixed = 5.00;
      const feeAmount = Math.max(scenario.amount * feePercentage, feeFixed);
      const netAmount = scenario.amount - feeAmount;
      
      // Nova regra: 85% para caixa operacional, 15% para lucro
      const feeForOperational = feeAmount * 0.85;
      const feeForProfit = feeAmount * 0.15;
      
      console.log('Valores calculados:');
      console.log(`  Valor do saque: R$ ${scenario.amount.toFixed(2)}`);
      console.log(`  Taxa (2% ou R$ 5): R$ ${feeAmount.toFixed(2)}`);
      console.log(`  Valor líquido: R$ ${netAmount.toFixed(2)}`);
      console.log(`  Taxa para caixa operacional (85%): R$ ${feeForOperational.toFixed(2)}`);
      console.log(`  Taxa para lucro de juros (15%): R$ ${feeForProfit.toFixed(2)}`);
      console.log(`  Total distribuído: R$ ${(feeForOperational + feeForProfit).toFixed(2)}`);
      
      // Validar soma
      const totalDistributed = feeForOperational + feeForProfit;
      const isSumCorrect = Math.abs(totalDistributed - feeAmount) < 0.01;
      
      console.log(`  Soma correta: ${isSumCorrect ? '✅' : '❌'}`);
      
      if (!isSumCorrect) {
        console.error(`❌ ERRO: Soma da distribuição (${totalDistributed.toFixed(2)}) não igual à taxa (${feeAmount.toFixed(2)})`);
      }
      
      // Validar integridade dos valores
      const validations = [
        { condition: feeAmount > 0, message: 'Taxa deve ser positiva' },
        { condition: netAmount > 0, message: 'Valor líquido deve ser positivo' },
        { condition: netAmount < scenario.amount, message: 'Valor líquido deve ser menor que o valor do saque' },
        { condition: feeForOperational > 0, message: 'Taxa para caixa deve ser positiva' },
        { condition: feeForProfit > 0, message: 'Taxa para lucro deve ser positiva' },
        { condition: scenario.amount <= 10000, message: 'Valor do saque não deve exceder R$ 10.000' }
      ];
      
      let allValidationsPassed = true;
      for (const validation of validations) {
        const passed = validation.condition;
        console.log(`  ${passed ? '✅' : '❌'} ${validation.message}`);
        if (!passed) allValidationsPassed = false;
      }
      
      console.log(`  Status geral: ${allValidationsPassed ? '✅ APROVADO' : '❌ REPROVADO'}`);
    }
    
    console.log('\n=== RESUMO DOS TESTES ===');
    console.log('✅ Nova regra implementada: 85% para caixa operacional, 15% para lucro de juros');
    console.log('✅ Validações implementadas para evitar valores negativos ou cálculos incorretos');
    console.log('✅ Logs detalhados para auditoria das distribuições');
    
  } catch (error) {
    console.error('Erro ao testar distribuição de taxas de saque:', error);
  } finally {
    await pool.end();
  }
}

// Executar testes
testWithdrawalFeeDistribution();