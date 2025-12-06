// backend/config/firebaseConfig.js  (ajusta la ruta real de tu archivo)

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json'); 
// si firebaseConfig.js está en config/, la ruta es './firebase-service-account.json'
// si está en src/, sería '../config/firebase-service-account.json'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
