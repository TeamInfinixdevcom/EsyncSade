import React, { useState } from "react";
import { collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export default function DevolucionEsims() {
  const [serie, setSerie] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDevolver = async (e) => {
    e.preventDefault();
    if (!/^\d{20}$/.test(serie)) {
      setMensaje("La serie debe tener 20 dígitos.");
      return;
    }
    setLoading(true);
    setMensaje("");
    try {
      // Buscar la eSIM por serie
      const q = query(collection(db, "esims"), where("serie", "==", serie));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setMensaje("Error: No se encontró eSIM con esa serie.");
        setLoading(false);
        return;
      }
      
      const esimDoc = snap.docs[0];
      const esimData = esimDoc.data();
      
      if (esimData.estado === "disponible") {
        setMensaje("Esta eSIM ya está disponible en el almacén.");
        setLoading(false);
        return;
      }
      
      // Actualizar estado a disponible
      await updateDoc(esimDoc.ref, {
        estado: "disponible",
        fechaDevolucion: new Date().toISOString(),
        pedido: null,
        numero: null,
        cedula: null,
        fechaUso: null
      });
      
      setMensaje(`✅ Serie ${serie} devuelta al almacén principal.`);
      setSerie("");
    } catch (err) {
      setMensaje("Error al devolver la eSIM: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", background: "#181818", borderRadius: 20, boxShadow: "0 0 32px 4px #ff34fccc", border: '2.5px solid #ff34fc', padding: "2.5rem 2rem", color: "#fff" }}>
      <h2 style={{ color: "#00fff7", textShadow: '0 2px 12px #00fff7cc, 0 0 2px #fff', fontWeight: 900, letterSpacing: 2 }}>Devolución de eSIM</h2>
      <form onSubmit={handleDevolver}>
        <input
          type="text"
          placeholder="Serie eSIM (20 dígitos)"
          value={serie}
          onChange={e => setSerie(e.target.value)}
          style={{ width: "100%", marginBottom: 16, padding: 10, borderRadius: 8, border: '1.5px solid #00fff7', fontSize: 16, background: '#232323', color: '#fff', boxShadow: '0 2px 8px #00fff733', outline: 'none' }}
        />
        <button type="submit" disabled={loading} style={{ width: "100%", background: 'linear-gradient(90deg, #00fff7 0%, #bd34fe 100%)', color: '#181818', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 900, fontSize: 17, boxShadow: '0 2px 16px #00fff7cc', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'background 0.2s', letterSpacing: 1, textShadow: '0 1px 8px #fff', marginBottom: 24 }}>
          {loading ? 'Procesando...' : 'Devolver'}
        </button>
      </form>
      {mensaje && <div style={{ color: '#00fff7', marginTop: 16, fontWeight: 700 }}>{mensaje}</div>}
    </div>
  );
}
