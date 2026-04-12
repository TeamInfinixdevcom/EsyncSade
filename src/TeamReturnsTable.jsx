import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { getUserAgency, isGeneralAdmin, sameAgency } from "./userProfile";

export default function TeamReturnsTable({ user }) {
  const [devoluciones, setDevoluciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const agenciaUsuario = getUserAgency(user);
  const canSeeAll = isGeneralAdmin(user);

  useEffect(() => {
    async function fetchDevoluciones() {
      setLoading(true);

      if (!canSeeAll && !agenciaUsuario) {
        setDevoluciones([]);
        setLoading(false);
        return;
      }

      const source = canSeeAll
        ? collection(db, "devoluciones")
        : query(collection(db, "devoluciones"), where("agencia", "==", agenciaUsuario));

      const querySnapshot = await getDocs(source);
      const data = querySnapshot.docs
        .map((docu) => ({ id: docu.id, ...docu.data() }))
        .filter((row) => canSeeAll || sameAgency(row.agencia, agenciaUsuario))
        .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
      setDevoluciones(data);
      setLoading(false);
    }

    fetchDevoluciones();
  }, [canSeeAll, agenciaUsuario]);

  const totalPages = Math.max(1, Math.ceil(devoluciones.length / pageSize));
  const paginatedDevoluciones = devoluciones.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalColumns = canSeeAll ? 5 : 4;

  return (
    <div style={{ maxWidth: 980, margin: "2rem auto" }}>
      <h2>eSIMs Devueltas</h2>
      {loading ? (
        <div>Cargando...</div>
      ) : (
        <>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 760,
                borderCollapse: "collapse",
                border: "2px solid #bd34fe",
                borderRadius: 12,
                overflow: "hidden",
                background: "#181818",
                color: "#fff",
                boxShadow: "0 2px 16px #bd34fe55",
              }}
            >
              <thead>
                <tr style={{ background: "#bd34fe", color: "#fff" }}>
                  <th style={{ border: "1.5px solid #bd34fe", padding: "8px 6px" }}>Serie</th>
                  {canSeeAll && <th style={{ border: "1.5px solid #bd34fe", padding: "8px 6px" }}>Agencia</th>}
                  <th style={{ border: "1.5px solid #bd34fe", padding: "8px 6px" }}>Pedido</th>
                  <th style={{ border: "1.5px solid #bd34fe", padding: "8px 6px" }}>Usuario</th>
                  <th style={{ border: "1.5px solid #bd34fe", padding: "8px 6px" }}>Fecha devolucion</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevoluciones.length === 0 ? (
                  <tr>
                    <td colSpan={totalColumns} style={{ padding: 14, textAlign: "center", opacity: 0.8 }}>
                      Sin devoluciones registradas.
                    </td>
                  </tr>
                ) : (
                  paginatedDevoluciones.map((d, i) => (
                    <tr key={d.id || i} style={{ background: i % 2 === 0 ? "#23243e" : "#181818" }}>
                      <td style={{ border: "1px solid #bd34fe", padding: "6px 4px" }}>{d.serie || "-"}</td>
                      {canSeeAll && <td style={{ border: "1px solid #bd34fe", padding: "6px 4px" }}>{d.agencia || "-"}</td>}
                      <td style={{ border: "1px solid #bd34fe", padding: "6px 4px" }}>{d.pedido || "-"}</td>
                      <td style={{ border: "1px solid #bd34fe", padding: "6px 4px" }}>{d.usuario || "-"}</td>
                      <td style={{ border: "1px solid #bd34fe", padding: "6px 4px" }}>
                        {d.fecha ? new Date(d.fecha).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: 16 }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                marginRight: 8,
                padding: "6px 12px",
                background: "#bd34fe",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
              }}
            >
              Anterior
            </button>
            <span style={{ margin: "0 12px" }}>
              Pagina {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                marginLeft: 8,
                padding: "6px 12px",
                background: "#bd34fe",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              }}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </div>
  );
}
