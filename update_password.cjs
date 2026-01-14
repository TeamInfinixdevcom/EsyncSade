// Script para actualizar la contraseña de un usuario en Firebase Auth
// Ejecuta este script en Node.js con firebase-admin instalado

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./homewise-77-firebase-adminsdk-fbsvc-afe24f499a.json');

initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();

async function updatePassword(email, newPassword) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: newPassword });
    console.log(`Contraseña actualizada para ${email}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

updatePassword('rmadrigalj@ice.go.cr', 'Kolbi200');
