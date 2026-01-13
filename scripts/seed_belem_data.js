const { Pool } = require('pg');
require('dotenv').config({ path: './packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🚀 Iniciando Seeding em Belém/PA...');

        // 1. Criar Vendedor Verificado (Com Selo)
        const verifiedSeller = await client.query(`
      INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, balance, is_seller, seller_status, asaas_wallet_id, seller_address_city, seller_address_state, seller_address_neighborhood)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
            ['João do Açaí (Verificado)', 'joao@acai.com', 'hash', 'frase', 'joao@pix.com', 0, true, 'approved', 'wallet_fake_123', 'Belém', 'PA', 'Batista Campos']
        );
        const seller1Id = verifiedSeller.rows[0].id;

        // 2. Criar Vendedor Comum (Sem Selo)
        const commonSeller = await client.query(`
      INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, balance, is_seller, seller_status, seller_address_city, seller_address_state, seller_address_neighborhood)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
            ['Maria da Unha', 'maria@unha.com', 'hash', 'frase', 'maria@pix.com', 0, true, 'approved', 'Belém', 'PA', 'Umarizal']
        );
        const seller2Id = commonSeller.rows[0].id;

        // 3. Cadastrar Produtos para João (Verificado)
        const productsJoão = [
            ['Açaí Médio 1L', 'Açaí fresquinho batido na hora.', 25.00, 'ALIMENTOS', 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e', 'MOTO'],
            ['Cesto de Castanha', 'Castanha do Pará selecionada.', 45.00, 'OUTROS', 'https://images.unsplash.com/photo-1599596561144-8cb9525492d5', 'BIKE'],
            ['Paneiro de Farinha', 'Farinha de Bragança crocante.', 15.00, 'ALIMENTOS', 'https://images.unsplash.com/photo-1514732193138-c5da55977933', 'CAR']
        ];

        for (const p of productsJoão) {
            await client.query(`
        INSERT INTO marketplace_listings (seller_id, title, description, price, category, image_url, required_vehicle, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')`,
                [seller1Id, ...p]
            );
        }

        // 4. Cadastrar Produtos para Maria (Comum)
        const productsMaria = [
            ['Kit Esmaltes Verão', 'Cores vibrantes para sua unha.', 60.00, 'BELEZA', 'https://images.unsplash.com/photo-1634712282287-14ed57b9cc89', 'MOTO'],
            ['Secador Profissional', 'Potente e compacto.', 180.00, 'OUTROS', 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da', 'CAR'],
            ['Hidratante de Cupuaçu', 'Fragrância regional e hidratação profunda.', 35.00, 'BELEZA', 'https://images.unsplash.com/photo-1556228720-195a672e8a03', 'BIKE']
        ];

        for (const p of productsMaria) {
            await client.query(`
        INSERT INTO marketplace_listings (seller_id, title, description, price, category, image_url, required_vehicle, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')`,
                [seller2Id, ...p]
            );
        }

        console.log('✅ Seeding concluído com sucesso!');
        console.log(`- João (ID: ${seller1Id}): Vendedor Verificado criado.`);
        console.log(`- Maria (ID: ${seller2Id}): Vendedora Comum criada.`);
        console.log('- 6 Produtos cadastrados em Belém/PA.');

    } catch (err) {
        console.error('❌ Erro no seeding:', err);
    } finally {
        client.release();
        pool.end();
    }
}

seed();
