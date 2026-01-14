import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import EsimPieChart from "./EsimPieChart";

export default function Dashboard() {
  const [disponibles, setDisponibles] = useState(0);
  const [usadas, setUsadas] = useState(0);
  const [total, setTotal] = useState(0);
  const [solicitudesPorEjecutivo, setSolicitudesPorEjecutivo] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "esims"), (snapshot) => {
      let disp = 0, used = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.estado === "disponible") disp++;
        else used++;
      });
      setDisponibles(disp);
      setUsadas(used);
      setTotal(snapshot.size);
    });
    return () => unsub();
  }, []);

  // Consultar y agrupar solicitudes por ejecutivo (email)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "solicitudes"), (snapshot) => {
      const counts = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        const email = data.usuario;
        if (email) {
          counts[email] = (counts[email] || 0) + 1;
        }
      });
      setSolicitudesPorEjecutivo(counts);
    });
    return () => unsub();
  }, []);

  const tasaUso = total === 0 ? 0 : Math.round((usadas / total) * 100);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 24, color: "#00fff7", textShadow: '0 2px 12px #00fff7cc, 0 0 2px #fff', fontWeight: 900, letterSpacing: 2 }}>EsynSadeCloud Dashboard</h2>
      <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
        <div style={{ flex: 1, background: "#181818", borderRadius: 16, padding: 24, boxShadow: "0 0 16px 2px #00fff7cc" }}>
          <div style={{ fontSize: 14, color: "#00fff7", textShadow: '0 1px 8px #00fff7cc' }}>Disponibles</div>
          <div style={{ fontSize: 32, fontWeight: "bold", color: "#00fff7", textShadow: '0 1px 8px #00fff7cc' }}>{disponibles}</div>
        </div>
        <div style={{ flex: 1, background: "#181818", borderRadius: 16, padding: 24, boxShadow: "0 0 16px 2px #ff3c2fcc" }}>
          <div style={{ fontSize: 14, color: "#ff3c2f", textShadow: '0 1px 8px #ff3c2fcc' }}>Usadas</div>
          <div style={{ fontSize: 32, fontWeight: "bold", color: "#ff3c2f", textShadow: '0 1px 8px #ff3c2fcc' }}>{usadas}</div>
        </div>
        <div style={{ flex: 1, background: "#181818", borderRadius: 16, padding: 24, boxShadow: "0 0 16px 2px #00fff7cc" }}>
          <div style={{ fontSize: 14, color: "#00fff7", textShadow: '0 1px 8px #00fff7cc' }}>Total</div>
          <div style={{ fontSize: 32, fontWeight: "bold", color: "#00fff7", textShadow: '0 1px 8px #00fff7cc' }}>{total}</div>
        </div>
        <div style={{ flex: 1, background: "#181818", borderRadius: 16, padding: 24, boxShadow: "0 0 16px 2px #ffe066cc" }}>
          <div style={{ fontSize: 14, color: "#ffe066", textShadow: '0 1px 8px #ffe066cc' }}>Tasa de Uso</div>
          <div style={{ fontSize: 32, fontWeight: "bold", color: "#ffe066", textShadow: '0 1px 8px #ffe066cc' }}>{tasaUso}%</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ flex: 1, background: "#181818", borderRadius: 16, padding: 24, boxShadow: "0 0 16px 2px #00fff7cc" }}>
          <h3 style={{ fontSize: 18, marginBottom: 16, color: '#00fff7', textShadow: '0 1px 8px #00fff7cc' }}>Distribución de Estados</h3>
          <EsimPieChart disponibles={disponibles} usadas={usadas} />
        </div>
        <div style={{ flex: 2, background: "#181818", borderRadius: 16, padding: 24, boxShadow: "0 0 16px 2px #bd34fecc" }}>
          <h3 style={{ fontSize: 18, marginBottom: 16, color: '#bd34fe', textShadow: '0 1px 8px #bd34fecc' }}>Solicitudes por Ejecutivo</h3>
          {Object.keys(solicitudesPorEjecutivo).length === 0 ? (
            <svg width="100%" height="180">
              <text x="50%" y="90" textAnchor="middle" fontSize="18" fill="#bd34fe" style={{ textShadow: '0 1px 8px #bd34fecc' }}>Sin datos</text>
            </svg>
          ) : (
            <table style={{ width: '100%', color: '#bd34fe', background: 'transparent', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr style={{ color: '#fff', background: '#bd34fe22' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Email</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Solicitudes</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(solicitudesPorEjecutivo).map(([email, count]) => (
                  <tr key={email}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #bd34fe44' }}>{email}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #bd34fe44' }}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
