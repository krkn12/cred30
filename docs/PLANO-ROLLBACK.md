# 🔄 Plano de Rollback - CRED30

## 📋 Visão Geral

Este documento descreve o plano de rollback para reverter a migração para Clean Architecture caso ocorram problemas críticos que impossibilitem o funcionamento do sistema.

## 🎯 Critérios de Ativação do Rollback

### Situações Críticas

- ❌ **Falha total do sistema**: Aplicação não inicia após migração
- ❌ **Perda de dados**: Corrupção ou perda de dados durante migração
- ❌ **Performance severamente degradada**: Queda > 80% na performance
- ❌ **Falhas de segurança**: Vulnerabilidades críticas introduzidas
- ❌ **Timeout em produção**: Sistemas críticos não respondem

### Situações Não Críticas

- ⚠️ **Pequenos bugs**: Erros corrigíveis com hotfix
- ⚠️ **Ajustes de performance**: Otimizações necessárias
- ⚠️ **Problemas de UI**: Interface precisa ajustes

## 🗂️ Backup Pré-Migração

### Arquivos Originais Backupados

```
backup/
├── backend/
│   ├── src/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── types/
├── frontend/
│   ├── components/
│   ├── services/
│   ├── src/
│   └── [App.tsx, types.ts, constants.ts]
└── config/
    ├── package.json
    ├── tsconfig.json (backend)
    └── tsconfig.json (frontend)
```

### Banco de Dados

- ✅ **Backup completo**: `cred30_backup_20241213.sql`
- ✅ **Schema original**: Documentado em `ORIGINAL_SCHEMA.md`
- ✅ **Migrations aplicadas**: Registradas em `migration_log.txt`

## 🚀 Procedimento de Rollback

### 1. Parada Imediata dos Serviços

```bash
# Parar backend
cd backend && npm run stop || pkill -f "node.*backend"

# Parar frontend
cd frontend && npm run stop || pkill -f "vite|webpack"

# Verificar processos
ps aux | grep -E "(node|vite|webpack)"
```

### 2. Restauração dos Arquivos

```bash
# Script de rollback automatizado
node ROLLBACK-AUTOMATICO.cjs

# Ou manualmente
cp -r backup/backend/* backend/
cp -r backup/frontend/* .
cp backup/config/* .
```

### 3. Restauração do Banco de Dados

```bash
# PostgreSQL
psql -U postgres -d cred30 < backup/cred30_backup_20241213.sql

# MongoDB (se aplicável)
mongorestore --db cred30 backup/mongodb_cred30_20241213/
```

### 4. Reinstalação de Dependências

```bash
# Backend
cd backend && rm -rf node_modules package-lock.json
npm install

# Frontend
cd .. && rm -rf node_modules package-lock.json
npm install
```

### 5. Verificação do Sistema

```bash
# Testar backend
cd backend && npm run dev
curl http://localhost:3001/api/health

# Testar frontend
cd .. && npm run dev
curl http://localhost:3000
```

## 📊 Script de Rollback Automatizado

### ROLLBACK-AUTOMATICO.cjs

```javascript
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PROJECT_ROOT = __dirname;
const BACKUP_DIR = path.join(PROJECT_ROOT, "backup");

console.log("🔄 Iniciando rollback automatizado...\n");

// 1. Parar serviços
try {
  console.log("⏹️  Parando serviços...");
  execSync('pkill -f "node.*backend" || true', { stdio: "inherit" });
  execSync('pkill -f "vite|webpack" || true', { stdio: "inherit" });
  console.log("✅ Serviços parados");
} catch (error) {
  console.log("⚠️  Erro ao parar serviços:", error.message);
}

// 2. Restaurar arquivos
try {
  console.log("\n📁 Restaurando arquivos...");

  // Backend
  const backendSrc = path.join(BACKUP_DIR, "backend/src");
  const backendDest = path.join(PROJECT_ROOT, "backend/src");

  if (fs.existsSync(backendSrc)) {
    execSync(`rm -rf ${backendDest}`, { stdio: "inherit" });
    execSync(`cp -r ${backendSrc} ${backendDest}`, { stdio: "inherit" });
    console.log("✅ Backend restaurado");
  }

  // Frontend
  const frontendFiles = ["App.tsx", "types.ts", "constants.ts"];

  frontendFiles.forEach((file) => {
    const src = path.join(BACKUP_DIR, "frontend", file);
    const dest = path.join(PROJECT_ROOT, file);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✅ ${file} restaurado`);
    }
  });

  // Components
  const componentsSrc = path.join(BACKUP_DIR, "frontend/components");
  const componentsDest = path.join(PROJECT_ROOT, "components");

  if (fs.existsSync(componentsSrc)) {
    execSync(`rm -rf ${componentsDest}`, { stdio: "inherit" });
    execSync(`cp -r ${componentsSrc} ${componentsDest}`, { stdio: "inherit" });
    console.log("✅ Components restaurados");
  }

  // Services
  const servicesSrc = path.join(BACKUP_DIR, "frontend/services");
  const servicesDest = path.join(PROJECT_ROOT, "services");

  if (fs.existsSync(servicesSrc)) {
    execSync(`rm -rf ${servicesDest}`, { stdio: "inherit" });
    execSync(`cp -r ${servicesSrc} ${servicesDest}`, { stdio: "inherit" });
    console.log("✅ Services restaurados");
  }
} catch (error) {
  console.log("❌ Erro ao restaurar arquivos:", error.message);
  process.exit(1);
}

// 3. Restaurar configurações
try {
  console.log("\n⚙️  Restaurando configurações...");

  const configFiles = [
    { src: "package.json", dest: "package.json" },
    { src: "backend/tsconfig.json", dest: "backend/tsconfig.json" },
    { src: "frontend/tsconfig.json", dest: "frontend/tsconfig.json" },
  ];

  configFiles.forEach(({ src, dest }) => {
    const srcPath = path.join(BACKUP_DIR, "config", src);
    const destPath = path.join(PROJECT_ROOT, dest);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ ${src} restaurado`);
    }
  });
} catch (error) {
  console.log("❌ Erro ao restaurar configurações:", error.message);
}

// 4. Reinstalar dependências
try {
  console.log("\n📦 Reinstalando dependências...");

  execSync("cd backend && rm -rf node_modules package-lock.json", {
    stdio: "inherit",
  });
  execSync("cd backend && npm install", { stdio: "inherit" });

  execSync("rm -rf node_modules package-lock.json", { stdio: "inherit" });
  execSync("npm install", { stdio: "inherit" });

  console.log("✅ Dependências reinstaladas");
} catch (error) {
  console.log("❌ Erro ao reinstalar dependências:", error.message);
}

console.log("\n🎉 Rollback concluído com sucesso!");
console.log("\n📋 Próximos passos:");
console.log('1. Execute "npm run dev:backend" para testar o backend');
console.log('2. Execute "npm run dev:frontend" para testar o frontend');
console.log("3. Verifique se tudo está funcionando como antes");
```

## 🧪 Testes Pós-Rollback

### Checklist de Verificação

- [ ] **Backend inicia sem erros**
- [ ] **Frontend carrega corretamente**
- [ ] **Login funciona**
- [ ] **Dashboard acessível**
- [ ] **APIs respondem corretamente**
- [ ] **Banco de dados consistente**
- [ ] **Performance aceitável**
- [ ] **Logs sem erros críticos**

### Comandos de Teste

```bash
# Testar saúde do backend
curl -f http://localhost:3001/api/health || echo "❌ Backend unhealthy"

# Testar frontend
curl -f http://localhost:3000 || echo "❌ Frontend unavailable"

# Testar login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -w "%{http_code}" | grep -q "200" && echo "✅ Login OK" || echo "❌ Login failed"

# Verificar banco
cd backend && npm run db:check || echo "❌ Database issues"
```

## 📞 Comunicação e Documentação

### Notificação de Rollback

- ✅ **Equipe de desenvolvimento**: Slack/email imediato
- ✅ **Stakeholders**: Comunicação em até 1 hora
- ✅ **Usuários**: Aviso em sistema (se afetar produção)
- ✅ **Documentação**: Atualizar changelog e incident report

### Registro do Incidente

```
Incident ID: INC-2024-001
Data: 2024-12-13
Hora: 20:54 UTC
Motivo: Performance degradation > 80%
Ação: Rollback para versão anterior
Impacto: Usuários afetados por 15 minutos
Resolução: Sistema restaurado em 5 minutos
```

## 🔄 Prevenção Futura

### Melhorias no Processo

- 🎯 **Testes mais abrangentes**: Suite de testes automatizados
- 🎯 **Deploy gradual**: Blue-green deployment
- 🎯 **Monitoramento real-time**: Alertas automáticos
- 🎯 **Rollback granular**: Por feature em vez de tudo

### Checkpoints de Qualidade

- ✅ **Code review obrigatório**: 2 desenvolvedores senior
- ✅ **Testes automatizados**: > 90% coverage
- ✅ **Performance benchmarks**: Baseline estabelecido
- ✅ **Security scan**: Verificação de vulnerabilidades

## 📞 Contatos de Emergência

### Equipe Técnica

- **Arquiteto de Software**: [Nome] - [Telefone]
- **Tech Lead Backend**: [Nome] - [Telefone]
- **Tech Lead Frontend**: [Nome] - [Telefone]
- **DevOps Engineer**: [Nome] - [Telefone]

### Stakeholders

- **Product Manager**: [Nome] - [Telefone]
- **CTO**: [Nome] - [Telefone]
- **CEO**: [Nome] - [Telefone]

---

**Versão**: 1.0.0  
**Data**: Dezembro 2024  
**Responsável**: Arquiteto de Software Sênior  
**Aprovação**: CTO
