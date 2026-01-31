const fs = require('fs');
const path = require('path');

// Find the latest dump file
const dir = __dirname;
const files = fs.readdirSync(dir);
const dumpFile = files.find(f => f.startsWith('db_dump_') && f.endsWith('.json'));

if (!dumpFile) {
    console.error('No dump file found!');
    process.exit(1);
}

console.log(`Auditing dump file: ${dumpFile}\n`);
const data = JSON.parse(fs.readFileSync(path.join(dir, dumpFile), 'utf8'));

const tables = Object.keys(data);
console.log(`Total Tables Found: ${tables.length}\n`);
console.log('--------------------------------------------------');
console.log('Table Name'.padEnd(35) + '| Rows');
console.log('--------------------------------------------------');

tables.sort().forEach(table => {
    const count = data[table] ? data[table].length : 0;
    console.log(`${table.padEnd(35)}| ${count}`);
});
console.log('--------------------------------------------------');
