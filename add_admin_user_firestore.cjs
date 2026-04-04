// Script para agregar un usuario a la colección 'usuarios' en Firestore con rol de admin
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./homewise-77-firebase-adminsdk-fbsvc-afe24f499a.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

async function agregarUsuario() {
  const usuario = {
    nombre: 'Ruben Madrigal',
    email: 'rmadrigalj@ice.go.cr',
    rol: 'admin',
    activo: true
  };
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(usuario.email);
    await auth.updateUser(userRecord.uid, { password: 'Kolbi200', displayName: usuario.nombre });
    console.log('Usuario ya existía, contraseña y nombre actualizados.');
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({
        email: usuario.email,
        password: 'Kolbi200',
        displayName: usuario.nombre
      });
      console.log('Usuario creado en Auth.');
    } else {
      console.error('Error al crear usuario:', err);
      process.exit(1);
    }
  }
  await db.collection('usuarios').doc(userRecord.uid).set(usuario, { merge: true });
  console.log('Usuario admin creado/actualizado en Firestore:', usuario.email);
  process.exit(0);
}

agregarUsuario().catch(console.error);
