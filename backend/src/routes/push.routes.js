const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth.middleware');
const { sendPushToAll } = require('../services/push.service');

// GET /api/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
    res.send(process.env.VAPID_PUBLIC_KEY || '');
});

// POST /api/subscribe
router.post('/subscribe', async (req, res) => {
    const subscription = req.body;
    try {
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ error: 'Dados de inscrição inválidos.' });
        }
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

// POST /api/send-notification (Manual via Admin)
router.post('/send-notification', isAuthenticated, async (req, res) => {
    try {
        const { title, body, url } = req.body;
        if (!title || !body) {
            return res.status(400).json({ error: 'Título e corpo da mensagem são obrigatórios.' });
        }
        const { total, successCount } = await sendPushToAll(title, body, url || '/');
        if (total === 0) {
            return res.status(200).json({ message: 'Notificação processada, mas não havia usuários inscritos para receber.' });
        }
        res.status(200).json({ message: `Notificações enviadas com sucesso para ${successCount} de ${total} inscritos.` });
    } catch (error) {
        console.error('Erro ao enviar notificação manual:', error);
        res.status(500).json({ error: 'Erro ao enviar notificação.' });
    }
});

module.exports = router;
