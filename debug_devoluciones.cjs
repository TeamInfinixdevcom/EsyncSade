/**
 * Debug: Verificar estado de devoluciones y eSIMs
 */
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "homewise-77",
});

const db = admin.firestore();

async function debugDevoluciones() {
  console.log("🔍 Verificando devoluciones recientes...\n");

  try {
    // Devoluciones recientes de PAVAS
    const devSnapshots = await db
      .collection("devoluciones")
      .where("agencia", "==", "PAVAS")
      .limit(10)
      .get();

    console.log(`📋 Últimas 10 devoluciones de PAVAS:\n`);
    const seriesDevueltas = [];
    
    devSnapshots.forEach((doc) => {
      const data = doc.data();
      console.log(`  Serie: ${data.serie}`);
      console.log(`  Usuario: ${data.usuario}`);
      console.log(`  Fecha: ${data.fecha}`);
      console.log(`  ---`);
      seriesDevueltas.push(data.serie);
    });

    console.log(`\n🔎 Verificando estado actual de esas 4 series en colección esims...\n`);

    // Verificar estado actual de esas series
    for (const serie of seriesDevueltas.slice(0, 4)) {
      const esimSnap = await db
        .collection("esims")
        .where("serie", "==", serie)
        .get();

      if (esimSnap.empty) {
        console.log(`❌ ${serie} - NO ENCONTRADA EN ESIMS`);
      } else {
        const esimData = esimSnap.docs[0].data();
        console.log(`✅ ${serie}`);
        console.log(`   Estado: ${esimData.estado}`);
        console.log(`   Agencia: ${esimData.agencia || "SIN AGENCIA"}`);
        console.log(`   Pedido: ${esimData.pedido || "null"}`);
      }
    }

    // Totales de disponibles en PAVAS
    console.log(`\n📊 Conteo PAVAS:\n`);
    const disposSnap = await db
      .collection("esims")
      .where("estado", "==", "disponible")
      .where("agencia", "==", "PAVAS")
      .get();

    const usadaSnap = await db
      .collection("esims")
      .where("estado", "==", "usada")
      .where("agencia", "==", "PAVAS")
      .get();

    console.log(`  Disponibles: ${disposSnap.size}`);
    console.log(`  Usadas: ${usadaSnap.size}`);
    console.log(`  Total: ${disposSnap.size + usadaSnap.size}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }

  process.exit(0);
}

debugDevoluciones();
