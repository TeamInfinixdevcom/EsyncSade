import React, { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";

export default function TeamRequestsTable({ user }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const isAgencyAdmin = user?.rol === "admin_agencia" || user?.rol === "admin de agencia";
  const agencyFromProfile = (user?.agencia || "").trim();

  useEffect(() => {
    async function fetchSolicitudes() {
      setLoading(true);
      setError("");

      if (isAgencyAdmin && !agencyFromProfile) {
        setSolicitudes([]);
        setError("Tu usuario admin de agencia no tiene agencia asignada.");
        setLoading(false);
        return;
      }

      try {
        const solicitudesRef = collection(db, "solicitudes");
        const q = (isAgencyAdmin && agencyFromProfile)
          ? query(solicitudesRef, where("agencia", "==", agencyFromProfile))
          : query(solicitudesRef, orderBy("fecha", "desc"));
        const querySnapshot = await getDocs(q);
        const rows = querySnapshot.docs.map(doc => doc.data());
        if (isAgencyAdmin) {
          rows.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
        }
        setSolicitudes(rows);
      } catch (err) {
        setError(err.message || "Error al cargar solicitudes.");
      }
      setLoading(false);
    }
    fetchSolicitudes();
  }, [isAgencyAdmin, agencyFromProfile]);

  // Calcular solicitudes a mostrar en la página actual
  const totalPages = Math.ceil(solicitudes.length / pageSize);
  const paginatedSolicitudes = solicitudes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div style={{ maxWidth: 700, margin: "2rem auto" }}>
      <h2>Solicitudes del Equipo</h2>
      {loading ? (
        <div>Cargando...</div>
      ) : error ? (
        <div style={{ color: "#ffb4b4" }}>{error}</div>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", border: '2px solid #00fff7', borderRadius: 12, overflow: 'hidden', background: '#181818', color: '#fff', boxShadow: '0 2px 16px #00fff733' }}>
            <thead>
              <tr style={{ background: '#00fff7', color: '#181818' }}>
                <th style={{ border: '1.5px solid #00fff7', padding: '8px 6px' }}>Serie</th>
                <th style={{ border: '1.5px solid #00fff7', padding: '8px 6px' }}>Pedido</th>
                <th style={{ border: '1.5px solid #00fff7', padding: '8px 6px' }}>Usuario</th>
                <th style={{ border: '1.5px solid #00fff7', padding: '8px 6px' }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSolicitudes.map((s, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#23243e' : '#181818' }}>
                  <td style={{ border: '1px solid #00fff7', padding: '6px 4px' }}>{s.serie}</td>
                  <td style={{ border: '1px solid #00fff7', padding: '6px 4px' }}>{s.pedido}</td>
                  <td style={{ border: '1px solid #00fff7', padding: '6px 4px' }}>{s.usuario}</td>
                  <td style={{ border: '1px solid #00fff7', padding: '6px 4px' }}>{s.fecha ? new Date(s.fecha).toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
