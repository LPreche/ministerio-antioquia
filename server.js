// c:\github\ministerio-antioquia\server.js
const express = require('express');
const db = require('./connection');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');
const webpush = require('web-push');
const app = express();
const port = 3000;

// --- CONFIGURAÇÃO DE ATUALIZAÇÕES EM TEMPO REAL (SSE) ---
let sseClients = []; // Armazena os clientes (admins) conectados para receber atualizações

// Função para enviar um evento para todos os clientes conectados
function sendSseUpdate(data) {
    console.log(`Enviando atualização SSE para ${sseClients.length} clientes.`);
    sseClients.forEach(client => {
        client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
}

require('dotenv').config(); // Carrega variáveis do .env

// --- CONFIGURAÇÃO DE NOTIFICAÇÕES PUSH ---
// Em um ambiente de produção, estas chaves DEVEM estar em variáveis de ambiente (arquivo .env)
// Para gerar novas chaves, rode no terminal do seu projeto: npx web-push generate-vapid-keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("VAPID keys não estão configuradas. Gere novas chaves e configure-as nas variáveis de ambiente (arquivo .env).");
} else {
    webpush.setVapidDetails(
        'mailto:ministeriomissoes.ibicco@hotmail.com', // E-mail para contato
        vapidPublicKey,
        vapidPrivateKey
    );
}


// Middleware para logar todas as requisições recebidas
// app.use((req, res, next) => {
//     console.log(`[${new Date().toISOString()}] Requisição recebida: ${req.method} ${req.url}`);
//     next();
// });

// Serve os arquivos estáticos (HTML, CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, '.')));
app.use(express.json());

// --- CONFIGURAÇÃO DE SESSÃO ---
// Em produção, use uma variável de ambiente para o 'secret' e configure 'cookie.secure: true' se estiver usando HTTPS.
if (!process.env.SESSION_SECRET) {
    console.error("SESSION_SECRET não está configurada no arquivo .env. Gere uma chave segura e adicione-a.");
    // Em um app de produção, seria ideal parar a execução aqui: process.exit(1);
}
app.use(session({
    secret: process.env.SESSION_SECRET, // Chave secreta forte vinda do arquivo .env
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true, // Impede acesso via JS no cliente
        // secure: true, // Descomente em produção com HTTPS
        maxAge: 24 * 60 * 60 * 1000 // Expira em 24 horas
    }
}));

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.status(401).json({ error: 'Não autorizado. Faça login para continuar.' });
}

// --- ENDPOINTS DE AUTENTICAÇÃO ---

// Helper para hash de senha
function sha256(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
}

// POST /api/login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Em uma aplicação real, estes dados viriam de um banco de dados.
    const CORRECT_USER = 'admin';
    const CORRECT_PASS_HASH = 'c74659bfb5a1e9ffc11e2b895efbcf625b8eb6a5fc8fff9c1751ecc10fccccd0'; // sha256('Lpreche135#')

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }

    if (username.trim() === CORRECT_USER && sha256(password.trim()) === CORRECT_PASS_HASH) {
        req.session.user = { username: CORRECT_USER }; // Cria a sessão
        res.json({ success: true, message: 'Login bem-sucedido' });
    } else {
        res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
    }
});

// GET /api/check-auth - Verifica se o usuário já está logado
app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Não foi possível fazer logout.' });
        }
        res.clearCookie('connect.sid'); // Opcional: Limpa o cookie da sessão do cliente
        res.status(200).json({ message: 'Logout bem-sucedido' });
    });
});

// Endpoint para fornecer a chave pública VAPID para o cliente
app.get('/api/vapid-public-key', (req, res) => {
    res.send(vapidPublicKey);
});

// Endpoint para registrar uma nova inscrição para notificações
app.post('/api/subscribe', async (req, res) => { // Tornando async
    const subscription = req.body;
    try {
        // Salva a inscrição no banco de dados
        // Usamos INSERT IGNORE para evitar erros se a inscrição (endpoint) já existir,
        // o que é esperado se o usuário recarregar a página.
        await db.execute(
            'INSERT IGNORE INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)',
            [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
        );
        res.status(201).json({ message: 'Inscrição recebida com sucesso.' });
    } catch (error) {
        console.error('Erro ao salvar inscrição no banco de dados:', error);
        res.status(500).json({ error: 'Erro ao registrar inscrição.' });
    }
});

// Endpoint para ENVIAR uma notificação push manualmente (Admin)
app.post('/api/send-notification', isAuthenticated, async (req, res) => {
    try {
        const { title, body, url } = req.body;

        if (!title || !body) {
            return res.status(400).json({ error: 'Título e corpo da mensagem são obrigatórios.' });
        }

        const notificationPayload = JSON.stringify({
            title: title,
            body: body,
            url: url || '/' // URL para abrir ao clicar, default para a home
        });

        // 1. Busca todas as inscrições do banco de dados
        const [dbSubscriptions] = await db.execute('SELECT endpoint, p256dh, auth FROM push_subscriptions');
        
        if (dbSubscriptions.length === 0) {
            return res.status(200).json({ message: 'Notificação processada, mas não haviam usuários inscritos para receber.' });
        }

        // 2. Formata as inscrições para o formato que a lib web-push espera
        const subscriptionsToSend = dbSubscriptions.map(sub => ({
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        }));

        let successCount = 0;

        // 3. Envia a notificação para todas as inscrições salvas
        const notificationPromises = subscriptionsToSend.map(sub => 
            webpush.sendNotification(sub, notificationPayload)
                .then(() => {
                    successCount++;
                })
                .catch(async (err) => {
                    if (err.statusCode === 410) {
                        console.log(`Inscrição ${sub.endpoint} expirou. Removendo do banco.`);
                        await db.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
                    } else {
                        console.error(`Erro ao enviar notificação para ${sub.endpoint}:`, err.statusCode, err.body);
                    }
                })
        );
        
        await Promise.all(notificationPromises);

        res.status(200).json({ message: `Notificações enviadas com sucesso para ${successCount} de ${subscriptionsToSend.length} inscritos.` });
    } catch (error) {
        console.error('Erro ao enviar notificação manual:', error);
        res.status(500).json({ error: 'Erro interno ao enviar notificações.' });
    }
});
// Endpoint para buscar as notícias do banco de dados
app.get('/api/noticias', async (req, res) => {
    try {
        // Adicionado id_noticia para ser usado no admin
        const [rows] = await db.execute('SELECT id_noticia, ntc_titulo, ntc_data_publicacao, ntc_corpo_mensagem, ntc_imagem_fundo FROM noticias ORDER BY ntc_data_publicacao DESC');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar notícias:', error);
        res.status(500).json({ error: 'Erro interno ao buscar notícias' });
    }
});

// Endpoint para buscar UMA notícia pelo ID (para edição)
app.get('/api/noticias/:id', async (req, res) => { // Tornando público para o modal de notícias
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id_noticia, ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao FROM noticias WHERE id_noticia = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Notícia não encontrada' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar notícia por ID:', error);
        res.status(500).json({ error: 'Erro interno ao buscar notícia' });
    }
});

// Endpoint para ADICIONAR uma nova notícia
app.post('/api/noticias', isAuthenticated, async (req, res) => {
    try { // ntc_data_publicacao
        const { ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao } = req.body;
        const [result] = await db.execute(
            'INSERT INTO noticias (ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao) VALUES (?, ?, ?, ?)',
            [ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao]
        );

        // --- Enviar Notificação Push ---
        const notificationPayload = JSON.stringify({
            title: 'Nova Notícia no Movimento Antioquia!',
            body: ntc_titulo,
            url: '/noticias.html' // URL para abrir ao clicar na notificação
        });

        // 1. Busca todas as inscrições do banco de dados
        const [dbSubscriptions] = await db.execute('SELECT endpoint, p256dh, auth FROM push_subscriptions');
        
        // 2. Formata as inscrições para o formato que a lib web-push espera
        const subscriptionsToSend = dbSubscriptions.map(sub => ({
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        }));

        // 3. Envia a notificação para todas as inscrições salvas
        const notificationPromises = subscriptionsToSend.map(sub => 
            webpush.sendNotification(sub, notificationPayload)
                .catch(async (err) => { // Tornando async para poder usar await
                    // Se a inscrição expirou ou é inválida (erro 410 Gone), removemos ela do banco
                    if (err.statusCode === 410) {
                        console.log(`Inscrição ${sub.endpoint} expirou. Removendo do banco.`);
                        await db.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
                    } else {
                        console.error(`Erro ao enviar notificação para ${sub.endpoint}:`, err.statusCode, err.body);
                    }
                })
        );
        await Promise.all(notificationPromises);

        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao adicionar notícia:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar notícia' });
    }
});

// Endpoint para ATUALIZAR uma notícia
app.put('/api/noticias/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao } = req.body;
        await db.execute(
            'UPDATE noticias SET ntc_titulo = ?, ntc_corpo_mensagem = ?, ntc_imagem_fundo = ?, ntc_data_publicacao = ? WHERE id_noticia = ?',
            [ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao, id]
        );
        res.json({ message: 'Notícia atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar notícia:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar notícia' });
    }
});

// Endpoint para DELETAR uma notícia
app.delete('/api/noticias/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM noticias WHERE id_noticia = ?', [id]);
        res.status(204).send(); // No content
    } catch (error) {
        console.error('Erro ao deletar notícia:', error);
        res.status(500).json({ error: 'Erro interno ao deletar notícia' });
    }
});

// --- CRUD para Missionários ---

// GET todos
app.get('/api/missionaries', async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT id_missionario, CONCAT(mis_primeiro_nome, ' ', mis_sobrenome) AS nome, mis_cidade, mis_pais, mis_imagem_url, mis_descricao, mis_historia FROM missionarios ORDER BY mis_primeiro_nome, mis_sobrenome"); // mis_descricao, mis_historia
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar missionários:', error);
        res.status(500).json({ error: 'Erro interno ao buscar missionários' });
    }
});

// GET um por ID
app.get('/api/missionaries/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id_missionario, mis_primeiro_nome, mis_sobrenome, mis_data_nascimento, mis_cidade, mis_pais, mis_imagem_url, mis_descricao, mis_historia FROM missionarios WHERE id_missionario = ?', [id]); // mis_descricao, mis_historia
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Missionário não encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar missionário por ID:', error);
        res.status(500).json({ error: 'Erro interno ao buscar missionário' });
    }
});

// POST (criar)
app.post('/api/missionaries', isAuthenticated, async (req, res) => {
    try {
        const { mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia } = req.body; // mis_descricao, mis_historia
        const [result] = await db.execute(
            'INSERT INTO missionarios (mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', // mis_descricao, mis_historia
            [mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia] // mis_descricao, mis_historia
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao adicionar missionário:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar missionário' });
    }
});

// PUT (atualizar)
app.put('/api/missionaries/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia } = req.body; // mis_descricao, mis_historia
        await db.execute(
            'UPDATE missionarios SET mis_primeiro_nome = ?, mis_sobrenome = ?, mis_cidade = ?, mis_pais = ?, mis_imagem_url = ?, mis_data_nascimento = ?, mis_descricao = ?, mis_historia = ? WHERE id_missionario = ?', // mis_descricao, mis_historia
            [mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia, id] // mis_descricao, mis_historia
        );
        res.json({ message: 'Missionário atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar missionário:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar missionário' });
    }
});

// DELETE
app.delete('/api/missionaries/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM missionarios WHERE id_missionario = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar missionário:', error);
        res.status(500).json({ error: 'Erro interno ao deletar missionário' });
    }
});

// --- CRUD para Configurações Gerais ---

// GET (Public): Retorna as configurações
app.get('/api/configuracoes', async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT cfg_pix_ativo, cfg_manutencao_noticias, cfg_manutencao_relogio, cfg_manutencao_quadrotito FROM configuracoes WHERE id = 1");
        if (rows.length === 0) {
            // Se por algum motivo a linha não existir, retorna um estado padrão seguro
            return res.json({
                cfg_pix_ativo: true,
                cfg_manutencao_noticias: false,
                cfg_manutencao_relogio: false,
                cfg_manutencao_quadrotito: false
            });
        }
        // Converte TINYINT(1) do banco (0 ou 1) para booleano para o frontend
        const settings = {
            cfg_pix_ativo: !!rows[0].cfg_pix_ativo,
            cfg_manutencao_noticias: !!rows[0].cfg_manutencao_noticias,
            cfg_manutencao_relogio: !!rows[0].cfg_manutencao_relogio,
            cfg_manutencao_quadrotito: !!rows[0].cfg_manutencao_quadrotito,
        };
        res.json(settings);
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({ error: 'Erro interno ao buscar configurações' });
    }
});

// PUT (Admin): Atualiza as configurações
app.put('/api/configuracoes', isAuthenticated, async (req, res) => {
    try {
        const { cfg_pix_ativo, cfg_manutencao_noticias, cfg_manutencao_relogio, cfg_manutencao_quadrotito } = req.body;

        await db.execute(
            'UPDATE configuracoes SET cfg_pix_ativo = ?, cfg_manutencao_noticias = ?, cfg_manutencao_relogio = ?, cfg_manutencao_quadrotito = ? WHERE id = 1',
            [
                cfg_pix_ativo,
                cfg_manutencao_noticias,
                cfg_manutencao_relogio,
                cfg_manutencao_quadrotito
            ]
        );
        res.json({ message: 'Configurações atualizadas com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar configurações' });
    }
});

// --- CRUD para Eventos ---

// GET (Public): Retorna todos os eventos
app.get('/api/eventos', async (req, res) => {
    try {
        // Admin precisa de todos os eventos, a página pública irá filtrar. Ordenado pela data de início mais recente.
        const [rows] = await db.execute("SELECT id_evento, evt_titulo, evt_descricao, evt_data_inicial, evt_data_final FROM eventos ORDER BY evt_data_inicial DESC");
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar eventos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar eventos' });
    }
});

// GET um por ID (para edição)
app.get('/api/eventos/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id_evento, evt_titulo, evt_descricao, evt_data_inicial, evt_data_final FROM eventos WHERE id_evento = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Evento não encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar evento por ID:', error);
        res.status(500).json({ error: 'Erro interno ao buscar evento' });
    }
});

// POST (criar)
app.post('/api/eventos', isAuthenticated, async (req, res) => {
    try {
        const { evt_titulo, evt_descricao, evt_data_inicial, evt_data_final } = req.body;
        const [result] = await db.execute(
            'INSERT INTO eventos (evt_titulo, evt_descricao, evt_data_inicial, evt_data_final) VALUES (?, ?, ?, ?)',
            [evt_titulo, evt_descricao, evt_data_inicial, evt_data_final]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao adicionar evento:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar evento' });
    }
});

// PUT (atualizar)
app.put('/api/eventos/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { evt_titulo, evt_descricao, evt_data_inicial, evt_data_final } = req.body;
        await db.execute(
            'UPDATE eventos SET evt_titulo = ?, evt_descricao = ?, evt_data_inicial = ?, evt_data_final = ? WHERE id_evento = ?',
            [evt_titulo, evt_descricao, evt_data_inicial, evt_data_final, id]
        );
        res.json({ message: 'Evento atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar evento:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar evento' });
    }
});

// DELETE
app.delete('/api/eventos/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM eventos WHERE id_evento = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar evento:', error);
        res.status(500).json({ error: 'Erro interno ao deletar evento' });
    }
});

// --- CRUD para Voluntários do Relógio de Oração ---

// GET todos os voluntários de um relógio específico (via query param)
app.get('/api/voluntarios', isAuthenticated, async (req, res) => { // Tornando autenticado
    try {
        const { relogioId } = req.query;

        if (!relogioId) {
            return res.json([]);
        }

        const [rows] = await db.execute('SELECT id_voluntario, vol_nome_completo, vol_horario_escolhido FROM voluntarios WHERE id_relogio = ? ORDER BY vol_horario_escolhido', [relogioId]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar voluntários:', error);
        res.status(500).json({ error: 'Erro interno ao buscar voluntários' });
    }
});

// GET um por ID
app.get('/api/voluntarios/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id_voluntario, id_relogio, vol_nome_completo, vol_horario_escolhido FROM voluntarios WHERE id_voluntario = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Voluntário não encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar voluntário por ID:', error);
        res.status(500).json({ error: 'Erro interno ao buscar voluntário' });
    }
});

// POST (criar)
app.post('/api/voluntarios', isAuthenticated, async (req, res) => {
    try {
        const { vol_nome_completo, vol_horario_escolhido, id_relogio } = req.body; // Adicionado id_relogio
        
        if (!id_relogio) {
            return res.status(400).json({ error: 'É necessário especificar o relógio de oração para associar o voluntário.' });
        }
        const horario = `${String(vol_horario_escolhido).padStart(2, '0')}:00:00`;

        const [result] = await db.execute(
            'INSERT INTO voluntarios (id_relogio, vol_nome_completo, vol_horario_escolhido) VALUES (?, ?, ?)',
            [id_relogio, vol_nome_completo, horario]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao adicionar voluntário:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar voluntário' });
    }
});

// PUT (atualizar)
app.put('/api/voluntarios/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { vol_nome_completo, vol_horario_escolhido } = req.body;
        const horario = `${String(vol_horario_escolhido).padStart(2, '0')}:00:00`;
        await db.execute(
            'UPDATE voluntarios SET vol_nome_completo = ?, vol_horario_escolhido = ? WHERE id_voluntario = ?',
            [vol_nome_completo, horario, id]
        );
        res.json({ message: 'Voluntário atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar voluntário:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar voluntário' });
    }
});

// DELETE
app.delete('/api/voluntarios/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM voluntarios WHERE id_voluntario = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar voluntário:', error);
        res.status(500).json({ error: 'Erro interno ao deletar voluntário' });
    }
});


// --- CRUD para Quadro Tito ---

// GET (Public): Retorna todos os post-its do quadro ativo no momento
app.get('/api/tito', async (req, res) => {
    try {
        // 1. Encontrar o quadro ativo
        const [activeBoards] = await db.execute(
            'SELECT id_quadro, qdt_data_inicial, qdt_data_final FROM quadro_tito WHERE CURDATE() BETWEEN qdt_data_inicial AND qdt_data_final ORDER BY qdt_data_criacao DESC LIMIT 1'
        );

        if (activeBoards.length === 0) {
            return res.json({ board: null, postIts: [] }); // No active board
        }

        const activeBoard = activeBoards[0];

        // 2. Buscar os post-its para esse quadro
        const [postIts] = await db.execute(
            'SELECT id_postit, pst_conteudo FROM post_it WHERE id_quadro = ? ORDER BY id_postit DESC',
            [activeBoard.id_quadro]
        );

        res.json({ board: activeBoard, postIts: postIts });

    } catch (error) {
        console.error('Erro ao buscar dados do Quadro Tito:', error);
        res.status(500).json({ error: 'Erro interno ao buscar dados do Quadro Tito' });
    }
});

// Endpoint de SSE (Server-Sent Events) para atualizações em tempo real no painel de admin
app.get('/api/admin/sugestoes-stream', isAuthenticated, (req, res) => {
    // Configura os headers para a conexão SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res: res };
    sseClients.push(newClient);
    console.log(`Admin client ${clientId} conectado para receber atualizações.`);

    // Envia uma mensagem de conexão inicial
    res.write('data: {"type": "connected"}\n\n');

    // Remove o cliente da lista quando a conexão for fechada
    req.on('close', () => {
        sseClients = sseClients.filter(client => client.id !== clientId);
        console.log(`Admin client ${clientId} desconectado.`);
    });
});

// POST (Public): Adiciona uma nova sugestão de post-it para aprovação
app.post('/api/tito/sugestao', async (req, res) => {
    try {
        const { nome_autor, conteudo } = req.body;

        if (!nome_autor || !conteudo) {
            return res.status(400).json({ error: 'Nome e conteúdo são obrigatórios.' });
        }

        // 1. Encontrar o quadro ativo
        const [activeBoards] = await db.execute(
            'SELECT id_quadro FROM quadro_tito WHERE CURDATE() BETWEEN qdt_data_inicial AND qdt_data_final ORDER BY qdt_data_criacao DESC LIMIT 1'
        );

        if (activeBoards.length === 0) {
            return res.status(404).json({ error: 'Nenhum quadro ativo encontrado para receber sugestões.' });
        }
        const activeBoardId = activeBoards[0].id_quadro;

        // 2. Inserir a sugestão na nova tabela
        await db.execute(
            'INSERT INTO postit_sugestoes (id_quadro, sug_nome_autor, sug_conteudo) VALUES (?, ?, ?)',
            [activeBoardId, nome_autor, conteudo]
        );

        // Notifica os painéis de administração abertos sobre a nova sugestão
        sendSseUpdate({ type: 'new_suggestion' });

        res.status(201).json({ message: 'Sugestão enviada com sucesso! Ela será analisada por um administrador.' });

    } catch (error) {
        console.error('Erro ao enviar sugestão de post-it:', error);
        res.status(500).json({ error: 'Erro interno ao processar sua sugestão.' });
    }
});

// --- ROTAS DE ADMIN (todas protegidas a partir daqui) ---
// app.use('/api/admin', isAuthenticated); // Removido para aplicar autenticação individualmente

// --- Endpoints de Admin para Relógios de Oração ---
app.get('/api/relogios', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_relogio, rel_titulo, rel_data_relogio FROM relogio_oracao ORDER BY rel_data_relogio DESC');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar relógios:', error);
        res.status(500).json({ error: 'Erro ao buscar relógios.' });
    }
});

app.get('/api/relogios/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id_relogio, rel_titulo, rel_data_relogio FROM relogio_oracao WHERE id_relogio = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Relógio não encontrado.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar relógio por ID:', error);
        res.status(500).json({ error: 'Erro ao buscar relógio.' });
    }
});

app.post('/api/relogios', isAuthenticated, async (req, res) => {
    try {
        const { rel_titulo, rel_data_relogio } = req.body;
        const [result] = await db.execute(
            'INSERT INTO relogio_oracao (rel_titulo, rel_data_relogio) VALUES (?, ?)',
            [rel_titulo, rel_data_relogio]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao criar relógio:', error);
        res.status(500).json({ error: 'Erro ao criar relógio.' });
    }
});

app.put('/api/relogios/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { rel_titulo, rel_data_relogio } = req.body;
        await db.execute(
            'UPDATE relogio_oracao SET rel_titulo = ?, rel_data_relogio = ? WHERE id_relogio = ?',
            [rel_titulo, rel_data_relogio, id]
        );
        res.json({ message: 'Relógio atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar relógio:', error);
        res.status(500).json({ error: 'Erro ao atualizar relógio.' });
    }
});

app.delete('/api/relogios/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM voluntarios WHERE id_relogio = ?', [id]);
        await db.execute('DELETE FROM motivos_oracao WHERE id_relogio = ?', [id]);
        await db.execute('DELETE FROM relogio_oracao WHERE id_relogio = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar relógio:', error);
        res.status(500).json({ error: 'Erro ao deletar relógio.' });
    }
});
// --- Endpoints de Admin para Quadros ---

app.get('/api/quadros', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_quadro, qdt_data_inicial, qdt_data_final FROM quadro_tito ORDER BY qdt_data_criacao DESC');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar quadros:', error);
        res.status(500).json({ error: 'Erro ao buscar quadros.' });
    }
});

app.get('/api/quadros/:id', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_quadro, qdt_data_inicial, qdt_data_final FROM quadro_tito WHERE id_quadro = ?', [req.params.id]);
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar quadro:', error);
        res.status(500).json({ error: 'Erro ao buscar quadro.' });
    }
});

app.post('/api/quadros', isAuthenticated, async (req, res) => {
    try {
        const { qdt_data_inicial, qdt_data_final } = req.body;

        // Validação de sobreposição de datas
        const [overlapping] = await db.execute(
            `SELECT id_quadro FROM quadro_tito WHERE 
            (? BETWEEN qdt_data_inicial AND qdt_data_final) OR 
            (? BETWEEN qdt_data_inicial AND qdt_data_final) OR 
            (qdt_data_inicial BETWEEN ? AND ?)`,
            [qdt_data_inicial, qdt_data_final, qdt_data_inicial, qdt_data_final]
        );

        if (overlapping.length > 0) {
            return res.status(400).json({ error: 'O período selecionado se sobrepõe a um quadro existente.' });
        }

        const [result] = await db.execute(
            'INSERT INTO quadro_tito (qdt_data_inicial, qdt_data_final, qdt_data_criacao) VALUES (?, ?, NOW())',
            [qdt_data_inicial, qdt_data_final]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao criar quadro:', error);
        res.status(500).json({ error: 'Erro ao criar quadro.' });
    }
});

app.put('/api/quadros/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { qdt_data_inicial, qdt_data_final } = req.body;

        // Validação de sobreposição de datas, excluindo o quadro atual
        const [overlapping] = await db.execute(
            `SELECT id_quadro FROM quadro_tito WHERE 
            id_quadro != ? AND (
                (? BETWEEN qdt_data_inicial AND qdt_data_final) OR 
                (? BETWEEN qdt_data_inicial AND qdt_data_final) OR 
                (qdt_data_inicial BETWEEN ? AND ?)
            )`,
            [id, qdt_data_inicial, qdt_data_final, qdt_data_inicial, qdt_data_final]
        );

        if (overlapping.length > 0) {
            return res.status(400).json({ error: 'O período selecionado se sobrepõe a um quadro existente.' });
        }

        await db.execute(
            'UPDATE quadro_tito SET qdt_data_inicial = ?, qdt_data_final = ? WHERE id_quadro = ?',
            [qdt_data_inicial, qdt_data_final, id]
        );
        res.json({ message: 'Quadro atualizado.' });
    } catch (error) {
        console.error('Erro ao atualizar quadro:', error);
        res.status(500).json({ error: 'Erro ao atualizar quadro.' });
    }
});

app.delete('/api/quadros/:id', isAuthenticated, async (req, res) => {
    try {
        // Opcional: verificar se existem post-its antes de deletar
        await db.execute('DELETE FROM post_it WHERE id_quadro = ?', [req.params.id]); // Deleta os post-its associados
        await db.execute('DELETE FROM quadro_tito WHERE id_quadro = ?', [req.params.id]); // Deleta o quadro
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar quadro:', error);
        res.status(500).json({ error: 'Erro ao deletar quadro.' });
    }
});

// --- Endpoints de Admin para Post-its ---
app.get('/api/postits', isAuthenticated, async (req, res) => {
    try {
        const { quadroId } = req.query;
        if (!quadroId) {
            return res.json([]); // Return empty if no quadro is selected
        }
        const [rows] = await db.execute('SELECT id_postit, pst_conteudo FROM post_it WHERE id_quadro = ? ORDER BY id_postit DESC', [quadroId]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar post-its:', error);
        res.status(500).json({ error: 'Erro ao buscar post-its.' });
    }
});

app.get('/api/postits/:id', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_postit, pst_conteudo, id_quadro FROM post_it WHERE id_postit = ?', [req.params.id]);
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar post-it:', error);
        res.status(500).json({ error: 'Erro ao buscar post-it.' });
    }
});

app.post('/api/postits', isAuthenticated, async (req, res) => {
    try {
        const { pst_conteudo, id_quadro } = req.body;
        const [result] = await db.execute('INSERT INTO post_it (pst_conteudo, id_quadro) VALUES (?, ?)', [pst_conteudo, id_quadro]);
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao criar post-it:', error);
        res.status(500).json({ error: 'Erro ao criar post-it.' });
    }
});

app.put('/api/postits/:id', isAuthenticated, async (req, res) => {
    try {
        const postItId = req.params.id;
        const { pst_conteudo, id_quadro } = req.body;
        const [postIts] = await db.execute('SELECT id_quadro FROM post_it WHERE id_postit = ?', [postItId]);
        if (postIts.length === 0) {
            return res.status(404).json({ error: 'Post-it não encontrado.' });
        }
        const currentQuadroId = postIts[0].id_quadro;

        // 2. Check if the current board is still editable (not finished)
        const [quadros] = await db.execute('SELECT qdt_data_final FROM quadro_tito WHERE id_quadro = ?', [currentQuadroId]);
        if (quadros.length === 0) {
            // Should not happen in a consistent DB
            return res.status(404).json({ error: 'Quadro associado ao post-it não encontrado.' });
        }
        const quadro = quadros[0];
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(quadro.qdt_data_final);

        if (endDate < today) {
            return res.status(403).json({ error: 'Não é permitido editar post-its de quadros finalizados.' });
        }

        // 3. If checks pass, perform the update
        await db.execute('UPDATE post_it SET pst_conteudo = ?, id_quadro = ? WHERE id_postit = ?', [pst_conteudo, id_quadro, postItId]);
        res.json({ message: 'Post-it atualizado.' });
    } catch (error) {
        console.error('Erro ao atualizar post-it:', error);
        res.status(500).json({ error: 'Erro ao atualizar post-it.' });
    }
});

app.delete('/api/postits/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Find the post-it and its board to check permissions
        const [postIts] = await db.execute('SELECT id_quadro FROM post_it WHERE id_postit = ?', [id]);
        if (postIts.length === 0) {
            // Item doesn't exist, so it's idempotent. Return success.
            return res.status(204).send();
        }
        const currentQuadroId = postIts[0].id_quadro;

        // 2. Check if the board is still editable (not finished)
        const [quadros] = await db.execute('SELECT qdt_data_final FROM quadro_tito WHERE id_quadro = ?', [currentQuadroId]);
        if (quadros.length === 0) {
            return res.status(404).json({ error: 'Quadro associado ao post-it não encontrado.' });
        }
        const quadro = quadros[0];
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(quadro.qdt_data_final);

        if (endDate < today) {
            return res.status(403).json({ error: 'Não é permitido excluir post-its de quadros finalizados.' });
        }

        // 3. If checks pass, perform the deletion
        await db.execute('DELETE FROM post_it WHERE id_postit = ?', [id]);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar post-it.' });
    }
});

// --- Endpoints de Admin para Sugestões de Post-it ---

// GET (Admin): Retorna todas as sugestões pendentes
app.get('/api/admin/sugestoes-pendentes', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT s.id_sugestao, s.sug_nome_autor, s.sug_conteudo, s.sug_data_criacao, q.qdt_data_inicial, q.qdt_data_final 
             FROM postit_sugestoes s
             JOIN quadro_tito q ON s.id_quadro = q.id_quadro
             WHERE s.sug_status = 'pendente' 
             ORDER BY s.sug_data_criacao ASC`
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar sugestões pendentes:', error);
        res.status(500).json({ error: 'Erro ao buscar sugestões.' });
    }
});

// POST (Admin): Aprova uma sugestão
app.post('/api/admin/sugestoes/:id/aprovar', isAuthenticated, async (req, res) => {
    const sugestaoId = req.params.id;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Buscar a sugestão
        const [sugestoes] = await connection.execute('SELECT id_quadro, sug_conteudo FROM postit_sugestoes WHERE id_sugestao = ? AND sug_status = "pendente"', [sugestaoId]);
        if (sugestoes.length === 0) {
            throw new Error('Sugestão não encontrada ou já processada.');
        }
        const sugestao = sugestoes[0];

        // 2. Inserir o novo post-it
        await connection.execute('INSERT INTO post_it (id_quadro, pst_conteudo) VALUES (?, ?)', [sugestao.id_quadro, sugestao.sug_conteudo]);

        // 3. Atualizar o status da sugestão
        await connection.execute('UPDATE postit_sugestoes SET sug_status = "aprovado" WHERE id_sugestao = ?', [sugestaoId]);

        await connection.commit();
        res.json({ message: 'Sugestão aprovada e post-it criado com sucesso.' });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao aprovar sugestão:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao aprovar sugestão.' });
    } finally {
        connection.release();
    }
});

// POST (Admin): Recusa uma sugestão
app.post('/api/admin/sugestoes/:id/recusar', isAuthenticated, async (req, res) => {
    try {
        const sugestaoId = req.params.id;
        await db.execute('UPDATE postit_sugestoes SET sug_status = "recusado" WHERE id_sugestao = ?', [sugestaoId]);
        res.json({ message: 'Sugestão recusada com sucesso.' });
    } catch (error) {
        console.error('Erro ao recusar sugestão:', error);
        res.status(500).json({ error: 'Erro interno ao recusar sugestão.' });
    }
});

// --- Endpoints de Admin para Motivos de Oração ---
app.get('/api/motivos-oracao', isAuthenticated, async (req, res) => {
    try {
        const { relogioId } = req.query;
        if (!relogioId) {
            return res.json([]);
        }
        const [rows] = await db.execute('SELECT id_motivo, mot_descricao FROM motivos_oracao WHERE id_relogio = ? ORDER BY id_motivo', [relogioId]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar motivos de oração:', error);
        res.status(500).json({ error: 'Erro ao buscar motivos de oração.' });
    }
});

app.get('/api/motivos-oracao/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id_motivo, mot_descricao, id_relogio FROM motivos_oracao WHERE id_motivo = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Motivo de oração não encontrado.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar motivo de oração por ID:', error);
        res.status(500).json({ error: 'Erro ao buscar motivo de oração.' });
    }
});

app.post('/api/motivos-oracao', isAuthenticated, async (req, res) => {
    try {
        const { mot_descricao, id_relogio } = req.body;
        if (!id_relogio || !mot_descricao) {
            return res.status(400).json({ error: 'Descrição e ID do relógio são obrigatórios.' });
        }
        const [result] = await db.execute(
            'INSERT INTO motivos_oracao (mot_descricao, id_relogio) VALUES (?, ?)',
            [mot_descricao, id_relogio]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao criar motivo de oração:', error);
        res.status(500).json({ error: 'Erro ao criar motivo de oração.' });
    }
});

app.put('/api/motivos-oracao/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { mot_descricao } = req.body;
        await db.execute('UPDATE motivos_oracao SET mot_descricao = ? WHERE id_motivo = ?', [mot_descricao, id]);
        res.json({ message: 'Motivo de oração atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar motivo de oração:', error);
        res.status(500).json({ error: 'Erro ao atualizar motivo de oração.' });
    }
});

app.delete('/api/motivos-oracao/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM motivos_oracao WHERE id_motivo = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar motivo de oração:', error);
        res.status(500).json({ error: 'Erro ao deletar motivo de oração.' });
    }
});
// Endpoint para buscar dados do Relógio de Oração
app.get('/api/relogio', async (req, res) => {
    try {
        // 1. Busca o relógio mais recente (ou de hoje)
        const [relogios] = await db.execute('SELECT id_relogio, rel_data_relogio FROM relogio_oracao ORDER BY rel_data_relogio DESC LIMIT 1');
        
        if (relogios.length === 0) {
            return res.status(404).json({ message: 'Nenhum relógio de oração encontrado.' });
        }
        
        const relogio = relogios[0];
        
        // Verificação de segurança para evitar o erro "Bind parameters must not contain undefined"
        // Ajustado para usar 'id_relogio' conforme sua estrutura de banco
        if (!relogio || relogio.id_relogio === undefined) {
            console.error('Erro: Relógio encontrado mas sem id_relogio definido.', relogio);
            return res.status(500).json({ error: 'Inconsistência nos dados do relógio.' });
        }

        // 2. Busca voluntários vinculados a este relógio
        const [voluntarios] = await db.execute('SELECT vol_nome_completo, vol_horario_escolhido FROM voluntarios WHERE id_relogio = ?', [relogio.id_relogio]);

        // 3. Busca motivos de oração vinculados a este relógio
        const [motivos] = await db.execute('SELECT mot_descricao FROM motivos_oracao WHERE id_relogio = ?', [relogio.id_relogio]);

        res.json({ relogio, voluntarios, motivos });
    } catch (error) {
        console.error('Erro ao buscar relógio:', error);
        res.status(500).json({ error: 'Erro interno ao buscar dados do relógio' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
