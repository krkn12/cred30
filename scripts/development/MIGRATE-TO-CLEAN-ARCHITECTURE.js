#!/usr/bin/env node

/**
 * Script de Migração para Clean Architecture
 * Reorganiza todos os arquivos do projeto CRED30 para seguir Clean Architecture e SOLID
 */

const fs = require('fs');
const path = require('path');

// Configuração
const PROJECT_ROOT = __dirname;
const BACKEND_SRC = path.join(PROJECT_ROOT, 'backend/src');
const FRONTEND_SRC = path.join(PROJECT_ROOT, 'src');

// Função para normalizar caminhos no Windows
function normalizePath(p) {
  return path.normalize(p).replace(/\\/g, '/');
}

// Mapeamento de migração de arquivos (com caminhos normalizados)
const MIGRATION_MAP = {
  // Backend - Mover arquivos existentes para nova estrutura
  'backend/src/middleware/auth.ts': normalizePath('backend/src/presentation/http/middleware/auth.middleware.ts'),
  'backend/src/middleware/rateLimit.ts': normalizePath('backend/src/presentation/http/middleware/rate-limit.middleware.ts'),
  'backend/src/middleware/pagination.ts': normalizePath('backend/src/presentation/http/middleware/pagination.middleware.ts'),
  'backend/src/middleware/audit.ts': normalizePath('backend/src/infrastructure/logging/audit.middleware.ts'),  
  'backend/src/routes/auth.ts': normalizePath('backend/src/presentation/http/routes/auth.routes.ts'),
  'backend/src/routes/users.ts': normalizePath('backend/src/presentation/http/routes/users.routes.ts'),
  'backend/src/routes/loans.ts': normalizePath('backend/src/presentation/http/routes/loans.routes.ts'),
  'backend/src/routes/quotas.ts': normalizePath('backend/src/presentation/http/routes/quotas.routes.ts'),
  'backend/src/routes/transactions.ts': normalizePath('backend/src/presentation/http/routes/transactions.routes.ts'),
  'backend/src/routes/admin.ts': normalizePath('backend/src/presentation/http/routes/admin.routes.ts'),
  'backend/src/routes/withdrawals.ts': normalizePath('backend/src/presentation/http/routes/withdrawals.routes.ts'),  
  'backend/src/models/User.ts': normalizePath('backend/src/domain/entities/user.entity.ts'),
  'backend/src/models/Loan.ts': normalizePath('backend/src/domain/entities/loan.entity.ts'),
  'backend/src/models/Quota.ts': normalizePath('backend/src/domain/entities/quota.entity.ts'),
  'backend/src/models/Transaction.ts': normalizePath('backend/src/domain/entities/transaction.entity.ts'),
  'backend/src/models/AppState.ts': normalizePath('backend/src/shared/types/app-state.type.ts'),  
  'backend/src/utils/db.ts': normalizePath('backend/src/infrastructure/database/postgresql/connection/pool.ts'),
  'backend/src/utils/cache.ts': normalizePath('backend/src/infrastructure/cache/memory-cache.service.ts'),
  'backend/src/utils/logger.ts': normalizePath('backend/src/infrastructure/logging/winston.logger.ts'),
  'backend/src/utils/validation.ts': normalizePath('backend/src/shared/utils/validation.utils.ts'),
  'backend/src/utils/constants.ts': normalizePath('backend/src/shared/constants/business.constants.ts'),
  'backend/src/utils/transactions.ts': normalizePath('backend/src/domain/services/transaction.service.ts'),
  'backend/src/utils/indexes.ts': normalizePath('backend/src/infrastructure/database/postgresql/migrations/002_add_indexes.sql'),  
  'backend/src/types/hono.ts': normalizePath('backend/src/shared/types/hono.types.ts'),  
  // Frontend - Reorganizar componentes
  'App.tsx': normalizePath('frontend/src/presentation/pages/app.page.tsx'),
  'components/Layout.tsx': normalizePath('frontend/src/presentation/components/layout/main-layout.component.tsx'),
  'components/AIAssistant.tsx': normalizePath('frontend/src/presentation/components/features/ai-assistant.component.tsx'),
  'components/InvestmentRedemption.tsx': normalizePath('frontend/src/presentation/components/features/investment-redemption.component.tsx'),  
  'src/components/admin/FinancialDashboard.tsx': normalizePath('frontend/src/presentation/pages/admin/financial-dashboard.page.tsx'),
  'src/components/admin/MetricCard.tsx': normalizePath('frontend/src/presentation/components/ui/metric-card.component.tsx'),
  'src/components/admin/PendingItemsTable.tsx': normalizePath('frontend/src/presentation/components/ui/pending-items-table.component.tsx'),
  'src/components/client/ClientDashboard.tsx': normalizePath('frontend/src/presentation/pages/dashboard/client-dashboard.page.tsx'),
  'src/components/ui/Modal.tsx': normalizePath('frontend/src/presentation/components/ui/modal.component.tsx'),  
  'services/apiService.ts': normalizePath('frontend/src/application/services/api.service.ts'),
  'services/apiStorageService.ts': normalizePath('frontend/src/application/services/storage.service.ts'),
  'services/storageService.ts': normalizePath('frontend/src/infrastructure/storage/local-storage.service.ts'),  
  'src/utils/constants.ts': normalizePath('frontend/src/shared/constants/api.constants.ts'),
  'src/utils/formatters.ts': normalizePath('frontend/src/shared/utils/format.utils.ts'),  
  'types.ts': normalizePath('frontend/src/domain/types/common.types.ts'),
  'constants.ts': normalizePath('frontend/src/shared/constants/app.constants.ts'),
};

// Estrutura de diretórios a ser criada
const DIRECTORIES_TO_CREATE = [
  // Backend
  normalizePath('backend/src/presentation'),
  normalizePath('backend/src/presentation/http'),
  normalizePath('backend/src/presentation/http/controllers'),
  normalizePath('backend/src/presentation/http/middleware'),
  normalizePath('backend/src/presentation/http/routes'),
  normalizePath('backend/src/presentation/graphql'),
  normalizePath('backend/src/application'),
  normalizePath('backend/src/application/use-cases'),
  normalizePath('backend/src/application/use-cases/auth'),
  normalizePath('backend/src/application/use-cases/users'),
  normalizePath('backend/src/application/use-cases/loans'),
  normalizePath('backend/src/application/use-cases/quotas'),
  normalizePath('backend/src/application/use-cases/transactions'),
  normalizePath('backend/src/application/dto'),
  normalizePath('backend/src/application/validators'),
  normalizePath('backend/src/application/mappers'),
  normalizePath('backend/src/domain'),
  normalizePath('backend/src/domain/entities'),
  normalizePath('backend/src/domain/value-objects'),
  normalizePath('backend/src/domain/enums'),
  normalizePath('backend/src/domain/events'),
  normalizePath('backend/src/domain/repositories'),
  normalizePath('backend/src/domain/services'),
  normalizePath('backend/src/infrastructure'),
  normalizePath('backend/src/infrastructure/database'),
  normalizePath('backend/src/infrastructure/database/postgresql'),
  normalizePath('backend/src/infrastructure/database/postgresql/connection'),
  normalizePath('backend/src/infrastructure/database/postgresql/migrations'),
  normalizePath('backend/src/infrastructure/database/postgresql/repositories'),
  normalizePath('backend/src/infrastructure/database/postgresql/models'),
  normalizePath('backend/src/infrastructure/external-services'),
  normalizePath('backend/src/infrastructure/external-services/pix'),
  normalizePath('backend/src/infrastructure/external-services/email'),
  normalizePath('backend/src/infrastructure/external-services/sms'),
  normalizePath('backend/src/infrastructure/cache'),
  normalizePath('backend/src/infrastructure/cache/redis'),
  normalizePath('backend/src/infrastructure/cache/memory'),
  normalizePath('backend/src/infrastructure/logging'),
  normalizePath('backend/src/infrastructure/security'),
  normalizePath('backend/src/infrastructure/security/jwt'),
  normalizePath('backend/src/infrastructure/security/encryption'),
  normalizePath('backend/src/infrastructure/security/rate-limit'),
  normalizePath('backend/src/shared'),
  normalizePath('backend/src/shared/errors'),
  normalizePath('backend/src/shared/types'),
  normalizePath('backend/src/shared/utils'),
  normalizePath('backend/src/shared/constants'),
  normalizePath('backend/src/config'),
  normalizePath('backend/tests'),
  normalizePath('backend/tests/unit'),
  normalizePath('backend/tests/integration'),
  normalizePath('backend/tests/e2e'),
  normalizePath('backend/tests/fixtures'),
  normalizePath('backend/docs'),
  normalizePath('backend/docs/architecture'),
  normalizePath('backend/docs/deployment'),
  normalizePath('backend/docs/development'),
  normalizePath('backend/scripts'),
  normalizePath('backend/scripts/migration'),
  normalizePath('backend/scripts/development'),
  normalizePath('backend/scripts/deployment'),
  normalizePath('backend/docker'),
  
  // Frontend
  normalizePath('frontend/src'),
  normalizePath('frontend/src/presentation'),
  normalizePath('frontend/src/presentation/pages'),
  normalizePath('frontend/src/presentation/pages/auth'),
  normalizePath('frontend/src/presentation/pages/dashboard'),
  normalizePath('frontend/src/presentation/pages/admin'),
  normalizePath('frontend/src/presentation/pages/loans'),
  normalizePath('frontend/src/presentation/pages/quotas'),
  normalizePath('frontend/src/presentation/pages/transactions'),
  normalizePath('frontend/src/presentation/pages/profile'),
  normalizePath('frontend/src/presentation/components'),
  normalizePath('frontend/src/presentation/components/ui'),
  normalizePath('frontend/src/presentation/components/layout'),
  normalizePath('frontend/src/presentation/components/forms'),
  normalizePath('frontend/src/presentation/components/features'),
  normalizePath('frontend/src/presentation/components/features/auth'),
  normalizePath('frontend/src/presentation/components/features/loans'),
  normalizePath('frontend/src/presentation/components/features/quotas'),
  normalizePath('frontend/src/presentation/components/features/transactions'),
  normalizePath('frontend/src/presentation/hooks'),
  normalizePath('frontend/src/presentation/providers'),
  normalizePath('frontend/src/application'),
  normalizePath('frontend/src/application/services'),
  normalizePath('frontend/src/application/stores'),
  normalizePath('frontend/src/application/mappers'),
  normalizePath('frontend/src/application/validators'),
  normalizePath('frontend/src/domain'),
  normalizePath('frontend/src/domain/entities'),
  normalizePath('frontend/src/domain/value-objects'),
  normalizePath('frontend/src/domain/enums'),
  normalizePath('frontend/src/domain/types'),
  normalizePath('frontend/src/infrastructure'),
  normalizePath('frontend/src/infrastructure/http'),
  normalizePath('frontend/src/infrastructure/storage'),
  normalizePath('frontend/src/infrastructure/notifications'),
  normalizePath('frontend/src/shared'),
  normalizePath('frontend/src/shared/constants'),
  normalizePath('frontend/src/shared/utils'),
  normalizePath('frontend/src/shared/types'),
  normalizePath('frontend/src/shared/errors'),
  normalizePath('frontend/src/config'),
  normalizePath('frontend/src/styles'),
  normalizePath('frontend/src/styles/components'),
  normalizePath('frontend/src/styles/utilities'),
  normalizePath('frontend/src/assets'),
  normalizePath('frontend/src/assets/images'),
  normalizePath('frontend/src/assets/icons'),
  normalizePath('frontend/src/assets/fonts'),
  normalizePath('frontend/tests'),
  normalizePath('frontend/tests/components'),
  normalizePath('frontend/tests/hooks'),
  normalizePath('frontend/tests/services'),
  normalizePath('frontend/tests/utils'),
  normalizePath('frontend/tests/e2e'),
  normalizePath('frontend/tests/e2e/auth'),
  normalizePath('frontend/tests/e2e/dashboard'),
  normalizePath('frontend/tests/e2e/loans'),
  normalizePath('frontend/tests/e2e/quotas'),
  normalizePath('frontend/tests/fixtures'),
  normalizePath('frontend/docs'),
  normalizePath('frontend/docs/components'),
  normalizePath('frontend/docs/hooks'),
  normalizePath('frontend/docs/guides'),
];

// Função para criar diretórios
function createDirectories() {
  console.log('📁 Criando estrutura de diretórios...');
  
  DIRECTORIES_TO_CREATE.forEach(dir => {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✅ Criado: ${dir}`);
    } else {
      console.log(`⚠️  Já existe: ${dir}`);
    }
  });
}

// Função para migrar arquivos
function migrateFiles() {
  console.log('📦 Migrando arquivos para nova estrutura...');
  
  Object.entries(MIGRATION_MAP).forEach(([source, target]) => {
    const sourcePath = path.join(PROJECT_ROOT, source);
    const targetPath = path.join(PROJECT_ROOT, target);
    
    if (fs.existsSync(sourcePath)) {
      // Criar diretório de destino se não existir
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Mover arquivo
      fs.renameSync(sourcePath, targetPath);
      console.log(`📄 Movido: ${source} -> ${target}`);
    } else {
      console.log(`❌ Não encontrado: ${source}`);
    }
  });
}

// Função para criar arquivos de configuração
function createConfigFiles() {
  console.log('⚙️  Criando arquivos de configuração...');
  
  // Backend tsconfig.json atualizado
  const backendTsConfig = {
    "compilerOptions": {
      "target": "ES2022",
      "module": "commonjs",
      "lib": ["ES2022"],
      "outDir": "./dist",
      "rootDir": "./src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "moduleResolution": "node",
      "allowSyntheticDefaultImports": true,
      "experimentalDecorators": true,
      "emitDecoratorMetadata": true,
      "baseUrl": "./src",
      "paths": {
        "@/*": ["./*"],
        "@presentation/*": ["./presentation/*"],
        "@application/*": ["./application/*"],
        "@domain/*": ["./domain/*"],
        "@infrastructure/*": ["./infrastructure/*"],
        "@shared/*": ["./shared/*"]
      }
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "tests"]
  };
  
  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'backend/tsconfig.json'),
    JSON.stringify(backendTsConfig, null, 2)
  );
  
  // Frontend tsconfig.json atualizado
  const frontendTsConfig = {
    "compilerOptions": {
      "target": "ES2020",
      "lib": ["DOM", "DOM.Iterable", "ES6"],
      "allowJs": true,
      "skipLibCheck": true,
      "esModuleInterop": true,
      "allowSyntheticDefaultImports": true,
      "strict": true,
      "forceConsistentCasingInFileNames": true,
      "module": "ESNext",
      "moduleResolution": "bundler",
      "resolveJsonModule": true,
      "isolatedModules": true,
      "noEmit": true,
      "jsx": "react-jsx",
      "baseUrl": "./src",
      "paths": {
        "@/*": ["./*"],
        "@presentation/*": ["./presentation/*"],
        "@application/*": ["./application/*"],
        "@domain/*": ["./domain/*"],
        "@infrastructure/*": ["./infrastructure/*"],
        "@shared/*": ["./shared/*"]
      }
    },
    "include": ["src"],
    "references": [{ "path": "./tsconfig.node.json" }]
  };
  
  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'frontend/tsconfig.json'),
    JSON.stringify(frontendTsConfig, null, 2)
  );
  
  // Package.json scripts de migração
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.scripts = {
      ...packageJson.scripts,
      "migrate:clean": "node MIGRATE-TO-CLEAN-ARCHITECTURE.js",
      "migrate:backend": "cd backend && npm run migrate:clean",
      "migrate:frontend": "cd frontend && npm run migrate:clean",
      "dev:backend": "cd backend && npm run dev",
      "dev:frontend": "cd frontend && npm run dev",
      "dev:all": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
      "test:backend": "cd backend && npm test",
      "test:frontend": "cd frontend && npm test",
      "test:all": "npm run test:backend && npm run test:frontend",
      "lint:backend": "cd backend && npm run lint",
      "lint:frontend": "cd frontend && npm run lint",
      "lint:all": "npm run lint:backend && npm run lint:frontend",
      "build:backend": "cd backend && npm run build",
      "build:frontend": "cd frontend && npm run build",
      "build:all": "npm run build:backend && npm run build:frontend"
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
}

// Função para criar arquivos .gitignore atualizados
function createGitignoreFiles() {
  console.log('🚫 Criando arquivos .gitignore...');
  
  const backendGitignore = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# Stores VSCode versions used for testing VSCode extensions
.vscode-test

# Temporary folders
tmp/
temp/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Tests
coverage/
.nyc_output/
test-results/
`;

  const frontendGitignore = `# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# production
/build
/dist

# misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`;

  fs.writeFileSync(path.join(PROJECT_ROOT, 'backend/.gitignore'), backendGitignore);
  fs.writeFileSync(path.join(PROJECT_ROOT, 'frontend/.gitignore'), frontendGitignore);
}

// Função principal
function main() {
  console.log('🚀 Iniciando migração para Clean Architecture e SOLID\n');
  console.log('📍 Diretório do projeto:', PROJECT_ROOT);
  
  try {
    // 1. Criar estrutura de diretórios
    createDirectories();
    
    // 2. Migrar arquivos existentes
    migrateFiles();
    
    // 3. Criar arquivos de configuração
    createConfigFiles();
    
    // 4. Criar arquivos .gitignore
    createGitignoreFiles();
    
    console.log('\n✅ Migração concluída com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Execute "npm install" nos diretórios backend e frontend');
    console.log('2. Execute "npm run dev:all" para iniciar ambos os serviços');
    console.log('3. Execute "npm run lint:all" para verificar código');
    console.log('4. Execute "npm run test:all" para executar testes');
    
  } catch (error) {
    console.error('❌ Erro durante migração:', error);
    process.exit(1);
  }
}

// Executar migração
if (require.main === module) {
  main();
}

module.exports = {
  createDirectories,
  migrateFiles,
  createConfigFiles,
  createGitignoreFiles
};