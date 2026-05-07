import React, { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { db } from "./firebase";
import { auth } from "./firebase";
import EsimPieChart from "./EsimPieChart";
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

function formatDateTimeWithSeconds(value) {
  if (!value) return "-";

  const raw = typeof value?.toDate === "function" ? value.toDate() : value;
  const date = raw instanceof Date ? raw : new Date(raw);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function normalizeDateValue(value) {
  if (!value) return null;
  const raw = typeof value?.toDate === "function" ? value.toDate() : value;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTipoGestionKey(solicitud) {
  if (solicitud?.tipoGestion === "cambio_sim_komercial") return "cambio";
  if (solicitud?.tipoGestion === "plan_nuevo_komercial") return "plan";
  return "solicitud";
}

export default function UserReport() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);
  const [usimUsos, setUsimUsos] = useState([]);
  const [usimDevoluciones, setUsimDevoluciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");
  const [filtroHistorial, setFiltroHistorial] = useState("");
  const [paginaSolicitudes, setPaginaSolicitudes] = useState(1);
  const [paginaDevoluciones, setPaginaDevoluciones] = useState(1);
  const [paginaUsimUsos, setPaginaUsimUsos] = useState(1);
  const [paginaUsimDevoluciones, setPaginaUsimDevoluciones] = useState(1);

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
        const usimUsosQuery = query(collection(db, "usim_usos"), where("usuarioEmail", "==", userEmail));
        const usimDevolucionesQuery = query(collection(db, "usim_devoluciones"), where("usuarioEmail", "==", userEmail));

        const [solicitudesSnap, devolucionesSnap, usimUsosSnap, usimDevolucionesSnap] = await Promise.all([
          getDocs(solicitudesQuery),
          getDocs(devolucionesQuery),
          getDocs(usimUsosQuery),
          getDocs(usimDevolucionesQuery),
        ]);

        const solicitudesData = solicitudesSnap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        const devolucionesData = devolucionesSnap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        const usimUsosData = usimUsosSnap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        const usimDevolucionesData = usimDevolucionesSnap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        setSolicitudes(solicitudesData);
        setDevoluciones(devolucionesData);
        setUsimUsos(usimUsosData);
        setUsimDevoluciones(usimDevolucionesData);
      } catch {
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

  const usimUsosFiltrados = useMemo(() => {
    return usimUsos.filter((item) =>
      matchesFilter(
        [item.serie, item.numero, item.numeroCliente, item.cedula, item.identificacion, item.pedido],
        filtroHistorial
      )
    );
  }, [usimUsos, filtroHistorial]);

  const usimDevolucionesFiltradas = useMemo(() => {
    return usimDevoluciones.filter((item) =>
      matchesFilter(
        [item.serie, item.numero, item.numeroCliente, item.cedula, item.identificacion, item.pedido],
        filtroHistorial
      )
    );
  }, [usimDevoluciones, filtroHistorial]);

  const totalPaginasSolicitudes = Math.max(1, Math.ceil(solicitudesFiltradas.length / PAGE_SIZE));
  const totalPaginasDevoluciones = Math.max(1, Math.ceil(devolucionesFiltradas.length / PAGE_SIZE));
  const totalPaginasUsimUsos = Math.max(1, Math.ceil(usimUsosFiltrados.length / PAGE_SIZE));
  const totalPaginasUsimDevoluciones = Math.max(1, Math.ceil(usimDevolucionesFiltradas.length / PAGE_SIZE));

  const paginaSolicitudesActual = Math.min(paginaSolicitudes, totalPaginasSolicitudes);
  const paginaDevolucionesActual = Math.min(paginaDevoluciones, totalPaginasDevoluciones);
  const paginaUsimUsosActual = Math.min(paginaUsimUsos, totalPaginasUsimUsos);
  const paginaUsimDevolucionesActual = Math.min(paginaUsimDevoluciones, totalPaginasUsimDevoluciones);

  const solicitudesPagina = solicitudesFiltradas.slice(
    (paginaSolicitudesActual - 1) * PAGE_SIZE,
    paginaSolicitudesActual * PAGE_SIZE
  );

  const devolucionesPagina = devolucionesFiltradas.slice(
    (paginaDevolucionesActual - 1) * PAGE_SIZE,
    paginaDevolucionesActual * PAGE_SIZE
  );

  const usimUsosPagina = usimUsosFiltrados.slice(
    (paginaUsimUsosActual - 1) * PAGE_SIZE,
    paginaUsimUsosActual * PAGE_SIZE
  );

  const usimDevolucionesPagina = usimDevolucionesFiltradas.slice(
    (paginaUsimDevolucionesActual - 1) * PAGE_SIZE,
    paginaUsimDevolucionesActual * PAGE_SIZE
  );

  const filtroActivo = normalizeSearch(filtroHistorial) !== "";

  const handleFiltroChange = (event) => {
    setFiltroHistorial(event.target.value);
    setPaginaSolicitudes(1);
    setPaginaDevoluciones(1);
    setPaginaUsimUsos(1);
    setPaginaUsimDevoluciones(1);
  };

  const actividadMetricas = useMemo(() => {
    const timeline = new Map();

    solicitudes.forEach((item) => {
      const date = normalizeDateValue(item.fecha);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const current = timeline.get(key) || { solicitudes: 0, devoluciones: 0 };
      current.solicitudes += 1;
      timeline.set(key, current);
    });

    devoluciones.forEach((item) => {
      const date = normalizeDateValue(item.fecha);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const current = timeline.get(key) || { solicitudes: 0, devoluciones: 0 };
      current.devoluciones += 1;
      timeline.set(key, current);
    });

    usimUsos.forEach((item) => {
      const date = normalizeDateValue(item.fecha);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const current = timeline.get(key) || { solicitudes: 0, devoluciones: 0 };
      current.solicitudes += 1;
      timeline.set(key, current);
    });

    usimDevoluciones.forEach((item) => {
      const date = normalizeDateValue(item.fecha);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const current = timeline.get(key) || { solicitudes: 0, devoluciones: 0 };
      current.devoluciones += 1;
      timeline.set(key, current);
    });

    const rows = Array.from(timeline.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([key, values]) => ({
        fecha: key,
        dia: new Date(`${key}T00:00:00`).toLocaleDateString("es-CR", { month: "2-digit", day: "2-digit" }),
        solicitudes: values.solicitudes,
        devoluciones: values.devoluciones,
        actividad: values.solicitudes + values.devoluciones,
      }));

    const actividadTotal = rows.reduce((acc, row) => acc + row.actividad, 0);
    const devolucionesTotales = devoluciones.length + usimDevoluciones.length;
    const solicitudesTotales = solicitudes.length + usimUsos.length;
    const balanceActivo = Math.max(0, solicitudesTotales - devolucionesTotales);

    return {
      timeline: rows,
      solicitudesTotales,
      devolucionesTotales,
      balanceActivo,
      actividadPromedio: rows.length ? (actividadTotal / rows.length).toFixed(1) : "0.0",
    };
  }, [solicitudes, devoluciones, usimUsos, usimDevoluciones]);

  const tipoGestionMetricas = useMemo(() => {
    const buckets = {
      solicitud: { label: "Solicitud", count: 0, color: "cyan" },
      cambio: { label: "Cambio SIM", count: 0, color: "violet" },
      plan: { label: "Plan nuevo", count: 0, color: "amber" },
    };

    [...solicitudes, ...usimUsos].forEach((item) => {
      const key = getTipoGestionKey(item);
      buckets[key].count += 1;
    });

    const rows = Object.values(buckets);
    const max = Math.max(1, ...rows.map((row) => row.count));

    return rows.map((row) => ({
      ...row,
      pulseCount: Math.max(3, Math.min(10, Math.round((row.count / max) * 10))),
    }));
  }, [solicitudes, usimUsos]);

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
            <span className="history-chip history-chip--req">uSIMs usadas <strong>{usimUsos.length}</strong></span>
            <span className="history-chip history-chip--ret">uSIMs devueltas <strong>{usimDevoluciones.length}</strong></span>
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
                  onChange={handleFiltroChange}
                  placeholder="Ejemplo: KO-50733578 o 1-16488468244"
                />
              </div>

              <section className="history-ops-grid">
                <article className="history-ops-panel history-ops-panel--cyan">
                  <div className="history-ops-head">
                    <div>
                      <p className="history-ops-kicker">Monarch personal feed</p>
                      <h3 className="history-ops-title">Radar de actividad</h3>
                    </div>
                    <div className="history-ops-pill">
                      {userEmail ? userEmail.split("@")[0].toUpperCase() : "USER"}
                    </div>
                  </div>

                  <div className="history-ops-radar">
                    <div className="history-ops-radar-copy">
                      <span>Solicitudes {actividadMetricas.solicitudesTotales}</span>
                      <span>Devoluciones {actividadMetricas.devolucionesTotales}</span>
                      <span>Balance {actividadMetricas.balanceActivo}</span>
                    </div>
                    <EsimPieChart
                      disponibles={actividadMetricas.solicitudesTotales}
                      usadas={actividadMetricas.devolucionesTotales}
                    />
                  </div>
                </article>

                <article className="history-ops-panel history-ops-panel--violet">
                  <div className="history-ops-head">
                    <div>
                      <p className="history-ops-kicker">Signal behavior</p>
                      <h3 className="history-ops-title">Comportamiento reciente</h3>
                    </div>
                    <div className="history-ops-pill history-ops-pill--violet">
                      AVG {actividadMetricas.actividadPromedio}
                    </div>
                  </div>

                  {actividadMetricas.timeline.length === 0 ? (
                    <div className="history-ops-empty">Aun no hay trazas para graficar</div>
                  ) : (
                    <div className="history-ops-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={actividadMetricas.timeline} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                          <defs>
                            <linearGradient id="historyReqFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#00fff7" stopOpacity={0.44} />
                              <stop offset="100%" stopColor="#00fff7" stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="historyRetFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#bd34fe" stopOpacity={0.42} />
                              <stop offset="100%" stopColor="#bd34fe" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(134, 182, 217, 0.12)" vertical={false} />
                          <XAxis dataKey="dia" tick={{ fill: "#cfe9ff", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fill: "#9bc5e8", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                          <Tooltip
                            contentStyle={{
                              background: "#091317",
                              border: "1px solid rgba(0, 255, 247, 0.25)",
                              borderRadius: 10,
                              color: "#ebfbff",
                            }}
                          />
                          <Area type="monotone" dataKey="solicitudes" stroke="#00fff7" fill="url(#historyReqFill)" strokeWidth={2.2} />
                          <Area type="monotone" dataKey="devoluciones" stroke="#bd34fe" fill="url(#historyRetFill)" strokeWidth={2.2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </article>

                <article className="history-ops-panel history-ops-panel--amber">
                  <div className="history-ops-head">
                    <div>
                      <p className="history-ops-kicker">Behavior signature</p>
                      <h3 className="history-ops-title">Tipos de gestion</h3>
                    </div>
                  <div className="history-ops-pill history-ops-pill--amber">
                      {solicitudes.length + usimUsos.length} total
                  </div>
                  </div>

                  <div className="history-type-matrix">
                    {tipoGestionMetricas.map((row, index) => (
                      <div
                        key={row.label}
                        className={`history-type-row is-${row.color}`}
                        style={{ "--strength": row.strength, "--delay": `${index * 0.16}s` }}
                      >
                        <div className="history-type-row__meta">
                          <strong>{row.label}</strong>
                          <span>{row.count} registros</span>
                        </div>
                        <div className="history-type-row__pulseband">
                          {Array.from({ length: row.pulseCount }, (_, pulseIndex) => (
                            <span
                              key={`${row.label}-${pulseIndex}`}
                              className="history-type-row__pulse"
                              style={{ "--pulse-delay": `${pulseIndex * 0.12}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

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
                                <td>{formatDateTimeWithSeconds(s.fecha)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="history-pagination">
                        <button
                          type="button"
                          onClick={() =>
                            setPaginaSolicitudes((prev) => Math.max(1, Math.min(prev, totalPaginasSolicitudes) - 1))
                          }
                          disabled={paginaSolicitudesActual === 1}
                        >
                          Anterior
                        </button>
                        <span>Pagina {paginaSolicitudesActual} de {totalPaginasSolicitudes}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPaginaSolicitudes((prev) =>
                              Math.min(totalPaginasSolicitudes, Math.min(prev, totalPaginasSolicitudes) + 1)
                            )
                          }
                          disabled={paginaSolicitudesActual === totalPaginasSolicitudes}
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
                                <td>{formatDateTimeWithSeconds(d.fecha)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="history-pagination history-pagination--ret">
                        <button
                          type="button"
                          onClick={() =>
                            setPaginaDevoluciones((prev) => Math.max(1, Math.min(prev, totalPaginasDevoluciones) - 1))
                          }
                          disabled={paginaDevolucionesActual === 1}
                        >
                          Anterior
                        </button>
                        <span>Pagina {paginaDevolucionesActual} de {totalPaginasDevoluciones}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPaginaDevoluciones((prev) =>
                              Math.min(totalPaginasDevoluciones, Math.min(prev, totalPaginasDevoluciones) + 1)
                            )
                          }
                          disabled={paginaDevolucionesActual === totalPaginasDevoluciones}
                        >
                          Siguiente
                        </button>
                      </div>
                    </>
                  )}
                </section>
              </div>

              <div className="history-grid" style={{ marginTop: 18 }}>
                <section className="history-panel">
                  <div className="history-panel-head">
                    <h3 className="history-panel-title">uSIMs registradas por ti</h3>
                    <span className="history-count history-count--req">
                      {filtroActivo
                        ? `${usimUsosFiltrados.length}/${usimUsos.length}`
                        : usimUsos.length}
                    </span>
                  </div>

                  {usimUsosFiltrados.length === 0 ? (
                    <div className="history-empty">
                      {usimUsos.length === 0
                        ? "No tienes uSIMs registradas."
                        : "No hay uSIMs que coincidan con el filtro."}
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
                              <th>Fecha uso</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usimUsosPagina.map((item) => (
                              <tr key={item.id}>
                                <td>{item.serie || "-"}</td>
                                <td>{getTipoGestion(item)}</td>
                                <td>{item.pedido || "-"}</td>
                                <td>{item.numero || item.numeroCliente || "-"}</td>
                                <td>{item.cedula || item.identificacion || "-"}</td>
                                <td>{formatDateTimeWithSeconds(item.fecha)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="history-pagination">
                        <button
                          type="button"
                          onClick={() => setPaginaUsimUsos((prev) => Math.max(1, Math.min(prev, totalPaginasUsimUsos) - 1))}
                          disabled={paginaUsimUsosActual === 1}
                        >
                          Anterior
                        </button>
                        <span>Pagina {paginaUsimUsosActual} de {totalPaginasUsimUsos}</span>
                        <button
                          type="button"
                          onClick={() => setPaginaUsimUsos((prev) => Math.min(totalPaginasUsimUsos, Math.min(prev, totalPaginasUsimUsos) + 1))}
                          disabled={paginaUsimUsosActual === totalPaginasUsimUsos}
                        >
                          Siguiente
                        </button>
                      </div>
                    </>
                  )}
                </section>

                <section className="history-panel">
                  <div className="history-panel-head">
                    <h3 className="history-panel-title">uSIMs devueltas por ti</h3>
                    <span className="history-count history-count--ret">
                      {filtroActivo
                        ? `${usimDevolucionesFiltradas.length}/${usimDevoluciones.length}`
                        : usimDevoluciones.length}
                    </span>
                  </div>

                  {usimDevolucionesFiltradas.length === 0 ? (
                    <div className="history-empty">
                      {usimDevoluciones.length === 0
                        ? "No tienes devoluciones uSIM registradas."
                        : "No hay devoluciones uSIM que coincidan con el filtro."}
                    </div>
                  ) : (
                    <>
                      <div className="history-table-wrap">
                        <table className="history-table history-table--returns">
                          <thead>
                            <tr>
                              <th>Serie</th>
                              <th>Lote</th>
                              <th>Fecha devolucion</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usimDevolucionesPagina.map((item) => (
                              <tr key={item.id}>
                                <td>{item.serie || "-"}</td>
                                <td>{item.loteId || "-"}</td>
                                <td>{formatDateTimeWithSeconds(item.fecha)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="history-pagination history-pagination--ret">
                        <button
                          type="button"
                          onClick={() => setPaginaUsimDevoluciones((prev) => Math.max(1, Math.min(prev, totalPaginasUsimDevoluciones) - 1))}
                          disabled={paginaUsimDevolucionesActual === 1}
                        >
                          Anterior
                        </button>
                        <span>Pagina {paginaUsimDevolucionesActual} de {totalPaginasUsimDevoluciones}</span>
                        <button
                          type="button"
                          onClick={() => setPaginaUsimDevoluciones((prev) => Math.min(totalPaginasUsimDevoluciones, Math.min(prev, totalPaginasUsimDevoluciones) + 1))}
                          disabled={paginaUsimDevolucionesActual === totalPaginasUsimDevoluciones}
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
