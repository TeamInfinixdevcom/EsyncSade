const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const [emailArg, agencyArg] = process.argv.slice(2);

if (!emailArg || !agencyArg) {
  console.error("Usage: node delete_usims_by_user.cjs <email> <agencia>");
  process.exit(1);
}

const email = String(emailArg).trim().toLowerCase();
const agencia = String(agencyArg).trim();

const serviceAccountPath = path.join(
  __dirname,
  "homewise-77-firebase-adminsdk-fbsvc-afe24f499a.json"
);

if (!getApps().length) {
  // eslint-disable-next-line global-require
  const serviceAccount = require(serviceAccountPath);
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function fetchUsimDocs() {
  const asignadasSnap = await db
    .collection("usims")
    .where("agencia", "==", agencia)
    .where("asignadoAEmail", "==", email)
    .get();

  const usadasSnap = await db
    .collection("usims")
    .where("agencia", "==", agencia)
    .where("usuarioUsoEmail", "==", email)
    .get();

  const docsById = new Map();
  asignadasSnap.docs.forEach((doc) => docsById.set(doc.id, doc));
  usadasSnap.docs.forEach((doc) => docsById.set(doc.id, doc));

  return Array.from(docsById.values());
}

async function deleteDocs(docs) {
  let totalDeleted = 0;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = db.batch();
    const slice = docs.slice(i, i + 450);
    slice.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += slice.length;
  }
  return totalDeleted;
}

async function main() {
  const docs = await fetchUsimDocs();
  if (docs.length === 0) {
    console.log("No se encontraron uSIMs para borrar.");
    return;
  }

  const totalDeleted = await deleteDocs(docs);
  console.log(`Se borraron ${totalDeleted} uSIM(s) de ${email} en ${agencia}.`);
}

main().catch((err) => {
  console.error("Error borrando uSIMs:", err);
  process.exit(1);
});
