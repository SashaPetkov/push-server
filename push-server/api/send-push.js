const admin = require('firebase-admin');

// Безопасная инициализация Firebase Admin
function initFirebase() {
  if (admin.apps.length) return;

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawKey) {
    throw new Error('Environment variable FIREBASE_SERVICE_ACCOUNT is missing');
  }

  let serviceAccount;
  try {
    // Если ключ передан как строка JSON
    serviceAccount = typeof rawKey === 'string' ? JSON.parse(rawKey) : rawKey;
  } catch (e) {
    // Если внутри строки есть неэкранированные переносы
    try {
      serviceAccount = JSON.parse(Buffer.from(rawKey, 'base64').toString('utf8'));
    } catch (err) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ' + e.message);
    }
  }

  // Защита от поврежденных приватных ключей (\n)
  if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = async (req, res) => {
  // CORS-заголовки
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

  // При GET-запросе в браузере показываем статус готовности
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
    console.error('Firebase init error:', err);
    return res.status(500).json({ error: 'Firebase configuration error: ' + err.message });
  }

  const { token, callerName, url } = req.body || {};

  if (!token || !callerName) {
    return res.status(400).json({ error: 'Missing token or callerName in request body' });
  }

  const message = {
    token: token,
    notification: {
      title: 'Входящий видеозвонок',
      body: `${callerName} звонит вам!`
    },
    webpush: {
      headers: {
        Urgency: 'high'
      },
      notification: {
        requireInteraction: true,
        icon: 'https://cdn-icons-png.flaticon.com/512/724/724664.png'
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
