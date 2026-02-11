// c:\github\ministerio-antioquia\sw.js

const CACHE_NAME = 'movimento-antioquia-cache-v2'; // Versão do cache incrementada
// Lista de arquivos essenciais para o funcionamento offline do app
const urlsToCache = [
  '/',
  '/index.html',
  '/missionarios.html',
  '/noticias.html',
  '/relogio.html',
  '/quadro-tito.html',
  '/eventos.html',
  '/contato.html',
  '/admin.html',
  '/style.css',
  '/script.js',
  '/admin.js',
  '/imagens/logo.jpg',
  '/imagens/hero-background.png',
  '/imagens/icons/icon-192x192.png',
  '/imagens/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital@0;1&family=Roboto:wght@300;400;700&family=Kalam:wght@400;700&display=swap'
];

// Evento de instalação: abre o cache e adiciona os arquivos da lista
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto e arquivos sendo cacheados.');
        return cache.addAll(urlsToCache);
      })
  );
});

// Estratégia "Network falling back to cache"
// Tenta buscar o recurso na rede primeiro. Se falhar (offline), serve do cache.
// Isso garante que os usuários online sempre vejam o conteúdo mais recente.
self.addEventListener('fetch', event => {
  // Ignora requisições que não são GET e requisições para a API que não devem ser cacheadas.
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request).then(networkResponse => {
      // Se a requisição à rede for bem-sucedida, clona a resposta.
      // Uma resposta só pode ser consumida uma vez, então precisamos cloná-la
      // para enviá-la tanto ao navegador quanto ao cache.
      const responseToCache = networkResponse.clone();

      caches.open(CACHE_NAME).then(cache => {
        cache.put(event.request, responseToCache); // Atualiza o cache com a nova versão
      });

      return networkResponse; // Retorna a resposta da rede para o navegador
    }).catch(() => {
      // Se a requisição à rede falhar, tenta encontrar no cache.
      return caches.match(event.request);
    })
  );
});

// Evento de ativação: limpa caches antigos para manter o app atualizado
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(caches.keys().then(cacheNames => Promise.all(cacheNames.map(cacheName => {
    if (cacheWhitelist.indexOf(cacheName) === -1) return caches.delete(cacheName);
  }))));
});

// --- PUSH NOTIFICATION LISTENERS ---

// Evento 'push': é acionado quando o servidor envia uma notificação.
self.addEventListener('push', event => {
  let pushData = { title: 'Movimento Antioquia', body: 'Você tem uma nova mensagem.', url: '/' };
  
  try {
    if (event.data) {
      pushData = event.data.json();
    }
  } catch (e) {
    console.error('Erro ao ler dados da notificação push:', e);
  }

  const options = {
    body: pushData.body,
    icon: 'imagens/icons/icon-192x192.png', // Ícone padrão para a notificação
    badge: 'imagens/icons/icon-192x192.png', // Ícone para a barra de status do Android
    data: {
      url: pushData.url || '/' // URL para abrir ao clicar
    }
  };

  // Exibe a notificação
  event.waitUntil(
    self.registration.showNotification(pushData.title, options)
  );
});

// Evento 'notificationclick': é acionado quando o usuário clica na notificação.
self.addEventListener('notificationclick', event => {
  // Fecha a notificação
  event.notification.close();

  // Abre a URL associada à notificação ou a página principal
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Se uma janela do site já estiver aberta, foca nela
      const matchingClient = windowClients.find(client => client.url.endsWith(urlToOpen));
      if (matchingClient) return matchingClient.focus();
      // Se não, abre uma nova janela
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});