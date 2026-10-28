const webpush = require('web-push');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BHJcIayU4Z3KkCTFSGmumY9YDiYm9t7K9JNUvafCC5gZfT0-D33XLpeyqJtBzizjINW6ZGpnb5pVGN0p6tjFWvQ';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'FwUlJIhLx6QwiKx5p_PuiY277ZI4toY8JeGooA8CZgo';

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
