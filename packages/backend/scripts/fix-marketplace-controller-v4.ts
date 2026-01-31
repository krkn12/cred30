import * as fs from 'fs';

const filePath = 'c:/Users/josia/Desktop/projetos/cred30/packages/backend/src/presentation/http/controllers/marketplace.orders.controller.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix broken options in buyOnCredit (optionsTotal from client._selectedOptions)
const brokenOptions = `// Somar opcionais (SE FOR COMIDA - CREDIT)
                let optionsTotal = 0;
                // No buyOnCredit, selectedOptions também deve vir do body.
                // Vou adicionar ao desestruturação do body no buyOnCredit também.
                if (isAnyFood && (client as any)._selectedOptions && (client as any)._selectedOptions.length > 0) {
                    optionsTotal = (client as any)._selectedOptions.reduce((acc: any, opt: any) => acc + opt.price, 0);
                }`;

const correctOptions = `// Somar opcionais (SE FOR COMIDA - CREDIT)
                let optionsTotal = 0;
                if (isAnyFood && selectedOptions && selectedOptions.length > 0) {
                    optionsTotal = selectedOptions.reduce((acc: any, opt: any) => acc + opt.price, 0);
                }`;

if (content.includes(brokenOptions)) {
    console.log('Fixing broken options in buyOnCredit...');
    content = content.replace(brokenOptions, correctOptions);
}

// 2. Fix the INSERT columns
const oldColumns = "variant_id";
const newColumns = "variant_id, selected_options";

// Search for the second occurrence of variant_id which is in buyOnCredit
const firstIdx = content.indexOf(oldColumns);
const secondIdx = content.indexOf(oldColumns, firstIdx + 1);

if (secondIdx > -1) {
    console.log('Updating INSERT columns in buyOnCredit...');
    content = content.substring(0, secondIdx) + newColumns + content.substring(secondIdx + oldColumns.length);
}

// 3. Fix the VALUES part
const oldValues = "$23::INTEGER, $24::INTEGER";
const newValues = "$23::INTEGER, $24::INTEGER, $25::JSONB";

const vFirstIdx = content.indexOf(oldValues);
const vSecondIdx = content.indexOf(oldValues, vFirstIdx + 1);

if (vSecondIdx > -1) {
    console.log('Updating INSERT values in buyOnCredit...');
    content = content.substring(0, vSecondIdx) + newValues + content.substring(vSecondIdx + oldValues.length);
}

// 4. Fix the Parameters array
const oldParams = "quantity, selectedVariantId || null";
const newParams = "quantity, selectedVariantId || null, JSON.stringify(selectedOptions || [])";

const pFirstIdx = content.indexOf(oldParams);
const pSecondIdx = content.indexOf(oldParams, pFirstIdx + 1);

if (pSecondIdx > -1) {
    console.log('Updating INSERT parameters in buyOnCredit...');
    content = content.substring(0, pSecondIdx) + newParams + content.substring(pSecondIdx + oldParams.length);
}

fs.writeFileSync(filePath, content);
console.log('File updated successfully!');
