const db = require('../config/db');
const webpush = require('../config/push');

/**
 * Envia notificação push para todos os inscritos salvos no banco
 */
async function sendPushToAll(title, body, url = '/') {
    try {
        const notificationPayload = JSON.stringify({
            title,
            body,
            url
        });

        const [dbSubscriptions] = await db.execute('SELECT endpoint, p256dh, auth FROM push_subscriptions');

        if (!dbSubscriptions || dbSubscriptions.length === 0) {
            console.log('[Push] Nenhuma inscrição encontrada no banco de dados.');
            return { total: 0, successCount: 0 };
        }

        const subscriptionsToSend = dbSubscriptions.map(sub => ({
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        }));

        let successCount = 0;

        const notificationPromises = subscriptionsToSend.map(sub =>
            webpush.sendNotification(sub, notificationPayload)
                .then(() => {
                    successCount++;
                })
                .catch(async (err) => {
                    if (err.statusCode === 410) {
                        console.log(`[Push] Inscrição expirada (${sub.endpoint}). Removendo do banco.`);
                        await db.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
                    } else {
                        console.error(`[Push] Erro ao enviar notificação para ${sub.endpoint}:`, err.statusCode || err.message);
                    }
                })
        );

        await Promise.all(notificationPromises);
        console.log(`[Push] Notificações enviadas: ${successCount}/${subscriptionsToSend.length}`);
        return { total: subscriptionsToSend.length, successCount };
    } catch (error) {
        console.error('[Push] Erro geral ao disparar notificações push:', error);
        throw error;
    }
}

module.exports = {
    sendPushToAll
};
