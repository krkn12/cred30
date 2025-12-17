# Script PowerShell para resolver problemas de execução no Windows
Write-Host "🔧 RESOLVENDO PROBLEMAS DE EXECUÇÃO NO WINDOWS" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se estamos no diretório correto
$currentDir = Get-Location
$projectRoot = Split-Path -Parent $currentDir

Write-Host "📁 Diretório atual: $currentDir" -ForegroundColor Yellow
Write-Host "📁 Raiz do projeto: $projectRoot" -ForegroundColor Yellow

# Verificar se o arquivo fix-ngrok-session-limit.js existe
$scriptPath = Join-Path $projectRoot "fix-ngrok-session-limit.js"
if (Test-Path $scriptPath) {
    Write-Host "✅ Script de solução encontrado em: $scriptPath" -ForegroundColor Green
} else {
    Write-Host "❌ Script de solução não encontrado!" -ForegroundColor Red
    Write-Host "Criando script de solução..." -ForegroundColor Yellow
    
    $scriptContent = @"
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
  console.log('2. Limpar config: del \"%USERPROFILE%\\.ngrok2\\ngrok.yml\"');
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
"@
    
    $scriptContent | Out-File -FilePath $scriptPath -Encoding UTF8
    Write-Host "✅ Script criado com sucesso!" -ForegroundColor Green
}

# Executar o script
Write-Host "🚀 Executando script de solução..." -ForegroundColor Yellow
try {
    & node $scriptPath
} catch {
    Write-Host "❌ Erro ao executar o script. Tentando método alternativo..." -ForegroundColor Red
    
    # Método alternativo direto
    Write-Host "🔧 Executando comandos diretamente..." -ForegroundColor Yellow
    
    # Matar processos ngrok
    try {
        $processos = tasklist | findstr ngrok
        if ($processos) {
            Write-Host "🛑 Matando processos ngrok existentes..." -ForegroundColor Yellow
            taskkill /f /im ngrok.exe | Out-Null
            Write-Host "✅ Processos ngrok finalizados" -ForegroundColor Green
        } else {
            Write-Host "ℹ️ Nenhum processo ngrok encontrado" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "ℹ️ Erro ao verificar processos ngrok" -ForegroundColor Yellow
    }
    
    # Limpar configuração ngrok
    $ngrokConfigPath = Join-Path $env:USERPROFILE ".ngrok2\ngrok.yml"
    if (Test-Path $ngrokConfigPath) {
        Write-Host "🧹 Limpando configuração do ngrok..." -ForegroundColor Yellow
        Remove-Item $ngrokConfigPath -Force
        Write-Host "✅ Configuração do ngrok limpa" -ForegroundColor Green
    } else {
        Write-Host "ℹ️ Nenhuma configuração do ngrok encontrada" -ForegroundColor Cyan
    }
    
    Write-Host "`n🎉 Preparado para iniciar ngrok com sessão única!" -ForegroundColor Green
    Write-Host "`n📋 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
    Write-Host "1. Execute: start-single-ngrok.bat" -ForegroundColor White
    Write-Host "2. Aguarde a URL do ngrok aparecer" -ForegroundColor White
    Write-Host "3. Compartilhe a URL com seus usuários de teste" -ForegroundColor White
    Write-Host "`n⚠️ IMPORTANTE: Mantenha apenas uma instância ngrok ativa por vez!" -ForegroundColor Red
}

Write-Host "`n🌐 Para iniciar o ngrok manualmente:" -ForegroundColor Cyan
Write-Host "ngrok http 5173 --log=stdout" -ForegroundColor White
Write-Host ""