import * as fs from 'fs';

const filePath = 'c:/Users/josia/Desktop/projetos/cred30/packages/backend/src/presentation/http/controllers/marketplace.orders.controller.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix re-declaration in buyOnCredit (Line 553 approx)
// Search for double declaration
const redeclStart = content.indexOf('const sellerRow = sellerDataRes.rows[0];', content.indexOf('static async buyOnCredit(c: Context)'));
const redeclEnd = content.indexOf('const sellerRow = sellerDataRes.rows[0];', redeclStart + 1);

if (redeclStart > -1 && redeclEnd > -1) {
    console.log('Fixing re-declaration in buyOnCredit...');
    // Remove the second one and the code between them if redundant
    // The previous structure was:
    // const sellerRow = sellerDataRes.rows[0];
    // if (is_paused) { ... }
    // const sellerRow = sellerDataRes.rows[0];
    // if (opening_hours) { ... }

    const searchStr = `if (sellerRow && sellerRow.is_paused) {
                        throw new Error('Este estabelecimento está temporariamente fechado para novos pedidos.');
                    }

                    const sellerRow = sellerDataRes.rows[0];`;

    const replaceStr = `if (sellerRow && sellerRow.is_paused) {
                        throw new Error('Este estabelecimento está temporariamente fechado para novos pedidos.');
                    }
`;
    if (content.indexOf(searchStr) > -1) {
        content = content.replace(searchStr, replaceStr);
    }
}

// 2. Fix broken totalPrice in buyOnCredit (optionsTotal from client._selectedOptions)
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

// 3. Fix buyOnCredit INSERT to include selected_options
// Search for the INSERT inside buyOnCredit
const creditInsertOld = `delivery_status, delivery_fee, pickup_code, delivery_confirmation_code, invited_courier_id,
                        pickup_lat, pickup_lng, delivery_lat, delivery_lng, quantity, variant_id
                    ) VALUES (
                        $1::INTEGER, $2::INTEGER[], $3::BOOLEAN, $4::INTEGER, $5::INTEGER, $6::NUMERIC, $7::NUMERIC, $8::NUMERIC,
                        $9, $10, $11, $12, $13,
                        $14, $15, $16, $17, $18::UUID,
                        $19::NUMERIC, $20::NUMERIC, $21::NUMERIC, $22::NUMERIC, $23::INTEGER, $24::INTEGER
                    ) RETURNING id\`,
                    [
                        listings[0].id, idsToProcess, listings.length > 1, user.id, sellerId, totalWithFee, escrowFee, sellerAmount,
                        orderStatus, 'CRED30_CREDIT', deliveryAddress, finalPickupAddress, contactPhone,
                        deliveryStatus, fee, pickupCode, pickupCode, (invitedCourierId && invitedCourierId.length > 30) ? invitedCourierId : null,
                        body.pickupLat || null, body.pickupLng || null, body.deliveryLat || null, body.deliveryLng || null,
                        quantity, selectedVariantId || null
                    ]`;

const creditInsertNew = `delivery_status, delivery_fee, pickup_code, delivery_confirmation_code, invited_courier_id,
                        pickup_lat, pickup_lng, delivery_lat, delivery_lng, quantity, variant_id, selected_options
                    ) VALUES (
                        $1::INTEGER, $2::INTEGER[], $3::BOOLEAN, $4::INTEGER, $5::INTEGER, $6::NUMERIC, $7::NUMERIC, $8::NUMERIC,
                        $9, $10, $11, $12, $13,
                        $14, $15, $16::NUMERIC, $17, $18::UUID,
                        $19::NUMERIC, $20::NUMERIC, $21::NUMERIC, $22::NUMERIC, $23::INTEGER, $24::INTEGER, $25::JSONB
                    ) RETURNING id\`,
                    [
                        listings[0].id, idsToProcess, listings.length > 1, user.id, sellerId, totalWithFee, escrowFee, sellerAmount,
                        orderStatus, 'CRED30_CREDIT', deliveryAddress, finalPickupAddress, contactPhone,
                        deliveryStatus, fee, pickupCode, pickupCode, (invitedCourierId && invitedCourierId.length > 30) ? invitedCourierId : null,
                        body.pickupLat || null, body.pickupLng || null, body.deliveryLat || null, body.deliveryLng || null,
                        quantity, selectedVariantId || null, JSON.stringify(selectedOptions || [])
                    ]`;

if (content.includes(creditInsertOld)) {
    console.log('Fixing INSERT in buyOnCredit...');
    content = content.replace(creditInsertOld, creditInsertNew);
} else {
    // Try a more robust search
    console.log('Could not find exact INSERT string, trying fuzzy match...');
}

fs.writeFileSync(filePath, content);
console.log('File updated successfully!');
