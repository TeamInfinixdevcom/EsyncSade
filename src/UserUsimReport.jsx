import React, { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { db } from "./firebase";
import { auth } from "./firebase";
import UsimPieChart from "./UsimPieChart";
import "./user-report.css";

const PAGE_SIZE = 10;

const REQUEST_MODES = {
  normal: "solicitud_normal",
  komercial: "cambio_sim_komercial",
  planNuevoKomercial: "plan_nuevo_komercial",
};

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

export default function UserUsimReport() {
  const [usimUsos, setUsimUsos] = useState([]);
  const [usimDevoluciones, setUsimDevoluciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");
  const [filtroHistorial, setFiltroHistorial] = useState("");
  const [paginaUsimUsos, setPaginaUsimUsos] = useState(1);
  const [paginaUsimDevoluciones, setPaginaUsimDevoluciones] = useState(1);
  const [editUso, setEditUso] = useState(null);
  const [editPedido, setEditPedido] = useState("");
  const [editNumero, setEditNumero] = useState("");
  const [editCedula, setEditCedula] = useState("");
  const [editTipoGestion, setEditTipoGestion] = useState(REQUEST_MODES.normal);
  const [editSaving, setEditSaving] = useState(false);
  const [editFeedback, setEditFeedback] = useState("");

  const getTipoGestion = (solicitud) => {
    if (solicitud?.tipoGestion === "cambio_sim_komercial") {
      return "Cambio SIM por Komercial";
    }
    if (solicitud?.tipoGestion === "solicitud_normal") {
      return "Solicitud";
    }
    return solicitud?.pedido ? "Solicitud" : "Sin pedido";
  };

  const getDetalleGestion = (tipo) => {
    if (tipo === REQUEST_MODES.planNuevoKomercial) return "Plan nuevo en Komercial";
    if (tipo === REQUEST_MODES.komercial) return "Cambio SIM por Komercial";
    return "Solicitud con pedido";
  };

  const formatEstadoRevision = (estado) => {
    if (estado === "rebajada") return "Rebajada";
    if (estado === "correccion") return "Correccion";
    return "Pendiente";
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserEmail(user?.email || "");
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userEmail) return undefined;
    setLoading(true);
    setError("");

    const usimUsosQuery = query(collection(db, "usim_usos"), where("usuarioEmail", "==", userEmail));
    const usimDevolucionesQuery = query(collection(db, "usim_devoluciones"), where("usuarioEmail", "==", userEmail));

    let pendingLoads = 2;
    const markLoaded = () => {
      pendingLoads = Math.max(0, pendingLoads - 1);
      if (pendingLoads === 0) setLoading(false);
    };

    const unsubUsos = onSnapshot(
      usimUsosQuery,
      (snap) => {
        const usimUsosData = snap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
        setUsimUsos(usimUsosData);
        markLoaded();
      },
      () => {
        setError("No se pudo cargar tu historial de uSIMs.");
        markLoaded();
      }
    );

    const unsubDevoluciones = onSnapshot(
      usimDevolucionesQuery,
      (snap) => {
        const usimDevolucionesData = snap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
        setUsimDevoluciones(usimDevolucionesData);
        markLoaded();
      },
      () => {
        setError("No se pudo cargar tu historial de uSIMs.");
        markLoaded();
      }
    );

    return () => {
      unsubUsos();
      unsubDevoluciones();
    };
  }, [userEmail]);

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

  const totalPaginasUsimUsos = Math.max(1, Math.ceil(usimUsosFiltrados.length / PAGE_SIZE));
  const totalPaginasUsimDevoluciones = Math.max(1, Math.ceil(usimDevolucionesFiltradas.length / PAGE_SIZE));

  const paginaUsimUsosActual = Math.min(paginaUsimUsos, totalPaginasUsimUsos);
  const paginaUsimDevolucionesActual = Math.min(paginaUsimDevoluciones, totalPaginasUsimDevoluciones);

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
    setPaginaUsimUsos(1);
    setPaginaUsimDevoluciones(1);
  };

  const openEditModal = (uso) => {
    setEditUso(uso);
    setEditPedido(uso?.pedido || "");
    setEditNumero(uso?.numero || uso?.numeroCliente || "");
    setEditCedula(uso?.cedula || uso?.identificacion || "");
    setEditTipoGestion(uso?.tipoGestion || REQUEST_MODES.normal);
    setEditFeedback("");
  };

  const closeEditModal = () => {
    setEditUso(null);
    setEditPedido("");
    setEditNumero("");
    setEditCedula("");
    setEditTipoGestion(REQUEST_MODES.normal);
    setEditFeedback("");
  };

  const handleGuardarCorreccion = async () => {
    if (!editUso?.id) return;

    const pedidoLimpio = editPedido.trim();
    const numeroLimpio = editNumero.trim();
    const cedulaLimpia = editCedula.trim();

    if (!pedidoLimpio && !numeroLimpio && !cedulaLimpia) {
      setEditFeedback("Debes completar al menos un dato: pedido, numero o cedula.");
      return;
    }

    setEditSaving(true);
    setEditFeedback("");
    try {
      await updateDoc(doc(db, "usim_usos", editUso.id), {
        pedido: pedidoLimpio,
        numero: numeroLimpio,
        cedula: cedulaLimpia,
        tipoGestion: editTipoGestion,
        detalleGestion: getDetalleGestion(editTipoGestion),
        estadoRevision: "pendiente",
        fechaCorreccion: new Date().toISOString(),
        corregidoPorEmail: userEmail || null,
      });

      setUsimUsos((prev) =>
        prev.map((row) =>
          row.id === editUso.id
            ? {
                ...row,
                pedido: pedidoLimpio,
                numero: numeroLimpio,
                cedula: cedulaLimpia,
                tipoGestion: editTipoGestion,
                detalleGestion: getDetalleGestion(editTipoGestion),
                estadoRevision: "pendiente",
                fechaCorreccion: new Date().toISOString(),
                corregidoPorEmail: userEmail || null,
              }
            : row
        )
      );

      closeEditModal();
    } catch (err) {
      setEditFeedback(`Error al guardar la correccion: ${err?.message || "desconocido"}`);
    }
    setEditSaving(false);
  };

  const actividadMetricas = useMemo(() => {
    const timeline = new Map();

    usimUsos.forEach((item) => {
      const date = normalizeDateValue(item.fecha);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const current = timeline.get(key) || { usos: 0, devoluciones: 0 };
      current.usos += 1;
      timeline.set(key, current);
    });

    usimDevoluciones.forEach((item) => {
      const date = normalizeDateValue(item.fecha);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const current = timeline.get(key) || { usos: 0, devoluciones: 0 };
      current.devoluciones += 1;
      timeline.set(key, current);
    });

    const rows = Array.from(timeline.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([key, values]) => ({
        fecha: key,
        dia: new Date(`${key}T00:00:00`).toLocaleDateString("es-CR", { month: "2-digit", day: "2-digit" }),
        usos: values.usos,
        devoluciones: values.devoluciones,
        actividad: values.usos + values.devoluciones,
      }));

    const actividadTotal = rows.reduce((acc, row) => acc + row.actividad, 0);
    const devolucionesTotales = usimDevoluciones.length;
    const usosTotales = usimUsos.length;
    const balanceActivo = Math.max(0, usosTotales - devolucionesTotales);

    return {
      timeline: rows,
      usosTotales,
      devolucionesTotales,
      balanceActivo,
      actividadPromedio: rows.length ? (actividadTotal / rows.length).toFixed(1) : "0.0",
    };
  }, [usimUsos, usimDevoluciones]);

  const tipoGestionMetricas = useMemo(() => {
    const buckets = {
      solicitud: { label: "Solicitud", count: 0, color: "cyan" },
      cambio: { label: "Cambio SIM", count: 0, color: "violet" },
      plan: { label: "Plan nuevo", count: 0, color: "amber" },
    };

    usimUsos.forEach((item) => {
      const key = getTipoGestionKey(item);
      buckets[key].count += 1;
    });

    const rows = Object.values(buckets);
    const max = Math.max(1, ...rows.map((row) => row.count));

    return rows.map((row) => ({
      ...row,
      pulseCount: Math.max(3, Math.min(10, Math.round((row.count / max) * 10))),
    }));
  }, [usimUsos]);

  return (
    <section className="history-shell">
      <div className="history-card">
        <header className="history-card-head">
          <div className="history-title-wrap">
            <p className="history-kicker">Resumen uSIMs</p>
            <h2 className="history-title">Mi Historial uSIM</h2>
            <p className="history-subtitle">Consulta usos y devoluciones de tus uSIMs fisicas.</p>
          </div>

          <div className="history-summary">
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
                <label className="history-filter-label" htmlFor="historialUsimFiltroInput">
                  Buscar por numero, cedula o pedido
                </label>
                <input
                  id="historialUsimFiltroInput"
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
                      <p className="history-ops-kicker">Radar personal</p>
                      <h3 className="history-ops-title">Radar de actividad uSIM</h3>
                    </div>
                    <div className="history-ops-pill">
                      {userEmail ? userEmail.split("@")[0].toUpperCase() : "USER"}
                    </div>
                  </div>

                  <div className="history-ops-radar">
                    <div className="history-ops-radar-copy">
                      <span>Usos {actividadMetricas.usosTotales}</span>
                      <span>Devoluciones {actividadMetricas.devolucionesTotales}</span>
                      <span>Balance {actividadMetricas.balanceActivo}</span>
                    </div>
                    <UsimPieChart
                      usadas={actividadMetricas.usosTotales}
                      devueltas={actividadMetricas.devolucionesTotales}
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
                            <linearGradient id="historyUsimUseFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#ff0040" stopOpacity={0.44} />
                              <stop offset="100%" stopColor="#ff0040" stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="historyUsimRetFill" x1="0" y1="0" x2="0" y2="1">
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
                              border: "1px solid rgba(255, 0, 64, 0.25)",
                              borderRadius: 10,
                              color: "#ffe0e8",
                            }}
                          />
                          <Area type="monotone" dataKey="usos" stroke="#ff0040" fill="url(#historyUsimUseFill)" strokeWidth={2.2} />
                          <Area type="monotone" dataKey="devoluciones" stroke="#bd34fe" fill="url(#historyUsimRetFill)" strokeWidth={2.2} />
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
                      {usimUsos.length} total
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
                              <th>Estado</th>
                              <th>Nota admin</th>
                              <th>Acciones</th>
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
                                <td>{formatEstadoRevision(item.estadoRevision)}</td>
                                <td>{item.notaAdmin || "-"}</td>
                                <td>
                                  {item.estadoRevision === "correccion" ? (
                                    <button type="button" className="history-table-action" onClick={() => openEditModal(item)}>
                                      Editar
                                    </button>
                                  ) : (
                                    "-"
                                  )}
                                </td>
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

      {editUso && (
        <div
          role="dialog"
          aria-modal="true"
          className="history-modal"
          style={{ position: "fixed", inset: 0, background: "rgba(6, 8, 16, 0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 40 }}
        >
          <div style={{ width: "min(520px, 96vw)", background: "#0d141f", borderRadius: 18, padding: 18, border: "1px solid rgba(255, 0, 64, 0.3)", boxShadow: "0 16px 32px rgba(1, 6, 12, 0.7)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, color: "#ff9bb5", fontWeight: 800, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>Correccion requerida</p>
                <h3 style={{ margin: "6px 0 0", color: "#fff" }}>Editar uSIM {editUso.serie || ""}</h3>
              </div>
              <button type="button" onClick={closeEditModal} style={{ background: "transparent", border: "none", color: "#9fb1c5", fontSize: 22, cursor: "pointer" }}>
                ×
              </button>
            </div>

            {editUso.notaAdmin && (
              <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: "rgba(255, 0, 64, 0.12)", border: "1px solid rgba(255, 0, 64, 0.3)", color: "#ffd6e0", fontSize: 13 }}>
                Nota del admin: {editUso.notaAdmin}
              </div>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6, color: "#dbe7f5", fontSize: 13 }}>
                Tipo de gestion
                <select value={editTipoGestion} onChange={(e) => setEditTipoGestion(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.1)", background: "#111a28", color: "#f7fbff" }}>
                  <option value={REQUEST_MODES.normal}>Solicitud con pedido</option>
                  <option value={REQUEST_MODES.komercial}>Cambio SIM por Komercial</option>
                  <option value={REQUEST_MODES.planNuevoKomercial}>Plan nuevo en Komercial</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6, color: "#dbe7f5", fontSize: 13 }}>
                Pedido
                <input value={editPedido} onChange={(e) => setEditPedido(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.1)", background: "#111a28", color: "#f7fbff" }} />
              </label>

              <label style={{ display: "grid", gap: 6, color: "#dbe7f5", fontSize: 13 }}>
                Numero
                <input value={editNumero} onChange={(e) => setEditNumero(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.1)", background: "#111a28", color: "#f7fbff" }} />
              </label>

              <label style={{ display: "grid", gap: 6, color: "#dbe7f5", fontSize: 13 }}>
                Cedula
                <input value={editCedula} onChange={(e) => setEditCedula(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.1)", background: "#111a28", color: "#f7fbff" }} />
              </label>
            </div>

            {editFeedback && (
              <div style={{ marginTop: 12, color: "#ffb4c4", fontSize: 12 }}>{editFeedback}</div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button type="button" onClick={closeEditModal} style={{ background: "transparent", border: "1px solid rgba(255, 255, 255, 0.2)", color: "#cfe2f7", borderRadius: 10, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="button" onClick={handleGuardarCorreccion} disabled={editSaving} style={{ background: editSaving ? "#441018" : "#ff0040", border: "none", color: "#fff", borderRadius: 10, padding: "8px 16px", fontWeight: 800, cursor: editSaving ? "not-allowed" : "pointer" }}>
                {editSaving ? "Guardando..." : "Enviar correccion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
