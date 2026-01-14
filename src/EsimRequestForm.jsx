import React, { useState } from "react";

import { collection, query, where, getDocs, doc, runTransaction } from "firebase/firestore";
import { db, auth } from "./firebase";

export default function EsimRequestForm() {
  const [pedido, setPedido] = useState("");
  const [numero, setNumero] = useState("");
  const [cedula, setCedula] = useState("");
  const [msg, setMsg] = useState("");

  const [serieAsignada, setSerieAsignada] = useState("");
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      let serie = "";
      await runTransaction(db, async (transaction) => {
        const q = query(collection(db, "esims"), where("estado", "==", "disponible"));
        const snap = await getDocs(q);
        if (snap.empty) throw new Error("No hay eSIMs disponibles");
        const esimDoc = snap.docs[0];
        serie = esimDoc.data().serie;
        const usuario = auth.currentUser?.email || "";
        transaction.update(esimDoc.ref, { estado: "usada", pedido, numero, cedula, fechaUso: new Date().toISOString() });
        transaction.set(doc(collection(db, "solicitudes")), {
          serie,
          pedido,
          numero,
          cedula,
          usuario,
          fecha: new Date().toISOString()
        });
      });
      setSerieAsignada(serie);
      navigator.clipboard.writeText(serie);
      setMsg("Solicitud enviada correctamente. La serie fue copiada al portapapeles.");
      setPedido(""); setNumero(""); setCedula("");
    } catch (err) {
      setMsg("Error: " + (err.message || "al enviar la solicitud."));
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: "2rem auto", background: '#181818', borderRadius: 24, boxShadow: '0 0 32px 4px #ff34fccc', border: '2.5px solid #ff34fc', padding: '2rem 1rem' }}>
      <h2>Solicitar E-SIM</h2>
      <input
        type="text"
        placeholder="Pedido"
        value={pedido}
        onChange={e => setPedido(e.target.value)}
        required
        style={{ width: "100%", marginBottom: 8 }}
      />
      <input
        type="text"
        placeholder="Número de cliente"
        value={numero}
        onChange={e => setNumero(e.target.value)}
        required
        style={{ width: "100%", marginBottom: 8 }}
      />
      <input
        type="text"
        placeholder="Cédula de cliente"
        value={cedula}
        onChange={e => setCedula(e.target.value)}
        required
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button type="submit" style={{ width: "100%" }}>Solicitar</button>
      {serieAsignada && (
        <div style={{ marginTop: 12, color: '#ff34fc', fontWeight: 700 }}>
          Serie asignada: <span style={{ background: '#232323', padding: '2px 8px', borderRadius: 6 }}>{serieAsignada}</span> (copiada)
        </div>
      )}
      {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
    </form>
  );
}
