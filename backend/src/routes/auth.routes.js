const express = require('express');
const router = express.Router();
const { sha256 } = require('../middleware/auth.middleware');

// POST /api/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPassHash = process.env.ADMIN_PASS_HASH || sha256(process.env.ADMIN_PASSWORD || 'Lpreche135#');

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }

    if (username.trim() === adminUser && sha256(password.trim()) === adminPassHash) {
        req.session.user = { username: adminUser };
        return res.json({ success: true, message: 'Login bem-sucedido' });
    }

    return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
});

// GET /api/check-auth
router.get('/check-auth', (req, res) => {
    if (req.session && req.session.user) {
        return res.json({ loggedIn: true, user: req.session.user });
    }
    return res.json({ loggedIn: false });
});

// POST /api/logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao fazer logout' });
        }
        res.clearCookie('connect.sid');
        return res.json({ success: true, message: 'Logout bem-sucedido' });
    });
});

module.exports = router;
