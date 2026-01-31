
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

async function migrateQuotas() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('🔄 Iniciando migração de cotas para o modelo Valor Cheio (R$ 50,00)...');

        // 1. Buscar cotas antigas (Valor ~42.00)
        const res = await client.query("SELECT count(*) as count FROM quotas WHERE current_value < 50 AND status = 'ACTIVE'");
        const count = parseInt(res.rows[0].count);

        if (count === 0) {
            console.log('✅ Nenhuma cota antiga encontrada para migrar.');
            await client.query('ROLLBACK');
            return;
        }

        console.log(`📦 Encontradas ${count} cotas para atualizar...`);

        // 2. Atualizar valor das cotas para 50.00
        // Aumentamos o valor da cota em R$ 8,00 (De ~42 para 50)
        const updateRes = await client.query(`
            UPDATE quotas 
            SET current_value = 50.00, purchase_price = 50.00 
            WHERE current_value < 50 AND status = 'ACTIVE'
            RETURNING id
        `);

        // 3. Ajustar Reservas (Contabilidade)
        // Se devolvemos R$ 8,00 para a cota, precisamos retirar das reservas de taxas onde elas foram alocadas
        // e colocá-las de volta na Investment Reserve (Lastro da Cota).

        // Total a ser remanejado = 8.00 * count
        const totalReversal = 8.00 * count;

        // Distribuição reversa baseada nas constantes antigas (20% cada)
        const reversalPerFund = totalReversal * 0.20;

        // Retirar das reservas de taxas
        await client.query(`
            UPDATE system_config SET
                total_tax_reserve = GREATEST(0, total_tax_reserve - $1),
                total_operational_reserve = GREATEST(0, total_operational_reserve - $1),
                total_owner_profit = GREATEST(0, total_owner_profit - $1),
                total_corporate_investment_reserve = GREATEST(0, total_corporate_investment_reserve - $1),
                mutual_reserve = GREATEST(0, mutual_reserve - $1),
                
                // Adicionar de volta ao lastro de investimento
                investment_reserve = investment_reserve + $2
        `, [reversalPerFund, totalReversal]);

        console.log(`💰 Revertido R$ ${totalReversal.toFixed(2)} das taxas para a Reserva de Investimento.`);

        await client.query('COMMIT');
        console.log(`✅ Sucesso! ${updateRes.rowCount} cotas foram atualizadas para R$ 50,00.`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro na migração:', error);
    } finally {
        client.release();
        pool.end();
    }
}

migrateQuotas();
