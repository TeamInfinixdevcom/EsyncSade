import React, { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { auth } from "./firebase";
import "./user-report.css";

const PAGE_SIZE = 10;

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function compactSearch(value) {
  return normalizeSearch(value).replace(/[^a-z0-9]/g, "");
}

function matchesFilter(values, queryText) {
  const normalizedQuery = normalizeSearch(queryText);
  if (!normalizedQuery) return true;

  const compactQuery = compactSearch(queryText);

  return values.some((value) => {
    const normalizedValue = normalizeSearch(value);
    if (normalizedValue.includes(normalizedQuery)) return true;
    if (!compactQuery) return false;
    return compactSearch(value).includes(compactQuery);
  });
}

export default function UserReport() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");
  const [filtroHistorial, setFiltroHistorial] = useState("");
  const [paginaSolicitudes, setPaginaSolicitudes] = useState(1);
  const [paginaDevoluciones, setPaginaDevoluciones] = useState(1);

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

  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter((s) =>
      matchesFilter(
        [s.numero, s.numeroCliente, s.cedula, s.identificacion, s.pedido],
        filtroHistorial
      )
    );
  }, [solicitudes, filtroHistorial]);

  const devolucionesFiltradas = useMemo(() => {
    return devoluciones.filter((d) =>
      matchesFilter(
        [d.numero, d.numeroCliente, d.cedula, d.identificacion, d.pedido],
        filtroHistorial
      )
    );
  }, [devoluciones, filtroHistorial]);

  useEffect(() => {
    setPaginaSolicitudes(1);
    setPaginaDevoluciones(1);
  }, [filtroHistorial, userEmail]);

  const totalPaginasSolicitudes = Math.max(1, Math.ceil(solicitudesFiltradas.length / PAGE_SIZE));
  const totalPaginasDevoluciones = Math.max(1, Math.ceil(devolucionesFiltradas.length / PAGE_SIZE));

  useEffect(() => {
    if (paginaSolicitudes > totalPaginasSolicitudes) {
      setPaginaSolicitudes(totalPaginasSolicitudes);
    }
    if (paginaDevoluciones > totalPaginasDevoluciones) {
      setPaginaDevoluciones(totalPaginasDevoluciones);
    }
  }, [
    paginaSolicitudes,
    paginaDevoluciones,
    totalPaginasSolicitudes,
    totalPaginasDevoluciones,
  ]);

  const solicitudesPagina = solicitudesFiltradas.slice(
    (paginaSolicitudes - 1) * PAGE_SIZE,
    paginaSolicitudes * PAGE_SIZE
  );

  const devolucionesPagina = devolucionesFiltradas.slice(
    (paginaDevoluciones - 1) * PAGE_SIZE,
    paginaDevoluciones * PAGE_SIZE
  );

  const filtroActivo = normalizeSearch(filtroHistorial) !== "";

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

              <div className="history-filter-wrap">
                <label className="history-filter-label" htmlFor="historialFiltroInput">
                  Buscar por numero, cedula o pedido
                </label>
                <input
                  id="historialFiltroInput"
                  className="history-filter-input"
                  type="text"
                  value={filtroHistorial}
                  onChange={(e) => setFiltroHistorial(e.target.value)}
                  placeholder="Ejemplo: KO-50733578 o 1-16488468244"
                />
              </div>

              <div className="history-grid">
                <section className="history-panel">
                  <div className="history-panel-head">
                    <h3 className="history-panel-title">Solicitudes realizadas</h3>
                    <span className="history-count history-count--req">
                      {filtroActivo
                        ? `${solicitudesFiltradas.length}/${solicitudes.length}`
                        : solicitudes.length}
                    </span>
                  </div>

                  {solicitudesFiltradas.length === 0 ? (
                    <div className="history-empty">
                      {solicitudes.length === 0
                        ? "No tienes solicitudes registradas."
                        : "No hay solicitudes que coincidan con el filtro."}
                    </div>
                  ) : (
                    <>
                      <div className="history-table-wrap">
                        <table className="history-table">
                          <thead>
                            <tr>
                              <th>Serie</th>
                              <th>Tipo</th>
                              <th>Pedido</th>
                              <th>Numero cliente</th>
                              <th>Cedula</th>
                              <th>Fecha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {solicitudesPagina.map((s) => (
                              <tr key={s.id}>
                                <td>{s.serie || "-"}</td>
                                <td>{getTipoGestion(s)}</td>
                                <td>{s.pedido || (s.pedidoPendiente ? "Pendiente por sistema" : "-")}</td>
                                <td>{s.numero || s.numeroCliente || "-"}</td>
                                <td>{s.cedula || s.identificacion || "-"}</td>
                                <td>{s.fecha ? new Date(s.fecha).toLocaleString() : "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="history-pagination">
                        <button
                          type="button"
                          onClick={() => setPaginaSolicitudes((prev) => Math.max(1, prev - 1))}
                          disabled={paginaSolicitudes === 1}
                        >
                          Anterior
                        </button>
                        <span>Pagina {paginaSolicitudes} de {totalPaginasSolicitudes}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPaginaSolicitudes((prev) => Math.min(totalPaginasSolicitudes, prev + 1))
                          }
                          disabled={paginaSolicitudes === totalPaginasSolicitudes}
                        >
                          Siguiente
                        </button>
                      </div>
                    </>
                  )}
                </section>

                <section className="history-panel">
                  <div className="history-panel-head">
                    <h3 className="history-panel-title">eSIMs devueltas por ti</h3>
                    <span className="history-count history-count--ret">
                      {filtroActivo
                        ? `${devolucionesFiltradas.length}/${devoluciones.length}`
                        : devoluciones.length}
                    </span>
                  </div>

                  {devolucionesFiltradas.length === 0 ? (
                    <div className="history-empty">
                      {devoluciones.length === 0
                        ? "No tienes devoluciones registradas."
                        : "No hay devoluciones que coincidan con el filtro."}
                    </div>
                  ) : (
                    <>
                      <div className="history-table-wrap">
                        <table className="history-table history-table--returns">
                          <thead>
                            <tr>
                              <th>Serie</th>
                              <th>Pedido</th>
                              <th>Numero cliente</th>
                              <th>Cedula</th>
                              <th>Fecha devolucion</th>
                            </tr>
                          </thead>
                          <tbody>
                            {devolucionesPagina.map((d) => (
                              <tr key={d.id}>
                                <td>{d.serie || "-"}</td>
                                <td>{d.pedido || "-"}</td>
                                <td>{d.numero || d.numeroCliente || "-"}</td>
                                <td>{d.cedula || d.identificacion || "-"}</td>
                                <td>{d.fecha ? new Date(d.fecha).toLocaleString() : "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="history-pagination history-pagination--ret">
                        <button
                          type="button"
                          onClick={() => setPaginaDevoluciones((prev) => Math.max(1, prev - 1))}
                          disabled={paginaDevoluciones === 1}
                        >
                          Anterior
                        </button>
                        <span>Pagina {paginaDevoluciones} de {totalPaginasDevoluciones}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPaginaDevoluciones((prev) => Math.min(totalPaginasDevoluciones, prev + 1))
                          }
                          disabled={paginaDevoluciones === totalPaginasDevoluciones}
                        >
                          Siguiente
                        </button>
                      </div>
                    </>
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
