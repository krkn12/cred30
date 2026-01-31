import * as fs from 'fs';
import * as path from 'path';

const filePath = 'c:/Users/josia/Desktop/projetos/cred30/packages/backend/src/presentation/http/controllers/marketplace.orders.controller.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix buyListing - seller query
const queryOld = "const sellerDataRes = await client.query('SELECT opening_hours, is_restaurant, is_liquor_store FROM users WHERE id = $1', [sellerId]);";
const queryNew = `const sellerDataRes = await client.query('SELECT opening_hours, is_restaurant, is_liquor_store, is_paused FROM users WHERE id = $1', [sellerId]);
                    const sellerRow = sellerDataRes.rows[0];
                    
                    if (sellerRow && sellerRow.is_paused) {
                        throw new Error('Este estabelecimento está temporariamente fechado para novos pedidos.');
                    }
`;

if (content.includes(queryOld)) {
    console.log('Replacing query in buyListing...');
    content = content.replace(queryOld, queryNew);
} else {
    console.log('Query not found in buyListing (Check 1)');
}

// 2. Fix buyListing - totalPrice
const tpOld = `const totalPrice = baseAmount;`;
const tpNew = `// Somar opcionais (SE FOR COMIDA)
                let optionsTotal = 0;
                if (isAnyFood && selectedOptions && selectedOptions.length > 0) {
                    optionsTotal = selectedOptions.reduce((acc: any, opt: any) => acc + opt.price, 0);
                }
                const totalPrice = baseAmount + optionsTotal;`;

// We need to be careful as this exists in multiple places.
// We want the one in buyListing first.
const buyListingStart = content.indexOf('static async buyListing(c: Context)');
const tpPos = content.indexOf(tpOld, buyListingStart);
if (tpPos > -1 && tpPos < content.indexOf('static async buyOnCredit(c: Context)')) {
    console.log('Replacing totalPrice in buyListing...');
    content = content.substring(0, tpPos) + tpNew + content.substring(tpPos + tpOld.length);
} else {
    console.log('totalPrice not found in buyListing (Check 2)');
}

// 3. Fix buyOnCredit - seller query
// search for the second occurrence of the seller query
const secondQueryPos = content.indexOf(queryOld, content.indexOf('static async buyOnCredit(c: Context)'));
if (secondQueryPos > -1) {
    console.log('Replacing query in buyOnCredit...');
    content = content.substring(0, secondQueryPos) + queryNew + content.substring(secondQueryPos + queryOld.length);
} else {
    console.log('Query not found in buyOnCredit (Check 3)');
}

// 4. Fix buyOnCredit - totalPrice with options
// The previous attempt might have left it corrupted.
const brokenTP = `// Somar opcionais (SE FOR COMIDA - CREDIT)
                let optionsTotal = 0;
                // No buyOnCredit, selectedOptions também deve vir do body.
                // Vou adicionar ao desestruturação do body no buyOnCredit também.
                if (isAnyFood && (client as any)._selectedOptions && (client as any)._selectedOptions.length > 0) {
                    optionsTotal = (client as any)._selectedOptions.reduce((acc: any, opt: any) => acc + opt.price, 0);
                }

                const totalPrice = baseAmount + optionsTotal;`;

const correctTP = `// Somar opcionais (SE FOR COMIDA - CREDIT)
                let optionsTotal = 0;
                if (isAnyFood && selectedOptions && selectedOptions.length > 0) {
                    optionsTotal = selectedOptions.reduce((acc: any, opt: any) => acc + opt.price, 0);
                }
                const totalPrice = baseAmount + optionsTotal;`;

if (content.includes(brokenTP)) {
    console.log('Fixing broken totalPrice in buyOnCredit...');
    content = content.replace(brokenTP, correctTP);
} else {
    console.log('Broken totalPrice not found in buyOnCredit (Check 4)');
    // If not broken, try to find the original if it exists
    const tpPosCredit = content.indexOf(tpOld, content.indexOf('static async buyOnCredit(c: Context)'));
    if (tpPosCredit > -1) {
        console.log('Replacing original totalPrice in buyOnCredit...');
        content = content.substring(0, tpPosCredit) + correctTP + content.substring(tpPosCredit + tpOld.length);
    }
}

fs.writeFileSync(filePath, content);
console.log('File updated successfully!');
