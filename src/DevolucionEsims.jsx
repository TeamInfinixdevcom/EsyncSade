import React, { useState } from "react";

export default function DevolucionEsims() {
  const [serie, setSerie] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Simulación de devolución (aquí iría la lógica real con Firestore)
  const handleDevolver = (e) => {
    e.preventDefault();
    if (!/^\d{20}$/.test(serie)) {
      setMensaje("La serie debe tener 20 dígitos.");
      return;
    }
    // Aquí deberías actualizar el estado de la eSIM en Firestore a 'devuelta' o moverla al almacén principal
    setMensaje(`Serie ${serie} devuelta al almacén principal.`);
    setSerie("");
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
        <button type="submit" style={{ width: "100%", background: 'linear-gradient(90deg, #00fff7 0%, #bd34fe 100%)', color: '#181818', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 900, fontSize: 17, boxShadow: '0 2px 16px #00fff7cc', cursor: 'pointer', transition: 'background 0.2s', letterSpacing: 1, textShadow: '0 1px 8px #fff', marginBottom: 24 }}>
          Devolver
        </button>
      </form>
      {mensaje && <div style={{ color: '#00fff7', marginTop: 16, fontWeight: 700 }}>{mensaje}</div>}
    </div>
  );
}
