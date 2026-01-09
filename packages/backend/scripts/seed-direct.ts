import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('🌱 SEED DIRETO NO BANCO...\n');

        // Ver estrutura da tabela quotas
        const cols = await client.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'quotas'
        `);
        console.log('Colunas da tabela quotas:', cols.rows.map(c => c.column_name).join(', '));

        // Inserir cotas usando apenas as colunas que existem
        console.log('\n💎 Inserindo COTAS...');
        await client.query(`
            INSERT INTO quotas (user_id, status, purchase_date, value, purchase_price, current_value) VALUES (1, 'ACTIVE', NOW(), 50, 50, 50)
        `);
        await client.query(`
            INSERT INTO quotas (user_id, status, purchase_date, value, purchase_price, current_value) VALUES (1, 'ACTIVE', NOW(), 50, 50, 50)
        `);
        await client.query(`
            INSERT INTO quotas (user_id, status, purchase_date, value, purchase_price, current_value) VALUES (2, 'ACTIVE', NOW(), 50, 50, 50)
        `);
        console.log('✅ 3 cotas criadas');

        // Inserir empréstimo
        console.log('\n💳 Inserindo EMPRÉSTIMO...');
        await client.query(`
            INSERT INTO loans (user_id, amount, interest_rate, term_months, monthly_payment, total_due, status, created_at)
            VALUES (2, 100, 0.20, 3, 40, 120, 'ACTIVE', NOW())
        `);
        console.log('✅ 1 empréstimo criado');

        // Inserir vídeos
        console.log('\n📺 Inserindo VÍDEOS...');
        await client.query(`
            INSERT INTO promo_videos (advertiser_id, title, video_url, budget, price_per_view, target_views, status, created_at)
            VALUES (1, 'Conheça o Cred30', 'https://youtube.com/watch?v=test1', 50, 0.10, 500, 'ACTIVE', NOW())
        `);
        await client.query(`
            INSERT INTO promo_videos (advertiser_id, title, video_url, budget, price_per_view, target_views, status, created_at)
            VALUES (1, 'Como usar o Marketplace', 'https://youtube.com/watch?v=test2', 30, 0.05, 600, 'ACTIVE', NOW())
        `);
        console.log('✅ 2 vídeos criados');

        // Inserir cursos
        console.log('\n📚 Inserindo CURSOS...');
        await client.query(`
            INSERT INTO education_courses (title, description, thumbnail_url, status, created_at)
            VALUES ('Finanças Pessoais', 'Aprenda a controlar seu dinheiro', 'https://placehold.co/400', 'ACTIVE', NOW())
        `);
        const courseId = (await client.query(`SELECT id FROM education_courses ORDER BY id DESC LIMIT 1`)).rows[0].id;

        await client.query(`
            INSERT INTO education_lessons (course_id, title, video_url, duration_seconds, reward_points, order_index)
            VALUES ($1, 'Introdução', 'https://youtube.com/embed/test', 300, 10, 1)
        `, [courseId]);
        await client.query(`
            INSERT INTO education_lessons (course_id, title, video_url, duration_seconds, reward_points, order_index)
            VALUES ($1, 'Orçamento', 'https://youtube.com/embed/test2', 400, 15, 2)
        `, [courseId]);
        console.log('✅ 1 curso + 2 aulas criados');

        // Verificar
        console.log('\n📊 RESUMO:');
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

        console.log('\n🎉 SEED COMPLETO!');

    } catch (e: any) {
        console.error('❌ Erro:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
