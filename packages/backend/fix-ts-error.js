const fs = require('fs');
const file = 'src/infrastructure/database/postgresql/connection/pool.ts';
let content = fs.readFileSync(file, 'utf8');

// Substitui acessos a mensagens de err/error/e de tipo unknown
content = content.replace(/err\.message/g, '(err as any)?.message');
content = content.replace(/error\.message/g, '(error as any)?.message');
content = content.replace(/e\.message/g, '(e as any)?.message');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed compile errors in pool.ts');
