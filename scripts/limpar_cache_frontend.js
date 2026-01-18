// SCRIPT PARA LIMPAR TODO O CACHE DO FRONTEND
// Cole isso no Console do navegador (F12 → Console)

console.log('🧹 Limpando TUDO...');

// 1. Limpar localStorage
localStorage.clear();
console.log('✅ localStorage limpo');

// 2. Limpar sessionStorage  
sessionStorage.clear();
console.log('✅ sessionStorage limpo');

// 3. Limpar cookies
document.cookie.split(";").forEach(function (c) {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});
console.log('✅ Cookies limpos');

// 4. Limpar cache do service worker (se tiver)
if ('caches' in window) {
    caches.keys().then(function (names) {
        for (let name of names) caches.delete(name);
    });
    console.log('✅ Service Worker cache limpo');
}

console.log('\n🎉 TUDO LIMPO! Agora:');
console.log('1. Recarregue a página (F5)');
console.log('2. Faça login novamente');
console.log('3. Va no painel admin');
console.log('4. Deve aparecer +R$ 14,00!');
