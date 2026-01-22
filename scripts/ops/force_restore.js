
const { Pool } = require('pg');
const fs = require('fs');

const DATABASE_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-little-cloud-a4c6j16l.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function run() {
    console.log('--- RESTAURAÇÃO FORÇADA ---');
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const snapshot = JSON.parse(fs.readFileSync('prod_full_snapshot.json', 'utf8'));
    const client = await pool.connect();

    try {
        console.log('Criando extensões...');
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        console.log('Criando tabela users...');
        await client.query(`
            CREATE TABLE users (
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
            )
        `);

        console.log('Criando tabela quotas...');
        await client.query(`
            CREATE TABLE quotas (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                purchase_price DECIMAL(10,2) NOT NULL,
                current_value DECIMAL(10,2) NOT NULL,
                purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                yield_rate DECIMAL(5,2) DEFAULT 0.5
            )
        `);

        console.log('Criando tabela loans...');
        await client.query(`
            CREATE TABLE loans (
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
            )
        `);

        console.log('Criando tabela transactions...');
        await client.query(`
            CREATE TABLE transactions (
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
            )
        `);

        console.log('Criando tabela system_config...');
        await client.query(`
            CREATE TABLE system_config (
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
            )
        `);

        const order = ['system_config', 'users', 'quotas', 'loans', 'transactions'];
        for (const table of order) {
            const data = snapshot.tables[table];
            if (!data || !data.rows) continue;
            console.log(`Inserindo dados em ${table}...`);
            for (const row of data.rows) {
                const keys = Object.keys(row);
                // Filtro básico para colunas que podem ter mudado se o snapshot for muito antigo
                const values = Object.values(row);
                const columns = keys.join(', ');
                const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                await client.query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, values);
            }
            try {
                await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`);
            } catch (e) { }
        }

        console.log('--- RESTAURAÇÃO COMPLETA ---');
    } catch (err) {
        console.error('ERRO:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
