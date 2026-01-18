
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'quotas'");
    console.log(JSON.stringify(res.rows));
    await client.end();
}
run();
