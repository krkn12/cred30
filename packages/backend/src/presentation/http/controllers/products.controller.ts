import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';

// Schema de validação
const productSchema = z.object({
    title: z.string().min(3, "Título muito curto"),
    description: z.string().optional(),
    imageUrl: z.string().url("URL da imagem inválida").optional().or(z.literal('')),
    affiliateUrl: z.string().url("Link de afiliado inválido"),
    price: z.number().optional(),
    category: z.string().default('geral'),
    active: z.boolean().default(true),
});

export class ProductsController {
    /**
     * Listar produtos ativos
     */
    static async listProducts(c: Context) {
        try {
            const pool = getDbPool(c);
            const { category } = c.req.query();

            let query = 'SELECT * FROM products WHERE active = true';
            const params: any[] = [];

            if (category) {
                query += ' AND category = $1';
                params.push(category);
            }

            query += ' ORDER BY created_at DESC';

            const result = await pool.query(query, params);

            const products = result.rows.map(row => ({
                id: row.id,
                title: row.title,
                description: row.description,
                imageUrl: row.image_url,
                affiliateUrl: row.affiliate_url,
                price: row.price ? parseFloat(row.price) : null,
                category: row.category,
                active: row.active,
                createdAt: row.created_at
            }));

            return c.json({ success: true, data: products });
        } catch (error) {
            console.error('Erro ao listar produtos:', error);
            return c.json({ success: false, message: 'Erro interno ao listar produtos' }, 500);
        }
    }

    /**
     * Listar tudo (Admin)
     */
    static async listAllAdmin(c: Context) {
        try {
            const pool = getDbPool(c);
            const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');

            const products = result.rows.map(row => ({
                id: row.id,
                title: row.title,
                description: row.description,
                imageUrl: row.image_url,
                affiliateUrl: row.affiliate_url,
                price: row.price ? parseFloat(row.price) : null,
                category: row.category,
                active: row.active,
                createdAt: row.created_at
            }));

            return c.json({ success: true, data: products });
        } catch (error) {
            return c.json({ success: false, message: 'Erro interno' }, 500);
        }
    }

    /**
     * Criar produto
     */
    static async createProduct(c: Context) {
        try {
            const body = await c.req.json();
            const data = productSchema.parse(body);
            const pool = getDbPool(c);

            const query = `
                INSERT INTO products (title, description, image_url, affiliate_url, price, category, active)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const values = [
                data.title,
                data.description || null,
                data.imageUrl || null,
                data.affiliateUrl,
                data.price || null,
                data.category,
                data.active
            ];

            const result = await pool.query(query, values);
            const newProduct = result.rows[0];

            return c.json({
                success: true,
                message: 'Produto criado com sucesso',
                data: {
                    id: newProduct.id,
                    ...data
                }
            }, 201);

        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            }
            console.error('Erro ao criar produto:', error);
            return c.json({ success: false, message: 'Erro ao criar produto' }, 500);
        }
    }

    /**
     * Atualizar produto
     */
    static async updateProduct(c: Context) {
        try {
            const id = c.req.param('id');
            const body = await c.req.json();
            const schema = productSchema.partial();
            const data = schema.parse(body);
            const pool = getDbPool(c);

            const fields: string[] = [];
            const values: any[] = [];
            let idx = 1;

            if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
            if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
            if (data.imageUrl !== undefined) { fields.push(`image_url = $${idx++}`); values.push(data.imageUrl); }
            if (data.affiliateUrl !== undefined) { fields.push(`affiliate_url = $${idx++}`); values.push(data.affiliateUrl); }
            if (data.price !== undefined) { fields.push(`price = $${idx++}`); values.push(data.price); }
            if (data.category !== undefined) { fields.push(`category = $${idx++}`); values.push(data.category); }
            if (data.active !== undefined) { fields.push(`active = $${idx++}`); values.push(data.active); }

            if (fields.length === 0) return c.json({ success: false, message: 'Nada a atualizar' }, 400);

            values.push(id);
            const query = `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;

            const result = await pool.query(query, values);

            if (result.rowCount === 0) return c.json({ success: false, message: 'Produto não encontrado' }, 404);

            return c.json({ success: true, message: 'Produto atualizado', data: result.rows[0] });

        } catch (error: any) {
            return c.json({ success: false, message: error.message || 'Erro ao atualizar' }, 500);
        }
    }

    /**
     * Deletar produto
     */
    static async deleteProduct(c: Context) {
        try {
            const id = c.req.param('id');
            const pool = getDbPool(c);

            const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);

            if (result.rowCount === 0) return c.json({ success: false, message: 'Produto não encontrado' }, 404);

            return c.json({ success: true, message: 'Produto removido' });
        } catch (error) {
            return c.json({ success: false, message: 'Erro ao deletar' }, 500);
        }
    }

    /**
     * Buscar metadados de uma URL
     */
    static async fetchMetadata(c: Context) {
        try {
            const { url } = await c.req.json();
            if (!url) return c.json({ success: false, message: 'URL is required' }, 400);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                return c.json({ success: false, message: `Failed to access URL: ${response.status}` }, 400);
            }

            const html = await response.text();

            const getMeta = (prop: string) => {
                const regex = new RegExp(`<meta\\s+(?:property|name)=["']${prop}["']\\s+content=["']([^"']*)["']`, 'i');
                const match = html.match(regex);
                return match ? match[1] : '';
            };

            const getTitle = () => {
                const match = html.match(/<title>([^<]*)<\/title>/i);
                return match ? match[1].trim() : '';
            }

            const getPrice = () => {
                const metaPrice = getMeta('product:price:amount') ||
                    getMeta('og:price:amount') ||
                    getMeta('product:amount');
                if (metaPrice) return parseFloat(metaPrice.replace(',', '.'));

                try {
                    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
                    if (jsonLdMatch) {
                        for (const script of jsonLdMatch) {
                            const content = script.replace(/<script.*?>|<\/script>/gi, '');
                            const json = JSON.parse(content);
                            const items = Array.isArray(json) ? json : [json];
                            for (const item of items) {
                                if (item['@type'] === 'Product' || item['@type'] === 'Offer') {
                                    const price = item.offers?.price || item.price;
                                    if (price) return parseFloat(String(price).replace(',', '.'));
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Ignora erros de parsing de JSON-LD silenciosamente para não quebrar a busca
                }

                return null;
            };

            const title = getMeta('og:title') || getMeta('twitter:title') || getTitle();
            const description = getMeta('og:description') || getMeta('description') || getMeta('twitter:description');
            const image = getMeta('og:image') || getMeta('twitter:image');
            const price = getPrice();

            return c.json({
                success: true,
                data: {
                    title: (title || '').trim(),
                    description: (description || '').trim(),
                    imageUrl: (image || '').trim(),
                    price: price
                }
            });

        } catch (error: any) {
            console.error('Error fetching metadata:', error);
            return c.json({ success: false, message: 'Failed to fetch metadata: ' + error.message }, 500);
        }
    }
}
