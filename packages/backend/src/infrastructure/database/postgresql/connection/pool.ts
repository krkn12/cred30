import { Pool } from 'pg';
// Importações comentadas para evitar dependência circular
// import { initializeAuditTable } from '../../../logging/audit.middleware';
// import { initializeRateLimitTable } from '../../../presentation/http/middleware/rate-limit.middleware';
// import { createIndexes } from '../../../../utils/indexes';

// Configuração do pool de conexões PostgreSQL balanceada para performance e custo
const poolConfig: any = {
  max: 15, // Máximo de conexões simultâneas (ideal para instâncias Neon/Supabase free/base)
  min: 2,  // Manter pelo menos 2 conexões abertas para warm start
  idleTimeoutMillis: 30000,      // Tempo para fechar conexões ociosas
  connectionTimeoutMillis: 5000,  // Timeout para tentar conectar
  maxUses: 7500, // Prevenir memory leaks do driver pg reciclagem periódica
  keepAlive: true, // <-- IMPORTANTE: Mantém conexão ativa com Neon
  keepAliveInitialDelayMillis: 10000, // Ping a cada 10 segundos
};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
  // Só habilita SSL se NÃO for teste (bancos de teste locais geralmente não têm SSL configurado)
  if (process.env.NODE_ENV !== 'test') {
    poolConfig.ssl = { rejectUnauthorized: false };
  } else {
    // Em ambiente de teste: manter SSL se for NeonDB (exige SSL), remover caso contrário (ex: Postgres CI/CD)
    if (process.env.DATABASE_URL.includes('neon.tech') || process.env.DATABASE_URL.includes('supabase')) {
      poolConfig.ssl = { rejectUnauthorized: false };
    } else {
      delete poolConfig.ssl;
      poolConfig.connectionString = poolConfig.connectionString.replace(/\?sslmode=[^&]+/, '').replace(/&sslmode=[^&]+/, '');
    }
  }
} else {
  // Configuração local de fallback
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = parseInt(process.env.DB_PORT || '5432');
  poolConfig.user = process.env.DB_USER || 'admin';
  poolConfig.password = process.env.DB_PASSWORD || 'password';
  poolConfig.database = process.env.DB_DATABASE || 'cred30_local';
  // Garantir que SSL está desligado no modo fallback local
  delete poolConfig.ssl;
}

// DEBUG: Inspecionar configuração final (sem expor senhas)
console.log('[POOL DEBUG] NODE_ENV:', process.env.NODE_ENV);
console.log('[POOL DEBUG] DATABASE_URL Presente:', !!process.env.DATABASE_URL);
console.log('[POOL DEBUG] SSL Config:', poolConfig.ssl);
console.log('[POOL DEBUG] Host:', poolConfig.host);

// Criar o pool de conexões
export const pool = new Pool(poolConfig);

// 🛡️ BLINDAGEM: Handler de erro para evitar crash do servidor
pool.on('error', (err, client) => {
  console.error('[POOL ERROR] Conexão perdida com o banco de dados:', (err as any)?.message);
  // Não faz nada aqui, o pg-pool reconecta automaticamente
});

pool.on('connect', () => {
  console.log('[POOL] Nova conexão estabelecida com o banco');
});

/**
 * Helper para queries SQL usando Tagged Template Literals.
 * Permite escrever sql`SELECT * FROM users WHERE id = ${id}` de forma segura.
 */
export const sql = async (strings: TemplateStringsArray, ...values: any[]) => {
  const text = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '');
  const result = await pool.query(text, values);
  return result.rows;
};

// Adicionar método 'begin' para transações simples no helper
sql.begin = async (callback: (tx: any) => Promise<any>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = async (strings: TemplateStringsArray, ...values: any[]) => {
      const text = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '');
      const res = await client.query(text, values);
      return res.rows;
    };
    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// Variável global para armazenar o pool de conexões
let dbPool: Pool | null = null;

export const getDbPool = (c?: any): Pool => {
  // Se o pool já foi injetado no contexto pelo Hono, use-o
  if (c && c.get && c.get('dbPool')) {
    return c.get('dbPool');
  }

  // Usar global para garantir singleton em ambiente de teste/vitest
  const globalAny: any = globalThis;
  if (!globalAny.__DB_POOL__) {
    globalAny.__DB_POOL__ = pool;
  }

  return globalAny.__DB_POOL__;
};

// Monitoramento de performance e log de queries lentas
const originalQuery = pool.query;
pool.query = async function (this: any, text: any, params: any) {
  const start = Date.now();
  const res = await (originalQuery.apply(this, [text, params] as any) as any);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`[SLOW DATABASE QUERY] ${duration}ms - ${typeof text === 'string' ? text : text.text}`);
  }
  return res;
} as any;

export const setDbPool = (pool: Pool) => {
  dbPool = pool;
};

// Função para gerar IDs únicos (UUID via PostgreSQL)
export const generateId = () => {
  // Gera um UUID v4 formatado como string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Função para gerar código de indicação
export const generateReferralCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// Função para inicializar o banco de dados (criar tabelas se não existirem)
export const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('Conectado ao PostgreSQL com sucesso!');

    // Criar extensão UUID se não existir
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Verificar se a tabela users existe e recriar se necessário (mudança de schema password -> password_hash)
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `);

    if (tableExists.rows[0].exists) {
      // Verificar se tem a coluna password (schema antigo)
      const oldColumnExists = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'password'
      `);

      if (oldColumnExists.rows.length > 0) {
        console.log('Detectado schema antigo (coluna password). Recriando tabela users...');
        // Drop cascade para remover referências de outras tabelas
        await client.query('DROP TABLE users CASCADE');
        // Também dropar tabelas dependentes que podem ter ficado inconsistentes
        await client.query('DROP TABLE IF EXISTS quotas CASCADE');
        await client.query('DROP TABLE IF EXISTS loans CASCADE');
        await client.query('DROP TABLE IF EXISTS transactions CASCADE');
      } else {
        // Se a tabela existe, verificar se tem as colunas necessárias
        // Verificar individualmente as colunas críticas e adicionar se faltarem (mais seguro que DROP TABLE)
        const scoreColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'score'
        `);

        if (scoreColumn.rows.length === 0) {
          console.log('Adicionando coluna score à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN score INTEGER DEFAULT 0');
        }

        const verifiedColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_email_verified'
        `);

        if (verifiedColumn.rows.length === 0) {
          console.log('Adicionando colunas de verificação de email...');
          await client.query('ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN DEFAULT FALSE');
          await client.query('ALTER TABLE users ADD COLUMN verification_code VARCHAR(10)');
          await client.query('ALTER TABLE users ADD COLUMN reset_password_token VARCHAR(255)');
        }

        const tfaColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'two_factor_secret'
        `);

        if (tfaColumn.rows.length === 0) {
          console.log('Adicionando colunas de 2FA à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN two_factor_secret TEXT');
          await client.query('ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE');
        }

        const termsColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'accepted_terms_at'
        `);

        if (termsColumn.rows.length === 0) {
          console.log('Adicionando coluna accepted_terms_at à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN accepted_terms_at TIMESTAMP');
        }

        const titleColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'title_downloaded'
        `);

        if (titleColumn.rows.length === 0) {
          console.log('Adicionando colunas de título à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN title_downloaded BOOLEAN DEFAULT FALSE');
          await client.query('ALTER TABLE users ADD COLUMN title_downloaded_at TIMESTAMP');
        }

        const roleColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
        `);

        if (roleColumn.rows.length === 0) {
          console.log('Adicionando coluna role e status à tabela users...');
          await client.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'MEMBER'");
          await client.query("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE'");
        }

        const checkinColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_checkin_at'
        `);

        if (checkinColumn.rows.length === 0) {
          console.log('Adicionando coluna last_checkin_at à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN last_checkin_at TIMESTAMP');
        }

        const cpfColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'cpf'
        `);

        if (cpfColumn.rows.length === 0) {
          console.log('Adicionando coluna cpf à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN cpf VARCHAR(14)');
        }

        const lastIpColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_ip'
        `);

        if (lastIpColumn.rows.length === 0) {
          console.log('Adicionando coluna last_ip à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN last_ip VARCHAR(45)');
        }

        const lastLoginColumn = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_login_at'
        `);

        if (lastLoginColumn.rows.length === 0) {
          console.log('Adicionando coluna last_login_at à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP');
        }

        const videoRewardColumn = await client.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'last_video_reward_at'
        `);
        if (videoRewardColumn.rows.length === 0) {
          console.log('Adicionando coluna last_video_reward_at à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN last_video_reward_at TIMESTAMP');
        }

        const pendingBalanceColumn = await client.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'pending_balance'
        `);
        if (pendingBalanceColumn.rows.length === 0) {
          console.log('Adicionando coluna pending_balance à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN pending_balance DECIMAL(10,2) DEFAULT 0');
        }

        const avatarUrlColumn = await client.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'avatar_url'
        `);
        if (avatarUrlColumn.rows.length === 0) {
          console.log('Adicionando coluna avatar_url à tabela users...');
          await client.query('ALTER TABLE users ADD COLUMN avatar_url TEXT');
        }

        console.log('Tabela users verificada e atualizada com sucesso');
      }
    }

    // Criar tabela de usuários (usando SERIAL para auto-incremento)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        secret_phrase VARCHAR(255),
        pix_key VARCHAR(255),
        balance DECIMAL(10,2) DEFAULT 0,
        pending_balance DECIMAL(10,2) DEFAULT 0,
        avatar_url TEXT,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Garantir que todas as colunas de vendedor existam na tabela users
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seller BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_status VARCHAR(20) DEFAULT 'none';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_account_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_wallet_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_company_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_cpf_cnpj VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_phone VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_street VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_number VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_neighborhood VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_city VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_state VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_postal_code VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_cep VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_created_at TIMESTAMP;
      
      -- Garantir que colunas críticas aceitem NULL para Google Auth
      ALTER TABLE users ALTER COLUMN secret_phrase DROP NOT NULL;
      ALTER TABLE users ALTER COLUMN pix_key DROP NOT NULL;
      
      -- Coluna de timestamp de atualização
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      
      -- DELIVERY PREMIUM: Pausa manual da loja
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;

      -- LOGÍSTICA & ENTREGADORES
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_courier BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_status VARCHAR(20) DEFAULT 'none';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_vehicle VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_phone VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_cpf VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_city VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_state VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_price_per_km DECIMAL(10,2) DEFAULT 2.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_id_photo TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_vehicle_photo TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_doc_photo TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_created_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_penalty_until TIMESTAMP;

      -- KYC & PERFIL
      ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_type VARCHAR(20) DEFAULT 'FREE';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'NONE';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_document_path TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_notes TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS safe_contact_phone VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS protection_expires_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS panic_phrase VARCHAR(255);

      -- FINANÇAS & RECOMPENSAS
      ALTER TABLE users ADD COLUMN IF NOT EXISTS total_dividends_earned DECIMAL(15,2) DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS security_lock_until TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_points INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_ad_points INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS total_ad_points INTEGER DEFAULT 0;

      -- COLUNAS DE VENDEDOR ADICIONAIS (PDV & MARKETPLACE)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seller BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_status VARCHAR(20) DEFAULT 'none';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS merchant_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_company_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_cpf_cnpj VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_phone VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_street VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_number VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_neighborhood VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_city VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_state VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_address_postal_code VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_company_type VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS restaurant_category VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS opening_hours TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_restaurant BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_liquor_store BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_rating DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_seller BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_courier BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_created_at TIMESTAMP;
    `);

    // Verificar o tipo da coluna id da tabela users para garantir integridade das chaves estrangeiras
    const userIdTypeResult = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'id'
    `);

    let userIdType = 'INTEGER'; // Default para SERIAL
    if (userIdTypeResult.rows.length > 0) {
      const type = userIdTypeResult.rows[0].data_type;
      console.log(`Tipo de dado detectado para users.id: ${type}`);
      if (type === 'uuid') {
        userIdType = 'UUID';
      }
    }

    // Criar tabela de cotas (usando SERIAL para consistência)
    // Atualizado: Removida coluna quantity, unit_price e total_amount pois agora é 1 linha por cota
    // Atualizado: Usa o tipo correto para user_id (UUID ou INTEGER)
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotas (
        id SERIAL PRIMARY KEY,
        user_id ${userIdType} REFERENCES users(id),
        purchase_price DECIMAL(10,2) NOT NULL,
        current_value DECIMAL(10,2) NOT NULL,
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        yield_rate DECIMAL(5,2) DEFAULT 0.5
      );
    `);

    // Garantir colunas novas na tabela quotas
    await client.query(`
      ALTER TABLE quotas ADD COLUMN IF NOT EXISTS yield_rate DECIMAL(5,2) DEFAULT 0.5;
    `);

    // Verificar se a tabela quotas tem a estrutura antiga
    const quotasTableInfo = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quotas' AND column_name = 'quantity'
    `);

    if (quotasTableInfo.rows.length > 0) {
      console.log('Detectado schema antigo na tabela quotas (com coluna quantity). Recriando tabela...');
      await client.query('DROP TABLE quotas CASCADE');
      await client.query(`
        CREATE TABLE IF NOT EXISTS quotas (
          id SERIAL PRIMARY KEY,
          user_id ${userIdType} REFERENCES users(id),
          purchase_price DECIMAL(10,2) NOT NULL,
          current_value DECIMAL(10,2) NOT NULL,
          purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) DEFAULT 'ACTIVE'
        );
      `);
      console.log('Tabela quotas recriada com novo schema.');
    }

    // Verificar se a tabela loans existe
    const loansTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'loans'
      );
    `);

    if (loansTableExists.rows[0].exists) {
      // Verificar se a coluna installments existe na tabela loans
      const installmentsColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'loans'
          AND column_name = 'installments'
        );
      `);

      // Se a coluna installments não existir, adicioná-la
      if (!installmentsColumnExists.rows[0].exists) {
        await client.query('ALTER TABLE loans ADD COLUMN installments INTEGER DEFAULT 1');
        console.log('Coluna installments adicionada à tabela loans');
      }

      // Verificar se a coluna pix_key_to_receive existe na tabela loans
      const pixKeyColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'loans'
          AND column_name = 'pix_key_to_receive'
        );
      `);

      if (!pixKeyColumnExists.rows[0].exists) {
        await client.query('ALTER TABLE loans ADD COLUMN pix_key_to_receive VARCHAR(255)');
        console.log('Coluna pix_key_to_receive adicionada à tabela loans');
      }

      // Verificar se a coluna penalty_rate existe na tabela loans
      const penaltyRateColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'loans'
          AND column_name = 'penalty_rate'
        );
      `);

      if (!penaltyRateColumnExists.rows[0].exists) {
        // Adicionar penalty_rate como nullable inicialmente para evitar erro, depois update com default
        await client.query('ALTER TABLE loans ADD COLUMN penalty_rate DECIMAL(5,2) DEFAULT 0.4');
        console.log('Coluna penalty_rate adicionada à tabela loans');
      }

      // Verificar se a coluna term_days existe na tabela loans
      const termDaysColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'loans'
          AND column_name = 'term_days'
        );
      `);

      if (!termDaysColumnExists.rows[0].exists) {
        await client.query('ALTER TABLE loans ADD COLUMN term_days INTEGER DEFAULT 30');
        console.log('Coluna term_days adicionada à tabela loans');
      }
    }

    // Criar tabela de empréstimos (usando SERIAL para consistência)
    // Atualizado para incluir todas as colunas
    await client.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id SERIAL PRIMARY KEY,
        user_id ${userIdType} REFERENCES users(id),
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
        pix_key_to_receive VARCHAR(255)
      );
    `);

    // Garantir que as colunas novas existam em bancos já criados
    await client.query(`
      ALTER TABLE loans ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) DEFAULT 'NONE';
      ALTER TABLE loans ADD COLUMN IF NOT EXISTS metadata JSONB;
    `);

    // Verificar se a tabela loan_installments existe
    const loanInstallmentsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'loan_installments'
      );
    `);

    if (!loanInstallmentsTableExists.rows[0].exists) {
      // Criar tabela de parcelas de empréstimos (usando SERIAL para consistência)
      await client.query(`
        CREATE TABLE loan_installments (
          id SERIAL PRIMARY KEY,
          loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
          installment_number INTEGER,
          amount DECIMAL(10,2),
          expected_amount DECIMAL(10,2),
          due_date TIMESTAMP,
          status VARCHAR(20) DEFAULT 'PENDING',
          paid_at TIMESTAMP,
          use_balance BOOLEAN DEFAULT FALSE,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Tabela loan_installments criada com sucesso!');
    } else {
      // Garantir que todas as colunas existam em bancos já criados
      await client.query(`
        ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS installment_number INTEGER;
        ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS expected_amount DECIMAL(10,2);
        ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
        ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';
        ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
        ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS use_balance BOOLEAN DEFAULT FALSE;
        ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS metadata JSONB;
      `);
      console.log('Colunas da tabela loan_installments verificadas/atualizadas');
    }

    // Verificar se a tabela transactions existe
    const transactionsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'transactions'
      );
    `);

    if (transactionsTableExists.rows[0].exists) {
      // Verificar se a coluna metadata existe na tabela transactions
      const metadataColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'transactions'
          AND column_name = 'metadata'
        );
      `);

      // Se a coluna metadata não existir, adicioná-la
      if (!metadataColumnExists.rows[0].exists) {
        await client.query('ALTER TABLE transactions ADD COLUMN metadata JSONB');
        console.log('Coluna metadata adicionada à tabela transactions');
      }
    }

    // Criar tabela de transações (usando SERIAL para consistência)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id ${userIdType} REFERENCES users(id),
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

    // Garantir que as colunas novas existam em bancos já criados
    await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) DEFAULT 'NONE';
    `);

    // Verificar se a coluna gateway_cost existe na tabela transactions
    const gatewayCostColumnExists = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'gateway_cost'
      );
    `);

    if (!gatewayCostColumnExists.rows[0].exists) {
      await client.query('ALTER TABLE transactions ADD COLUMN gateway_cost DECIMAL(10,2) DEFAULT 0');
      console.log('Coluna gateway_cost adicionada à tabela transactions');
    }

    // Criar tabela de configuração do sistema
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
        total_corporate_investment_reserve DECIMAL(20,2) DEFAULT 0,
        credit_guarantee_fund DECIMAL(20,2) DEFAULT 0,
        mutual_reserve DECIMAL(20,2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Garantir que as colunas novas existam em bancos já criados
    await client.query(`
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS total_tax_reserve DECIMAL(20,2) DEFAULT 0;
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS total_operational_reserve DECIMAL(20,2) DEFAULT 0;
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS total_owner_profit DECIMAL(20,2) DEFAULT 0;
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS investment_reserve DECIMAL(20,2) DEFAULT 0;
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS courier_price_per_km DECIMAL(10,2) DEFAULT 2.50;
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS mutual_protection_fund DECIMAL(20,2) DEFAULT 0;
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS mutual_reserve DECIMAL(20,2) DEFAULT 0;
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS total_corporate_investment_reserve DECIMAL(20,2) DEFAULT 0;
      ALTER TABLE system_config ADD COLUMN IF NOT EXISTS credit_guarantee_fund DECIMAL(20,2) DEFAULT 0;
    `);

    // Migração de saldo (separada para garantir que as colunas existam)
    await client.query(`
      UPDATE system_config SET 
        mutual_reserve = mutual_reserve + mutual_protection_fund,
        mutual_protection_fund = 0
      WHERE mutual_protection_fund > 0;
    `);

    // Verificar se a coluna total_gateway_costs existe na tabela system_config
    const totalGatewayCostsColumnExists = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'system_config' AND column_name = 'total_gateway_costs'
      );
    `);

    console.log('--- [DB] Initializing Core Tables ---');
    // Criar tabela de códigos de indicação (Sistema Admin)
    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        created_by ${userIdType} REFERENCES users(id),
        max_uses INTEGER,
        current_uses INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Garantir coluna is_verified para bancos existentes
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE');

    if (!totalGatewayCostsColumnExists.rows[0].exists) {
      await client.query('ALTER TABLE system_config ADD COLUMN total_gateway_costs DECIMAL(15,2) DEFAULT 0');
      console.log('Coluna total_gateway_costs adicionada à tabela system_config');
    }

    // Verificar se a coluna total_manual_costs existe na tabela system_config
    const totalManualCostsColumnExists = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'system_config' AND column_name = 'total_manual_costs'
      );
    `);

    if (!totalManualCostsColumnExists.rows[0].exists) {
      await client.query('ALTER TABLE system_config ADD COLUMN total_manual_costs DECIMAL(15,2) DEFAULT 0');
      console.log('Coluna total_manual_costs adicionada à tabela system_config');
    }

    // Verificar se a coluna updated_at existe na tabela system_config
    const updatedAtColumnExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'system_config'
        AND column_name = 'updated_at'
      );
    `);

    // Se a coluna updated_at não existir, adicioná-la
    if (!updatedAtColumnExists.rows[0].exists) {
      await client.query('ALTER TABLE system_config ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      console.log('Coluna updated_at adicionada à tabela system_config');
    }

    // Criar tabela de auditoria (audit_logs - Fintech Compliance) - Unificada abaixo no bloco de auditoria

    // Criar tabela de auditoria administrativa (admin_logs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        admin_id ${userIdType} REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(20) NOT NULL,
        entity_id VARCHAR(50),
        old_values JSONB,
        new_values JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela de rate limiting (rate_limit_logs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_logs (
        id SERIAL PRIMARY KEY,
        identifier VARCHAR(100) NOT NULL,
        user_id ${userIdType} REFERENCES users(id),
        count INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        endpoint VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela de produtos (Loja de Afiliados - Deprecated em favor do Marketplace P2P)
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        affiliate_url TEXT NOT NULL,
        price DECIMAL(10, 2),
        category VARCHAR(50) DEFAULT 'geral',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- NOVO MERCADO CRED30 (P2P MARKETPLACE) ---

    // Tabela de Anúncios (OLX STYLE) com suporte a impulsionamento
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_listings (
        id SERIAL PRIMARY KEY,
        seller_id ${userIdType} REFERENCES users(id),
        quota_id INTEGER REFERENCES quotas(id), -- Referência para cota à venda no mercado secundário
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(50) DEFAULT 'OUTROS',
        image_url TEXT,
        status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, SOLD, PAUSED, DELETED
        is_boosted BOOLEAN DEFAULT FALSE,
        boost_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Garantir que as colunas de impulsionamento e quota_id existem (para bancos legados)
    await client.query(`
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMP;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS quota_id INTEGER REFERENCES quotas(id);
      
      -- Suporte a itens digitais e logística
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'PHYSICAL'; -- PHYSICAL, DIGITAL
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS digital_content TEXT;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS required_vehicle VARCHAR(20) DEFAULT 'MOTO';
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 1;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pickup_address TEXT;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pickup_postal_code VARCHAR(20);
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS weight_grams INTEGER DEFAULT 1000;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS free_shipping BOOLEAN DEFAULT FALSE;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS shipping_price DECIMAL(10,2) DEFAULT 0;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS delivery_fee_final DECIMAL(10,2) DEFAULT 0;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS food_options JSONB DEFAULT '[]';
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS seller_phone VARCHAR(20);
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS is_food BOOLEAN DEFAULT FALSE;
      ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS estimated_prep_time_minutes INTEGER DEFAULT 20;

      -- Galeria de Imagens
      CREATE TABLE IF NOT EXISTS marketplace_listing_images (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Variantes de Produtos
      CREATE TABLE IF NOT EXISTS marketplace_listing_variants (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        name VARCHAR(100),
        color VARCHAR(50),
        size VARCHAR(50),
        stock INTEGER DEFAULT 0,
        price DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Contatos e Analytics
      CREATE TABLE IF NOT EXISTS marketplace_contacts (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        buyer_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
        points_spent INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(listing_id, buyer_id)
      );

      -- Categorias de Food/Delivery
      CREATE TABLE IF NOT EXISTS marketplace_food_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50),
        image_url TEXT,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        slug VARCHAR(100) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Inserir categorias padrão se não houver nenhuma
      INSERT INTO marketplace_food_categories (name, slug, icon, display_order)
      SELECT 'Restaurantes', 'restaurantes', 'utensils', 1
      WHERE NOT EXISTS (SELECT 1 FROM marketplace_food_categories WHERE slug = 'restaurantes');

      INSERT INTO marketplace_food_categories (name, slug, icon, display_order)
      SELECT 'Bebidas', 'bebidas', 'glass-martini-alt', 2
      WHERE NOT EXISTS (SELECT 1 FROM marketplace_food_categories WHERE slug = 'bebidas');

      INSERT INTO marketplace_food_categories (name, slug, icon, display_order)
      SELECT 'Mercado', 'mercado', 'shopping-basket', 3
      WHERE NOT EXISTS (SELECT 1 FROM marketplace_food_categories WHERE slug = 'mercado');

      INSERT INTO marketplace_food_categories (name, slug, icon, display_order)
      SELECT 'Farmácia', 'farmacia', 'pills', 4
      WHERE NOT EXISTS (SELECT 1 FROM marketplace_food_categories WHERE slug = 'farmacia');
    `);

    // Tabela de Pedidos / Escrow (Garantia Cred30)
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_orders (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER REFERENCES marketplace_listings(id),
        buyer_id ${userIdType} REFERENCES users(id),
        seller_id ${userIdType} REFERENCES users(id),
        amount DECIMAL(10, 2) NOT NULL,
        fee_amount DECIMAL(10, 2) NOT NULL, -- Taxa de 5-10% da Cred30 pela garantia
        seller_amount DECIMAL(10, 2) NOT NULL, -- Valor que o vendedor receberá (amount - fee)
        status VARCHAR(30) DEFAULT 'WAITING_PAYMENT', -- WAITING_PAYMENT, WAITING_SHIPPING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED, DISPUTE
        payment_method VARCHAR(20), -- BALANCE, PIX, etc
        delivery_address TEXT,
        contact_phone VARCHAR(20),
        dispute_reason TEXT,
        disputed_at TIMESTAMP,
        buyer_rating INTEGER, -- -5 a 5
        seller_rating INTEGER, -- -5 a 5
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tracking_code VARCHAR(100),
        offline_token VARCHAR(50),
        listing_ids INTEGER[],
        is_lote BOOLEAN DEFAULT FALSE,
        quantity INTEGER DEFAULT 1,
        variant_id INTEGER,
        item_title VARCHAR(255),
        pickup_lat NUMERIC,
        pickup_lng NUMERIC,
        delivery_lat NUMERIC,
        delivery_lng NUMERIC,
        pickup_code VARCHAR(10),
        delivery_confirmation_code VARCHAR(10),
        invited_courier_id INTEGER
      )
    `);

    // Garantir que a coluna de token offline existe
    await client.query(`
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS offline_token VARCHAR(50);
    `);

    // Garantir colunas novas
    await client.query(`
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMP;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS buyer_rating INTEGER;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS seller_rating INTEGER;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_address TEXT;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(30) DEFAULT 'NONE';
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_id ${userIdType} REFERENCES users(id);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(10);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS variant_id INTEGER;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS item_title VARCHAR(255);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_confirmation_code VARCHAR(10);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS invited_courier_id INTEGER;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS previous_couriers INTEGER[];
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS selected_options JSONB DEFAULT '[]';
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS module_type VARCHAR(20) DEFAULT 'PRODUCT';
    `);

    // --- VARIANTES E IMAGENS (PHASE 3) ---

    // Tabela de Variantes de Anúncios (Cor, Tamanho, Estoque individual)
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_listing_variants (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        name VARCHAR(100), -- Ex: "Azul / M"
        color VARCHAR(50),
        size VARCHAR(50),
        stock INTEGER DEFAULT 0,
        price DECIMAL(10, 2), -- Opcional, se variar por modelo
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de Imagens Adicionais (Galeria)
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_listing_images (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10, 8);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(11, 8);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10, 8);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(11, 8);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_lat DECIMAL(10, 8);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_lng DECIMAL(11, 8);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES marketplace_listing_variants(id);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS invited_courier_id UUID;
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS previous_couriers INTEGER[];
      ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS listing_ids INTEGER[];
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS is_lote BOOLEAN DEFAULT FALSE;
      
      -- DELIVERY PREMIUM: Opcionais selecionados e Rastreio GPS
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS selected_options JSONB DEFAULT '[]';
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_lat DECIMAL(10, 8);
      ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_lng DECIMAL(11, 8);
    `);

    // --- SISTEMA DE PROMOÇÃO DE VÍDEOS (VIEW-TO-EARN) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS promo_videos(
      id SERIAL PRIMARY KEY,
      user_id ${userIdType} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      video_url TEXT NOT NULL,
      thumbnail_url TEXT,
      platform VARCHAR(50) DEFAULT 'YOUTUBE',
      duration_seconds INTEGER DEFAULT 60,
      price_per_view DECIMAL(10, 2) NOT NULL DEFAULT 0.05,
      min_watch_seconds INTEGER NOT NULL DEFAULT 30,
      budget DECIMAL(10, 2) NOT NULL DEFAULT 0,
      spent DECIMAL(10, 2) NOT NULL DEFAULT 0,
      max_views INTEGER,
      target_views INTEGER DEFAULT 1000,
      daily_limit INTEGER DEFAULT 100,
      status VARCHAR(20) DEFAULT 'PENDING',
      is_active BOOLEAN DEFAULT FALSE,
      total_views INTEGER DEFAULT 0,
      unique_viewers INTEGER DEFAULT 0,
      total_watch_time INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      approved_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      expires_at TIMESTAMP WITH TIME ZONE,
      is_approved BOOLEAN DEFAULT FALSE,
      approved_by ${userIdType} REFERENCES users(id),
      rejection_reason TEXT,
      tag VARCHAR(30) DEFAULT 'OUTROS',
      budget_gross DECIMAL(10, 2) DEFAULT 0
    );

      ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS budget_gross DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS tag VARCHAR(30) DEFAULT 'OUTROS';

      CREATE TABLE IF NOT EXISTS promo_video_views(
      id SERIAL PRIMARY KEY,
      video_id INTEGER NOT NULL REFERENCES promo_videos(id) ON DELETE CASCADE,
      viewer_id ${userIdType} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      watch_time_seconds INTEGER NOT NULL DEFAULT 0,
      completed BOOLEAN DEFAULT FALSE,
      earned DECIMAL(10, 2) DEFAULT 0,
      paid_at TIMESTAMP WITH TIME ZONE,
      ip_address VARCHAR(45),
      user_agent TEXT,
      device_fingerprint VARCHAR(100),
      started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP WITH TIME ZONE,
      UNIQUE(video_id, viewer_id)
    );

    --SISTEMA DE SESSÕES DE ESTUDO(ACADEMY)
      CREATE TABLE IF NOT EXISTS education_sessions(
      id SERIAL PRIMARY KEY,
      user_id ${userIdType} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      video_id VARCHAR(50) NOT NULL,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      total_seconds INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      ip_address VARCHAR(45),
      user_agent TEXT
    );
      CREATE INDEX IF NOT EXISTS idx_edu_sessions_user ON education_sessions(user_id);

      -- ACADEMY: Compras de Cursos (Necessária para Relatório Fiscal)
      CREATE TABLE IF NOT EXISTS course_purchases (
        id SERIAL PRIMARY KEY,
        user_id ${userIdType} NOT NULL REFERENCES users(id),
        course_id INTEGER NOT NULL,
        amount_paid DECIMAL(10,2) NOT NULL,
        instructor_share DECIMAL(10,2) NOT NULL,
        platform_share DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id)
      );

      ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS budget_gross DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS tag VARCHAR(30) DEFAULT 'OUTROS';
      ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255);

      CREATE INDEX IF NOT EXISTS idx_promo_videos_user_v2 ON promo_videos(user_id);
      CREATE INDEX IF NOT EXISTS idx_promo_videos_status_v2 ON promo_videos(status, is_active);
    `);

    // --- SISTEMA DE SUPORTE VIA CHAT (IA + HUMANO) ---
    console.log('Verificando tabelas de suporte...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_chats(
      id SERIAL PRIMARY KEY,
      user_id ${userIdType} REFERENCES users(id),
      status VARCHAR(20) DEFAULT 'AI_ONLY', --AI_ONLY, PENDING_HUMAN, ACTIVE_HUMAN, CLOSED
        rating INTEGER,
      feedback_comment TEXT,
      last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    --Garantir colunas de feedback para bancos existentes
      ALTER TABLE support_chats ADD COLUMN IF NOT EXISTS rating INTEGER;
      ALTER TABLE support_chats ADD COLUMN IF NOT EXISTS feedback_comment TEXT;

      CREATE TABLE IF NOT EXISTS support_messages(
      id SERIAL PRIMARY KEY,
      chat_id INTEGER REFERENCES support_chats(id) ON DELETE CASCADE,
      sender_id ${userIdType} REFERENCES users(id), --NULL se for IA
        role VARCHAR(20) NOT NULL, --user, assistant, admin
        content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_support_chats_user ON support_chats(user_id);
      CREATE INDEX IF NOT EXISTS idx_support_chats_status ON support_chats(status);
      CREATE INDEX IF NOT EXISTS idx_support_messages_chat ON support_messages(chat_id);
`);

    console.log('Tabelas de suporte criadas/verificadas com sucesso!');

    // --- SISTEMA DE SEGURO DE ENTREGAS ---
    console.log('Criando tabelas do sistema de seguro de entregas...');
    await client.query(`
      -- Fundo de Seguro: Reserva de cada entrega para cobrir incidentes
      CREATE TABLE IF NOT EXISTS delivery_insurance_fund (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES marketplace_orders(id) ON DELETE CASCADE,
        courier_contribution DECIMAL(10,2) NOT NULL DEFAULT 0,
        platform_contribution DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) DEFAULT 'RESERVED',
        released_at TIMESTAMP,
        used_for_claim_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Claims: Registro de incidentes reportados
      CREATE TABLE IF NOT EXISTS delivery_claims (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES marketplace_orders(id) ON DELETE SET NULL,
        courier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        claim_type VARCHAR(30) NOT NULL,
        description TEXT,
        evidence_urls TEXT[],
        seller_refund DECIMAL(10,2) DEFAULT 0,
        buyer_refund DECIMAL(10,2) DEFAULT 0,
        courier_penalty DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'PENDING',
        admin_notes TEXT,
        resolved_by INTEGER REFERENCES users(id),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Colunas de aceite de termos e saldo de seguro do entregador
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_terms_accepted_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_terms_accepted_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_insurance_balance DECIMAL(10,2) DEFAULT 0;

      -- Índices para performance
      CREATE INDEX IF NOT EXISTS idx_insurance_fund_order ON delivery_insurance_fund(order_id);
      CREATE INDEX IF NOT EXISTS idx_insurance_fund_status ON delivery_insurance_fund(status);
      CREATE INDEX IF NOT EXISTS idx_claims_status ON delivery_claims(status);
      CREATE INDEX IF NOT EXISTS idx_claims_courier ON delivery_claims(courier_id);
    `);
    console.log('Tabelas de seguro de entregas criadas/verificadas com sucesso!');


    console.log('Tabelas criadas/verificadas com sucesso!');

    // Criar índices de performance (protegido por try-catch)
    try {
      console.log('Criando índices de performance...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
        CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
        CREATE INDEX IF NOT EXISTS idx_quotas_user_id ON quotas(user_id);
        CREATE INDEX IF NOT EXISTS idx_quotas_status ON quotas(status);
        CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
        CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
        CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
        CREATE INDEX IF NOT EXISTS idx_transactions_payout_pending ON transactions(payout_status) WHERE payout_status = 'PENDING_PAYMENT';
        CREATE INDEX IF NOT EXISTS idx_loans_payout_pending ON loans(payout_status) WHERE payout_status = 'PENDING_PAYMENT';
        CREATE INDEX IF NOT EXISTS idx_transactions_user_type_idx ON transactions(user_id, type);
        CREATE INDEX IF NOT EXISTS idx_loans_user_status_active ON loans(user_id, status) WHERE status IN('APPROVED', 'PAYMENT_PENDING');
        CREATE INDEX IF NOT EXISTS idx_users_score_desc ON users(score DESC);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_created_desc ON transactions(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_marketplace_active_created_desc ON marketplace_listings(status, created_at DESC) WHERE status = 'ACTIVE';
      `);
      console.log('✅[DB] Índices de performance criados');
    } catch (err: unknown) {
      console.warn('⚠️[DB] Índices de performance (parcial):', (err as any)?.message);
    }

    // Otimização de precisão decimal (protegido por try-catch)
    try {
      await client.query(`
        ALTER TABLE system_config ALTER COLUMN system_balance TYPE DECIMAL(20, 2);
        ALTER TABLE system_config ALTER COLUMN profit_pool TYPE DECIMAL(20, 2);
        ALTER TABLE system_config ALTER COLUMN total_tax_reserve TYPE DECIMAL(20, 2);
        ALTER TABLE system_config ALTER COLUMN total_operational_reserve TYPE DECIMAL(20, 2);
        ALTER TABLE system_config ALTER COLUMN total_owner_profit TYPE DECIMAL(20, 2);
        ALTER TABLE system_config ALTER COLUMN total_gateway_costs TYPE DECIMAL(20, 2);
      `);
    } catch (err: unknown) {
      console.warn('⚠️[DB] Precisão decimal (parcial):', (err as any)?.message);
    }

    // ANALYZE e FILLFACTOR isolados (podem travar em Neon)
    try { await client.query('ANALYZE users; ANALYZE transactions; ANALYZE loans; ANALYZE quotas;'); } catch (e) { console.error(e); }
    try { await client.query('ANALYZE marketplace_listings; ANALYZE marketplace_orders;'); } catch (e) { console.error(e); }
    try { await client.query('ALTER TABLE users SET(fillfactor = 85);'); } catch (e) { console.error(e); }

    // Adicionar campos de monetização na tabela de usuários
    try {
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_type VARCHAR(20) DEFAULT 'FREE';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_reward_at TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS total_dividends_earned DECIMAL(12, 2) DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS security_lock_until TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS panic_phrase VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_under_duress BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS safe_contact_phone VARCHAR(20);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_benefit_uses INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS video_points INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_points INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_ad_points INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS total_ad_points INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS protection_expires_at TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_chests_opened INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_chest_date VARCHAR(10);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'NONE';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_document_path TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_notes TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);
      `);
    } catch (err: unknown) {
      console.warn('⚠️[DB] Campos de monetização (parcial):', (err as any)?.message);
    }

    // Criar tabelas de auditoria e webhooks (protegido)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs(
          id SERIAL PRIMARY KEY,
          user_id ${userIdType} REFERENCES users(id),
          action_type VARCHAR(100),
          entity_type VARCHAR(50),
          entity_id VARCHAR(100),
          old_values JSONB,
          new_values JSONB,
          ip_address VARCHAR(45),
          user_agent TEXT,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_type VARCHAR(100);
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id VARCHAR(100);
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;

        CREATE TABLE IF NOT EXISTS webhook_logs(
          id SERIAL PRIMARY KEY,
          provider VARCHAR(50) NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(20) DEFAULT 'PENDING',
          error_message TEXT,
          processed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_action_type ON audit_logs(action_type);
        CREATE INDEX IF NOT EXISTS idx_webhook_status ON webhook_logs(status);
      `);
      console.log('✅[DB] Auditoria e webhooks inicializados');
    } catch (err: unknown) {
      console.error('❌[DB] Erro ao inicializar auditoria:', (err as any)?.message);
    }

    // --- SISTEMA DE NOTIFICAÇÕES (PERSISTÊNCIA) ---
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(20) DEFAULT 'INFO',
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
      `);
      console.log('✅[DB] Sistema de notificações inicializado');
    } catch (err: unknown) {
      console.error('❌[DB] Erro ao inicializar notificações:', (err as any)?.message);
    }

    // --- SISTEMA PDV (PONTO DE VENDA) ---
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS pdv_subscriptions (
          id SERIAL PRIMARY KEY,
          user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
          plan VARCHAR(20) NOT NULL,
          max_devices INTEGER DEFAULT 1,
          price_monthly DECIMAL(10,2) NOT NULL,
          status VARCHAR(20) DEFAULT 'ACTIVE',
          expires_at TIMESTAMP NOT NULL,
          last_payment_at TIMESTAMP,
          auto_renew BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pdv_devices (
          id SERIAL PRIMARY KEY,
          subscription_id INTEGER REFERENCES pdv_subscriptions(id) ON DELETE CASCADE,
          device_name VARCHAR(100) NOT NULL,
          device_token TEXT UNIQUE NOT NULL,
          device_type VARCHAR(20) DEFAULT 'DESKTOP',
          is_active BOOLEAN DEFAULT TRUE,
          last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pdv_products (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(200) NOT NULL,
          barcode VARCHAR(100),
          sku VARCHAR(100),
          price DECIMAL(10,2) NOT NULL,
          cost_price DECIMAL(10,2),
          stock DECIMAL(12,3) DEFAULT 0,
          min_stock DECIMAL(12,3) DEFAULT 5,
          category VARCHAR(100),
          unit VARCHAR(20) DEFAULT 'UN',
          tax_ncm VARCHAR(20),
          image_url TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pdv_sales (
          id SERIAL PRIMARY KEY,
          user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
          device_id INTEGER REFERENCES pdv_devices(id) ON DELETE SET NULL,
          sale_number INTEGER NOT NULL,
          subtotal DECIMAL(12,2) NOT NULL,
          discount DECIMAL(12,2) DEFAULT 0,
          total DECIMAL(12,2) NOT NULL,
          payment_method VARCHAR(20) NOT NULL,
          received_amount DECIMAL(12,2),
          change_amount DECIMAL(12,2) DEFAULT 0,
          customer_cpf VARCHAR(14),
          customer_name VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pdv_sale_items (
          id SERIAL PRIMARY KEY,
          sale_id INTEGER REFERENCES pdv_sales(id) ON DELETE CASCADE,
          product_id UUID REFERENCES pdv_products(id) ON DELETE SET NULL,
          product_name VARCHAR(200) NOT NULL,
          product_barcode VARCHAR(100),
          quantity DECIMAL(12,3) NOT NULL,
          unit_price DECIMAL(12,2) NOT NULL,
          discount DECIMAL(12,2) DEFAULT 0,
          total DECIMAL(12,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pdv_subscription_payments (
          id SERIAL PRIMARY KEY,
          subscription_id INTEGER REFERENCES pdv_subscriptions(id) ON DELETE CASCADE,
          amount DECIMAL(10,2) NOT NULL,
          tax_amount DECIMAL(10,2) DEFAULT 0,
          operational_amount DECIMAL(10,2) DEFAULT 0,
          owner_amount DECIMAL(10,2) DEFAULT 0,
          stability_amount DECIMAL(10,2) DEFAULT 0,
          cotista_amount DECIMAL(10,2) DEFAULT 0,
          corporate_amount DECIMAL(10,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE OR REPLACE FUNCTION get_next_sale_number(target_user_id INTEGER) RETURNS INTEGER AS $$
        DECLARE
            next_num INTEGER;
        BEGIN
            SELECT COALESCE(MAX(sale_number), 1000) + 1 INTO next_num FROM pdv_sales WHERE user_id = target_user_id;
            RETURN next_num;
        END;
        $$ LANGUAGE plpgsql;

        CREATE INDEX IF NOT EXISTS idx_pdv_subs_user ON pdv_subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_pdv_products_user ON pdv_products(user_id);
        CREATE INDEX IF NOT EXISTS idx_pdv_products_barcode ON pdv_products(barcode);
        CREATE INDEX IF NOT EXISTS idx_pdv_sales_user ON pdv_sales(user_id);
        CREATE INDEX IF NOT EXISTS idx_pdv_sales_date ON pdv_sales(created_at);
      `);
      console.log('✅[DB] Sistema PDV inicializado');
    } catch (err: unknown) {
      console.error('❌[DB] Erro ao inicializar PDV:', (err as any)?.message);
    }


    // --- SISTEMA DE GOVERNANÇA (VOTAÇÃO V2) ---
    try {
      console.log('Verificando tabelas de governança...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS governance_proposals(
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          creator_id ${userIdType} REFERENCES users(id),
          category VARCHAR(50) DEFAULT 'general',
          status VARCHAR(20) DEFAULT 'active',
          yes_votes_power DECIMAL(15, 2) DEFAULT 0,
          no_votes_power DECIMAL(15, 2) DEFAULT 0,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS governance_votes(
          id SERIAL PRIMARY KEY,
          proposal_id INTEGER REFERENCES governance_proposals(id) ON DELETE CASCADE,
          user_id ${userIdType} REFERENCES users(id),
          choice VARCHAR(10) NOT NULL,
          voting_power DECIMAL(15, 2) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(proposal_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_gov_votes_proposal ON governance_votes(proposal_id);
        CREATE INDEX IF NOT EXISTS idx_gov_votes_user ON governance_votes(user_id);
      `);
      console.log('✅[DB] Sistema de governança inicializado');
    } catch (err: unknown) {
      console.error('❌[DB] Erro ao inicializar governança:', (err as any)?.message);
    }

    // --- TABELAS CRÍTICAS DE ADMIN (GARANTIR CRIAÇÃO) ---
    try {
      const criticalTables = [
        {
          name: 'course_purchases',
          query: `CREATE TABLE IF NOT EXISTS course_purchases(
            id SERIAL PRIMARY KEY,
            user_id ${userIdType} NOT NULL REFERENCES users(id),
            course_id INTEGER NOT NULL,
            amount_paid DECIMAL(10, 2) NOT NULL,
            instructor_share DECIMAL(10, 2) NOT NULL,
            platform_share DECIMAL(10, 2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, course_id)
          )`
        },
        {
          name: 'transaction_reviews',
          query: `CREATE TABLE IF NOT EXISTS transaction_reviews(
            id SERIAL PRIMARY KEY,
            transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
            user_id ${userIdType} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            comment TEXT,
            is_public BOOLEAN DEFAULT FALSE,
            is_approved BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(transaction_id)
          )`
        },
        {
          name: 'bug_reports',
          query: `CREATE TABLE IF NOT EXISTS bug_reports(
            id SERIAL PRIMARY KEY,
            user_id ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
            user_email VARCHAR(255),
            user_name VARCHAR(255),
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(50) DEFAULT 'general',
            severity VARCHAR(20) DEFAULT 'low',
            status VARCHAR(20) DEFAULT 'open',
            screenshot_url TEXT,
            device_info TEXT,
            admin_notes TEXT,
            resolved_by ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
            resolved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'system_costs',
          query: `CREATE TABLE IF NOT EXISTS system_costs(
            id SERIAL PRIMARY KEY,
            description TEXT NOT NULL,
            amount DECIMAL(20, 2) NOT NULL,
            is_recurring BOOLEAN DEFAULT TRUE,
            category VARCHAR(20) DEFAULT 'MIXED',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        }
      ];

      for (const table of criticalTables) {
        try {
          await client.query(table.query);
          console.log(`✅[DB] Tabela verificada/criada: ${table.name}`);
        } catch (err: unknown) {
          console.error(`❌[DB] Erro ao criar tabela ${table.name}:`, (err as any)?.message);
        }
      }
    } catch (err: unknown) {
      console.error('❌[DB] Erro no bloco de tabelas críticas:', (err as any)?.message);
    }

    // --- CONSORTIUM UPDATES (LATEST) ---
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS consortium_groups(
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          admin_id ${userIdType} REFERENCES users(id),
          status VARCHAR(20) DEFAULT 'ACTIVE',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS consortium_members(
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES consortium_groups(id),
          user_id ${userIdType} REFERENCES users(id),
          status VARCHAR(20) DEFAULT 'ACTIVE',
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE consortium_members ADD COLUMN IF NOT EXISTS invoice_url TEXT;
        ALTER TABLE consortium_members ADD COLUMN IF NOT EXISTS credit_limit_released DECIMAL(15, 2);
        ALTER TABLE consortium_groups ADD COLUMN IF NOT EXISTS reserve_pool DECIMAL(20, 2) DEFAULT 0;
      `);
      console.log('✅[DB] Sistema de Consórcio inicializado');
    } catch (err: unknown) {
      console.error('❌[DB] Erro ao inicializar consórcio:', (err as any)?.message);
    }

    // --- MANUTENÇÃO E OTIMIZAÇÃO (FINAL) ---
    try {
      console.log('Executando manutenção e índices de performance...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
        CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
        CREATE INDEX IF NOT EXISTS idx_quotas_user_id ON quotas(user_id);
        CREATE INDEX IF NOT EXISTS idx_quotas_status ON quotas(status);
        CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
        CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
        CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

        -- Novos índices para otimização batch e admin
        CREATE INDEX IF NOT EXISTS idx_transactions_payout_pending ON transactions(payout_status) WHERE payout_status = 'PENDING_PAYMENT';
        CREATE INDEX IF NOT EXISTS idx_loans_payout_pending ON loans(payout_status) WHERE payout_status = 'PENDING_PAYMENT';
        CREATE INDEX IF NOT EXISTS idx_transactions_user_type_idx ON transactions(user_id, type);
        CREATE INDEX IF NOT EXISTS idx_loans_user_status_active ON loans(user_id, status) WHERE status IN('APPROVED', 'PAYMENT_PENDING');
        CREATE INDEX IF NOT EXISTS idx_users_score_desc ON users(score DESC);

        -- Novas Otimizações de Índices Compostos
        CREATE INDEX IF NOT EXISTS idx_transactions_user_created_desc ON transactions(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_marketplace_active_created_desc ON marketplace_listings(status, created_at DESC) WHERE status = 'ACTIVE';
      `);

      // Otimização de precisão decimal e estatísticas
      await client.query(`
        ALTER TABLE system_config ALTER COLUMN system_balance TYPE DECIMAL(20, 2);
        ALTER TABLE system_config ALTER COLUMN profit_pool TYPE DECIMAL(20, 2);
        ALTER TABLE system_config ALTER COLUMN total_tax_reserve TYPE DECIMAL(20, 2);
        ALTER TABLE system_config ALTER COLUMN total_operational_reserve TYPE DECIMAL(20, 2);
        ALTER TABLE system_config ALTER COLUMN total_owner_profit TYPE DECIMAL(20, 2);
        ALTER TABLE system_config ALTER COLUMN total_gateway_costs TYPE DECIMAL(20, 2);
      `);

      // ANALYZE e FILLFACTOR em blocos separados para não travar
      try { await client.query('ANALYZE users; ANALYZE transactions; ANALYZE loans; ANALYZE quotas;'); } catch (e) { console.error(e); }
      try { await client.query('ANALYZE marketplace_listings; ANALYZE marketplace_orders;'); } catch (e) { console.error(e); }
      try { await client.query('ALTER TABLE users SET(fillfactor = 85);'); } catch (e) { console.error(e); }

      console.log('✅[DB] Manutenção concluída');
    } catch (err: unknown) {
      console.warn('⚠️[DB] Manutenção parcial concluída com avisos:', (err as any)?.message);
    }

  } catch (error) {
    console.error('Erro ao inicializar o banco de dados:', error);
    throw error;
  } finally {
    client.release();
  }
};