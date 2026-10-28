const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth.middleware');
const { addClient, removeClient } = require('../services/sse.service');

// GET /api/admin/sugestoes-stream
router.get('/admin/sugestoes-stream', isAuthenticated, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    addClient(newClient);

    res.write('data: {"type": "connected"}\n\n');

    req.on('close', () => {
        removeClient(clientId);
    });
});

module.exports = router;
