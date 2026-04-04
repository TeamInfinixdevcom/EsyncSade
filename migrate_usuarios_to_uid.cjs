// Script para migrar documentos de usuarios a /usuarios/{uid}
// Requiere que los usuarios existan en Firebase Auth con el mismo email.
// Opciones:
// - DRY_RUN=true para no escribir cambios
// - DELETE_OLD=true para eliminar documentos antiguos con ID aleatorio

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const serviceAccount = require('./homewise-77-firebase-adminsdk-fbsvc-afe24f499a.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

const DRY_RUN = process.env.DRY_RUN === 'true';
const DELETE_OLD = process.env.DELETE_OLD === 'true';

async function migrateUsuarios() {
  const snapshot = await db.collection('usuarios').get();
  if (snapshot.empty) {
    console.log('No hay documentos en usuarios.');
    return;
  }

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const email = data.email;

    if (!email) {
      console.log(`Documento sin email, se omite: ${docSnap.id}`);
      continue;
    }

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (err) {
      console.log(`No existe usuario Auth para ${email}, se omite.`);
      continue;
    }

    const uid = userRecord.uid;
    const targetRef = db.collection('usuarios').doc(uid);

    if (DRY_RUN) {
      console.log(`[DRY_RUN] Migraria ${email} -> ${uid}`);
      continue;
    }

    await targetRef.set(
      {
        ...data,
        email,
        rol: data.rol || (data.admin === true ? 'admin' : 'ejecutivo'),
        activo: data.activo !== false
      },
      { merge: true }
    );

    if (DELETE_OLD && docSnap.id !== uid) {
      await db.collection('usuarios').doc(docSnap.id).delete();
    }

    console.log(`Migrado ${email} -> ${uid}`);
  }

  console.log('Migracion completada.');
}

migrateUsuarios().catch((err) => {
  console.error('Error en migracion:', err.message);
});
