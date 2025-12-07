// config/firebaseConfig.js
// Config de Firebase Admin, tolerante a falta de credenciales en producción.

const admin = require('firebase-admin');

let app = null;

try {
  let serviceAccount = null;

  // Opción 1: credenciales en variable de entorno (string JSON)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log('🔥 Usando FIREBASE_SERVICE_ACCOUNT_JSON desde variables de entorno');
  }

  if (serviceAccount) {
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin inicializado correctamente');
  } else {
    console.warn(
      '⚠️ No se encontraron credenciales de Firebase. ' +
      'firebaseConfig.js NO inicializará Firebase Admin, ' +
      'pero el servidor seguirá funcionando.'
    );
  }
} catch (err) {
  console.error('❌ Error inicializando Firebase Admin:', err.message);
  // No lanzamos el error para que el server no se caiga
}

module.exports = { admin, app };
