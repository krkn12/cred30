const { Client } = require('pg');
const fs = require('fs');

const url = 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const client = new Client({ connectionString: url });

async function dumpDatabase() {
    let output = '';

    try {
        await client.connect();
        console.log('Conectado ao banco de dados!\n');

        // Listar todas as tabelas
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);

        output += '=====================================\n';
        output += 'DUMP COMPLETO DO BANCO DE DADOS\n';
        output += '=====================================\n\n';
        output += `Total de tabelas: ${tablesResult.rows.length}\n\n`;

        // Para cada tabela
        for (const table of tablesResult.rows) {
            const tableName = table.table_name;
            console.log(`Processando tabela: ${tableName}`);

            output += `\n${'='.repeat(60)}\n`;
            output += `TABELA: ${tableName}\n`;
            output += `${'='.repeat(60)}\n\n`;

            // Estrutura da tabela (colunas)
            const columnsResult = await client.query(`
                SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [tableName]);

            output += '--- ESTRUTURA ---\n';
            columnsResult.rows.forEach(col => {
                output += `  ${col.column_name} (${col.data_type}`;
                if (col.character_maximum_length) output += `(${col.character_maximum_length})`;
                output += `, ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`;
                if (col.column_default) output += `, default: ${col.column_default}`;
                output += `)\n`;
            });

            // Contar registros
            const countResult = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
            const count = parseInt(countResult.rows[0].count);
            output += `\n--- TOTAL DE REGISTROS: ${count} ---\n\n`;

            // Se tiver dados, mostrar alguns
            if (count > 0) {
                const limit = count > 10 ? 10 : count;
                const dataResult = await client.query(`SELECT * FROM ${tableName} LIMIT ${limit}`);

                output += '--- AMOSTRA DE DADOS ---\n';
                if (dataResult.rows.length > 0) {
                    dataResult.rows.forEach((row, idx) => {
                        output += `\nRegistro ${idx + 1}:\n`;
                        Object.entries(row).forEach(([key, value]) => {
                            output += `  ${key}: ${JSON.stringify(value)}\n`;
                        });
                    });
                }

                if (count > limit) {
                    output += `\n... e mais ${count - limit} registros\n`;
                }
            } else {
                output += '(Tabela vazia)\n';
            }
        }

        // Salvar em arquivo
        fs.writeFileSync('database_dump.txt', output);
        console.log('\n✅ Dump completo salvo em: database_dump.txt');
        console.log(`Total de ${tablesResult.rows.length} tabelas processadas!`);

    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await client.end();
    }
}

dumpDatabase();
