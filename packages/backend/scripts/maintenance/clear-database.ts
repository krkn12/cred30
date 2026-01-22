import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('🧹 INICIANDO LIMPEZA TOTAL DO BANCO DE DADOS...');

        // Lista de tabelas para limpar (ordem importa se não usar CASCADE, mas usaremos CASCADE)
        const tables = [
            'marketplace_orders',
            'marketplace_listings',
            'products',
            'loan_installments',
            'loans',
            'quotas',
            'transactions',
            'promo_video_views',
            'promo_videos',
            'education_progress',
            'education_lessons',
            'education_courses',
            'education_sessions',
            'notifications',
            'investments',
            'support_messages',
            'support_chats',
            'referral_codes',
            'admin_logs',
            'audit_logs',
            'webhook_logs',
            'governance_votes',
            'governance_proposals',
            'transaction_reviews',
            'bug_reports',
            'rate_limit_logs',
            'users' // Usuários por último
        ];

        console.log('🗑️ Apagando registros...');

        for (const table of tables) {
            try {
                await client.query(`TRUNCATE TABLE ${table} CASCADE`);
                console.log(`   ✅ Tabela ${table} limpa.`);
            } catch (e: any) {
                console.log(`   ⚠️ Erro ao limpar ${table}: ${e.message}`);
            }
        }

        console.log('\n⚙️ Reinicializando configurações do sistema...');
        await client.query(`DELETE FROM system_config`);
        await client.query(`
            INSERT INTO system_config (
                system_balance, 
                profit_pool, 
                investment_reserve, 
                total_tax_reserve, 
                total_operational_reserve, 
                total_owner_profit,
                quota_price,
                loan_interest_rate
            ) VALUES (0, 0, 0, 0, 0, 0, 50, 0.20)
        `);
        console.log('   ✅ system_config resetado para zero.');

        console.log('\n✨ BANCO DE DADOS COMPLETAMENTE LIMPO!');
        console.log('📝 Nota: Você precisará criar uma nova conta no app.');

    } catch (e: any) {
        console.error('❌ Erro fatal durante a limpeza:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
