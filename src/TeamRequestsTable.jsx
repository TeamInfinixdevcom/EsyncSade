import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { getUserAgency, isGeneralAdmin, sameAgency } from "./userProfile";

export default function TeamRequestsTable({ user }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const agenciaUsuario = getUserAgency(user);
  const canSeeAll = isGeneralAdmin(user);

  const getTipoGestion = (solicitud) => {
    if (solicitud?.tipoGestion === "cambio_sim_komercial") {
      return "Cambio SIM por Komercial";
    }
    if (solicitud?.tipoGestion === "solicitud_normal") {
      return "Solicitud";
    }
    return solicitud?.pedido ? "Solicitud" : "Sin pedido";
  };

  const isAgencyAdmin = user?.rol === "admin_agencia" || user?.rol === "admin de agencia";
  const agencyFromProfile = (user?.agencia || "").trim();

  useEffect(() => {
    async function fetchSolicitudes() {
      setLoading(true);

      if (!canSeeAll && !agenciaUsuario) {
        setSolicitudes([]);
        setLoading(false);
        return;
      }

      const source = canSeeAll
        ? collection(db, "solicitudes")
        : query(collection(db, "solicitudes"), where("agencia", "==", agenciaUsuario));

      const querySnapshot = await getDocs(source);
      const data = querySnapshot.docs
        .map((docu) => ({ id: docu.id, ...docu.data() }))
        .filter((row) => canSeeAll || sameAgency(row.agencia, agenciaUsuario))
        .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
      setSolicitudes(data);
      setLoading(false);
    }
    fetchSolicitudes();
  }, [canSeeAll, agenciaUsuario]);

  // Calcular solicitudes a mostrar en la página actual
  const totalPages = Math.max(1, Math.ceil(solicitudes.length / pageSize));
  const paginatedSolicitudes = solicitudes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalColumns = canSeeAll ? 8 : 7;

  return (
    <div style={{ maxWidth: 980, margin: "2rem auto" }}>
      <h2>Solicitudes del Equipo</h2>
      {loading ? (
        <div>Cargando...</div>
      ) : error ? (
        <div style={{ color: "#ffb4b4" }}>{error}</div>
      ) : (
        <>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 920, borderCollapse: "collapse", border: "2px solid #00fff7", borderRadius: 12, overflow: "hidden", background: "#181818", color: "#fff", boxShadow: "0 2px 16px #00fff733" }}>
              <thead>
                <tr style={{ background: "#00fff7", color: "#181818" }}>
                  <th style={{ border: "1.5px solid #00fff7", padding: "8px 6px" }}>Serie</th>
                  {canSeeAll && <th style={{ border: "1.5px solid #00fff7", padding: "8px 6px" }}>Agencia</th>}
                  <th style={{ border: "1.5px solid #00fff7", padding: "8px 6px" }}>Tipo</th>
                  <th style={{ border: "1.5px solid #00fff7", padding: "8px 6px" }}>Pedido</th>
                  <th style={{ border: "1.5px solid #00fff7", padding: "8px 6px" }}>Numero cliente</th>
                  <th style={{ border: "1.5px solid #00fff7", padding: "8px 6px" }}>Cedula</th>
                  <th style={{ border: "1.5px solid #00fff7", padding: "8px 6px" }}>Usuario</th>
                  <th style={{ border: "1.5px solid #00fff7", padding: "8px 6px" }}>Fecha solicitud</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSolicitudes.length === 0 ? (
                  <tr>
                    <td colSpan={totalColumns} style={{ padding: 14, textAlign: "center", opacity: 0.8 }}>
                      Sin solicitudes registradas.
                    </td>
                  </tr>
                ) : (
                  paginatedSolicitudes.map((s, i) => (
                    <tr key={s.id || i} style={{ background: i % 2 === 0 ? "#23243e" : "#181818" }}>
                      <td style={{ border: "1px solid #00fff7", padding: "6px 4px" }}>{s.serie}</td>
                      {canSeeAll && <td style={{ border: "1px solid #00fff7", padding: "6px 4px" }}>{s.agencia || "-"}</td>}
                      <td style={{ border: "1px solid #00fff7", padding: "6px 4px" }}>{getTipoGestion(s)}</td>
                      <td style={{ border: "1px solid #00fff7", padding: "6px 4px" }}>{s.pedido || (s.pedidoPendiente ? "Pendiente por sistema" : "-")}</td>
                      <td style={{ border: "1px solid #00fff7", padding: "6px 4px" }}>{s.numero || s.numeroCliente || "-"}</td>
                      <td style={{ border: "1px solid #00fff7", padding: "6px 4px" }}>{s.cedula || s.identificacion || "-"}</td>
                      <td style={{ border: "1px solid #00fff7", padding: "6px 4px" }}>{s.usuario}</td>
                      <td style={{ border: "1px solid #00fff7", padding: "6px 4px" }}>{s.fecha ? new Date(s.fecha).toLocaleString() : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Controles de paginación */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 16 }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ marginRight: 8, padding: '6px 12px', background: '#00fff7', color: '#181818', border: 'none', borderRadius: 6, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >Anterior</button>
            <span style={{ margin: '0 12px' }}>Página {currentPage} de {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ marginLeft: 8, padding: '6px 12px', background: '#00fff7', color: '#181818', border: 'none', borderRadius: 6, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
            >Siguiente</button>
          </div>
        </>
      )}
    </div>
  );
}
