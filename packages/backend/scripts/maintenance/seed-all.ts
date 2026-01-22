import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('🌱 SEED COMPLETO: Cotas, Empréstimos, Vídeos e Academy\n');

        // Pegar usuários existentes
        const users = await client.query(`SELECT id, name FROM users ORDER BY id LIMIT 4`);
        if (users.rows.length < 2) {
            console.log('❌ Precisa de pelo menos 2 usuários! Rode o seed de entregas primeiro.');
            return;
        }

        const user1 = users.rows[0]; // Josias
        const user2 = users.rows[1]; // teste silvano

        // =============================================
        // 1️⃣ COTAS
        // =============================================
        console.log('💎 1. Criando COTAS...');

        // Verificar se já tem cotas
        const existingQuotas = await client.query(`SELECT COUNT(*) FROM quotas`);
        if (parseInt(existingQuotas.rows[0].count) === 0) {
            // Criar 3 cotas para user1
            for (let i = 0; i < 3; i++) {
                await client.query(`
                    INSERT INTO quotas (user_id, value, status, created_at, vesting_start)
                    VALUES ($1, 50, 'ACTIVE', NOW(), NOW())
                `, [user1.id]);
            }
            console.log(`   ✅ ${user1.name}: 3 cotas criadas (R$ 150)`);

            // Criar 2 cotas para user2
            for (let i = 0; i < 2; i++) {
                await client.query(`
                    INSERT INTO quotas (user_id, value, status, created_at, vesting_start)
                    VALUES ($1, 50, 'ACTIVE', NOW())
                `, [user2.id]);
            }
            console.log(`   ✅ ${user2.name}: 2 cotas criadas (R$ 100)`);
        } else {
            console.log('   ⚠️ Já existem cotas no banco.');
        }

        // =============================================
        // 2️⃣ EMPRÉSTIMOS
        // =============================================
        console.log('\n💳 2. Criando EMPRÉSTIMOS...');

        const existingLoans = await client.query(`SELECT COUNT(*) FROM loans`);
        if (parseInt(existingLoans.rows[0].count) === 0) {
            // Empréstimo ativo para user2
            await client.query(`
                INSERT INTO loans (user_id, amount, interest_rate, term_months, monthly_payment, total_due, status, created_at, due_date)
                VALUES ($1, 100, 0.20, 3, 40, 120, 'ACTIVE', NOW(), NOW() + INTERVAL '3 months')
            `, [user2.id]);
            console.log(`   ✅ ${user2.name}: Empréstimo de R$ 100 (3 parcelas de R$ 40)`);

            // Criar parcelas
            for (let i = 1; i <= 3; i++) {
                const dueDate = new Date();
                dueDate.setMonth(dueDate.getMonth() + i);
                await client.query(`
                    INSERT INTO loan_installments (loan_id, installment_number, amount, due_date, status)
                    VALUES ((SELECT id FROM loans ORDER BY id DESC LIMIT 1), $1, 40, $2, 'PENDING')
                `, [i, dueDate.toISOString()]);
            }
            console.log(`   ✅ 3 parcelas criadas (R$ 40 cada)`);
        } else {
            console.log('   ⚠️ Já existem empréstimos no banco.');
        }

        // =============================================
        // 3️⃣ VÍDEOS PROMOCIONAIS
        // =============================================
        console.log('\n📺 3. Criando VÍDEOS PROMOCIONAIS...');

        const existingVideos = await client.query(`SELECT COUNT(*) FROM promo_videos`);
        if (parseInt(existingVideos.rows[0].count) === 0) {
            const videos = [
                { title: 'Conheça o Cred30!', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', budget: 50, ppv: 0.10 },
                { title: 'Como Funciona o Marketplace', url: 'https://www.youtube.com/watch?v=abc123', budget: 30, ppv: 0.05 },
                { title: 'Ganhe Dinheiro Entregando', url: 'https://www.youtube.com/watch?v=xyz789', budget: 20, ppv: 0.08 },
            ];

            for (const v of videos) {
                await client.query(`
                    INSERT INTO promo_videos (advertiser_id, title, video_url, budget, price_per_view, target_views, current_views, status, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, 0, 'ACTIVE', NOW())
                `, [user1.id, v.title, v.url, v.budget, v.ppv, Math.floor(v.budget / v.ppv)]);
                console.log(`   ✅ Vídeo: "${v.title}" (Budget: R$ ${v.budget})`);
            }
        } else {
            console.log('   ⚠️ Já existem vídeos no banco.');
        }

        // =============================================
        // 4️⃣ ACADEMY (CURSOS E AULAS)
        // =============================================
        console.log('\n📚 4. Criando CURSOS e AULAS...');

        const existingCourses = await client.query(`SELECT COUNT(*) FROM education_courses`);
        if (parseInt(existingCourses.rows[0].count) === 0) {
            // Curso 1: Finanças Pessoais
            await client.query(`
                INSERT INTO education_courses (title, description, thumbnail_url, status, created_at)
                VALUES ('Finanças Pessoais', 'Aprenda a controlar seu dinheiro', 'https://placehold.co/400x300?text=Financas', 'ACTIVE', NOW())
            `);
            const course1 = await client.query(`SELECT id FROM education_courses ORDER BY id DESC LIMIT 1`);

            const lessons1 = [
                { title: 'Introdução às Finanças', duration: 300, reward: 5 },
                { title: 'Orçamento Familiar', duration: 480, reward: 8 },
                { title: 'Investimentos Básicos', duration: 600, reward: 10 },
            ];
            for (let i = 0; i < lessons1.length; i++) {
                await client.query(`
                    INSERT INTO education_lessons (course_id, title, video_url, duration_seconds, reward_points, order_index, created_at)
                    VALUES ($1, $2, 'https://youtube.com/embed/test', $3, $4, $5, NOW())
                `, [course1.rows[0].id, lessons1[i].title, lessons1[i].duration, lessons1[i].reward, i + 1]);
            }
            console.log(`   ✅ Curso: "Finanças Pessoais" (3 aulas)`);

            // Curso 2: Empreendedorismo
            await client.query(`
                INSERT INTO education_courses (title, description, thumbnail_url, status, created_at)
                VALUES ('Empreendedorismo Digital', 'Monte seu negócio online', 'https://placehold.co/400x300?text=Empreender', 'ACTIVE', NOW())
            `);
            const course2 = await client.query(`SELECT id FROM education_courses ORDER BY id DESC LIMIT 1`);

            const lessons2 = [
                { title: 'Ideias de Negócio', duration: 420, reward: 7 },
                { title: 'Marketing Digital', duration: 540, reward: 9 },
            ];
            for (let i = 0; i < lessons2.length; i++) {
                await client.query(`
                    INSERT INTO education_lessons (course_id, title, video_url, duration_seconds, reward_points, order_index, created_at)
                    VALUES ($1, $2, 'https://youtube.com/embed/test2', $3, $4, $5, NOW())
                `, [course2.rows[0].id, lessons2[i].title, lessons2[i].duration, lessons2[i].reward, i + 1]);
            }
            console.log(`   ✅ Curso: "Empreendedorismo Digital" (2 aulas)`);
        } else {
            console.log('   ⚠️ Já existem cursos no banco.');
        }

        // =============================================
        // RELATÓRIO FINAL
        // =============================================
        console.log('\n📊 RESUMO DOS DADOS CRIADOS:');

        const quotasCount = await client.query(`SELECT COUNT(*) FROM quotas`);
        const loansCount = await client.query(`SELECT COUNT(*) FROM loans`);
        const videosCount = await client.query(`SELECT COUNT(*) FROM promo_videos`);
        const coursesCount = await client.query(`SELECT COUNT(*) FROM education_courses`);
        const lessonsCount = await client.query(`SELECT COUNT(*) FROM education_lessons`);

        console.log(`   💎 Cotas: ${quotasCount.rows[0].count}`);
        console.log(`   💳 Empréstimos: ${loansCount.rows[0].count}`);
        console.log(`   📺 Vídeos Promo: ${videosCount.rows[0].count}`);
        console.log(`   📚 Cursos: ${coursesCount.rows[0].count}`);
        console.log(`   📖 Aulas: ${lessonsCount.rows[0].count}`);

        console.log('\n🎉 SEED COMPLETO! Pode testar no app.');

    } catch (e: any) {
        console.error('❌ Erro:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
