const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'packages/backend/src/presentation/http/controllers/marketplace.orders.controller.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Corrigir parseFloat para Number em todos os reduce de selectedOptions
const newContent = content.replace(
    /optionsTotal = selectedOptions\.reduce\(\(acc, opt\) => acc \+ \(parseFloat\(opt\.price\) \|\| 0\), 0\);/g,
    'optionsTotal = selectedOptions.reduce((acc, opt) => acc + (Number(opt.price) || 0), 0);'
);

if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log('Fixed lints in marketplace.orders.controller.ts');
} else {
    console.log('No lint fixes needed or pattern not matched.');
}
