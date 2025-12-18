self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('install', (event) => {
    // Força o SW a esperar a ativação até que o usuário confirme (para não quebrar a página atual)
    // Mas o skipWaiting acima permite pular isso quando solicitado
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Estratégia simples: tenta rede, se falhar, tenta cache
    event.respondWith(fetch(event.request));
});
