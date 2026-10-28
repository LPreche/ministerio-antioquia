const webpush = require('web-push');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("⚠️ VAPID keys não estão configuradas no .env. Notificações push não serão enviadas até serem configuradas.");
} else {
    webpush.setVapidDetails(
        'mailto:ministeriomissoes.ibicco@hotmail.com',
        vapidPublicKey,
        vapidPrivateKey
    );
}

module.exports = webpush;
