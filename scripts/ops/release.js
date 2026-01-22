#!/usr/bin/env node
/**
 * Script de Release Inteligente
 * Uso: npm run release -- "mensagem do commit"
 * Ou: node scripts/release.js "mensagem do commit"
 */

const { execSync } = require('child_process');
const readline = require('readline');

const args = process.argv.slice(2);

async function getCommitMessage() {
    // Se passou mensagem como argumento, usa ela
    if (args.length > 0 && args[0].trim()) {
        return args.join(' ');
    }

    // Senão, pergunta interativamente
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('📝 Descreva o que foi alterado neste release:\n> ', (answer) => {
            rl.close();
            resolve(answer.trim() || 'chore: update and deploy');
        });
    });
}

async function main() {
    try {
        console.log('\n🚀 Iniciando Release...\n');

        // 1. Pegar mensagem do commit
        const message = await getCommitMessage();
        console.log(`\n📋 Mensagem: "${message}"\n`);

        // 2. Bump de versão
        console.log('📦 Atualizando versões...');
        execSync('npm run bump', { stdio: 'inherit' });

        // 3. Git add, commit e push
        // 3. Git add, commit e push
        console.log('\n📤 Enviando para o repositório (MASTER)...');
        execSync('git add .', { stdio: 'inherit' });
        execSync(`git commit -m "${message}"`, { stdio: 'inherit' });

        console.log('🔄 Sincronizando com o remoto (master)...');
        // Tenta puxar do master para garantir que não há conflitos
        try {
            execSync('git pull origin master --rebase', { stdio: 'inherit' });
        } catch (e) {
            console.log('⚠️ Rebase falhou, tentando pull normal...');
            execSync('git pull origin master', { stdio: 'inherit' });
        }

        // Push explícito para o master
        execSync('git push origin HEAD:master', { stdio: 'inherit' });

        // 4. Build do frontend
        console.log('\n🔨 Buildando frontend...');
        execSync('npm run build', { stdio: 'inherit' });

        // 5. Deploy no Firebase
        console.log('\n🌐 Deployando no Firebase...');
        execSync('firebase deploy --only hosting', { stdio: 'inherit' });

        console.log('\n✅ Release concluído com sucesso!\n');
    } catch (error) {
        console.error('\n❌ Erro no release:', error.message);
        process.exit(1);
    }
}

main();
