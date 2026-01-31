
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/cred30_db'
});

async function check() {
    const client = await pool.connect();
    try {
        const users = await client.query('SELECT count(*) FROM users');
        const notifs = await client.query('SELECT count(*) FROM notifications');
        const txs = await client.query('SELECT count(*) FROM transactions');

        console.log('--- DB STATE ---');
        console.log(`Users: ${users.rows[0].count}`);
        console.log(`Notifications: ${notifs.rows[0].count}`);
        console.log(`Transactions: ${txs.rows[0].count}`);
    } finally {
        client.release();
        pool.end();
    }
}
check();
