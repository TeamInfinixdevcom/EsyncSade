/*
  Backfill multi-agency fields and normalize user profile docs by UID.

  Usage:
    node backfill_multiagency_data.cjs            # dry-run (no writes)
    node backfill_multiagency_data.cjs --apply    # apply changes

  Optional:
    --unknown-agency=SinAgencia
*/

const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

const SERVICE_ACCOUNT_PATH = path.join(
  __dirname,
  "homewise-77-firebase-adminsdk-fbsvc-afe24f499a.json"
);
const DEFAULT_UNKNOWN_AGENCY = "SinAgencia";
const GENERAL_ADMIN_EMAILS = new Set(["rmadrigalj@ice.go.cr"]);

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const UNKNOWN_AGENCY =
  args.find((arg) => arg.startsWith("--unknown-agency="))?.split("=")[1]?.trim() ||
  DEFAULT_UNKNOWN_AGENCY;

if (getApps().length === 0) {
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();
const auth = getAuth();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function isTrueFlag(value) {
  return value === true || normalizeText(value).toLowerCase() === "true";
}

function getArgRoleValue(value) {
  return normalizeText(value).toLowerCase();
}

function deriveRoleAndFlags(rawProfile, email, agency) {
  const role = getArgRoleValue(rawProfile?.rol || rawProfile?.role);

  const explicitGeneral = isTrueFlag(rawProfile?.adminGeneral) || isTrueFlag(rawProfile?.superAdmin);
  const explicitAgency = isTrueFlag(rawProfile?.adminAgencia);
  const legacyAdmin = isTrueFlag(rawProfile?.admin) || isTrueFlag(rawProfile?.isAdmin);

  if (GENERAL_ADMIN_EMAILS.has(email) || explicitGeneral) {
    return { rol: "admin_general", adminGeneral: true, adminAgencia: false };
  }

  if (["admin_general", "super_admin", "administrador_general"].includes(role)) {
    return { rol: "admin_general", adminGeneral: true, adminAgencia: false };
  }

  if (explicitAgency || ["admin_agencia", "administrador_agencia"].includes(role)) {
    return { rol: "admin_agencia", adminGeneral: false, adminAgencia: true };
  }

  if (legacyAdmin || ["admin", "administrador"].includes(role)) {
    if (agency) {
      return { rol: "admin_agencia", adminGeneral: false, adminAgencia: true };
    }
    return { rol: "admin_general", adminGeneral: true, adminAgencia: false };
  }

  return { rol: "agente", adminGeneral: false, adminAgencia: false };
}

async function listAllAuthUsers() {
  const users = [];
  let pageToken;

  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

function createBatchWriter(firestore, apply) {
  let batch = firestore.batch();
  let opCount = 0;
  let committedBatches = 0;

  async function flush() {
    if (!apply || opCount === 0) {
      batch = firestore.batch();
      opCount = 0;
      return;
    }

    await batch.commit();
    committedBatches += 1;
    batch = firestore.batch();
    opCount = 0;
  }

  async function push(operation) {
    operation(batch);
    opCount += 1;

    if (opCount >= 400) {
      await flush();
    }
  }

  return {
    push,
    flush,
    getCommittedBatches: () => committedBatches,
  };
}

async function main() {
  console.log(`\n[Multiagency Backfill] Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`[Multiagency Backfill] Unknown agency label: ${UNKNOWN_AGENCY}`);

  const writer = createBatchWriter(db, APPLY);
  const now = new Date().toISOString();

  const [usuariosSnap, authUsers] = await Promise.all([
    db.collection("usuarios").get(),
    listAllAuthUsers(),
  ]);

  const usersById = new Map();
  const usersByEmail = new Map();

  usuariosSnap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const row = { id: docSnap.id, ...data };
    usersById.set(docSnap.id, row);

    const email = normalizeEmail(data.email);
    if (email && !usersByEmail.has(email)) {
      usersByEmail.set(email, row);
    }
  });

  const userAgencyByEmail = new Map();

  let userWrites = 0;
  let legacyUserDeletes = 0;

  for (const authUser of authUsers) {
    const uid = authUser.uid;
    const email = normalizeEmail(authUser.email);
    if (!email) continue;

    const existing = usersById.get(uid) || usersByEmail.get(email) || {};

    let agency = normalizeText(existing.agencia || existing.agency);
    const roleInfo = deriveRoleAndFlags(existing, email, agency);

    if (!agency && !roleInfo.adminGeneral) {
      agency = UNKNOWN_AGENCY;
    }

    const normalizedProfile = {
      uid,
      email,
      nombre: normalizeText(existing.nombre || existing.name) || authUser.displayName || "",
      name: normalizeText(existing.name || existing.nombre) || authUser.displayName || "",
      rol: roleInfo.rol,
      adminGeneral: roleInfo.adminGeneral,
      adminAgencia: roleInfo.adminAgencia,
      admin: roleInfo.adminGeneral || roleInfo.adminAgencia,
      agencia: agency,
      activo: existing.activo !== false,
      fechaCreacion: existing.fechaCreacion || existing.fecha || now,
      fechaActualizacion: now,
    };

    if (!normalizedProfile.nombre && normalizedProfile.name) {
      normalizedProfile.nombre = normalizedProfile.name;
    }
    if (!normalizedProfile.name && normalizedProfile.nombre) {
      normalizedProfile.name = normalizedProfile.nombre;
    }

    await writer.push((batch) => {
      batch.set(db.collection("usuarios").doc(uid), normalizedProfile, { merge: true });
    });
    userWrites += 1;

    if (agency) {
      userAgencyByEmail.set(email, agency);
    }

    if (existing.id && existing.id !== uid) {
      // Remove legacy profile doc with non-UID key to avoid duplicate email records.
      await writer.push((batch) => {
        batch.delete(db.collection("usuarios").doc(existing.id));
      });
      legacyUserDeletes += 1;
    }
  }

  // Preserve agency hints from any remaining user docs.
  usuariosSnap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const email = normalizeEmail(data.email);
    const agency = normalizeText(data.agencia || data.agency);
    if (email && agency && !userAgencyByEmail.has(email)) {
      userAgencyByEmail.set(email, agency);
    }
  });

  const lotesSnap = await db.collection("lotes").get();
  const lotAgencyById = new Map();
  let lotesUpdated = 0;

  for (const docSnap of lotesSnap.docs) {
    const data = docSnap.data() || {};
    const currentAgency = normalizeText(data.agencia);
    const inferredAgency =
      currentAgency ||
      userAgencyByEmail.get(normalizeEmail(data.usuario)) ||
      UNKNOWN_AGENCY;

    lotAgencyById.set(docSnap.id, inferredAgency);

    if (!currentAgency) {
      await writer.push((batch) => {
        batch.update(docSnap.ref, {
          agencia: inferredAgency,
          fechaActualizacion: FieldValue.serverTimestamp(),
        });
      });
      lotesUpdated += 1;
    }
  }

  const esimsSnap = await db.collection("esims").get();
  const esimAgencyById = new Map();
  const esimAgencyBySerie = new Map();
  let esimsUpdated = 0;

  for (const docSnap of esimsSnap.docs) {
    const data = docSnap.data() || {};
    const currentAgency = normalizeText(data.agencia);
    const inferredAgency =
      currentAgency ||
      lotAgencyById.get(String(data.loteId || "")) ||
      userAgencyByEmail.get(normalizeEmail(data.usuario)) ||
      UNKNOWN_AGENCY;

    esimAgencyById.set(docSnap.id, inferredAgency);
    if (data.serie) {
      esimAgencyBySerie.set(String(data.serie), inferredAgency);
    }

    if (!currentAgency) {
      await writer.push((batch) => {
        batch.update(docSnap.ref, {
          agencia: inferredAgency,
          fechaActualizacion: FieldValue.serverTimestamp(),
        });
      });
      esimsUpdated += 1;
    }
  }

  const solicitudesSnap = await db.collection("solicitudes").get();
  let solicitudesUpdated = 0;

  for (const docSnap of solicitudesSnap.docs) {
    const data = docSnap.data() || {};
    const currentAgency = normalizeText(data.agencia);
    const inferredAgency =
      currentAgency ||
      userAgencyByEmail.get(normalizeEmail(data.usuario)) ||
      esimAgencyBySerie.get(String(data.serie || "")) ||
      UNKNOWN_AGENCY;

    if (!currentAgency) {
      await writer.push((batch) => {
        batch.update(docSnap.ref, {
          agencia: inferredAgency,
          fechaActualizacion: FieldValue.serverTimestamp(),
        });
      });
      solicitudesUpdated += 1;
    }
  }

  const devolucionesSnap = await db.collection("devoluciones").get();
  let devolucionesUpdated = 0;

  for (const docSnap of devolucionesSnap.docs) {
    const data = docSnap.data() || {};
    const currentAgency = normalizeText(data.agencia);
    const inferredAgency =
      currentAgency ||
      userAgencyByEmail.get(normalizeEmail(data.usuario)) ||
      esimAgencyById.get(String(data.esimId || "")) ||
      esimAgencyBySerie.get(String(data.serie || "")) ||
      UNKNOWN_AGENCY;

    if (!currentAgency) {
      await writer.push((batch) => {
        batch.update(docSnap.ref, {
          agencia: inferredAgency,
          fechaActualizacion: FieldValue.serverTimestamp(),
        });
      });
      devolucionesUpdated += 1;
    }
  }

  await writer.flush();

  console.log("\n[Multiagency Backfill] Summary");
  console.log(`- Auth users processed: ${authUsers.length}`);
  console.log(`- User profiles upserted by UID: ${userWrites}`);
  console.log(`- Legacy user docs removed: ${legacyUserDeletes}`);
  console.log(`- Lotes updated with agency: ${lotesUpdated}`);
  console.log(`- eSIMs updated with agency: ${esimsUpdated}`);
  console.log(`- Solicitudes updated with agency: ${solicitudesUpdated}`);
  console.log(`- Devoluciones updated with agency: ${devolucionesUpdated}`);
  console.log(`- Batch commits executed: ${APPLY ? writer.getCommittedBatches() : 0}`);

  if (!APPLY) {
    console.log("\nDry-run only. Run again with --apply to persist changes.");
  } else {
    console.log("\nChanges applied successfully.");
  }
}

main().catch((error) => {
  console.error("[Multiagency Backfill] Failed:", error);
  process.exit(1);
});
