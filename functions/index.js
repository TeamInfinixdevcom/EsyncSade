
/* eslint-env node */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const ROLE_ADMIN = "admin";
const ROLE_AGENCY_ADMIN = "admin_agencia";
const ROLE_EXECUTIVE = "ejecutivo";

function normalizeRole(value) {
  const rol = String(value || "").trim().toLowerCase();
  if (rol === ROLE_ADMIN) return ROLE_ADMIN;
  if (rol === ROLE_AGENCY_ADMIN || rol === "admin de agencia") return ROLE_AGENCY_ADMIN;
  if (rol === "agente") return ROLE_EXECUTIVE;
  return ROLE_EXECUTIVE;
}

function cleanAgency(value) {
  const agencia = String(value || "").trim();
  return agencia || null;
}

async function getCallerProfile(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesion.");
  }

  const callerUid = context.auth.uid;
  const callerSnap = await db.collection("usuarios").doc(callerUid).get();

  if (!callerSnap.exists || callerSnap.data().activo !== true) {
    throw new functions.https.HttpsError("permission-denied", "Usuario no autorizado.");
  }

  const caller = {
    uid: callerUid,
    ...callerSnap.data(),
    rol: normalizeRole(callerSnap.data().rol),
    agencia: cleanAgency(callerSnap.data().agencia),
  };

  if (caller.rol !== ROLE_ADMIN && caller.rol !== ROLE_AGENCY_ADMIN) {
    throw new functions.https.HttpsError("permission-denied", "No tienes permisos para gestionar usuarios.");
  }

  if (caller.rol === ROLE_AGENCY_ADMIN && !caller.agencia) {
    throw new functions.https.HttpsError("permission-denied", "Tu usuario admin de agencia no tiene agencia asignada.");
  }

  return caller;
}

function assertCallerCanManageTarget(caller, targetUid, targetData) {
  const targetRole = normalizeRole(targetData?.rol);
  const targetAgency = cleanAgency(targetData?.agencia);

  if (targetUid && targetUid === caller.uid) {
    throw new functions.https.HttpsError("permission-denied", "No puedes realizar esta accion sobre tu propio usuario.");
  }

  if (caller.rol === ROLE_ADMIN) {
    return;
  }

  if (targetRole === ROLE_ADMIN) {
    throw new functions.https.HttpsError("permission-denied", "No puedes gestionar admins generales.");
  }

  if (targetAgency !== caller.agencia) {
    throw new functions.https.HttpsError("permission-denied", "Solo puedes gestionar usuarios de tu agencia.");
  }
}

function resolveManagedRoleAndAgency(caller, requestedRole, requestedAgency) {
  if (caller.rol === ROLE_ADMIN) {
    if (requestedRole === ROLE_ADMIN) {
      return { role: ROLE_ADMIN, agency: null };
    }
    return { role: requestedRole, agency: requestedAgency };
  }

  if (requestedRole === ROLE_ADMIN) {
    throw new functions.https.HttpsError("permission-denied", "Un admin de agencia no puede crear ni editar admins generales.");
  }

  if (requestedAgency && requestedAgency !== caller.agencia) {
    throw new functions.https.HttpsError("permission-denied", "Solo puedes gestionar usuarios de tu agencia.");
  }

  return { role: requestedRole, agency: caller.agencia };
}

// Obtener lista de usuarios (Firestore)
exports.listUsers = functions.runWith({}).https.onCall(async (data, context) => {
  const caller = await getCallerProfile(context);

  let usuariosSnap;
  if (caller.rol === ROLE_ADMIN) {
    usuariosSnap = await db.collection("usuarios").get();
  } else {
    usuariosSnap = await db.collection("usuarios").where("agencia", "==", caller.agencia).get();
  }

  const usuarios = usuariosSnap.docs.map((docu) => ({
    uid: docu.id,
    ...docu.data(),
    rol: normalizeRole(docu.data().rol),
    agencia: cleanAgency(docu.data().agencia),
  }));

  return { usuarios };
});

// Eliminar usuario (Firestore y Auth)
exports.deleteUser = functions.runWith({}).https.onCall(async (data, context) => {
  const caller = await getCallerProfile(context);
  const uid = String(data.uid || "").trim();

  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "Falta el UID del usuario a borrar.");
  }

  const targetRef = db.collection("usuarios").doc(uid);
  const targetSnap = await targetRef.get();

  if (targetSnap.exists) {
    assertCallerCanManageTarget(caller, uid, targetSnap.data());
  } else if (caller.rol !== ROLE_ADMIN) {
    throw new functions.https.HttpsError("permission-denied", "No puedes borrar este usuario.");
  }

  // Eliminar de Auth
  try {
    await auth.deleteUser(uid);
  } catch (err) {
    // Si no existe en Auth, continuar
    if (err.code !== "auth/user-not-found") {
      throw new functions.https.HttpsError("internal", "Error al borrar usuario en Auth.");
    }
  }

  // Eliminar de Firestore
  await targetRef.delete();
  return { message: "Usuario eliminado correctamente." };
});

exports.createUser = functions.runWith({}).https.onCall(async (data, context) => {
  const caller = await getCallerProfile(context);

  const nombre = (data.nombre || "").trim();
  const email = (data.email || "").trim().toLowerCase();
  const password = data.password || "";
  const requestedRole = normalizeRole(data.rol);
  const requestedAgency = cleanAgency(data.agencia);
  const managed = resolveManagedRoleAndAgency(caller, requestedRole, requestedAgency);
  const activo = data.activo !== false;

  if (!nombre || !email || !password) {
    throw new functions.https.HttpsError("invalid-argument", "Nombre, email y contrasena son requeridos.");
  }

  if (password.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "La contrasena debe tener al menos 6 caracteres.");
  }

  let userRecord;
  let existsInAuth = true;

  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      existsInAuth = false;
      userRecord = await auth.createUser({
        email,
        password,
        displayName: nombre,
      });
    } else {
      throw new functions.https.HttpsError("internal", "Error al crear usuario.");
    }
  }

  const targetRef = db.collection("usuarios").doc(userRecord.uid);
  const targetSnap = await targetRef.get();

  if (targetSnap.exists) {
    assertCallerCanManageTarget(caller, userRecord.uid, targetSnap.data());
  } else if (existsInAuth && caller.rol !== ROLE_ADMIN) {
    throw new functions.https.HttpsError("permission-denied", "No puedes gestionar un usuario existente sin perfil de agencia.");
  }

  const finalRole = managed.role;
  const finalAgency = finalRole === ROLE_ADMIN ? null : managed.agency;

  try {
    await auth.updateUser(userRecord.uid, { password, displayName: nombre });
  } catch (err) {
    throw new functions.https.HttpsError("internal", "No se pudo actualizar el usuario en Auth.");
  }

  await targetRef.set(
    {
      nombre,
      email,
      rol: finalRole,
      activo,
      agencia: finalAgency,
    },
    { merge: true }
  );

  return { message: "Usuario creado/actualizado correctamente." };
});

exports.updateUser = functions.runWith({}).https.onCall(async (data, context) => {
  const caller = await getCallerProfile(context);

  const uid = String(data.uid || "").trim();
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "Falta el UID del usuario a editar.");
  }

  const targetRef = db.collection("usuarios").doc(uid);
  const targetSnap = await targetRef.get();

  if (!targetSnap.exists) {
    throw new functions.https.HttpsError("not-found", "No se encontro el usuario a editar.");
  }

  const target = targetSnap.data();
  assertCallerCanManageTarget(caller, uid, target);

  const nombre = data.nombre !== undefined ? String(data.nombre || "").trim() : String(target.nombre || "").trim();
  const email = data.email !== undefined ? String(data.email || "").trim().toLowerCase() : String(target.email || "").trim().toLowerCase();
  const activo = typeof data.activo === "boolean" ? data.activo : target.activo === true;

  if (!nombre || !email) {
    throw new functions.https.HttpsError("invalid-argument", "Nombre y email son requeridos.");
  }

  const requestedRole = data.rol !== undefined ? normalizeRole(data.rol) : normalizeRole(target.rol);
  const requestedAgency = data.agencia !== undefined ? cleanAgency(data.agencia) : cleanAgency(target.agencia);
  const managed = resolveManagedRoleAndAgency(caller, requestedRole, requestedAgency);
  const finalAgency = managed.role === ROLE_ADMIN ? null : managed.agency;

  try {
    await auth.updateUser(uid, {
      displayName: nombre,
      email,
    });
  } catch (err) {
    if (err.code !== "auth/user-not-found") {
      throw new functions.https.HttpsError("internal", "No se pudo actualizar el usuario en Auth.");
    }
  }

  await targetRef.set(
    {
      nombre,
      email,
      rol: managed.role,
      activo,
      agencia: finalAgency,
    },
    { merge: true }
  );

  return { message: "Usuario actualizado correctamente." };
});

exports.resetUserPassword = functions.runWith({}).https.onCall(async (data, context) => {
  const caller = await getCallerProfile(context);

  const uid = String(data.uid || "").trim();
  const newPassword = String(data.newPassword || data.password || "").trim();

  if (!uid || !newPassword) {
    throw new functions.https.HttpsError("invalid-argument", "UID y nueva contrasena son requeridos.");
  }

  if (newPassword.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "La contrasena debe tener al menos 6 caracteres.");
  }

  const targetRef = db.collection("usuarios").doc(uid);
  const targetSnap = await targetRef.get();

  if (!targetSnap.exists) {
    throw new functions.https.HttpsError("not-found", "No se encontro el usuario.");
  }

  assertCallerCanManageTarget(caller, uid, targetSnap.data());

  try {
    await auth.updateUser(uid, { password: newPassword });
  } catch (err) {
    throw new functions.https.HttpsError("internal", "No se pudo restablecer la contrasena.");
  }

  return { message: "Contrasena restablecida correctamente." };
});
