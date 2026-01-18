
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    const res = await client.query("SELECT * FROM system_config LIMIT 1");
    console.log(JSON.stringify(res.rows[0], null, 2));
    await client.end();
}
run();
