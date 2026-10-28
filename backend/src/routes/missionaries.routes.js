const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth.middleware');

// GET /api/missionaries
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute(
            "SELECT id_missionario, CONCAT(mis_primeiro_nome, ' ', mis_sobrenome) AS nome, mis_cidade, mis_pais, mis_imagem_url, mis_descricao, mis_historia FROM missionarios ORDER BY mis_primeiro_nome, mis_sobrenome"
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar missionários:', error);
        res.status(500).json({ error: 'Erro interno ao buscar missionários' });
    }
});

// GET /api/missionaries/:id
router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            'SELECT id_missionario, mis_primeiro_nome, mis_sobrenome, mis_data_nascimento, mis_cidade, mis_pais, mis_imagem_url, mis_descricao, mis_historia FROM missionarios WHERE id_missionario = ?',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Missionário não encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar missionário por ID:', error);
        res.status(500).json({ error: 'Erro interno ao buscar missionário' });
    }
});

// POST /api/missionaries (Admin)
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia } = req.body;
        const [result] = await db.execute(
            'INSERT INTO missionarios (mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao adicionar missionário:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar missionário' });
    }
});

// PUT /api/missionaries/:id (Admin)
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia } = req.body;
        await db.execute(
            'UPDATE missionarios SET mis_primeiro_nome = ?, mis_sobrenome = ?, mis_cidade = ?, mis_pais = ?, mis_imagem_url = ?, mis_data_nascimento = ?, mis_descricao = ?, mis_historia = ? WHERE id_missionario = ?',
            [mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia, id]
        );
        res.json({ message: 'Missionário atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar missionário:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar missionário' });
    }
});

// DELETE /api/missionaries/:id (Admin)
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM missionarios WHERE id_missionario = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar missionário:', error);
        res.status(500).json({ error: 'Erro interno ao deletar missionário' });
    }
});

module.exports = router;
