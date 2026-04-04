
// Script para inicializar la colección de usuarios en Firestore (CommonJS)
// Ejecuta este script en un entorno Node.js con las credenciales de Firebase Admin

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./homewise-77-firebase-adminsdk-fbsvc-afe24f499a.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

async function crearUsuariosIniciales() {
  const usuarios = [
    {
      nombre: 'Ruben Madrigal',
      email: 'rmadrigalj@ice.go.cr',
      rol: 'admin',
      activo: true
    },
    {
      nombre: 'Daniel Astorga Cerdas',
      email: 'daniel.astorga@ice.go.cr',
      rol: 'ejecutivo',
      activo: true
    },
    {
      nombre: 'Natalia Calderón Chavarría',
      email: 'natalia.calderon@ice.go.cr',
      rol: 'ejecutivo',
      activo: true
    }
  ];

  for (const usuario of usuarios) {
    const userRecord = await auth.getUserByEmail(usuario.email);
    await db.collection('usuarios').doc(userRecord.uid).set(usuario, { merge: true });
    console.log(`Usuario agregado/actualizado: ${usuario.email}`);
  }
  console.log('Colección de usuarios inicializada.');
}

crearUsuariosIniciales().catch(console.error);
