const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 RESOLVENDO PROBLEMAS NGROK E EXECUÇÃO...');
console.log('==========================================\n');

// Função para verificar se o ngrok está instalado
function checkNgrokInstallation() {
  try {
    const version = execSync('ngrok version', { encoding: 'utf8' });
    console.log('✅ ngrok instalado:', version.trim());
    return true;
  } catch (error) {
    console.log('❌ ngrok não encontrado. Instalando...');
    try {
      execSync('npm install -g ngrok', { stdio: 'inherit' });
      console.log('✅ ngrok instalado com sucesso!');
      return true;
    } catch (installError) {
      console.error('❌ Falha ao instalar ngrok:', installError.message);
      return false;
    }
  }
}

// Função para matar processos ngrok existentes
function killExistingNgrokProcesses() {
  try {
    console.log('🔍 Verificando processos ngrok existentes...');
    
    // No Windows
    if (process.platform === 'win32') {
      try {
        const result = execSync('tasklist | findstr ngrok', { encoding: 'utf8' });
        if (result.includes('ngrok')) {
          console.log('🛑 Matando processos ngrok existentes...');
          execSync('taskkill /f /im ngrok.exe', { stdio: 'inherit' });
          console.log('✅ Processos ngrok finalizados');
        }
      } catch (error) {
        console.log('ℹ️ Nenhum processo ngrok encontrado');
      }
    } else {
      // No Linux/Mac
      try {
        const result = execSync('ps aux | grep ngrok | grep -v grep', { encoding: 'utf8' });
        if (result.trim()) {
          console.log('🛑 Matando processos ngrok existentes...');
          execSync('pkill -f ngrok', { stdio: 'inherit' });
          console.log('✅ Processos ngrok finalizados');
        }
      } catch (error) {
        console.log('ℹ️ Nenhum processo ngrok encontrado');
      }
    }
  } catch (error) {
    console.log('⚠️ Erro ao verificar processos ngrok:', error.message);
  }
}

// Função para limpar configuração do ngrok
function clearNgrokConfig() {
  try {
    const configPath = path.join(process.env.HOME || process.env.USERPROFILE, '.ngrok2', 'ngrok.yml');
    
    if (fs.existsSync(configPath)) {
      console.log('🧹 Limpando configuração do ngrok...');
      fs.unlinkSync(configPath);
      console.log('✅ Configuração do ngrok limpa');
    } else {
      console.log('ℹ️ Nenhuma configuração do ngrok encontrada');
    }
  } catch (error) {
    console.log('⚠️ Erro ao limpar configuração do ngrok:', error.message);
  }
}

// Função para iniciar ngrok com configuração limpa
function startNgrokSingleTunnel(port = 5173) {
  console.log(`🚀 Iniciando ngrok na porta ${port}...`);
  
  try {
    // Criar configuração temporária para uma única sessão
    const config = {
      version: '2',
      tunnels: {
        web: {
          proto: 'http',
          addr: port,
          bind_tls: true,
          inspect: false
        }
      }
    };
    
    const configPath = path.join(process.cwd(), 'ngrok-temp.yml');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('📝 Configuração temporária criada');
    console.log('🌐 Iniciando ngrok com configuração limpa...');
    
    // Iniciar ngrok com a nova configuração
    const ngrokProcess = execSync(`ngrok start --config=${configPath}`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    return ngrokProcess;
  } catch (error) {
    console.error('❌ Erro ao iniciar ngrok:', error.message);
    return null;
  }
}

// Função principal
function main() {
  console.log('🔧 SOLUÇÃO DEFINITIVA PARA PROBLEMAS NGROK');
  console.log('==========================================\n');
  
  // 1. Verificar instalação
  if (!checkNgrokInstallation()) {
    console.error('❌ Não foi possível instalar o ngrok');
    process.exit(1);
  }
  
  // 2. Matar processos existentes
  killExistingNgrokProcesses();  
  // 3. Limpar configuração
  clearNgrokConfig();
  
  // 4. Iniciar com nova configuração
  console.log('\n🎉 Preparado para iniciar ngrok com sessão única!');
  console.log('\n📋 PRÓXIMOS PASSOS:');
  console.log('1. Execute: start-single-ngrok.bat (Windows)');
  console.log('2. Aguarde a URL do ngrok aparecer');
  console.log('3. Compartilhe a URL com seus usuários de teste');
  console.log('\n⚠️ IMPORTANTE: Mantenha apenas uma instância ngrok ativa por vez!');
  
  console.log('\n🔧 ALTERNATIVA MANUAL (se o script automático falhar):');
  console.log('1. Matar processos: taskkill /f /im ngrok.exe');
  console.log('2. Limpar config: del "%USERPROFILE%\\.ngrok2\\ngrok.yml"');
  console.log('3. Iniciar: ngrok http 5173 --log=stdout');
  
  console.log('\n🌐 Teste de conexão direta:');
  console.log('ngrok http 5173 --log=stdout');
}

if (require.main === module) {
  main();
}

module.exports = {
  checkNgrokInstallation,
  killExistingNgrokProcesses,
  clearNgrokConfig,
  startNgrokSingleTunnel
};