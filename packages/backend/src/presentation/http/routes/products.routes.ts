import { Hono } from 'hono';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { ProductsController } from '../controllers/products.controller';

const productsRoutes = new Hono();

// Listar produtos
productsRoutes.get('/', authMiddleware, ProductsController.listProducts);

// Listar TUDO (Para admin)
productsRoutes.get('/admin/all', authMiddleware, adminMiddleware, ProductsController.listAllAdmin);

// Criar produto
productsRoutes.post('/', authMiddleware, adminMiddleware, ProductsController.createProduct);

// Atualizar produto
productsRoutes.put('/:id', authMiddleware, adminMiddleware, ProductsController.updateProduct);

// Deletar produto
productsRoutes.delete('/:id', authMiddleware, adminMiddleware, ProductsController.deleteProduct);

// Rota para buscar metadados de uma URL
productsRoutes.post('/fetch-metadata', authMiddleware, adminMiddleware, ProductsController.fetchMetadata);

export { productsRoutes };
