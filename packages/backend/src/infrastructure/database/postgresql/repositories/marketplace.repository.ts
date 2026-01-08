import { Pool, PoolClient } from 'pg';

export class MarketplaceRepository {
    constructor(private pool: Pool) { }

    async findOrderById(orderId: string | number) {
        const result = await this.pool.query(
            'SELECT * FROM marketplace_orders WHERE id = $1',
            [orderId]
        );
        return result.rows[0];
    }

    async updateOrderMetadata(client: PoolClient, orderId: string | number, metadata: any) {
        await client.query(
            'UPDATE marketplace_orders SET metadata = $1 WHERE id = $2',
            [metadata, orderId]
        );
    }

    async updateSellerAmount(client: PoolClient, orderId: string | number, amount: number) {
        await client.query(
            'UPDATE marketplace_orders SET seller_amount = $1 WHERE id = $2',
            [amount, orderId]
        );
    }

    async updateCourierFee(client: PoolClient, orderId: string | number, fee: number) {
        await client.query(
            'UPDATE marketplace_orders SET courier_fee = $1 WHERE id = $2',
            [fee, orderId]
        );
    }
}
