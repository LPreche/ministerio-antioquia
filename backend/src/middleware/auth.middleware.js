const crypto = require('crypto');

/**
 * Calcula o hash SHA-256 de uma string
 */
function sha256(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
}

/**
 * Middleware para proteger rotas administrativas
 */
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({ error: 'Não autorizado. Faça login para continuar.' });
}

module.exports = {
    sha256,
    isAuthenticated
};
