const express = require('express');
const router = express.Router();
const { sha256 } = require('../middleware/auth.middleware');

// POST /api/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    let adminUser = (process.env.ADMIN_USER || 'admin').trim();
    // Remove possíveis aspas que tenham sido coladas no painel do Render
    adminUser = adminUser.replace(/^["']|["']$/g, '');

    let rawAdminPass = process.env.ADMIN_PASSWORD || 'Lpreche135#';
    rawAdminPass = rawAdminPass.replace(/^["']|["']$/g, '').trim();

    const adminPassHash = process.env.ADMIN_PASS_HASH || sha256(rawAdminPass);

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }

    const cleanUser = String(username).trim();
    const cleanPass = String(password).trim();

    // Permite login caso o hash bata com a senha limpa, bruta ou variação com/sem '#' (tratamento de comentário de .env)
    const passMatches = 
        (sha256(cleanPass) === adminPassHash) || 
        (cleanPass === rawAdminPass) ||
        (cleanPass === rawAdminPass + '#') ||
        (cleanPass.replace(/#$/, '') === rawAdminPass);

    if (cleanUser.toLowerCase() === adminUser.toLowerCase() && passMatches) {
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
