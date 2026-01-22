
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Força o uso do .env do backend
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../packages/backend/.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('ERRO: DATABASE_URL não encontrada no .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function restore() {
    console.log('--- INICIANDO RESTAURAÇÃO DE PRODUÇÃO ---');
    console.log('Alvo:', DATABASE_URL.split('@')[1]);

    const snapshot = JSON.parse(fs.readFileSync('prod_full_snapshot.json', 'utf8'));
    console.log(`Snapshot carregado. Data: ${snapshot.timestamp}`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Recriar Extensões
        console.log('Recriando extensões...');
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        // 2. Recriar Tabelas (Ordem importa por causa das FKs)
        console.log('Recriando tabelas base...');

        // Users
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                secret_phrase VARCHAR(255) NOT NULL,
                pix_key VARCHAR(255) NOT NULL,
                balance DECIMAL(10,2) DEFAULT 0,
                referral_code VARCHAR(10) UNIQUE,
                referred_by VARCHAR(10),
                is_admin BOOLEAN DEFAULT FALSE,
                score INTEGER DEFAULT 0,
                is_email_verified BOOLEAN DEFAULT FALSE,
                verification_code VARCHAR(10),
                reset_password_token VARCHAR(255),
                two_factor_secret TEXT,
                two_factor_enabled BOOLEAN DEFAULT FALSE,
                accepted_terms_at TIMESTAMP,
                title_downloaded BOOLEAN DEFAULT FALSE,
                title_downloaded_at TIMESTAMP,
                role VARCHAR(20) DEFAULT 'MEMBER',
                status VARCHAR(20) DEFAULT 'ACTIVE',
                address TEXT,
                phone VARCHAR(20),
                is_seller BOOLEAN DEFAULT FALSE,
                seller_status VARCHAR(20) DEFAULT 'none',
                asaas_account_id VARCHAR(255),
                asaas_wallet_id VARCHAR(255),
                seller_company_name VARCHAR(255),
                seller_cpf_cnpj VARCHAR(255),
                seller_phone VARCHAR(255),
                seller_address_street VARCHAR(255),
                seller_address_number VARCHAR(255),
                seller_address_neighborhood VARCHAR(255),
                seller_address_city VARCHAR(255),
                seller_address_state VARCHAR(255),
                seller_address_postal_code VARCHAR(255),
                seller_created_at TIMESTAMP,
                last_ip VARCHAR(45),
                last_login_at TIMESTAMP,
                ad_points INTEGER DEFAULT 0,
                last_video_reward_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // System Config
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_config (
                id SERIAL PRIMARY KEY,
                system_balance DECIMAL(20,2) DEFAULT 0,
                profit_pool DECIMAL(20,2) DEFAULT 0,
                investment_reserve DECIMAL(20,2) DEFAULT 0,
                total_gateway_costs DECIMAL(20,2) DEFAULT 0,
                total_tax_reserve DECIMAL(20,2) DEFAULT 0,
                total_operational_reserve DECIMAL(20,2) DEFAULT 0,
                total_owner_profit DECIMAL(20,2) DEFAULT 0,
                quota_price DECIMAL(10,2) DEFAULT 100,
                loan_interest_rate DECIMAL(5,2) DEFAULT 0.2,
                penalty_rate DECIMAL(5,2) DEFAULT 0.4,
                vesting_period_ms BIGINT DEFAULT 31536000000,
                total_manual_costs DECIMAL(20,2) DEFAULT 0,
                courier_price_per_km DECIMAL(10,2) DEFAULT 2.50,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Quotas
        await client.query(`
            CREATE TABLE IF NOT EXISTS quotas (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                purchase_price DECIMAL(10,2) NOT NULL,
                current_value DECIMAL(10,2) NOT NULL,
                purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                yield_rate DECIMAL(5,2) DEFAULT 0.5
            );
        `);

        // Loans
        await client.query(`
            CREATE TABLE IF NOT EXISTS loans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                amount DECIMAL(10,2) NOT NULL,
                interest_rate DECIMAL(5,2) NOT NULL,
                penalty_rate DECIMAL(5,2) DEFAULT 0.4,
                total_repayment DECIMAL(10,2) NOT NULL,
                installments INTEGER DEFAULT 1,
                term_days INTEGER DEFAULT 30,
                status VARCHAR(20) DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_at TIMESTAMP,
                due_date TIMESTAMP,
                payout_status VARCHAR(20) DEFAULT 'NONE',
                pix_key_to_receive VARCHAR(255),
                metadata JSONB
            );
        `);

        // Transactions
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                type VARCHAR(20) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                gateway_cost DECIMAL(10,2) DEFAULT 0,
                description TEXT,
                status VARCHAR(20) DEFAULT 'PENDING',
                metadata JSONB,
                payout_status VARCHAR(20) DEFAULT 'NONE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP
            );
        `);

        // 3. Inserir Dados
        const tablesToRestore = ['system_config', 'users', 'quotas', 'loans', 'transactions'];

        for (const table of tablesToRestore) {
            const data = snapshot.tables[table];
            if (!data || !data.rows || data.rows.length === 0) {
                console.log(`Pulando ${table} (sem dados)`);
                continue;
            }

            console.log(`Restaurando ${table} (${data.rows.length} registros)...`);

            for (const row of data.rows) {
                const keys = Object.keys(row);
                const values = Object.values(row);
                const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                const columns = keys.join(', ');

                // Para evitar conflitos de ID SERIAL
                await client.query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
            }

            // Atualizar o SERIAL counter se a tabela usar SERIAL
            if (['users', 'quotas', 'loans', 'transactions', 'system_config'].includes(table)) {
                await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`);
            }
        }

        await client.query('COMMIT');
        console.log('--- RESTAURAÇÃO CONCLUÍDA COM SUCESSO ---');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('ERRO NA RESTAURAÇÃO:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

restore();
