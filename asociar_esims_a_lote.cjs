// Script para crear un lote y asociar todas las eSIMs huérfanas (sin loteId) a ese lote
// Ejecuta: node asociar_esims_a_lote.cjs

const admin = require("firebase-admin");
const serviceAccount = require("./homewise-77-firebase-adminsdk-fbsvc-afe24f499a.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function main() {
  // Buscar todas las eSIMs que no tienen loteId
  const esimsSnap = await db.collection("esims").where("loteId", "==", null).get();
  if (esimsSnap.empty) {
    console.log("No hay eSIMs huérfanas (sin loteId)");
    process.exit(0);
  }
  const series = [];
  esimsSnap.forEach(doc => series.push(doc.id));
  // Crear lote
  const loteRef = await db.collection("lotes").add({
    fecha: new Date().toISOString(),
    cantidad: series.length,
    usuario: "asociacion-manual",
    series
  });
  // Asociar cada eSIM al lote
  const batch = db.batch();
  esimsSnap.forEach(docu => {
    batch.update(docu.ref, { loteId: loteRef.id });
  });
  await batch.commit();
  console.log(`Lote creado (${loteRef.id}) y ${series.length} eSIMs asociadas.`);
  process.exit(0);
}

main();
