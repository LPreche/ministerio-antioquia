const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth.middleware');

// GET /api/configuracoes (Public)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute(
            "SELECT cfg_pix_ativo, cfg_manutencao_noticias, cfg_manutencao_relogio, cfg_manutencao_quadrotito FROM configuracoes WHERE id = 1"
        );
        if (rows.length === 0) {
            return res.json({
                cfg_pix_ativo: true,
                cfg_manutencao_noticias: false,
                cfg_manutencao_relogio: false,
                cfg_manutencao_quadrotito: false
            });
        }
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

// PUT /api/configuracoes (Admin)
router.put('/', isAuthenticated, async (req, res) => {
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

module.exports = router;
