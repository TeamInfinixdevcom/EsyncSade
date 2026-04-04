// Script para forzar la asociación de TODAS las eSIMs existentes a un nuevo lote
// Ejecuta: node forzar_asociar_esims_a_lote.cjs

const admin = require("firebase-admin");
const serviceAccount = require("./homewise-77-firebase-adminsdk-fbsvc-afe24f499a.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function main() {
  // Buscar todas las eSIMs
  const esimsSnap = await db.collection("esims").get();
  if (esimsSnap.empty) {
    console.log("No hay eSIMs en el sistema");
    process.exit(0);
  }
  const series = [];
  esimsSnap.forEach(doc => series.push(doc.id));
  // Crear lote
  const loteRef = await db.collection("lotes").add({
    fecha: new Date().toISOString(),
    cantidad: series.length,
    usuario: "forzado-manual",
    series
  });
  // Asociar cada eSIM al nuevo lote
  const batch = db.batch();
  esimsSnap.forEach(docu => {
    batch.update(docu.ref, { loteId: loteRef.id });
  });
  await batch.commit();
  console.log(`Lote creado (${loteRef.id}) y ${series.length} eSIMs asociadas.`);
  process.exit(0);
}

main();
