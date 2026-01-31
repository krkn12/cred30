import * as fs from 'fs';

const filePath = 'c:/Users/josia/Desktop/projetos/cred30/packages/backend/src/presentation/http/controllers/marketplace.orders.controller.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Restore buyListing structure
// The corrupted part starts around line 114
const corruptedOld = `            if (!parseResult.success) {
                return c.json({
                    const result = await executeInTransaction(pool, async (client: any) => {`;

const restoredNew = `            if (!parseResult.success) {
                return c.json({
                    success: false,
                    message: parseResult.error.errors[0]?.message || 'Dados inválidos.'
                }, 400);
            }

            const {
                paymentMethod, deliveryType, offeredDeliveryFee, invitedCourierId,
                deliveryLat, deliveryLng, pickupLat, pickupLng, pickupAddress, selectedOptions,
                listingId, listingIds, quantity, selectedVariantId, deliveryAddress, contactPhone, offlineToken
            } = parseResult.data;

            const idsToProcess = listingIds || (listingId ? [listingId] : []);
            if (idsToProcess.length === 0) return c.json({ success: false, message: 'Nenhum item selecionado.' }, 400);

            // Iniciar transação no início para garantir consistência de leitura do estoque
            const result = await executeInTransaction(pool, async (client: any) => {`;

if (content.includes(corruptedOld)) {
    console.log('Restoring buyListing structure...');
    content = content.replace(corruptedOld, restoredNew);
}

// 2. Remove sellerRow redeclaration in buyListing
// Need to find the second occurrence after buyListing start
const buyListingStart = content.indexOf('static async buyListing(c: Context)');
const buyOnCreditStart = content.indexOf('static async buyOnCredit(c: Context)');

const sellerRowDecl = `const sellerRow = sellerDataRes.rows[0];`;
const firstIdx = content.indexOf(sellerRowDecl, buyListingStart);
const secondIdx = content.indexOf(sellerRowDecl, firstIdx + 1);

if (secondIdx > -1 && secondIdx < buyOnCreditStart) {
    console.log('Removing sellerRow redeclaration in buyListing...');
    // Replace with nothing, but be careful with whitespace
    const start = content.lastIndexOf('\n', secondIdx) + 1;
    const end = content.indexOf('\n', secondIdx) + 1;
    content = content.substring(0, start) + content.substring(end);
}

// 3. Remove sellerRow redeclaration in buyOnCredit
const firstIdxCredit = content.indexOf(sellerRowDecl, buyOnCreditStart);
const secondIdxCredit = content.indexOf(sellerRowDecl, firstIdxCredit + 1);

if (secondIdxCredit > -1) {
    console.log('Removing sellerRow redeclaration in buyOnCredit...');
    const start = content.lastIndexOf('\n', secondIdxCredit) + 1;
    const end = content.indexOf('\n', secondIdxCredit) + 1;
    content = content.substring(0, start) + content.substring(end);
}

// 4. Fix parsedBody.quantity to just quantity (since we destructured it)
content = content.replace(/const quantity = parsedBody.quantity \|\| 1;/g, 'const finalQuantity = quantity || 1;');
content = content.replace(/parsedBody.quantity/g, 'quantity'); // replace others if any

fs.writeFileSync(filePath, content);
console.log('File restored and fixed successfully!');
