require('dotenv').config({ path: 'packages/backend/.env' });
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

console.log('Tentando conectar ao banco Neon...');

client.connect()
    .then(() => {
        console.log('CONEXÃO BEM SUCEDIDA!');
        return client.query('SELECT NOW()');
    })
    .then(res => {
        console.log(' Hora do banco:', res.rows[0].now);
        return client.end();
    })
    .catch(err => {
        console.error('ERRO DE CONEXÃO:', err.message);
        if (err.message.includes('password')) console.error(' -> Verifique a senha.');
        if (err.message.includes('ECONNREFUSED')) console.error(' -> O banco pode estar "dormindo" (Neon suspende inativos) ou bloqueado por firewall.');
    });
