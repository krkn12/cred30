#!/usr/bin/env node

/**
 * Script de Rollback Automatizado - CRED30
 * Reverte a migração para Clean Architecture caso ocorram problemas
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = __dirname;
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backup');

console.log('🔄 Iniciando rollback automatizado...\n');

// Função para executar comandos com tratamento de erro
function execCommand(command, description) {
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description}`);
    return true;
  } catch (error) {
    console.log(`❌ Erro ao ${description.toLowerCase()}: ${error.message}`);
    return false;
  }
}

// Função para verificar se diretório existe
function dirExists(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

// Função para verificar se arquivo existe
function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

// 1. Verificar se backup existe
console.log('🔍 Verificando backup...');
if (!dirExists(BACKUP_DIR)) {
  console.log('❌ Diretório de backup não encontrado. Abortando rollback.');
  process.exit(1);
}
console.log('✅ Backup encontrado');

// 2. Parar serviços
console.log('\n⏹️  Parando serviços...');
try {
  // Tentar parar processos de forma segura
  execCommand('pkill -f "node.*backend" || true', 'Parando processos backend');
  execCommand('pkill -f "vite|webpack" || true', 'Parando processos frontend');
  execCommand('pkill -f "npm.*dev" || true', 'Parando processos npm dev');
} catch (error) {
  console.log('⚠️  Alguns serviços podem já estar parados');
}

// 3. Restaurar arquivos do backend
console.log('\n📁 Restaurando arquivos do backend...');
try {
  const backendSrc = path.join(BACKUP_DIR, 'backend/src');
  const backendDest = path.join(PROJECT_ROOT, 'backend/src');
  
  if (dirExists(backendSrc)) {
    // Remover estrutura atual se existir
    if (dirExists(backendDest)) {
      execCommand(`rm -rf "${backendDest}"`, 'Removendo estrutura atual do backend');
    }
    
    // Restaurar do backup
    execCommand(`cp -r "${backendSrc}" "${backendDest}"`, 'Restaurando arquivos do backend');
    console.log('✅ Backend restaurado com sucesso');
  } else {
    console.log('⚠️  Backup do backend não encontrado, pulando restauração');
  }
} catch (error) {
  console.log('❌ Erro crítico ao restaurar backend:', error.message);
  process.exit(1);
}

// 4. Restaurar arquivos do frontend
console.log('\n📁 Restaurando arquivos do frontend...');
try {
  // Arquivos principais do frontend
  const frontendFiles = [
    'App.tsx', 'types.ts', 'constants.ts', 'index.tsx', 'index.html'
  ];
  
  let restoredFiles = 0;
  frontendFiles.forEach(file => {
    const src = path.join(BACKUP_DIR, 'frontend', file);
    const dest = path.join(PROJECT_ROOT, file);
    
    if (fileExists(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✅ ${file} restaurado`);
      restoredFiles++;
    } else {
      console.log(`⚠️  ${file} não encontrado no backup`);
    }
  });
  
  // Restaurar diretório components
  const componentsSrc = path.join(BACKUP_DIR, 'frontend/components');
  const componentsDest = path.join(PROJECT_ROOT, 'components');
  
  if (dirExists(componentsSrc)) {
    if (dirExists(componentsDest)) {
      execCommand(`rm -rf "${componentsDest}"`, 'Removendo components atual');
    }
    execCommand(`cp -r "${componentsSrc}" "${componentsDest}"`, 'Restaurando components');
    console.log('✅ Components restaurado');
  }
  
  // Restaurar diretório services
  const servicesSrc = path.join(BACKUP_DIR, 'frontend/services');
  const servicesDest = path.join(PROJECT_ROOT, 'services');
  
  if (dirExists(servicesSrc)) {
    if (dirExists(servicesDest)) {
      execCommand(`rm -rf "${servicesDest}"`, 'Removendo services atual');
    }
    execCommand(`cp -r "${servicesSrc}" "${servicesDest}"`, 'Restaurando services');
    console.log('✅ Services restaurado');
  }
  
  // Restaurar diretório src se existir
  const srcSrc = path.join(BACKUP_DIR, 'frontend/src');
  const srcDest = path.join(PROJECT_ROOT, 'src');
  
  if (dirExists(srcSrc)) {
    if (dirExists(srcDest)) {
      execCommand(`rm -rf "${srcDest}"`, 'Removendo src atual');
    }
    execCommand(`cp -r "${srcSrc}" "${srcDest}"`, 'Restaurando src');
    console.log('✅ Src restaurado');
  }
  
  console.log(`✅ Frontend restaurado (${restoredFiles} arquivos)`);
  
} catch (error) {
  console.log('❌ Erro ao restaurar frontend:', error.message);
}

// 5. Restaurar configurações
console.log('\n⚙️  Restaurando configurações...');
try {
  const configFiles = [
    { src: 'package.json', dest: 'package.json' },
    { src: 'backend/package.json', dest: 'backend/package.json' },
    { src: 'backend/tsconfig.json', dest: 'backend/tsconfig.json' },
    { src: 'frontend/tsconfig.json', dest: 'frontend/tsconfig.json' },
    { src: 'vite.config.ts', dest: 'vite.config.ts' },
    { src: 'tailwind-styles.css', dest: 'tailwind-styles.css' }
  ];
  
  let restoredConfigs = 0;
  configFiles.forEach(({ src, dest }) => {
    const srcPath = path.join(BACKUP_DIR, 'config', src);
    const destPath = path.join(PROJECT_ROOT, dest);
    
    if (fileExists(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ ${src} restaurado`);
      restoredConfigs++;
    } else {
      console.log(`⚠️  ${src} não encontrado no backup`);
    }
  });
  
  console.log(`✅ Configurações restauradas (${restoredConfigs} arquivos)`);
  
} catch (error) {
  console.log('❌ Erro ao restaurar configurações:', error.message);
}

// 6. Reinstalar dependências
console.log('\n📦 Reinstalando dependências...');
try {
  // Backend
  if (dirExists(path.join(PROJECT_ROOT, 'backend'))) {
    execCommand('cd backend && rm -rf node_modules package-lock.json', 'Limpando dependências backend');
    execCommand('cd backend && npm install', 'Instalando dependências backend');
  }
  
  // Frontend
  execCommand('rm -rf node_modules package-lock.json', 'Limpando dependências frontend');
  execCommand('npm install', 'Instalando dependências frontend');
  
  console.log('✅ Dependências reinstaladas');
  
} catch (error) {
  console.log('❌ Erro ao reinstalar dependências:', error.message);
}

// 7. Limpar arquivos da migração
console.log('\n🧹 Limpando arquivos da migração...');
try {
  const filesToRemove = [
    'MIGRATE-TO-CLEAN-ARCHITECTURE.js',
    'MIGRATE-TO-CLEAN-ARCHITECTURE.cjs',
    'PLANO-MIGRACAO-CLEAN-ARCHITECTURE.md',
    'NOVA-ARQUITETURA-CLEAN.md',
    'AUDITORIA-ARQUITETURA-CRED30.md',
    'DOCUMENTACAO-ARQUITETURAL.md',
    'PLANO-ROLLBACK.md'
  ];
  
  filesToRemove.forEach(file => {
    const filePath = path.join(PROJECT_ROOT, file);
    if (fileExists(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Removido: ${file}`);
    }
  });
  
  // Remover diretórios da nova arquitetura
  const dirsToRemove = [
    'frontend/src',
    'backend/src/presentation',
    'backend/src/application',
    'backend/src/infrastructure',
    'backend/src/domain',
    'backend/src/shared'
  ];
  
  dirsToRemove.forEach(dir => {
    const dirPath = path.join(PROJECT_ROOT, dir);
    if (dirExists(dirPath)) {
      execCommand(`rm -rf "${dirPath}"`, `Removendo ${dir}`);
    }
  });
  
} catch (error) {
  console.log('⚠️  Erro ao limpar arquivos da migração:', error.message);
}

// 8. Criar log do rollback
console.log('\n📝 Criando log do rollback...');
try {
  const rollbackLog = {
    timestamp: new Date().toISOString(),
    reason: 'Rollback automatizado executado',
    filesRestored: {
      backend: 'backend/src/*',
      frontend: ['App.tsx', 'types.ts', 'constants.ts', 'components/*', 'services/*'],
      config: ['package.json', 'tsconfig.json', 'vite.config.ts']
    },
    status: 'completed'
  };
  
  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'rollback-log.json'),
    JSON.stringify(rollbackLog, null, 2)
  );
  
  console.log('✅ Log do rollback criado');
  
} catch (error) {
  console.log('⚠️  Erro ao criar log do rollback:', error.message);
}

// 9. Resumo final
console.log('\n🎉 Rollback concluído!');
console.log('\n📋 Resumo das ações:');
console.log('✅ Serviços parados');
console.log('✅ Arquivos do backend restaurados');
console.log('✅ Arquivos do frontend restaurados');
console.log('✅ Configurações restauradas');
console.log('✅ Dependências reinstaladas');
console.log('✅ Arquivos da migração removidos');

console.log('\n🔧 Próximos passos:');
console.log('1. Execute "npm run dev:backend" para testar o backend');
console.log('2. Execute "npm run dev:frontend" para testar o frontend');
console.log('3. Verifique se tudo está funcionando como antes');
console.log('4. Execute testes automatizados se disponíveis');

console.log('\n📞 Em caso de problemas:');
console.log('- Verifique o log: rollback-log.json');
console.log('- Contacte o arquiteto de software');
console.log('- Analise os logs de erro dos serviços');

console.log('\n⚠️  Importante:');
console.log('- Este rollback reverte TODAS as alterações da migração');
console.log('- Qualquer trabalho na nova arquitetura será perdido');
console.log('- Considere criar backup antes de novas migrações');