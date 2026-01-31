import * as fs from 'fs';

const filePath = 'c:/Users/josia/Desktop/projetos/cred30/packages/backend/src/presentation/http/controllers/marketplace.orders.controller.ts';
let content = fs.readFileSync(filePath, 'utf8');

const oldLine = "$23::INTEGER, $24::INTEGER";
const newLine = "$23::INTEGER, $24::INTEGER, $25::JSONB";

// We want to replace only the occurrence AFTER buyOnCredit
const buyOnCreditStart = content.indexOf('static async buyOnCredit(c: Context)');
const pos = content.indexOf(oldLine, buyOnCreditStart);

if (pos > -1) {
    console.log('Replacing VALUES line in buyOnCredit...');
    content = content.substring(0, pos) + newLine + content.substring(pos + oldLine.length);
    fs.writeFileSync(filePath, content);
    console.log('File updated successfully!');
} else {
    console.log('Could not find VALUES line in buyOnCredit');
}
