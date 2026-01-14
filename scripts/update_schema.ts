import { initializeDatabase, pool } from '../packages/backend/src/infrastructure/database/postgresql/connection/pool';
import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente explicitamente
dotenv.config({ path: path.resolve(__dirname, '../packages/backend/.env') });

async function runMigration() {
    console.log("🚀 Iniciando atualização de Schema...");

    try {
        await initializeDatabase();
        console.log("✅ Schema atualizado com sucesso!");
    } catch (error) {
        console.error("❌ Erro ao atualizar schema:", error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

runMigration();
