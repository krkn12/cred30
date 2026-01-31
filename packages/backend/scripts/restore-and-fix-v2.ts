import * as fs from 'fs';

const filePath = 'c:/Users/josia/Desktop/projetos/cred30/packages/backend/src/presentation/http/controllers/marketplace.orders.controller.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Restore buyListing structure using Regex
// The pattern: return c.json({ ... const result = await executeInTransaction(pool, async (client: any) => {
const pattern = /return c\.json\(\{\s+const result = await executeInTransaction\(pool, async \(client: any\) => \{/;
const replacement = `return c.json({
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

if (pattern.test(content)) {
    console.log('Regex matched! Restoring buyListing structure...');
    content = content.replace(pattern, replacement);
} else {
    console.log('Regex did NOT match. Manual check needed.');
}

fs.writeFileSync(filePath, content);
console.log('File processing complete.');
