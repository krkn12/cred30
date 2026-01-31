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

console.log(`Analyzing dump file: ${dumpFile}`);
const data = JSON.parse(fs.readFileSync(path.join(dir, dumpFile), 'utf8'));

// 1. Verify Quotas
const quotas = data.quotas || [];
console.log(`\n--- Quotas Analysis (${quotas.length} total) ---`);

let validCount = 0;
let invalidCount = 0;
const invalidIds = [];

quotas.forEach(q => {
    const current = parseFloat(q.current_value);
    const price = parseFloat(q.purchase_price);
    const is50 = Math.abs(current - 50.00) < 0.01;
    const priceIs50 = Math.abs(price - 50.00) < 0.01;

    if (q.status === 'ACTIVE') {
        if (is50 && priceIs50) {
            validCount++;
        } else {
            invalidCount++;
            invalidIds.push({ id: q.id, current, price, status: q.status });
        }
    } else {
        console.log(`Skipping non-active quota #${q.id} (Status: ${q.status})`);
    }
});

console.log(`✅ Correct (R$ 50.00): ${validCount}`);
console.log(`❌ Incorrect: ${invalidCount}`);
if (invalidCount > 0) {
    console.log('Details of incorrect active quotas:', JSON.stringify(invalidIds, null, 2));
}

// 2. Verify System Config
const config = data.system_config?.[0]; // Assuming single row
console.log(`\n--- System Config ---`);
if (config) {
    console.log(`Investment Reserve: R$ ${config.investment_reserve}`);
    console.log(`System Balance: R$ ${config.system_balance}`);
} else {
    console.log('No system config found.');
}

// 3. Verify Transactions (Recent)
const transactions = data.transactions || [];
console.log(`\n--- Recent Quota Transactions (Last 5) ---`);
const quotaTx = transactions
    .filter(t => t.type === 'QUOTA_PURCHASE' || t.description?.includes('Cota'))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

quotaTx.forEach(t => {
    console.log(`[${t.created_at}] Amount: R$ ${t.amount} | Desc: ${t.description}`);
});
