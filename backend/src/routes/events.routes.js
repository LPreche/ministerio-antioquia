const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth.middleware');

// GET /api/eventos
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id_evento, evt_titulo, evt_descricao, evt_data_inicial, evt_data_final FROM eventos ORDER BY evt_data_inicial DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar eventos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar eventos' });
    }
});

// GET /api/eventos/:id (Admin)
router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            'SELECT id_evento, evt_titulo, evt_descricao, evt_data_inicial, evt_data_final FROM eventos WHERE id_evento = ?',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Evento não encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar evento por ID:', error);
        res.status(500).json({ error: 'Erro interno ao buscar evento' });
    }
});

// POST /api/eventos (Admin)
router.post('/', isAuthenticated, async (req, res) => {
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

// PUT /api/eventos/:id (Admin)
router.put('/:id', isAuthenticated, async (req, res) => {
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

// DELETE /api/eventos/:id (Admin)
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM eventos WHERE id_evento = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar evento:', error);
        res.status(500).json({ error: 'Erro interno ao deletar evento' });
    }
});

module.exports = router;
