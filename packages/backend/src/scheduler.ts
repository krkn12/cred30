
import cron from 'node-cron';
import { Pool } from 'pg';
import { distributeProfits } from './application/services/profit-distribution.service';

/**
 * Inicializa os agendadores de tarefas (Cron Jobs)
 */
export const initializeScheduler = (pool: Pool) => {
    console.log('Inicializando agendador de tarefas...');

    // Distribuir lucros diariamente às 00:00 (Meia-noite)
    // Formato Cron: Minuto Hora Dia Mês DiaDaSemana
    // 0 0 * * * = Executar todo dia à meia-noite
    cron.schedule('0 0 * * *', async () => {
        console.log('🕒 [CRON] Iniciando distribuição diária de lucros...');
        try {
            const result = await distributeProfits(pool);
            if (result.success) {
                console.log('✅ [CRON] Distribuição de lucros realizada com sucesso:', result);
            } else {
                console.log('ℹ️ [CRON] Distribuição de lucros finalizada (sem ação):', result.message);
            }
        } catch (error) {
            console.error('❌ [CRON] Erro fatal na distribuição de lucros:', error);
        }
    });

    // Exemplo: Distribuição Semanal (Todo domingo à meia-noite)
    // Para ativar semanalmente em vez de diariamente, basta descomentar e ajustar
    /*
    cron.schedule('0 0 * * 0', async () => {
       // Lógica de distribuição semanal
    });
    */

    console.log('✅ Agendador de tarefas inicializado: Distribuição de lucros configurada para 00:00 diariamente.');
};
