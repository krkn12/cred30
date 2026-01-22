
import { initializeDatabase } from './packages/backend/src/infrastructure/database/postgresql/connection/pool';
import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, './packages/backend/.env') });

async function runInit() {
    console.log('--- INICIANDO INITIALIZE_DATABASE DO PROJETO ---');
    try {
        await initializeDatabase();
        console.log('--- SUCESSO ---');
    } catch (err) {
        console.error('--- ERRO ---', err);
    } finally {
        process.exit(0);
    }
}

runInit();
