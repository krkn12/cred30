import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('🌱 SEED FINAL - Todos os módulos\n');

        // 1. EMPRÉSTIMO (colunas: user_id, amount, interest_rate, installments, term_days, status)
        console.log('💳 Inserindo EMPRÉSTIMO...');
        try {
            await client.query(`
                INSERT INTO loans (user_id, amount, interest_rate, installments, term_days, status, created_at, total_repayment)
                VALUES (2, 100, 0.20, 3, 90, 'ACTIVE', NOW(), 120)
            `);
            console.log('✅ Empréstimo criado: R$ 100 em 3x de R$ 40');
        } catch (e: any) {
            console.log('⚠️ Empréstimo:', e.message);
        }

        // 2. VÍDEOS PROMO (user_id, title, video_url, budget, price_per_view, target_views, status)
        console.log('\n📺 Inserindo VÍDEOS...');
        try {
            await client.query(`
                INSERT INTO promo_videos (user_id, title, video_url, budget, price_per_view, target_views, status, created_at, is_active)
                VALUES (1, 'Conheça o Cred30!', 'https://youtube.com/watch?v=dQw4w9WgXcQ', 50, 0.10, 500, 'ACTIVE', NOW(), true)
            `);
            await client.query(`
                INSERT INTO promo_videos (user_id, title, video_url, budget, price_per_view, target_views, status, created_at, is_active)
                VALUES (1, 'Como usar o Marketplace', 'https://youtube.com/watch?v=test123', 30, 0.05, 600, 'ACTIVE', NOW(), true)
            `);
            console.log('✅ 2 vídeos criados');
        } catch (e: any) {
            console.log('⚠️ Vídeos:', e.message);
        }

        // 3. CURSOS E AULAS
        console.log('\n📚 Inserindo CURSOS E AULAS...');
        try {
            // Curso
            await client.query(`
                INSERT INTO education_courses (title, description, thumbnail_url, status, created_at)
                VALUES ('Finanças Pessoais 101', 'Aprenda a controlar seu dinheiro', 'https://placehold.co/400x300?text=Financas', 'ACTIVE', NOW())
            `);
            const courseRes = await client.query(`SELECT id FROM education_courses ORDER BY id DESC LIMIT 1`);
            const courseId = courseRes.rows[0].id;

            // Aulas
            await client.query(`
                INSERT INTO education_lessons (course_id, title, video_url, duration_seconds, reward_points, order_index, created_at)
                VALUES ($1, 'Introdução às Finanças', 'https://youtube.com/embed/intro', 300, 10, 1, NOW())
            `, [courseId]);
            await client.query(`
                INSERT INTO education_lessons (course_id, title, video_url, duration_seconds, reward_points, order_index, created_at)
                VALUES ($1, 'Orçamento Familiar', 'https://youtube.com/embed/orcamento', 450, 15, 2, NOW())
            `, [courseId]);
            await client.query(`
                INSERT INTO education_lessons (course_id, title, video_url, duration_seconds, reward_points, order_index, created_at)
                VALUES ($1, 'Investimentos Básicos', 'https://youtube.com/embed/invest', 600, 20, 3, NOW())
            `, [courseId]);
            console.log('✅ 1 curso + 3 aulas criados');
        } catch (e: any) {
            console.log('⚠️ Cursos:', e.message);
        }

        // RESUMO
        console.log('\n📊 RESUMO FINAL:');
        const qc = await client.query(`SELECT COUNT(*) FROM quotas`);
        const lc = await client.query(`SELECT COUNT(*) FROM loans`);
        const vc = await client.query(`SELECT COUNT(*) FROM promo_videos`);
        const cc = await client.query(`SELECT COUNT(*) FROM education_courses`);
        const lsc = await client.query(`SELECT COUNT(*) FROM education_lessons`);

        console.log(`   💎 Cotas: ${qc.rows[0].count}`);
        console.log(`   💳 Empréstimos: ${lc.rows[0].count}`);
        console.log(`   📺 Vídeos: ${vc.rows[0].count}`);
        console.log(`   📚 Cursos: ${cc.rows[0].count}`);
        console.log(`   📖 Aulas: ${lsc.rows[0].count}`);

        console.log('\n🎉 SEED COMPLETO! Teste no app.');

    } catch (e: any) {
        console.error('❌ Erro geral:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
