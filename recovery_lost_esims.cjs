/**
 * Script para recuperar eSIMs que se devolvieron pero perdieron agencia
 * Relaciona devoluciones con eSIMs sin agencia y las corrige
 */

const admin = require("firebase-admin");
const serviceAccount = require("./firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "homewise-77",
});

const db = admin.firestore();

async function recoverLostEsims() {
  console.log("🔍 Buscando eSIMs perdidas (disponibles sin agencia)...\n");

  try {
    // Buscar eSIMs sin agencia
    const esimsSinAgencia = await db
      .collection("esims")
      .where("estado", "==", "disponible")
      .get();

    const esomsToFix = esimsSinAgencia.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(
        (esim) =>
          !esim.agencia || esim.agencia.trim() === ""
      );

    console.log(`Found ${esomsToFix.length} lost eSIMs.\n`);

    if (esomsToFix.length === 0) {
      console.log("✅ No eSIMs sin agencia encontradas.");
      process.exit(0);
    }

    let fixed = 0;
    let notFound = 0;

    // Para cada eSIM sin agencia, buscar en devoluciones
    for (const esim of esomsToFix) {
      const devolution = await db
        .collection("devoluciones")
        .where("serie", "==", esim.serie)
        .get();

      if (devolution.empty) {
        console.log(`⚠️  No devolution record for ${esim.serie}`);
        notFound++;
        continue;
      }

      const devolutionData = devolution.docs[0].data();
      const recoveredAgencia = devolutionData.agencia;

      if (!recoveredAgencia) {
        console.log(`❌ Devolution has no agencia for ${esim.serie}`);
        continue;
      }

      // Actualizar eSIM con agencia recuperada
      await db.collection("esims").doc(esim.id).update({
        agencia: recoveredAgencia,
      });

      console.log(`✅ Fixed ${esim.serie} → agencia: ${recoveredAgencia}`);
      fixed++;
    }

    console.log(`\n📊 Resultados:`);
    console.log(`   Recuperadas: ${fixed}`);
    console.log(`   Sin devolución: ${notFound}`);
    console.log(`\nDeploy this code fix and run this script once to recover.\n`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }

  process.exit(0);
}

recoverLostEsims();
