// Script para verificar si el usuario existe en Firebase Auth
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./homewise-77-firebase-adminsdk-fbsvc-afe24f499a.json');

initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();

async function checkUser(email) {
  try {
    const user = await auth.getUserByEmail(email);
    console.log(`Usuario encontrado: ${user.email}, UID: ${user.uid}`);
  } catch (err) {
    console.error('No existe el usuario:', email);
  }
}

checkUser('rmadrigalj@ice.go.cr');
