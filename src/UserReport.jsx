import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { auth } from "./firebase";
import "./user-report.css";

export default function UserReport() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");

  const getTipoGestion = (solicitud) => {
    if (solicitud?.tipoGestion === "cambio_sim_komercial") {
      return "Cambio SIM por Komercial";
    }
    if (solicitud?.tipoGestion === "solicitud_normal") {
      return "Solicitud";
    }
    return solicitud?.pedido ? "Solicitud" : "Sin pedido";
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserEmail(user?.email || "");
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchRegistros() {
      if (!userEmail) return;
      setLoading(true);
      setError("");
      try {
        const solicitudesQuery = query(collection(db, "solicitudes"), where("usuario", "==", userEmail));
        const devolucionesQuery = query(collection(db, "devoluciones"), where("usuario", "==", userEmail));

        const [solicitudesSnap, devolucionesSnap] = await Promise.all([
          getDocs(solicitudesQuery),
          getDocs(devolucionesQuery),
        ]);

        const solicitudesData = solicitudesSnap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        const devolucionesData = devolucionesSnap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        setSolicitudes(solicitudesData);
        setDevoluciones(devolucionesData);
      } catch (err) {
        setError("No se pudo cargar tu historial.");
      }
      setLoading(false);
    }

    fetchRegistros();
  }, [userEmail]);

  return (
    <section className="history-shell">
      <div className="history-card">
        <header className="history-card-head">
          <div className="history-title-wrap">
            <p className="history-kicker">Resumen personal</p>
            <h2 className="history-title">Mi Historial</h2>
            <p className="history-subtitle">Consulta tus solicitudes y devoluciones con un registro ordenado por fecha.</p>
          </div>

          <div className="history-summary">
            <span className="history-chip history-chip--req">Solicitudes <strong>{solicitudes.length}</strong></span>
            <span className="history-chip history-chip--ret">Devoluciones <strong>{devoluciones.length}</strong></span>
          </div>
        </header>

        <div className="history-content">
          {loading ? (
            <div className="history-loading">
              <span className="history-loading-dot" />
              <span className="history-loading-dot" />
              <span className="history-loading-dot" />
              Cargando historial...
            </div>
          ) : (
            <>
              {error && <div className="history-feedback">{error}</div>}

              <div className="history-grid">
                <section className="history-panel">
                  <div className="history-panel-head">
                    <h3 className="history-panel-title">Solicitudes realizadas</h3>
                    <span className="history-count history-count--req">{solicitudes.length}</span>
                  </div>

                  {solicitudes.length === 0 ? (
                    <div className="history-empty">No tienes solicitudes registradas.</div>
                  ) : (
                    <div className="history-table-wrap">
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>Serie</th>
                            <th>Tipo</th>
                            <th>Pedido</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {solicitudes.map((s) => (
                            <tr key={s.id}>
                              <td>{s.serie || "-"}</td>
                              <td>{getTipoGestion(s)}</td>
                              <td>{s.pedido || (s.pedidoPendiente ? "Pendiente por sistema" : "-")}</td>
                              <td>{s.fecha ? new Date(s.fecha).toLocaleString() : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="history-panel">
                  <div className="history-panel-head">
                    <h3 className="history-panel-title">eSIMs devueltas por ti</h3>
                    <span className="history-count history-count--ret">{devoluciones.length}</span>
                  </div>

                  {devoluciones.length === 0 ? (
                    <div className="history-empty">No tienes devoluciones registradas.</div>
                  ) : (
                    <div className="history-table-wrap">
                      <table className="history-table history-table--returns">
                        <thead>
                          <tr>
                            <th>Serie</th>
                            <th>Fecha devolucion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {devoluciones.map((d) => (
                            <tr key={d.id}>
                              <td>{d.serie || "-"}</td>
                              <td>{d.fecha ? new Date(d.fecha).toLocaleString() : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
