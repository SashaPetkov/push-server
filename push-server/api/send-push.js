const admin = require('firebase-admin');

// Инициализируем Firebase Admin через переменную окружения
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = async (req, res) => {
  // Настройка CORS для запросов с вашего GitHub Pages
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, callerName, url } = req.body;

  if (!token || !callerName) {
    return res.status(400).json({ error: 'Missing token or callerName' });
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
    console.error('Ошибка отправки FCM:', error);
    return res.status(500).json({ error: error.message });
  }
};
