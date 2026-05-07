import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { getUserAgency } from "./userProfile";
import "./forms.css";

const REQUEST_MODES = {
  normal: "normal",
  komercial: "komercial",
  planNuevoKomercial: "plan_nuevo_komercial",
};

function mergeById(rows) {
  const merged = new Map();
  rows.forEach((row) => {
    if (row?.id) merged.set(row.id, row);
  });
  return Array.from(merged.values()).sort((a, b) => new Date(b.fechaAsignacion || 0) - new Date(a.fechaAsignacion || 0));
}

export default function UserUsims({ user }) {
  const [usimsByUid, setUsimsByUid] = useState([]);
  const [usimsByEmail, setUsimsByEmail] = useState([]);
  const [selectedUsimId, setSelectedUsimId] = useState("");
  const [requestMode, setRequestMode] = useState(REQUEST_MODES.normal);
  const [pedido, setPedido] = useState("");
  const [numero, setNumero] = useState("");
  const [cedula, setCedula] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const currentUserId = auth.currentUser?.uid || user?.id || "";
  const currentUserEmail = (user?.email || auth.currentUser?.email || "").trim().toLowerCase();
  const agenciaUsuario = getUserAgency(user);
  const usims = useMemo(() => mergeById([...usimsByUid, ...usimsByEmail]), [usimsByUid, usimsByEmail]);
  const selectedUsim = useMemo(
    () => usims.find((usim) => usim.id === selectedUsimId && usim.estado === "asignada") || null,
    [selectedUsimId, usims]
  );
  const usimsAsignadas = usims.filter((usim) => usim.estado === "asignada");
  const usimsUsadas = usims.filter((usim) => usim.estado === "usada");
  const msgIsError = mensaje.toLowerCase().startsWith("error") || mensaje.includes("Debes") || mensaje.includes("No se");
  const isCambioKomercial = requestMode === REQUEST_MODES.komercial;
  const isPlanNuevoKomercial = requestMode === REQUEST_MODES.planNuevoKomercial;

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    const q = query(collection(db, "usims"), where("asignadoAUid", "==", currentUserId));
    return onSnapshot(q, (snap) => {
      setUsimsByUid(snap.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
    });
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserEmail) {
      return undefined;
    }

    const q = query(collection(db, "usims"), where("asignadoAEmail", "==", currentUserEmail));
    return onSnapshot(q, (snap) => {
      setUsimsByEmail(snap.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
    });
  }, [currentUserEmail]);

  const resetForm = () => {
    setSelectedUsimId("");
    setPedido("");
    setNumero("");
    setCedula("");
    setRequestMode(REQUEST_MODES.normal);
  };

  const handleRegistrarUso = async (e) => {
    e.preventDefault();
    setMensaje("");

    if (!selectedUsim) {
      setMensaje("Debes seleccionar una uSIM asignada.");
      return;
    }

    const pedidoLimpio = pedido.trim();
    const numeroLimpio = numero.trim();
    const cedulaLimpia = cedula.trim();

    if (!pedidoLimpio && !numeroLimpio && !cedulaLimpia) {
      setMensaje("Debes completar al menos un dato: pedido, numero o cedula.");
      return;
    }

    setLoading(true);
    try {
      const fecha = new Date().toISOString();
      const usuario = currentUserEmail || "";
      const tipoGestion = isPlanNuevoKomercial
        ? "plan_nuevo_komercial"
        : isCambioKomercial
        ? "cambio_sim_komercial"
        : "solicitud_normal";
      const detalleGestion = isPlanNuevoKomercial
        ? "Plan nuevo en Komercial"
        : isCambioKomercial
        ? "Cambio SIM por Komercial"
        : "Solicitud con pedido";

      await updateDoc(doc(db, "usims", selectedUsim.id), {
        estado: "usada",
        fechaUso: fecha,
        usuarioUsoUid: currentUserId || null,
        usuarioUsoEmail: usuario || null,
        pedido: pedidoLimpio,
        numero: numeroLimpio,
        cedula: cedulaLimpia,
        tipoGestion,
        detalleGestion,
      });

      await addDoc(collection(db, "usim_usos"), {
        fecha,
        agencia: selectedUsim.agencia || agenciaUsuario,
        serie: selectedUsim.serie,
        loteId: selectedUsim.loteId || null,
        usimId: selectedUsim.id,
        usuarioUid: currentUserId || null,
        usuarioEmail: usuario || null,
        pedido: pedidoLimpio,
        numero: numeroLimpio,
        cedula: cedulaLimpia,
        tipoGestion,
        detalleGestion,
      });

      setMensaje(`uSIM ${selectedUsim.serie} registrada como usada.`);
      resetForm();
    } catch (err) {
      setMensaje(`Error: ${err?.message || "No se pudo registrar la uSIM."}`);
    }
    setLoading(false);
  };

  const handleDevolver = async (usim) => {
    if (!usim?.id) return;
    if (!window.confirm(`¿Devolver la uSIM ${usim.serie} a tu mazo asignado?`)) return;

    setLoading(true);
    setMensaje("");
    try {
      const fecha = new Date().toISOString();
      if (usim.estado !== "usada") {
        setMensaje("Primero debes registrar la uSIM como usada antes de devolverla.");
        setLoading(false);
        return;
      }

      await updateDoc(doc(db, "usims", usim.id), {
        estado: "asignada",
        asignadoAUid: usim.asignadoAUid || currentUserId || null,
        asignadoAEmail: usim.asignadoAEmail || currentUserEmail || null,
        fechaAsignacion: usim.fechaAsignacion || fecha,
        fechaUltimaDevolucion: fecha,
        devueltoPorUid: currentUserId || null,
        devueltoPorEmail: currentUserEmail || null,
        fechaUso: null,
        usuarioUsoUid: null,
        usuarioUsoEmail: null,
        pedido: null,
        numero: null,
        cedula: null,
        tipoGestion: null,
        detalleGestion: null,
      });

      await addDoc(collection(db, "usim_devoluciones"), {
        fecha,
        agencia: usim.agencia || agenciaUsuario,
        serie: usim.serie,
        loteId: usim.loteId || null,
        usimId: usim.id,
        usuarioUid: currentUserId || null,
        usuarioEmail: currentUserEmail || null,
      });

      if (selectedUsimId === usim.id) resetForm();
      setMensaje(`uSIM ${usim.serie} devuelta a tu mazo asignado.`);
    } catch (err) {
      setMensaje(`Error: ${err?.message || "No se pudo devolver la uSIM."}`);
    }
    setLoading(false);
  };

  return (
    <div className="form-screen">
      <div className="form-card" style={{ width: "min(980px, 96vw)", maxWidth: 980, "--form-accent": "#38bdf8", "--form-accent-secondary": "#7dd3fc", "--form-accent-glow": "rgba(56, 189, 248, 0.28)" }}>
        <div className="form-hero">
          <div className="form-hero__copy">
            <p className="form-kicker">Mazo fisico asignado</p>
            <h2 className="form-title">Mis uSIMs</h2>
            <p className="form-subtitle">
              Trabaja las SIM fisicas asignadas a tu usuario o devuelve al mazo las que no necesites.
            </p>
          </div>

          <div className="form-hero__visual" aria-hidden="true">
            <div className="form-orbit form-orbit--outer" />
            <div className="form-orbit form-orbit--mid" />
            <div className="form-orbit form-orbit--inner" />
            <div className="form-orbit-core" />
          </div>
        </div>

        <div className="form-availability">
          <div className="form-availability__scan" aria-hidden="true" />
          <span className="form-availability__label">Asignadas pendientes</span>
          <span className="form-availability__value">{usimsAsignadas.length}</span>
          <span className="form-availability__label">Usadas</span>
          <span className="form-availability__value">{usimsUsadas.length}</span>
          <span className="form-availability__label">Total en tu mazo</span>
          <span className="form-availability__value">{usimsAsignadas.length + usimsUsadas.length}</span>
        </div>

        {selectedUsim && (
          <form onSubmit={handleRegistrarUso} style={{ position: "relative", zIndex: 1, marginBottom: 18 }}>
            <div className="form-feedback is-info">
              uSIM seleccionada: <span className="form-code">{selectedUsim.serie}</span>
            </div>

            <p className="form-hint" style={{ margin: "12px 0 14px" }}>
              Completa pedido, numero o cedula. Con al menos un dato puedes registrar la uSIM como usada.
            </p>

            <div className="form-tabs" style={{ marginTop: 14 }}>
              <button type="button" className={`form-tab ${requestMode === REQUEST_MODES.normal ? "is-active" : ""}`} onClick={() => setRequestMode(REQUEST_MODES.normal)}>
                Solicitud con pedido
              </button>
              <button type="button" className={`form-tab ${requestMode === REQUEST_MODES.komercial ? "is-active" : ""}`} onClick={() => setRequestMode(REQUEST_MODES.komercial)}>
                Cambio SIM por Komercial
              </button>
              <button type="button" className={`form-tab ${requestMode === REQUEST_MODES.planNuevoKomercial ? "is-active" : ""}`} onClick={() => setRequestMode(REQUEST_MODES.planNuevoKomercial)}>
                Plan nuevo en Komercial
              </button>
            </div>

            <div className="form-grid">
              {!isCambioKomercial && (
                <div className="form-field">
                  <label className="form-label" htmlFor="pedidoUsim">Numero de pedido</label>
                  <input id="pedidoUsim" className="form-input" value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="Ejemplo: PED-000123" />
                </div>
              )}

              {!isPlanNuevoKomercial && (
                <div className="form-field">
                  <label className="form-label" htmlFor="numeroUsim">Numero de cliente</label>
                  <input id="numeroUsim" className="form-input" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ejemplo: 87889999" />
                </div>
              )}

              <div className="form-field">
                <label className="form-label" htmlFor="cedulaUsim">Cedula del cliente</label>
                <input id="cedulaUsim" className="form-input" value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="Ejemplo: 1-2345-6789" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="form-button form-button--primary">
              {loading ? "Registrando..." : "Registrar uso de uSIM"}
            </button>
          </form>
        )}

        {usimsAsignadas.length === 0 ? (
          <div className="form-feedback is-info">No tienes uSIMs asignadas pendientes.</div>
        ) : (
          <div style={{ overflowX: "auto", position: "relative", zIndex: 1, marginBottom: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(8, 14, 24, 0.72)", borderRadius: 12, overflow: "hidden", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#f7fbff", background: "rgba(56, 189, 248, 0.18)" }}>
                  <th style={{ textAlign: "left", padding: 10 }}>Serie</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Lote</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Asignacion</th>
                  <th style={{ textAlign: "center", padding: 10 }}>Accion</th>
                </tr>
              </thead>
              <tbody>
                {usimsAsignadas.map((usim) => (
                  <tr key={usim.id} style={{ borderBottom: "1px solid rgba(125, 211, 252, 0.16)", background: selectedUsimId === usim.id ? "rgba(56, 189, 248, 0.12)" : "transparent" }}>
                    <td style={{ padding: 10, fontFamily: "monospace", color: "#e0f7ff", fontWeight: 800 }}>{usim.serie}</td>
                    <td style={{ padding: 10, color: "#cdeeff" }}>{usim.loteId || "-"}</td>
                    <td style={{ padding: 10, color: "#cdeeff" }}>{usim.fechaAsignacion ? new Date(usim.fechaAsignacion).toLocaleString("es-CR") : "-"}</td>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className={`form-tab ${selectedUsimId === usim.id ? "is-active" : ""}`} onClick={() => setSelectedUsimId(usim.id)} style={{ width: "auto", padding: "0.45rem 0.7rem" }}>
                          Usar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {usimsUsadas.length > 0 && (
          <div style={{ overflowX: "auto", position: "relative", zIndex: 1, marginBottom: 18 }}>
            <h3 style={{ color: "#dff6ff", fontSize: "1rem", margin: "0 0 10px" }}>uSIMs usadas pendientes de devolución</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(8, 14, 24, 0.72)", borderRadius: 12, overflow: "hidden", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#f7fbff", background: "rgba(125, 211, 252, 0.15)" }}>
                  <th style={{ textAlign: "left", padding: 10 }}>Serie</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Pedido</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Numero</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Cedula</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Fecha uso</th>
                  <th style={{ textAlign: "center", padding: 10 }}>Accion</th>
                </tr>
              </thead>
              <tbody>
                {usimsUsadas.map((usim) => (
                  <tr key={usim.id} style={{ borderBottom: "1px solid rgba(125, 211, 252, 0.16)" }}>
                    <td style={{ padding: 10, fontFamily: "monospace", color: "#e0f7ff", fontWeight: 800 }}>{usim.serie}</td>
                    <td style={{ padding: 10, color: "#cdeeff" }}>{usim.pedido || "-"}</td>
                    <td style={{ padding: 10, color: "#cdeeff" }}>{usim.numero || "-"}</td>
                    <td style={{ padding: 10, color: "#cdeeff" }}>{usim.cedula || "-"}</td>
                    <td style={{ padding: 10, color: "#cdeeff" }}>{usim.fechaUso ? new Date(usim.fechaUso).toLocaleString("es-CR") : "-"}</td>
                    <td style={{ padding: 10, textAlign: "center" }}>
                      <button type="button" className="form-tab" onClick={() => handleDevolver(usim)} disabled={loading} style={{ width: "auto", padding: "0.45rem 0.7rem" }}>
                        Devolver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mensaje && (
          <div className={`form-feedback ${msgIsError ? "is-error" : "is-success"}`}>
            {mensaje}
          </div>
        )}
      </div>
    </div>
  );
}
