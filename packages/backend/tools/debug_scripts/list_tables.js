require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function listTables() {
    const r = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' ORDER BY table_name
  `);
    console.log('Tabelas:', r.rows.map(x => x.table_name));

    // Verificar índices
    const idx = await pool.query(`
    SELECT indexname, tablename FROM pg_indexes 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `);
    console.log('\nÍndices:', idx.rows.length);

    await pool.end();
}
listTables();
