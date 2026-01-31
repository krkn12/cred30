import * as fs from 'fs';

const filePath = 'c:/Users/josia/Desktop/projetos/cred30/packages/backend/src/presentation/http/controllers/marketplace.orders.controller.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix re-declaration in buyOnCredit
const redeclarationOld = `
                    if (sellerRow && sellerRow.is_paused) {
                        throw new Error('Este estabelecimento está temporariamente fechado para novos pedidos.');
                    }

                    const sellerRow = sellerDataRes.rows[0];`;

const redeclarationNew = `
                    if (sellerRow && sellerRow.is_paused) {
                        throw new Error('Este estabelecimento está temporariamente fechado para novos pedidos.');
                    }
`;

if (content.includes(redeclarationOld)) {
    console.log('Fixing re-declaration in buyOnCredit...');
    content = content.replace(redeclarationOld, redeclarationNew);
}

// 2. Fix totalPrice in buyListing (if still baseAmount)
const buyListingStart = content.indexOf('static async buyListing(c: Context)');
const buyOnCreditStart = content.indexOf('static async buyOnCredit(c: Context)');

const tpOld = `let totalPrice = baseAmount;`;
const tpNew = `// Somar opcionais (SE FOR COMIDA)
                let optionsTotal = 0;
                if (isAnyFood && selectedOptions && selectedOptions.length > 0) {
                    optionsTotal = selectedOptions.reduce((acc: any, opt: any) => acc + opt.price, 0);
                }
                const totalPrice = baseAmount + optionsTotal;`;

const tpPosListing = content.indexOf(tpOld, buyListingStart);
if (tpPosListing > -1 && tpPosListing < buyOnCreditStart) {
    console.log('Applying totalPrice fix to buyListing...');
    content = content.substring(0, tpPosListing) + tpNew + content.substring(tpPosListing + tpOld.length);
}

// 3. Fix broken totalPrice in buyOnCredit
const brokenTPCredit = `// Somar opcionais (SE FOR COMIDA - CREDIT)
                let optionsTotal = 0;
                // No buyOnCredit, selectedOptions também deve vir do body.
                // Vou adicionar ao desestruturação do body no buyOnCredit também.
                if (isAnyFood && (client as any)._selectedOptions && (client as any)._selectedOptions.length > 0) {
                    optionsTotal = (client as any)._selectedOptions.reduce((acc: any, opt: any) => acc + opt.price, 0);
                }

                const totalPrice = baseAmount + optionsTotal;`;

const correctTPCredit = `// Somar opcionais (SE FOR COMIDA - CREDIT)
                let optionsTotal = 0;
                if (isAnyFood && selectedOptions && selectedOptions.length > 0) {
                    optionsTotal = selectedOptions.reduce((acc: any, opt: any) => acc + opt.price, 0);
                }
                const totalPrice = baseAmount + optionsTotal;`;

if (content.includes(brokenTPCredit)) {
    console.log('Fixing broken totalPrice in buyOnCredit...');
    content = content.replace(brokenTPCredit, correctTPCredit);
}

fs.writeFileSync(filePath, content);
console.log('File updated successfully!');
