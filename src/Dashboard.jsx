import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import EsimPieChart from "./EsimPieChart";
import { getUserAgency, isGeneralAdmin, sameAgency } from "./userProfile";

export default function Dashboard({ user }) {
  const [disponibles, setDisponibles] = useState(0);
  const [usadas, setUsadas] = useState(0);
  const [total, setTotal] = useState(0);
  const [devoluciones, setDevoluciones] = useState(0);
  const [solicitudesPorEjecutivo, setSolicitudesPorEjecutivo] = useState({});
  const agenciaUsuario = getUserAgency(user);
  const canSeeAll = isGeneralAdmin(user);

  useEffect(() => {
    if (!canSeeAll && !agenciaUsuario) {
      setDisponibles(0);
      setUsadas(0);
      setTotal(0);
      return;
    }

    const source = canSeeAll
      ? collection(db, "esims")
      : query(collection(db, "esims"), where("agencia", "==", agenciaUsuario));

    const unsub = onSnapshot(source, (snapshot) => {
      let disp = 0, used = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.estado === "disponible") disp++;
        else used++;
      });
      setDisponibles(disp);
      setUsadas(used);
      setTotal(disp + used);
    });
    return () => unsub();
  }, [canSeeAll, agenciaUsuario]);

  // Consultar y agrupar solicitudes por ejecutivo (email)
  useEffect(() => {
    if (!canSeeAll && !agenciaUsuario) {
      setSolicitudesPorEjecutivo({});
      return;
    }

    const source = canSeeAll
      ? collection(db, "solicitudes")
      : query(collection(db, "solicitudes"), where("agencia", "==", agenciaUsuario));

    const unsub = onSnapshot(source, (snapshot) => {
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
  }, [canSeeAll, agenciaUsuario]);

  useEffect(() => {
    if (!canSeeAll && !agenciaUsuario) {
      setDevoluciones(0);
      return;
    }

    const source = canSeeAll
      ? collection(db, "devoluciones")
      : query(collection(db, "devoluciones"), where("agencia", "==", agenciaUsuario));

    const unsub = onSnapshot(source, (snapshot) => {
      let totalDevoluciones = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (canSeeAll || sameAgency(data.agencia, agenciaUsuario)) {
          totalDevoluciones += 1;
        }
      });
      setDevoluciones(totalDevoluciones);
    });
    return () => unsub();
  }, [canSeeAll, agenciaUsuario]);

  const tasaUso = total === 0 ? 0 : Math.round((usadas / total) * 100);

  return (
    <div style={{ width: "100%", maxWidth: 1240, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 24, color: "#00fff7", textShadow: "0 2px 12px #00fff7cc, 0 0 2px #fff", fontWeight: 900, letterSpacing: 2 }}>
        EsynSadeCloud Dashboard
      </h2>
      {!canSeeAll && agenciaUsuario && (
        <p style={{ marginTop: -8, marginBottom: 16, color: "#c6f9f0", fontWeight: 700 }}>
          Vista filtrada por agencia: {agenciaUsuario}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ background: "#181818", borderRadius: 16, padding: 18, boxShadow: "0 0 16px 2px #00fff7cc" }}>
          <div style={{ fontSize: 14, color: "#00fff7", textShadow: "0 1px 8px #00fff7cc" }}>Disponibles</div>
          <div style={{ fontSize: 30, fontWeight: "bold", color: "#00fff7", textShadow: "0 1px 8px #00fff7cc" }}>{disponibles}</div>
        </div>
        <div style={{ background: "#181818", borderRadius: 16, padding: 18, boxShadow: "0 0 16px 2px #ff3c2fcc" }}>
          <div style={{ fontSize: 14, color: "#ff3c2f", textShadow: "0 1px 8px #ff3c2fcc" }}>Usadas</div>
          <div style={{ fontSize: 30, fontWeight: "bold", color: "#ff3c2f", textShadow: "0 1px 8px #ff3c2fcc" }}>{usadas}</div>
        </div>
        <div style={{ background: "#181818", borderRadius: 16, padding: 18, boxShadow: "0 0 16px 2px #00fff7cc" }}>
          <div style={{ fontSize: 14, color: "#00fff7", textShadow: "0 1px 8px #00fff7cc" }}>Total</div>
          <div style={{ fontSize: 30, fontWeight: "bold", color: "#00fff7", textShadow: "0 1px 8px #00fff7cc" }}>{total}</div>
        </div>
        <div style={{ background: "#181818", borderRadius: 16, padding: 18, boxShadow: "0 0 16px 2px #ffe066cc" }}>
          <div style={{ fontSize: 14, color: "#ffe066", textShadow: "0 1px 8px #ffe066cc" }}>Tasa de Uso</div>
          <div style={{ fontSize: 30, fontWeight: "bold", color: "#ffe066", textShadow: "0 1px 8px #ffe066cc" }}>{tasaUso}%</div>
        </div>
        <div style={{ background: "#181818", borderRadius: 16, padding: 18, boxShadow: "0 0 16px 2px #bd34fecc" }}>
          <div style={{ fontSize: 14, color: "#bd34fe", textShadow: "0 1px 8px #bd34fecc" }}>Devoluciones</div>
          <div style={{ fontSize: 30, fontWeight: "bold", color: "#bd34fe", textShadow: "0 1px 8px #bd34fecc" }}>{devoluciones}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        <div style={{ background: "#181818", borderRadius: 16, padding: 18, boxShadow: "0 0 16px 2px #00fff7cc", minHeight: 320 }}>
          <h3 style={{ fontSize: 18, marginBottom: 16, color: "#00fff7", textShadow: "0 1px 8px #00fff7cc" }}>Distribucion de estados</h3>
          <EsimPieChart disponibles={disponibles} usadas={usadas} />
        </div>

        <div style={{ background: "#181818", borderRadius: 16, padding: 18, boxShadow: "0 0 16px 2px #bd34fecc", minHeight: 320 }}>
          <h3 style={{ fontSize: 18, marginBottom: 16, color: "#bd34fe", textShadow: "0 1px 8px #bd34fecc" }}>Solicitudes por ejecutivo</h3>
          {Object.keys(solicitudesPorEjecutivo).length === 0 ? (
            <svg width="100%" height="180">
              <text x="50%" y="90" textAnchor="middle" fontSize="18" fill="#bd34fe" style={{ textShadow: "0 1px 8px #bd34fecc" }}>Sin datos</text>
            </svg>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", color: "#bd34fe", background: "transparent", borderCollapse: "collapse", marginTop: 8, minWidth: 360 }}>
                <thead>
                  <tr style={{ color: "#fff", background: "#bd34fe22" }}>
                    <th style={{ textAlign: "left", padding: "8px" }}>Email</th>
                    <th style={{ textAlign: "right", padding: "8px" }}>Solicitudes</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(solicitudesPorEjecutivo).map(([email, count]) => (
                    <tr key={email}>
                      <td style={{ padding: "8px", borderBottom: "1px solid #bd34fe44" }}>{email}</td>
                      <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #bd34fe44" }}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
