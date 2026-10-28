const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth.middleware');
const { sendSseUpdate } = require('../services/sse.service');

// GET /api/tito (Public)
router.get('/tito', async (req, res) => {
    try {
        const [activeBoards] = await db.execute(
            'SELECT id_quadro, qdt_data_inicial, qdt_data_final FROM quadro_tito WHERE CURDATE() BETWEEN qdt_data_inicial AND qdt_data_final ORDER BY qdt_data_criacao DESC LIMIT 1'
        );

        if (activeBoards.length === 0) {
            return res.json({ board: null, postIts: [] });
        }

        const activeBoard = activeBoards[0];

        const [postIts] = await db.execute(
            'SELECT id_postit, pst_conteudo FROM post_it WHERE id_quadro = ? ORDER BY id_postit DESC',
            [activeBoard.id_quadro]
        );

        res.json({ board: activeBoard, postIts });
    } catch (error) {
        console.error('Erro ao buscar dados do Quadro Tito:', error);
        res.status(500).json({ error: 'Erro interno ao buscar dados do Quadro Tito' });
    }
});

// POST /api/tito/sugestao (Public)
router.post('/tito/sugestao', async (req, res) => {
    try {
        const { nome_autor, conteudo } = req.body;

        if (!nome_autor || !conteudo) {
            return res.status(400).json({ error: 'Nome e conteúdo são obrigatórios.' });
        }

        const [activeBoards] = await db.execute(
            'SELECT id_quadro FROM quadro_tito WHERE CURDATE() BETWEEN qdt_data_inicial AND qdt_data_final ORDER BY qdt_data_criacao DESC LIMIT 1'
        );

        if (activeBoards.length === 0) {
            return res.status(404).json({ error: 'Nenhum quadro ativo encontrado para receber sugestões.' });
        }
        const activeBoardId = activeBoards[0].id_quadro;

        await db.execute(
            'INSERT INTO postit_sugestoes (id_quadro, sug_nome_autor, sug_conteudo) VALUES (?, ?, ?)',
            [activeBoardId, nome_autor, conteudo]
        );

        // Notifica via SSE
        sendSseUpdate({ type: 'new_suggestion' });

        res.status(201).json({ message: 'Sugestão enviada com sucesso! Ela será analisada por um administrador.' });
    } catch (error) {
        console.error('Erro ao enviar sugestão de post-it:', error);
        res.status(500).json({ error: 'Erro interno ao processar sua sugestão.' });
    }
});

// --- Quadros (Admin) ---

// GET /api/quadros
router.get('/quadros', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_quadro, qdt_data_inicial, qdt_data_final FROM quadro_tito ORDER BY qdt_data_criacao DESC');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar quadros:', error);
        res.status(500).json({ error: 'Erro ao buscar quadros.' });
    }
});

// GET /api/quadros/:id
router.get('/quadros/:id', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_quadro, qdt_data_inicial, qdt_data_final FROM quadro_tito WHERE id_quadro = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Quadro não encontrado.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar quadro:', error);
        res.status(500).json({ error: 'Erro ao buscar quadro.' });
    }
});

// POST /api/quadros
router.post('/quadros', isAuthenticated, async (req, res) => {
    try {
        const { qdt_data_inicial, qdt_data_final } = req.body;

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

// PUT /api/quadros/:id
router.put('/quadros/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { qdt_data_inicial, qdt_data_final } = req.body;

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

// DELETE /api/quadros/:id
router.delete('/quadros/:id', isAuthenticated, async (req, res) => {
    try {
        await db.execute('DELETE FROM post_it WHERE id_quadro = ?', [req.params.id]);
        await db.execute('DELETE FROM quadro_tito WHERE id_quadro = ?', [req.params.id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar quadro:', error);
        res.status(500).json({ error: 'Erro ao deletar quadro.' });
    }
});

// --- Post-its (Admin) ---

// GET /api/postits
router.get('/postits', isAuthenticated, async (req, res) => {
    try {
        const { quadroId } = req.query;
        if (!quadroId) {
            return res.json([]);
        }
        const [rows] = await db.execute('SELECT id_postit, pst_conteudo FROM post_it WHERE id_quadro = ? ORDER BY id_postit DESC', [quadroId]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar post-its:', error);
        res.status(500).json({ error: 'Erro ao buscar post-its.' });
    }
});

// GET /api/postits/:id
router.get('/postits/:id', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_postit, pst_conteudo, id_quadro FROM post_it WHERE id_postit = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Post-it não encontrado.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar post-it:', error);
        res.status(500).json({ error: 'Erro ao buscar post-it.' });
    }
});

// POST /api/postits
router.post('/postits', isAuthenticated, async (req, res) => {
    try {
        const { pst_conteudo, id_quadro } = req.body;
        const [result] = await db.execute('INSERT INTO post_it (pst_conteudo, id_quadro) VALUES (?, ?)', [pst_conteudo, id_quadro]);
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao criar post-it:', error);
        res.status(500).json({ error: 'Erro ao criar post-it.' });
    }
});

// PUT /api/postits/:id
router.put('/postits/:id', isAuthenticated, async (req, res) => {
    try {
        const postItId = req.params.id;
        const { pst_conteudo, id_quadro } = req.body;
        const [postIts] = await db.execute('SELECT id_quadro FROM post_it WHERE id_postit = ?', [postItId]);
        if (postIts.length === 0) {
            return res.status(404).json({ error: 'Post-it não encontrado.' });
        }
        const currentQuadroId = postIts[0].id_quadro;

        const [quadros] = await db.execute('SELECT qdt_data_final FROM quadro_tito WHERE id_quadro = ?', [currentQuadroId]);
        if (quadros.length === 0) {
            return res.status(404).json({ error: 'Quadro associado ao post-it não encontrado.' });
        }
        const quadro = quadros[0];
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(quadro.qdt_data_final);

        if (endDate < today) {
            return res.status(403).json({ error: 'Não é permitido editar post-its de quadros finalizados.' });
        }

        await db.execute('UPDATE post_it SET pst_conteudo = ?, id_quadro = ? WHERE id_postit = ?', [pst_conteudo, id_quadro, postItId]);
        res.json({ message: 'Post-it atualizado.' });
    } catch (error) {
        console.error('Erro ao atualizar post-it:', error);
        res.status(500).json({ error: 'Erro ao atualizar post-it.' });
    }
});

// DELETE /api/postits/:id
router.delete('/postits/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const [postIts] = await db.execute('SELECT id_quadro FROM post_it WHERE id_postit = ?', [id]);
        if (postIts.length === 0) {
            return res.status(204).send();
        }
        const currentQuadroId = postIts[0].id_quadro;

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

        await db.execute('DELETE FROM post_it WHERE id_postit = ?', [id]);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar post-it.' });
    }
});

// --- Sugestões de Post-it (Admin) ---

// GET /api/admin/sugestoes-pendentes
router.get('/admin/sugestoes-pendentes', isAuthenticated, async (req, res) => {
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

// GET /api/admin/sugestoes-historico
router.get('/admin/sugestoes-historico', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id_sugestao, sug_nome_autor, sug_conteudo, sug_data_criacao, sug_status 
             FROM postit_sugestoes
             WHERE sug_status IN ('aprovado', 'recusado')
             ORDER BY sug_data_criacao DESC`
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar histórico de sugestões:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de sugestões.' });
    }
});

// POST /api/admin/sugestoes/:id/aprovar
router.post('/admin/sugestoes/:id/aprovar', isAuthenticated, async (req, res) => {
    const sugestaoId = req.params.id;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [sugestoes] = await connection.execute('SELECT id_quadro, sug_conteudo FROM postit_sugestoes WHERE id_sugestao = ? AND sug_status = "pendente"', [sugestaoId]);
        if (sugestoes.length === 0) {
            throw new Error('Sugestão não encontrada ou já processada.');
        }
        const sugestao = sugestoes[0];

        await connection.execute('INSERT INTO post_it (id_quadro, pst_conteudo) VALUES (?, ?)', [sugestao.id_quadro, sugestao.sug_conteudo]);
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

// POST /api/admin/sugestoes/:id/recusar
router.post('/admin/sugestoes/:id/recusar', isAuthenticated, async (req, res) => {
    try {
        const sugestaoId = req.params.id;
        await db.execute('UPDATE postit_sugestoes SET sug_status = "recusado" WHERE id_sugestao = ?', [sugestaoId]);
        res.json({ message: 'Sugestão recusada com sucesso.' });
    } catch (error) {
        console.error('Erro ao recusar sugestão:', error);
        res.status(500).json({ error: 'Erro interno ao recusar sugestão.' });
    }
});

module.exports = router;
