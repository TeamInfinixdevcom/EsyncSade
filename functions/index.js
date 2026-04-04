
/* eslint-env node */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// Obtener lista de usuarios (Firestore)
exports.listUsers = functions.runWith({}).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesion.");
  }
  const callerUid = context.auth.uid;
  const callerRef = db.collection("usuarios").doc(callerUid);
  const callerSnap = await callerRef.get();
  if (!callerSnap.exists || callerSnap.data().activo !== true) {
    throw new functions.https.HttpsError("permission-denied", "Usuario no autorizado.");
  }
  if (callerSnap.data().rol !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Solo admins pueden ver usuarios.");
  }
  const usuariosSnap = await db.collection("usuarios").get();
  const usuarios = usuariosSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  return { usuarios };
});

// Eliminar usuario (Firestore y Auth)
exports.deleteUser = functions.runWith({}).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesion.");
  }
  const callerUid = context.auth.uid;
  const callerRef = db.collection("usuarios").doc(callerUid);
  const callerSnap = await callerRef.get();
  if (!callerSnap.exists || callerSnap.data().activo !== true) {
    throw new functions.https.HttpsError("permission-denied", "Usuario no autorizado.");
  }
  if (callerSnap.data().rol !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Solo admins pueden borrar usuarios.");
  }
  const uid = data.uid;
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "Falta el UID del usuario a borrar.");
  }
  // Eliminar de Auth
  try {
    await auth.deleteUser(uid);
  } catch (err) {
    // Si no existe en Auth, continuar
    if (err.code !== 'auth/user-not-found') {
      throw new functions.https.HttpsError("internal", "Error al borrar usuario en Auth.");
    }
  }
  // Eliminar de Firestore
  await db.collection("usuarios").doc(uid).delete();
  return { message: "Usuario eliminado correctamente." };
});

exports.createUser = functions.runWith({}).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesion.");
  }

  const callerUid = context.auth.uid;
  const callerRef = db.collection("usuarios").doc(callerUid);
  const callerSnap = await callerRef.get();

  if (!callerSnap.exists || callerSnap.data().activo !== true) {
    throw new functions.https.HttpsError("permission-denied", "Usuario no autorizado.");
  }

  if (callerSnap.data().rol !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Solo admins pueden crear usuarios.");
  }

  const nombre = (data.nombre || "").trim();
  const email = (data.email || "").trim().toLowerCase();
  const password = data.password || "";
  const rol = data.rol === "admin" ? "admin" : "ejecutivo";
  const activo = data.activo === false ? false : true;

  if (!nombre || !email || !password) {
    throw new functions.https.HttpsError("invalid-argument", "Nombre, email y contrasena son requeridos.");
  }

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { password, displayName: nombre });
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: nombre
      });
    } else {
      throw new functions.https.HttpsError("internal", "Error al crear usuario.");
    }
  }

  await db.collection("usuarios").doc(userRecord.uid).set(
    {
      nombre,
      email,
      rol,
      activo
    },
    { merge: true }
  );

  return { message: "Usuario creado/actualizado correctamente." };
});
