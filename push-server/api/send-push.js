const admin = require('firebase-admin');

function initFirebase() {
  if (admin.apps.length) return;

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawKey) {
    throw new Error('Environment variable FIREBASE_SERVICE_ACCOUNT is missing');
  }

  let serviceAccount;
  try {
    serviceAccount = typeof rawKey === 'string' ? JSON.parse(rawKey) : rawKey;
  } catch (e) {
    serviceAccount = JSON.parse(Buffer.from(rawKey, 'base64').toString('utf8'));
  }

  if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      initFirebase();
      return res.status(200).json({ status: 'ok', message: 'Push server is running' });
    } catch (err) {
      return res.status(500).json({ status: 'error', error: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    initFirebase();
  } catch (err) {
    return res.status(500).json({ error: 'Firebase init error: ' + err.message });
  }

  const { token, callerName, url } = req.body || {};

  if (!token || !callerName) {
    return res.status(400).json({ error: 'Missing token or callerName' });
  }

  // Полноценный WebPush-пейлоад для спящего браузера
  const message = {
    token: token,
    data: {
      title: 'Входящий видеозвонок',
      body: `${callerName} звонит вам!`,
      url: url || '/'
    },
    webpush: {
      headers: {
        Urgency: 'high',
        TTL: '60' // Доставить за 60 секунд
      },
      notification: {
        title: 'Входящий видеозвонок',
        body: `${callerName} звонит вам!`,
        icon: 'https://cdn-icons-png.flaticon.com/512/724/724664.png',
        requireInteraction: true,
        vibrate: [500, 200, 500, 200, 500]
      },
      fcmOptions: {
        link: url || '/'
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    return res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    console.error('FCM send error:', error);
    return res.status(500).json({ error: error.message });
  }
};
