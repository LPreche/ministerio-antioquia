const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth.middleware');
const { sendPushToAll } = require('../services/push.service');

// GET /api/noticias
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id_noticia, ntc_titulo, ntc_data_publicacao, ntc_corpo_mensagem, ntc_imagem_fundo FROM noticias ORDER BY ntc_data_publicacao DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar notícias:', error);
        res.status(500).json({ error: 'Erro interno ao buscar notícias' });
    }
});

// GET /api/noticias/:id
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            'SELECT id_noticia, ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao FROM noticias WHERE id_noticia = ?',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Notícia não encontrada' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar notícia por ID:', error);
        res.status(500).json({ error: 'Erro interno ao buscar notícia' });
    }
});

// POST /api/noticias (Admin)
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao } = req.body;
        const [result] = await db.execute(
            'INSERT INTO noticias (ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao) VALUES (?, ?, ?, ?)',
            [ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao || new Date()]
        );

        // Dispara notificação push em segundo plano sem travar a resposta
        sendPushToAll('Nova Notícia no Movimento Antioquia!', ntc_titulo, '/noticias.html')
            .catch(err => console.error('[Push] Erro ao notificar nova notícia:', err.message));

        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao adicionar notícia:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar notícia' });
    }
});

// PUT /api/noticias/:id (Admin)
router.put('/:id', isAuthenticated, async (req, res) => {
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

// DELETE /api/noticias/:id (Admin)
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM noticias WHERE id_noticia = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar notícia:', error);
        res.status(500).json({ error: 'Erro interno ao deletar notícia' });
    }
});

module.exports = router;
