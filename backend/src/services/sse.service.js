// Gerenciamento de Atualizações em Tempo Real (Server-Sent Events - SSE)
let sseClients = [];

/**
 * Adiciona um cliente à lista de conexões ativas
 */
function addClient(client) {
    sseClients.push(client);
    console.log(`[SSE] Novo cliente conectado. Total: ${sseClients.length}`);
}

/**
 * Remove um cliente desconectado
 */
function removeClient(clientId) {
    sseClients = sseClients.filter(c => c.id !== clientId);
    console.log(`[SSE] Cliente desconectado. Total restante: ${sseClients.length}`);
}

/**
 * Envia um evento em formato JSON para todos os clientes conectados
 */
function sendSseUpdate(data) {
    console.log(`[SSE] Enviando atualização para ${sseClients.length} cliente(s):`, data.type || 'evento');
    sseClients.forEach(client => {
        try {
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (err) {
            console.error('[SSE] Erro ao enviar para cliente:', err.message);
        }
    });
}

module.exports = {
    addClient,
    removeClient,
    sendSseUpdate
};
