import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';

const productsRoutes = new Hono();

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

// Listar produtos
productsRoutes.get('/', authMiddleware, async (c) => {
    try {
        const pool = getDbPool(c);
        const { category, showAll } = c.req.query();

        // Se não for admin e pedir showAll, forçar apenas ativos
        // (Na verdade, simplificando: listar ativos para todos)

        let query = 'SELECT * FROM products WHERE active = true';
        const params: any[] = [];

        if (category) {
            query += ' AND category = $1';
            params.push(category);
        }

        // Se for admin, pode ver inativos se quiser
        // Mas por padrão a rota pública mostra ativos.
        // Vamos criar rota específica para admin se precisar listar tudo ou usar query param protegido?
        // Vamos simplificar: GET / retorna ativos. GET /admin/all retorna tudo.

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
});

// Listar TUDO (Para admin)
productsRoutes.get('/admin/all', authMiddleware, adminMiddleware, async (c) => {
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
});

// Criar produto
productsRoutes.post('/', authMiddleware, adminMiddleware, async (c) => {
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
});

// Atualizar produto
productsRoutes.put('/:id', authMiddleware, adminMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const schema = productSchema.partial(); // Permite atualização parcial
        const data = schema.parse(body);
        const pool = getDbPool(c);

        // Construir query dinâmica
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
});

// Deletar produto
productsRoutes.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        const pool = getDbPool(c);

        const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);

        if (result.rowCount === 0) return c.json({ success: false, message: 'Produto não encontrado' }, 404);

        return c.json({ success: true, message: 'Produto removido' });
    } catch (error) {
        return c.json({ success: false, message: 'Erro ao deletar' }, 500);
    }
});

// Rota para buscar metadados de uma URL
productsRoutes.post('/fetch-metadata', authMiddleware, adminMiddleware, async (c) => {
    try {
        const { url } = await c.req.json();
        if (!url) return c.json({ success: false, message: 'URL is required' }, 400);

        // Fetch the page com user agent de browser para evitar bloqueios simples
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            return c.json({ success: false, message: `Failed to access URL: ${response.status}` }, 400);
        }

        const html = await response.text();

        // Helper para extrair meta tags
        const getMeta = (prop: string) => {
            // Regex flexível para aspas simples e duplas e property ou name
            const regex = new RegExp(`<meta\\s+(?:property|name)=["']${prop}["']\\s+content=["']([^"']*)["']`, 'i');
            const match = html.match(regex);
            return match ? match[1] : '';
        };

        const getTitle = () => {
            const match = html.match(/<title>([^<]*)<\/title>/i);
            return match ? match[1] : '';
        }

        let title = getMeta('og:title') || getMeta('twitter:title') || getTitle();
        let description = getMeta('og:description') || getMeta('description') || getMeta('twitter:description');
        let image = getMeta('og:image') || getMeta('twitter:image');

        return c.json({
            success: true,
            data: {
                title: title || '',
                description: description || '',
                imageUrl: image || ''
            }
        });

    } catch (error: any) {
        console.error('Error fetching metadata:', error);
        return c.json({ success: false, message: 'Failed to fetch metadata: ' + error.message }, 500);
    }
});

export { productsRoutes };
