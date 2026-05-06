import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { db } from "./firebase";
import EsimPieChart from "./EsimPieChart";
import Barcode from "react-barcode";
import { getUserAgency, isGeneralAdmin, normalizeAgency, sameAgency } from "./userProfile";
import "./dashboard-monarch.css";

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isAvailableStatus(value) {
  return normalizeStatus(value) === "disponible";
}

function buildSignalVectors(count, variant = "returns") {
  const safeCount = Math.max(1, count);
  const total = Math.min(variant === "returns" ? 10 : 8, Math.max(4, Math.round(Math.log2(safeCount + 2) * 2.4)));
  const radius = variant === "returns" ? 42 : 38;

  return Array.from({ length: total }, (_, index) => {
    const angle = ((index / total) * Math.PI * 2) - Math.PI / 2;
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    const rotation = `${Math.atan2(50 - y, 50 - x)}rad`;
    const strength = 62 + ((index + safeCount) % 4) * 8;

    return {
      id: `${variant}-${index}`,
      x,
      y,
      angle: rotation,
      length: `${strength}px`,
      delay: `${(index % 5) * 0.32}s`,
      dim: index >= Math.ceil(total * 0.6),
    };
  });
}

function normalizeDateValue(value) {
  if (!value) return null;
  const raw = typeof value?.toDate === "function" ? value.toDate() : value;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function Dashboard({ user }) {
  const [disponibles, setDisponibles] = useState(0);
  const [usadas, setUsadas] = useState(0);
  const [total, setTotal] = useState(0);
  const [estadoPorAgencia, setEstadoPorAgencia] = useState([]);
  const [esimsSinAgencia, setEsimsSinAgencia] = useState(0);
  const [agenciaGraficaSeleccionada, setAgenciaGraficaSeleccionada] = useState("");
  const [devoluciones, setDevoluciones] = useState(0);
  const [solicitudesPorEjecutivo, setSolicitudesPorEjecutivo] = useState({});
  const [solicitudesActividad, setSolicitudesActividad] = useState([]);
  const [devolucionesActividad, setDevolucionesActividad] = useState([]);
  const [error, setError] = useState("");
  const [mostrarDetalleDisponibles, setMostrarDetalleDisponibles] = useState(false);
  const [detalleDisponibles, setDetalleDisponibles] = useState([]);
  const [cargandoDetalleDisponibles, setCargandoDetalleDisponibles] = useState(false);
  const [errorDetalleDisponibles, setErrorDetalleDisponibles] = useState("");
  const [filtroSerieDisponibles, setFiltroSerieDisponibles] = useState("");
  const agenciaUsuario = getUserAgency(user);
  const canSeeAll = isGeneralAdmin(user);

  useEffect(() => {
    if (!canSeeAll) {
      setAgenciaGraficaSeleccionada("");
      return;
    }

    if (estadoPorAgencia.length === 0) {
      setAgenciaGraficaSeleccionada("");
      return;
    }

    const existeSeleccion = estadoPorAgencia.some((row) => row.agencia === agenciaGraficaSeleccionada);
    if (!existeSeleccion) {
      setAgenciaGraficaSeleccionada(estadoPorAgencia[0].agencia);
    }
  }, [canSeeAll, estadoPorAgencia, agenciaGraficaSeleccionada]);

  useEffect(() => {
    setError("");

    const agenciaUsuarioNormalizada = normalizeAgency(agenciaUsuario);

    if (!canSeeAll && !agenciaUsuarioNormalizada) {
      setDisponibles(0);
      setUsadas(0);
      setTotal(0);
      setEstadoPorAgencia([]);
      setEsimsSinAgencia(0);
      return;
    }

    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        setError("La consulta de metricas esta tardando mas de lo esperado. Intenta recargar.");
      }
    }, 12000);

    const source = canSeeAll
      ? collection(db, "esims")
      : query(collection(db, "esims"), where("agencia", "==", agenciaUsuarioNormalizada));

    const unsub = onSnapshot(
      source,
      (snapshot) => {
        settled = true;
        clearTimeout(timeoutId);
        let disp = 0, used = 0;
        let sinAgencia = 0;
        const byAgency = new Map();

        snapshot.forEach(doc => {
          const data = doc.data();
          const estado = String(data.estado || "").trim().toLowerCase();
          
          // Excluir eSIMs reservadas del conteo de disponibles/usadas
          if (estado === "reservada") return;
          
          const disponible = isAvailableStatus(estado);

          const agencia = normalizeAgency(data.agencia);
          if (!agencia) {
            sinAgencia += 1;
            return;
          }

          if (disponible) disp++;
          else used++;

          const current = byAgency.get(agencia) || { disponibles: 0, usadas: 0, total: 0 };
          if (disponible) {
            current.disponibles += 1;
          } else {
            current.usadas += 1;
          }
          current.total += 1;
          byAgency.set(agencia, current);
        });

        const agrupado = Array.from(byAgency.entries())
          .map(([agencia, values]) => ({ agencia, ...values }))
          .sort((a, b) => a.agencia.localeCompare(b.agencia));

        setDisponibles(disp);
        setUsadas(used);
        setTotal(disp + used);
        setEstadoPorAgencia(agrupado);
        setEsimsSinAgencia(sinAgencia);
      },
      () => {
        settled = true;
        clearTimeout(timeoutId);
        setError("No se pudieron cargar las metricas de eSIMs.");
        setDisponibles(0);
        setUsadas(0);
        setTotal(0);
        setEstadoPorAgencia([]);
        setEsimsSinAgencia(0);
      }
    );
    return () => {
      clearTimeout(timeoutId);
      unsub();
    };
  }, [canSeeAll, agenciaUsuario]);

  const metricasVisibles = useMemo(() => {
    if (canSeeAll) {
      if (agenciaGraficaSeleccionada) {
        const seleccion = estadoPorAgencia.find((row) => row.agencia === agenciaGraficaSeleccionada);
        if (seleccion) {
          return {
            disponibles: seleccion.disponibles,
            usadas: seleccion.usadas,
            total: seleccion.total,
          };
        }
      }

      return { disponibles, usadas, total };
    }

    const metricaAgencia = estadoPorAgencia.find((row) => sameAgency(row.agencia, agenciaUsuario));
    if (metricaAgencia) {
      return {
        disponibles: metricaAgencia.disponibles,
        usadas: metricaAgencia.usadas,
        total: metricaAgencia.total,
      };
    }

    return { disponibles, usadas, total };
  }, [canSeeAll, agenciaGraficaSeleccionada, estadoPorAgencia, disponibles, usadas, total, agenciaUsuario]);

  const agenciaFiltroDisponibles = canSeeAll ? agenciaGraficaSeleccionada : agenciaUsuario;

  useEffect(() => {
    if (!mostrarDetalleDisponibles) return;

    const agenciaUsuarioNormalizada = normalizeAgency(agenciaUsuario);

    if (!canSeeAll && !agenciaUsuarioNormalizada) {
      setDetalleDisponibles([]);
      setErrorDetalleDisponibles("No tienes agencia asignada para consultar eSIMs disponibles.");
      setCargandoDetalleDisponibles(false);
      return;
    }

    setCargandoDetalleDisponibles(true);
    setErrorDetalleDisponibles("");
    setDetalleDisponibles([]);

    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        setCargandoDetalleDisponibles(false);
        setDetalleDisponibles([]);
        setErrorDetalleDisponibles("La consulta de eSIMs disponibles esta tardando mas de lo esperado. Intenta recargar.");
      }
    }, 12000);

    const constraints = [where("estado", "==", "disponible")];
    if (agenciaFiltroDisponibles) {
      constraints.push(where("agencia", "==", agenciaFiltroDisponibles));
    }

    const source = query(collection(db, "esims"), ...constraints);

    const unsub = onSnapshot(
      source,
      (snapshot) => {
        settled = true;
        clearTimeout(timeoutId);
        const rows = snapshot.docs
          .map((docu) => {
            const data = docu.data();
            const agencia = normalizeAgency(data.agencia);
            if (!agencia) return null;

            const serie = String(data.serie || "").trim();
            const codigoBarras = String(data.codigoBarras || data.barcode || serie).trim();

            return {
              id: docu.id,
              serie,
              codigoBarras,
              agencia,
              loteId: String(data.loteId || "").trim(),
              fechaCarga: data.fechaCarga || "",
            };
          })
          .filter(Boolean);

        setDetalleDisponibles(rows);
        setCargandoDetalleDisponibles(false);
      },
      () => {
        settled = true;
        clearTimeout(timeoutId);
        setErrorDetalleDisponibles("No se pudo cargar el detalle de eSIMs disponibles.");
        setDetalleDisponibles([]);
        setCargandoDetalleDisponibles(false);
      }
    );

    return () => {
      clearTimeout(timeoutId);
      unsub();
    };
  }, [mostrarDetalleDisponibles, canSeeAll, agenciaUsuario, agenciaFiltroDisponibles]);

  const detalleDisponiblesFiltrado = useMemo(() => {
    const filtro = filtroSerieDisponibles.trim().toLowerCase();
    const rowsOrdenadas = [...detalleDisponibles].sort((a, b) => a.serie.localeCompare(b.serie));

    if (!filtro) return rowsOrdenadas;

    return rowsOrdenadas.filter((row) => {
      const serie = String(row.serie || "").toLowerCase();
      const agencia = String(row.agencia || "").toLowerCase();
      return serie.includes(filtro) || agencia.includes(filtro);
    });
  }, [detalleDisponibles, filtroSerieDisponibles]);

  // Consultar y agrupar solicitudes por ejecutivo (email)
  useEffect(() => {
    if (!canSeeAll && !agenciaUsuario) {
      setSolicitudesPorEjecutivo({});
      return;
    }

    const source = canSeeAll
      ? collection(db, "solicitudes")
      : query(collection(db, "solicitudes"), where("agencia", "==", agenciaUsuario));

    const unsub = onSnapshot(
      source,
      (snapshot) => {
        const counts = {};
        const rows = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          const email = data.usuario;
          if (email) {
            counts[email] = (counts[email] || 0) + 1;
          }
          rows.push({
            fecha: data.fecha || "",
            agencia: normalizeAgency(data.agencia),
          });
        });
        setSolicitudesPorEjecutivo(counts);
        setSolicitudesActividad(rows);
      },
      () => {
        setError("No se pudieron cargar las solicitudes del equipo.");
      }
    );
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

    const unsub = onSnapshot(
      source,
      (snapshot) => {
        let totalDevoluciones = 0;
        const rows = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (canSeeAll || sameAgency(data.agencia, agenciaUsuario)) {
            totalDevoluciones += 1;
          }
          rows.push({
            fecha: data.fecha || "",
            agencia: normalizeAgency(data.agencia),
          });
        });
        setDevoluciones(totalDevoluciones);
        setDevolucionesActividad(rows);
      },
      () => {
        setError("No se pudieron cargar las devoluciones.");
      }
    );
    return () => unsub();
  }, [canSeeAll, agenciaUsuario]);

  const tasaUso = metricasVisibles.total === 0
    ? 0
    : Math.round((metricasVisibles.usadas / metricasVisibles.total) * 100);
  const agenciaActiva = canSeeAll
    ? estadoPorAgencia.find((row) => row.agencia === agenciaGraficaSeleccionada) || null
    : null;
  const requestEntries = useMemo(() => {
    return Object.entries(solicitudesPorEjecutivo)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10);
  }, [solicitudesPorEjecutivo]);
  const maxRequestCount = requestEntries[0]?.[1] || 1;
  const returnSignals = useMemo(() => buildSignalVectors(devoluciones, "returns"), [devoluciones]);
  const agencyPulseData = useMemo(() => {
    const timeline = new Map();
    const targetAgency = normalizeAgency(canSeeAll ? agenciaGraficaSeleccionada : agenciaUsuario);
    if (!targetAgency) return [];

    solicitudesActividad.forEach((item) => {
      if (!sameAgency(item.agencia, targetAgency)) return;
      const date = normalizeDateValue(item.fecha);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const current = timeline.get(key) || { solicitudes: 0, devoluciones: 0 };
      current.solicitudes += 1;
      timeline.set(key, current);
    });

    devolucionesActividad.forEach((item) => {
      if (!sameAgency(item.agencia, targetAgency)) return;
      const date = normalizeDateValue(item.fecha);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const current = timeline.get(key) || { solicitudes: 0, devoluciones: 0 };
      current.devoluciones += 1;
      timeline.set(key, current);
    });

    return Array.from(timeline.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([key, values]) => ({
        dia: new Date(`${key}T00:00:00`).toLocaleDateString("es-CR", { month: "2-digit", day: "2-digit" }),
        actividad: values.solicitudes + values.devoluciones,
        solicitudes: values.solicitudes,
        devoluciones: values.devoluciones,
      }));
  }, [canSeeAll, agenciaGraficaSeleccionada, agenciaUsuario, solicitudesActividad, devolucionesActividad]);
  const observationCards = useMemo(() => {
    if (estadoPorAgencia.length === 0) return [];

    const solicitudesPorAgencia = new Map();
    solicitudesActividad.forEach((item) => {
      if (!item.agencia) return;
      solicitudesPorAgencia.set(item.agencia, (solicitudesPorAgencia.get(item.agencia) || 0) + 1);
    });

    const devolucionesPorAgencia = new Map();
    devolucionesActividad.forEach((item) => {
      if (!item.agencia) return;
      devolucionesPorAgencia.set(item.agencia, (devolucionesPorAgencia.get(item.agencia) || 0) + 1);
    });

    const mayorActividad = [...estadoPorAgencia].sort((a, b) => {
      const actividadA = (solicitudesPorAgencia.get(a.agencia) || 0) + (devolucionesPorAgencia.get(a.agencia) || 0);
      const actividadB = (solicitudesPorAgencia.get(b.agencia) || 0) + (devolucionesPorAgencia.get(b.agencia) || 0);
      return actividadB - actividadA;
    })[0];

    const mayorRetorno = [...estadoPorAgencia].sort(
      (a, b) => (devolucionesPorAgencia.get(b.agencia) || 0) - (devolucionesPorAgencia.get(a.agencia) || 0)
    )[0];

    const inventarioCritico = [...estadoPorAgencia].sort((a, b) => a.disponibles - b.disponibles)[0];
    const mayorUso = [...estadoPorAgencia].sort((a, b) => {
      const usoA = a.total === 0 ? 0 : a.usadas / a.total;
      const usoB = b.total === 0 ? 0 : b.usadas / b.total;
      return usoB - usoA;
    })[0];

    return [
      {
        label: "Mayor actividad",
        agency: mayorActividad?.agencia || "-",
        value: `${(solicitudesPorAgencia.get(mayorActividad?.agencia) || 0) + (devolucionesPorAgencia.get(mayorActividad?.agencia) || 0)} eventos`,
        tone: "cyan",
      },
      {
        label: "Retorno mas alto",
        agency: mayorRetorno?.agencia || "-",
        value: `${devolucionesPorAgencia.get(mayorRetorno?.agencia) || 0} devoluciones`,
        tone: "violet",
      },
      {
        label: "Inventario critico",
        agency: inventarioCritico?.agencia || "-",
        value: `${inventarioCritico?.disponibles ?? 0} disponibles`,
        tone: "amber",
      },
      {
        label: "Mayor uso",
        agency: mayorUso?.agencia || "-",
        value: `${mayorUso?.total ? Math.round((mayorUso.usadas / mayorUso.total) * 100) : 0}% ocupacion`,
        tone: "red",
      },
    ];
  }, [estadoPorAgencia, solicitudesActividad, devolucionesActividad]);

  return (
    <div style={{ width: "100%", maxWidth: 1240, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 24, color: "#00fff7", textShadow: "0 2px 12px #00fff7cc, 0 0 2px #fff", fontWeight: 900, letterSpacing: 2 }}>
        Panel de control de EsyncSadeCloud
      </h2>
      {error && (
        <p style={{ marginTop: -8, marginBottom: 16, color: "#ffd1d1", fontWeight: 700 }}>{error}</p>
      )}
      {!canSeeAll && agenciaUsuario && (
        <p style={{ marginTop: -8, marginBottom: 16, color: "#c6f9f0", fontWeight: 700 }}>
          Vista filtrada por agencia: {agenciaUsuario}
        </p>
      )}
      {canSeeAll && agenciaActiva && (
        <p style={{ marginTop: -8, marginBottom: 16, color: "#c6f9f0", fontWeight: 700 }}>
          Mostrando metricas de agencia: {agenciaActiva.agencia}
        </p>
      )}
      {canSeeAll && esimsSinAgencia > 0 && (
        <p style={{ marginTop: -8, marginBottom: 16, color: "#ffd58c", fontWeight: 700 }}>
          Aviso: se detectaron {esimsSinAgencia} eSIMs sin agencia y se excluyeron del consolidado.
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
        <button
          type="button"
          onClick={() => setMostrarDetalleDisponibles((prev) => !prev)}
          style={{
            background: "#181818",
            borderRadius: 16,
            border: mostrarDetalleDisponibles ? "1px solid #00fff7" : "1px solid transparent",
            padding: 18,
            boxShadow: "0 0 16px 2px #00fff7cc",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: 14, color: "#00fff7", textShadow: "0 1px 8px #00fff7cc" }}>Disponibles</div>
          <div style={{ fontSize: 30, fontWeight: "bold", color: "#00fff7", textShadow: "0 1px 8px #00fff7cc" }}>{metricasVisibles.disponibles}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#b5fffb", fontWeight: 700 }}>
            {mostrarDetalleDisponibles ? "Ocultar lista y codigos" : "Ver lista y codigos de barras"}
          </div>
        </button>
        <div style={{ background: "#181818", borderRadius: 16, padding: 18, boxShadow: "0 0 16px 2px #ff3c2fcc" }}>
          <div style={{ fontSize: 14, color: "#ff3c2f", textShadow: "0 1px 8px #ff3c2fcc" }}>Usadas</div>
          <div style={{ fontSize: 30, fontWeight: "bold", color: "#ff3c2f", textShadow: "0 1px 8px #ff3c2fcc" }}>{metricasVisibles.usadas}</div>
        </div>
        <div style={{ background: "#181818", borderRadius: 16, padding: 18, boxShadow: "0 0 16px 2px #00fff7cc" }}>
          <div style={{ fontSize: 14, color: "#00fff7", textShadow: "0 1px 8px #00fff7cc" }}>Total</div>
          <div style={{ fontSize: 30, fontWeight: "bold", color: "#00fff7", textShadow: "0 1px 8px #00fff7cc" }}>{metricasVisibles.total}</div>
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

      {mostrarDetalleDisponibles && (
        <section
          className="barcode-print-area"
          style={{
            marginBottom: 24,
            background: "#f8fbff",
            color: "#0f1c2d",
            borderRadius: 16,
            border: "2px solid #00d9cf",
            boxShadow: "0 12px 30px #00132966",
            padding: 16,
          }}
        >
          <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: "#0f1c2d" }}>
                Inventario disponible{agenciaFiltroDisponibles ? ` - ${agenciaFiltroDisponibles}` : ""}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#2d4b68", fontWeight: 600 }}>
                Cada tarjeta muestra la serie y su codigo de barras (CODE128) listo para imprimir y escanear.
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                value={filtroSerieDisponibles}
                onChange={(e) => setFiltroSerieDisponibles(e.target.value)}
                placeholder="Buscar por serie o agencia"
                style={{ minWidth: 220, padding: "8px 10px", borderRadius: 8, border: "1px solid #6aa6c8", background: "#fff", color: "#0f1c2d", fontWeight: 600 }}
              />
              <button
                type="button"
                onClick={() => window.print()}
                style={{ background: "#0f1c2d", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontWeight: 800, cursor: "pointer" }}
              >
                Imprimir codigos
              </button>
            </div>
          </div>

          {errorDetalleDisponibles && (
            <div style={{ marginBottom: 12, color: "#8a1f24", fontWeight: 700, border: "1px solid #e6adb0", background: "#ffe9ea", borderRadius: 10, padding: "8px 10px" }}>
              {errorDetalleDisponibles}
            </div>
          )}

          {cargandoDetalleDisponibles ? (
            <div style={{ color: "#1a3650", fontWeight: 700 }}>Cargando eSIMs disponibles...</div>
          ) : detalleDisponiblesFiltrado.length === 0 ? (
            <div style={{ color: "#2d4b68", fontWeight: 700 }}>No hay eSIMs disponibles con ese filtro.</div>
          ) : (
            <div className="barcode-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 12 }}>
              {detalleDisponiblesFiltrado.map((item) => (
                <article
                  key={item.id}
                  className="barcode-ticket"
                  style={{
                    border: "1.5px solid #b8cfdf",
                    borderRadius: 12,
                    background: "#fff",
                    padding: 12,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#0f1c2d", letterSpacing: 0.3 }}>{item.serie}</div>
                  <div style={{ border: "1px dashed #8aa8c0", borderRadius: 8, padding: "6px 8px", background: "#f8fbff", overflowX: "auto" }}>
                    <Barcode
                      value={item.codigoBarras || item.serie}
                      format="CODE128"
                      height={52}
                      width={1.5}
                      margin={0}
                      background="transparent"
                      lineColor="#111111"
                      displayValue={false}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: "#324e67", fontWeight: 700 }}>Agencia: {item.agencia}</div>
                  <div style={{ fontSize: 12, color: "#476680" }}>Lote: {item.loteId || "Sin lote"}</div>
                  <div style={{ fontSize: 12, color: "#476680" }}>
                    Carga: {item.fechaCarga ? new Date(item.fechaCarga).toLocaleString() : "Sin fecha"}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        <div style={{ background: "#181818", borderRadius: 16, padding: 18, boxShadow: "0 0 16px 2px #00fff7cc", minHeight: 320 }}>
          <h3 style={{ fontSize: 18, marginBottom: 16, color: "#00fff7", textShadow: "0 1px 8px #00fff7cc" }}>
            {canSeeAll ? "Distribucion de estados por agencia" : "Distribucion de estados"}
          </h3>

          {canSeeAll ? (
            estadoPorAgencia.length === 0 ? (
              <div style={{ width: "100%", height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#00fff7" }}>
                Sin datos para graficar
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, color: "#c6f9f0", fontWeight: 700 }}>
                    Selecciona una agencia
                  </label>
                  <select
                    value={agenciaGraficaSeleccionada}
                    onChange={(e) => setAgenciaGraficaSeleccionada(e.target.value)}
                    style={{ width: "100%", maxWidth: 360, padding: 10, borderRadius: 8, border: "1.5px solid #00fff7", background: "#232323", color: "#fff", outline: "none" }}
                  >
                    {estadoPorAgencia.map((row) => (
                      <option key={row.agencia} value={row.agencia}>{row.agencia}</option>
                    ))}
                  </select>
                </div>

                {agenciaActiva ? (
                  <div style={{ border: "1px solid #00fff744", borderRadius: 12, padding: 10, background: "#141414" }}>
                    <div style={{ fontWeight: 800, color: "#dff" }}>{agenciaActiva.agencia}</div>
                    <div style={{ fontSize: 13, color: "#9cefee", marginTop: 2 }}>
                      Disponibles: {agenciaActiva.disponibles} | Usadas: {agenciaActiva.usadas} | Total: {agenciaActiva.total}
                    </div>
                    <EsimPieChart disponibles={agenciaActiva.disponibles} usadas={agenciaActiva.usadas} />
                    <div className="agency-pulse-panel">
                      <div className="agency-pulse-panel__head">
                        <strong>Pulso de actividad</strong>
                        <span>Ultimos 7 dias</span>
                      </div>
                      {agencyPulseData.length === 0 ? (
                        <div className="agency-pulse-panel__empty">Sin actividad reciente detectada</div>
                      ) : (
                        <div className="agency-pulse-chart">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={agencyPulseData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                              <defs>
                                <linearGradient id="agencyPulseFill" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#ffe066" stopOpacity={0.52} />
                                  <stop offset="100%" stopColor="#ffe066" stopOpacity={0.04} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid stroke="rgba(255, 224, 102, 0.08)" vertical={false} />
                              <XAxis dataKey="dia" tick={{ fill: "#f9ebb0", fontSize: 11 }} axisLine={false} tickLine={false} />
                              <YAxis allowDecimals={false} tick={{ fill: "#c9c39d", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                              <Tooltip
                                formatter={(value, name) => [
                                  `${value}`,
                                  name === "actividad" ? "Actividad" : name === "solicitudes" ? "Solicitudes" : "Devoluciones",
                                ]}
                                contentStyle={{
                                  background: "#15120a",
                                  border: "1px solid rgba(255, 224, 102, 0.26)",
                                  borderRadius: 10,
                                  color: "#fff6cc",
                                }}
                              />
                              <Area type="monotone" dataKey="actividad" stroke="#ffe066" fill="url(#agencyPulseFill)" strokeWidth={2.4} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                    {canSeeAll && observationCards.length > 0 && (
                      <div className="observation-grid">
                        <div className="observation-grid__title">Canales en observacion</div>
                        <div className="observation-grid__cards">
                          {observationCards.map((card, index) => (
                            <article
                              key={card.label}
                              className={`observation-card is-${card.tone}`}
                              style={{ "--delay": `${index * 0.16}s` }}
                            >
                              <span className="observation-card__label">{card.label}</span>
                              <strong className="observation-card__agency">{card.agency}</strong>
                              <span className="observation-card__value">{card.value}</span>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ width: "100%", height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#00fff7" }}>
                    Selecciona una agencia para ver la dona.
                  </div>
                )}
              </div>
            )
          ) : (
            <div>
              <EsimPieChart disponibles={metricasVisibles.disponibles} usadas={metricasVisibles.usadas} />
              <div className="agency-pulse-panel">
                <div className="agency-pulse-panel__head">
                  <strong>Pulso de actividad</strong>
                  <span>Ultimos 7 dias</span>
                </div>
                {agencyPulseData.length === 0 ? (
                  <div className="agency-pulse-panel__empty">Sin actividad reciente detectada</div>
                ) : (
                  <div className="agency-pulse-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={agencyPulseData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="agencyPulseFillUser" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffe066" stopOpacity={0.52} />
                            <stop offset="100%" stopColor="#ffe066" stopOpacity={0.04} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255, 224, 102, 0.08)" vertical={false} />
                        <XAxis dataKey="dia" tick={{ fill: "#f9ebb0", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: "#c9c39d", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip
                          formatter={(value, name) => [
                            `${value}`,
                            name === "actividad" ? "Actividad" : name === "solicitudes" ? "Solicitudes" : "Devoluciones",
                          ]}
                          contentStyle={{
                            background: "#15120a",
                            border: "1px solid rgba(255, 224, 102, 0.26)",
                            borderRadius: 10,
                            color: "#fff6cc",
                          }}
                        />
                        <Area type="monotone" dataKey="actividad" stroke="#ffe066" fill="url(#agencyPulseFillUser)" strokeWidth={2.4} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ops-panel ops-panel--violet" style={{ borderRadius: 16, padding: 18, minHeight: 320 }}>
          <div className="ops-panel__content">
            <h3 style={{ fontSize: 18, marginBottom: 16, color: "#bd34fe", textShadow: "0 1px 8px #bd34fecc" }}>Solicitudes por ejecutivo</h3>

            <div style={{ display: "grid", gap: 16 }}>
              <div className="returns-chamber" aria-hidden="true">
                <div className="returns-chamber__ring returns-chamber__ring--1" />
                <div className="returns-chamber__ring returns-chamber__ring--2" />
                <div className="returns-chamber__ring returns-chamber__ring--3" />
                <div className="returns-chamber__core" />
                {returnSignals.map((signal) => (
                  <span
                    key={signal.id}
                    className={`returns-chamber__trace ${signal.dim ? "is-dim" : ""}`}
                    style={{
                      "--start-x": `${signal.x}%`,
                      "--start-y": `${signal.y}%`,
                      "--trace-angle": signal.angle,
                      "--trace-length": signal.length,
                      "--delay": signal.delay,
                    }}
                  />
                ))}
                <div className="returns-chamber__overlay">
                  <span>Recovery Channel</span>
                  <span>{devoluciones} eSIMs devueltas</span>
                  <span>Retorno estable</span>
                </div>
              </div>

              {requestEntries.length === 0 ? (
                <div className="signal-matrix__empty">Sin actividad para escanear</div>
              ) : (
                <div className="signal-matrix">
                  {requestEntries.map(([email, count], index) => {
                    const alias = String(email || "sin-correo").split("@")[0];
                    const strength = `${Math.max(22, Math.round((count / maxRequestCount) * 100))}%`;

                    return (
                      <div
                        key={email}
                        className="signal-matrix__row"
                        style={{ "--strength": strength, "--delay": `${index * 0.18}s` }}
                      >
                        <div className="signal-matrix__meta">
                          <div className="signal-matrix__email">
                            <strong>{email}</strong>
                            <span>Canal {alias.toUpperCase()}</span>
                          </div>
                          <div className="signal-matrix__count">{count}</div>
                        </div>
                        <div className="signal-matrix__bar">
                          <div className="signal-matrix__bar-fill" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
