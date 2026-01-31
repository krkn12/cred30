import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'packages/backend/src/presentation/http/controllers/marketplace.orders.controller.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Corrigir buyListing reduce
const buyListingPattern = /optionsTotal = selectedOptions\.reduce\(\(acc: any, opt: any\) => acc \+ opt\.price, 0\);/;
const buyListingFix = 'optionsTotal = selectedOptions.reduce((acc: number, opt: any) => acc + (parseFloat(opt.price) || 0), 0);';

if (buyListingPattern.test(content)) {
    content = content.replace(buyListingPattern, buyListingFix);
    console.log('Fixed buyListing calculation');
} else {
    console.error('Could not find buyListing calculation pattern');
}

// 2. Corrigir buyOnCredit scope e reduce
const buyOnCreditPattern = /\/\/ Somar opcionais \(SE FOR COMIDA - CREDIT\)\s+let optionsTotal = 0;\s+\/\/ No buyOnCredit, selectedOptions também deve vir do body\.\s+\/\/ Vou adicionar ao desestruturação do body no buyOnCredit também\.\s+if \(isAnyFood && \(client as any\)\._selectedOptions && \(client as any\)\._selectedOptions\.length > 0\) \{\s+optionsTotal = \(client as any\)\._selectedOptions\.reduce\(\(acc: any, opt: any\) => acc \+ opt\.price, 0\);\s+\}/;

const buyOnCreditFix = `// Somar opcionais (SE FOR COMIDA - CREDIT)
                let optionsTotal = 0;
                if (isAnyFood && selectedOptions && selectedOptions.length > 0) {
                    optionsTotal = selectedOptions.reduce((acc: number, opt: any) => acc + (parseFloat(opt.price) || 0), 0);
                }`;

if (buyOnCreditPattern.test(content)) {
    content = content.replace(buyOnCreditPattern, buyOnCreditFix);
    console.log('Fixed buyOnCredit scope and calculation');
} else {
    // Tenta uma versão mais simples do pattern para buyOnCredit se a complexa falhar
    const simplerPattern = /optionsTotal = \(client as any\)\._selectedOptions\.reduce\(\(acc: any, opt: any\) => acc \+ opt\.price, 0\);/;
    if (simplerPattern.test(content)) {
        content = content.replace(simplerPattern, 'optionsTotal = selectedOptions.reduce((acc: number, opt: any) => acc + (parseFloat(opt.price) || 0), 0);');
        // Também precisa remover o check do client._selectedOptions
        content = content.replace(/if \(isAnyFood && \(client as any\)\._selectedOptions && \(client as any\)\._selectedOptions\.length > 0\)/, 'if (isAnyFood && selectedOptions && selectedOptions.length > 0)');
        console.log('Fixed buyOnCredit using simpler pattern');
    } else {
        console.error('Could not find buyOnCredit pattern');
    }
}

fs.writeFileSync(filePath, content);
console.log('File updated successfully');
