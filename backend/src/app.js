const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const app = express();

// --- MIDDLEWARES GERAIS ---
app.use(express.json());

// --- CONFIGURAÇÃO DE SESSÃO ---
if (!process.env.SESSION_SECRET) {
    console.warn("⚠️ SESSION_SECRET não configurada no .env. Recomenda-se definir para maior segurança.");
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'antioquia_default_secret_session_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// --- SERVINDO ARQUIVOS ESTÁTICOS DO FRONTEND ---
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Rotas de compatibilidade (para garantir que requisições legadas ou do service worker não quebrem)
app.use('/style.css', express.static(path.join(frontendPath, 'css/style.css')));
app.use('/script.js', express.static(path.join(frontendPath, 'js/script.js')));
app.use('/admin.js', express.static(path.join(frontendPath, 'js/admin.js')));

// --- ROTAS DA API ---
const authRoutes = require('./routes/auth.routes');
const pushRoutes = require('./routes/push.routes');
const newsRoutes = require('./routes/news.routes');
const missionariesRoutes = require('./routes/missionaries.routes');
const configRoutes = require('./routes/config.routes');
const eventsRoutes = require('./routes/events.routes');
const prayerClockRoutes = require('./routes/prayerClock.routes');
const titoRoutes = require('./routes/tito.routes');
const sseRoutes = require('./routes/sse.routes');

app.use('/api', authRoutes);
app.use('/api', pushRoutes);
app.use('/api/noticias', newsRoutes);
app.use('/api/missionaries', missionariesRoutes);
app.use('/api/configuracoes', configRoutes);
app.use('/api/eventos', eventsRoutes);
app.use('/api', prayerClockRoutes);
app.use('/api', titoRoutes);
app.use('/api', sseRoutes);

module.exports = app;
