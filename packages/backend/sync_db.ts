import dotenv from 'dotenv';
dotenv.config();

import { initializeDatabase, pool } from './src/infrastructure/database/postgresql/connection/pool';

async function runSync() {
    console.log('🔄 Iniciando sincronização forçada de schema (Migrations)...');
    const url = process.env.DATABASE_URL || '';
    console.log('URL de Destino:', url.substring(0, 40) + '...');

    try {
        await initializeDatabase();
        console.log('✅ Sincronização e Migrations concluídas com sucesso!');
    } catch (err) {
        console.error('❌ Erro fatal durante sincronização:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

runSync();
