const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();
    console.log('✅ Conectado ao banco Neon\n');

    const migrationsDir = path.join(__dirname, 'src', 'infrastructure', 'database', 'postgresql', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    console.log(`📦 Encontradas ${files.length} migrations\n`);

    for (const file of files) {
        const filepath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filepath, 'utf8');

        try {
            await c.query(sql);
            console.log(`✅ ${file}`);
        } catch (e) {
            // Ignora erros de "já existe"
            if (e.message.includes('already exists') || e.message.includes('duplicate')) {
                console.log(`⏭️  ${file} (já existe)`);
            } else {
                console.log(`❌ ${file}: ${e.message}`);
            }
        }
    }

    console.log('\n🎉 Migrations concluídas!');
    await c.end();
}

main().catch(e => console.log('Erro:', e.message));
