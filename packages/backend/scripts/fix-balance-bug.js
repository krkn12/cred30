const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'packages/backend/src/presentation/http/controllers/marketplace.orders.controller.ts');
let content = fs.readFileSync(filePath, 'utf-8');

console.log('Original content length:', content.length);

// 1. Corrigir buyListing reduce - Use a simpler regex
const buyListingPattern = /optionsTotal = selectedOptions\.reduce\(\(acc: any, opt: any\) => acc \+ opt\.price, 0\);/;
const buyListingFix = 'optionsTotal = selectedOptions.reduce((acc, opt) => acc + (parseFloat(opt.price) || 0), 0);';

if (buyListingPattern.test(content)) {
    content = content.replace(buyListingPattern, buyListingFix);
    console.log('Fixed buyListing calculation');
} else {
    console.error('Could not find buyListing calculation pattern');
}

// 2. Corrigir buyOnCredit scope e reduce - Simpler approach
const buyOnCreditTargetLine = 'optionsTotal = (client as any)._selectedOptions.reduce((acc: any, opt: any) => acc + opt.price, 0);';
const buyOnCreditFixLine = 'optionsTotal = selectedOptions.reduce((acc, opt) => acc + (parseFloat(opt.price) || 0), 0);';

if (content.includes(buyOnCreditTargetLine)) {
    content = content.replace(buyOnCreditTargetLine, buyOnCreditFixLine);
    console.log('Fixed buyOnCredit calculation line');

    // Fix the if check as well
    const ifCheck = 'if (isAnyFood && (client as any)._selectedOptions && (client as any)._selectedOptions.length > 0)';
    const newIfCheck = 'if (isAnyFood && selectedOptions && selectedOptions.length > 0)';
    if (content.includes(ifCheck)) {
        content = content.replace(ifCheck, newIfCheck);
        console.log('Fixed buyOnCredit if condition');
    }
} else {
    console.error('Could not find buyOnCredit target line');
}

fs.writeFileSync(filePath, content);
console.log('File updated successfully. New length:', content.length);
