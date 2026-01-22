import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('🔧 Criando tabelas que faltam...\n');

        // QUOTAS
        await client.query(`
            CREATE TABLE IF NOT EXISTS quotas (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                value DECIMAL(12,2) DEFAULT 50,
                status TEXT DEFAULT 'ACTIVE',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                vesting_start TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('✅ Tabela quotas OK');

        // LOANS
        await client.query(`
            CREATE TABLE IF NOT EXISTS loans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                amount DECIMAL(12,2) NOT NULL,
                interest_rate DECIMAL(5,4) DEFAULT 0.20,
                term_months INTEGER DEFAULT 3,
                monthly_payment DECIMAL(12,2),
                total_due DECIMAL(12,2),
                status TEXT DEFAULT 'PENDING',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                due_date TIMESTAMPTZ,
                metadata JSONB DEFAULT '{}'
            )
        `);
        console.log('✅ Tabela loans OK');

        // LOAN_INSTALLMENTS
        await client.query(`
            CREATE TABLE IF NOT EXISTS loan_installments (
                id SERIAL PRIMARY KEY,
                loan_id INTEGER NOT NULL REFERENCES loans(id),
                installment_number INTEGER NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                due_date TIMESTAMPTZ NOT NULL,
                paid_at TIMESTAMPTZ,
                status TEXT DEFAULT 'PENDING'
            )
        `);
        console.log('✅ Tabela loan_installments OK');

        // PROMO_VIDEOS
        await client.query(`
            CREATE TABLE IF NOT EXISTS promo_videos (
                id SERIAL PRIMARY KEY,
                advertiser_id INTEGER NOT NULL REFERENCES users(id),
                title TEXT NOT NULL,
                video_url TEXT NOT NULL,
                budget DECIMAL(12,2) DEFAULT 0,
                price_per_view DECIMAL(8,4) DEFAULT 0.10,
                target_views INTEGER DEFAULT 100,
                current_views INTEGER DEFAULT 0,
                status TEXT DEFAULT 'ACTIVE',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('✅ Tabela promo_videos OK');

        // PROMO_VIDEO_VIEWS
        await client.query(`
            CREATE TABLE IF NOT EXISTS promo_video_views (
                id SERIAL PRIMARY KEY,
                video_id INTEGER NOT NULL REFERENCES promo_videos(id),
                viewer_id INTEGER NOT NULL REFERENCES users(id),
                points_earned INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(video_id, viewer_id)
            )
        `);
        console.log('✅ Tabela promo_video_views OK');

        // EDUCATION_COURSES
        await client.query(`
            CREATE TABLE IF NOT EXISTS education_courses (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                thumbnail_url TEXT,
                status TEXT DEFAULT 'ACTIVE',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('✅ Tabela education_courses OK');

        // EDUCATION_LESSONS
        await client.query(`
            CREATE TABLE IF NOT EXISTS education_lessons (
                id SERIAL PRIMARY KEY,
                course_id INTEGER NOT NULL REFERENCES education_courses(id),
                title TEXT NOT NULL,
                video_url TEXT,
                duration_seconds INTEGER DEFAULT 300,
                reward_points INTEGER DEFAULT 5,
                order_index INTEGER DEFAULT 1,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('✅ Tabela education_lessons OK');

        // EDUCATION_PROGRESS
        await client.query(`
            CREATE TABLE IF NOT EXISTS education_progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                lesson_id INTEGER NOT NULL REFERENCES education_lessons(id),
                completed_at TIMESTAMPTZ DEFAULT NOW(),
                points_earned INTEGER DEFAULT 0,
                UNIQUE(user_id, lesson_id)
            )
        `);
        console.log('✅ Tabela education_progress OK');

        console.log('\n🎉 Todas as tabelas criadas!');

    } catch (e: any) {
        console.error('❌ Erro:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
