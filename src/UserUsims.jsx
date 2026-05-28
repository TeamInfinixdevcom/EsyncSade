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

const PAGE_SIZE = 10;

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
  const [usimLoteIds, setUsimLoteIds] = useState(null);
  const [selectedUsimId, setSelectedUsimId] = useState("");
  const [requestMode, setRequestMode] = useState(REQUEST_MODES.normal);
  const [pedido, setPedido] = useState("");
  const [numero, setNumero] = useState("");
  const [cedula, setCedula] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [usimTransferencias, setUsimTransferencias] = useState([]);
  const [pageAsignadas, setPageAsignadas] = useState(1);
  const [pageUsadas, setPageUsadas] = useState(1);
  const [pageTransferencias, setPageTransferencias] = useState(1);

  const currentUserId = auth.currentUser?.uid || user?.id || "";
  const currentUserEmail = (user?.email || auth.currentUser?.email || "").trim().toLowerCase();
  const agenciaUsuario = getUserAgency(user);
  const usims = useMemo(() => {
    const merged = mergeById([...usimsByUid, ...usimsByEmail]);
    if (usimLoteIds === null) return merged;
    return merged.filter((usim) =>
      !usim.loteId || usimLoteIds.has(usim.loteId)
    );
  }, [usimsByUid, usimsByEmail, usimLoteIds]);
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
    if (!agenciaUsuario) {
      setUsimLoteIds(null);
      return undefined;
    }

    const lotesQuery = query(collection(db, "usim_lotes"), where("agencia", "==", agenciaUsuario));
    return onSnapshot(lotesQuery, (snap) => {
      const ids = new Set();
      snap.docs.forEach((docu) => ids.add(docu.id));
      setUsimLoteIds(ids);
    });
  }, [agenciaUsuario]);

  useEffect(() => {
    if (!currentUserId && !currentUserEmail) return;

    const q = query(collection(db, "usim_transferencias"), 
      where(currentUserId ? "usuarioDestinoUid" : "usuarioDestinoEmail", "==", currentUserId || currentUserEmail)
    );
    return onSnapshot(q, (snap) => {
      const transferenciasIn = snap.docs.map((docu) => ({ id: docu.id, tipo: "recibida", ...docu.data() }));
      
      const q2 = query(collection(db, "usim_transferencias"), 
        where(currentUserId ? "usuarioOrigenUid" : "usuarioOrigenEmail", "==", currentUserId || currentUserEmail)
      );
      onSnapshot(q2, (snap2) => {
        const transferenciasOut = snap2.docs.map((docu) => ({ id: docu.id, tipo: "enviada", ...docu.data() }));
        setUsimTransferencias([...transferenciasIn, ...transferenciasOut].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
        setPageTransferencias(1);
      });
    });
  }, [currentUserId, currentUserEmail]);

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
        estadoRevision: "pendiente",
        notaAdmin: "",
        fechaRevision: null,
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
      <div className="form-card" style={{ width: "min(980px, 96vw)", maxWidth: 980, "--form-accent": "#ff0055", "--form-accent-secondary": "#ff3377", "--form-accent-glow": "rgba(255, 0, 85, 0.28)" }}>
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
                <tr style={{ color: "#ffe0e8", background: "rgba(255, 0, 64, 0.18)" }}>
                  <th style={{ textAlign: "left", padding: 10 }}>Serie</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Lote</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Asignacion</th>
                  <th style={{ textAlign: "center", padding: 10 }}>Accion</th>
                </tr>
              </thead>
              <tbody>
                {usimsAsignadas.slice((pageAsignadas - 1) * PAGE_SIZE, pageAsignadas * PAGE_SIZE).map((usim) => (
                  <tr key={usim.id} style={{ borderBottom: "1px solid rgba(255, 0, 64, 0.16)", background: selectedUsimId === usim.id ? "rgba(255, 0, 64, 0.12)" : "transparent" }}>
                    <td style={{ padding: 10, fontFamily: "monospace", color: "#ffc0d0", fontWeight: 800 }}>{usim.serie}</td>
                    <td style={{ padding: 10, color: "#ffb0c0" }}>{usim.loteId || "-"}</td>
                    <td style={{ padding: 10, color: "#ffb0c0" }}>{usim.fechaAsignacion ? new Date(usim.fechaAsignacion).toLocaleString("es-CR") : "-"}</td>
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
            {usimsAsignadas.length > PAGE_SIZE && (
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12, alignItems: "center" }}>
                <button 
                  onClick={() => setPageAsignadas(pageAsignadas - 1)} 
                  disabled={pageAsignadas === 1}
                  style={{ background: "#ff0040", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 700, cursor: pageAsignadas === 1 ? "not-allowed" : "pointer", opacity: pageAsignadas === 1 ? 0.5 : 1 }}
                >
                  Anterior
                </button>
                <span style={{ color: "#ffb0c0", fontWeight: 700 }}>Página {pageAsignadas} de {Math.ceil(usimsAsignadas.length / PAGE_SIZE)}</span>
                <button 
                  onClick={() => setPageAsignadas(pageAsignadas + 1)} 
                  disabled={pageAsignadas >= Math.ceil(usimsAsignadas.length / PAGE_SIZE)}
                  style={{ background: "#ff0040", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 700, cursor: pageAsignadas >= Math.ceil(usimsAsignadas.length / PAGE_SIZE) ? "not-allowed" : "pointer", opacity: pageAsignadas >= Math.ceil(usimsAsignadas.length / PAGE_SIZE) ? 0.5 : 1 }}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}

        {usimsUsadas.length > 0 && (
          <div style={{ overflowX: "auto", position: "relative", zIndex: 1, marginBottom: 18 }}>
            <h3 style={{ color: "#ffe0e8", fontSize: "1rem", margin: "0 0 10px" }}>uSIMs Usadas</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(8, 14, 24, 0.72)", borderRadius: 12, overflow: "hidden", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#ffe0e8", background: "rgba(255, 0, 64, 0.15)" }}>
                  <th style={{ textAlign: "left", padding: 10 }}>Serie</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Pedido</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Numero</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Cedula</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Fecha uso</th>
                  <th style={{ textAlign: "center", padding: 10 }}>Accion</th>
                </tr>
              </thead>
              <tbody>
                {usimsUsadas.slice((pageUsadas - 1) * PAGE_SIZE, pageUsadas * PAGE_SIZE).map((usim) => (
                  <tr key={usim.id} style={{ borderBottom: "1px solid rgba(255, 0, 64, 0.16)" }}>
                    <td style={{ padding: 10, fontFamily: "monospace", color: "#ffc0d0", fontWeight: 800 }}>{usim.serie}</td>
                    <td style={{ padding: 10, color: "#ffb0c0" }}>{usim.pedido || "-"}</td>
                    <td style={{ padding: 10, color: "#ffb0c0" }}>{usim.numero || "-"}</td>
                    <td style={{ padding: 10, color: "#ffb0c0" }}>{usim.cedula || "-"}</td>
                    <td style={{ padding: 10, color: "#ffb0c0" }}>{usim.fechaUso ? new Date(usim.fechaUso).toLocaleString("es-CR") : "-"}</td>
                    <td style={{ padding: 10, textAlign: "center" }}>
                      <button type="button" className="form-tab" onClick={() => handleDevolver(usim)} disabled={loading} style={{ width: "auto", padding: "0.45rem 0.7rem" }}>
                        Devolver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {usimsUsadas.length > PAGE_SIZE && (
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12, alignItems: "center" }}>
                <button 
                  onClick={() => setPageUsadas(pageUsadas - 1)} 
                  disabled={pageUsadas === 1}
                  style={{ background: "#ff0040", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 700, cursor: pageUsadas === 1 ? "not-allowed" : "pointer", opacity: pageUsadas === 1 ? 0.5 : 1 }}
                >
                  Anterior
                </button>
                <span style={{ color: "#ffb0c0", fontWeight: 700 }}>Página {pageUsadas} de {Math.ceil(usimsUsadas.length / PAGE_SIZE)}</span>
                <button 
                  onClick={() => setPageUsadas(pageUsadas + 1)} 
                  disabled={pageUsadas >= Math.ceil(usimsUsadas.length / PAGE_SIZE)}
                  style={{ background: "#ff0040", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 700, cursor: pageUsadas >= Math.ceil(usimsUsadas.length / PAGE_SIZE) ? "not-allowed" : "pointer", opacity: pageUsadas >= Math.ceil(usimsUsadas.length / PAGE_SIZE) ? 0.5 : 1 }}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}

        {usimTransferencias.length > 0 && (
          <div style={{ overflowX: "auto", position: "relative", zIndex: 1, marginBottom: 18 }}>
            <h3 style={{ color: "#ffe0e8", fontSize: "1rem", margin: "0 0 10px" }}>Mi historial de uSIM</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(8, 14, 24, 0.72)", borderRadius: 12, overflow: "hidden", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#ffe0e8", background: "rgba(255, 0, 64, 0.15)" }}>
                  <th style={{ textAlign: "left", padding: 10 }}>Fecha</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Serie</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Tipo</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Usuario origen</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Usuario destino</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Admin</th>
                </tr>
              </thead>
              <tbody>
                {usimTransferencias
                  .slice((pageTransferencias - 1) * PAGE_SIZE, pageTransferencias * PAGE_SIZE)
                  .map((transfer) => (
                  <tr key={transfer.id} style={{ borderBottom: "1px solid rgba(255, 0, 64, 0.16)" }}>
                    <td style={{ padding: 10, color: "#ffb0c0" }}>{transfer.fecha ? new Date(transfer.fecha).toLocaleString("es-CR") : "-"}</td>
                    <td style={{ padding: 10, fontFamily: "monospace", color: "#ffc0d0", fontWeight: 800 }}>{transfer.serie}</td>
                    <td style={{ padding: 10, color: transfer.tipo === "recibida" ? "#22c55e" : "#ff0040", fontWeight: 800 }}>
                      {transfer.tipo === "recibida" ? "Recibida" : "Enviada"}
                    </td>
                    <td style={{ padding: 10, color: "#ffb0c0" }}>{transfer.usuarioOrigenEmail || "-"}</td>
                    <td style={{ padding: 10, color: "#ffb0c0" }}>{transfer.usuarioDestinoEmail || "-"}</td>
                    <td style={{ padding: 10, color: "#ffb0c0" }}>{transfer.adminEmail || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {usimTransferencias.length > PAGE_SIZE && (
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12, alignItems: "center" }}>
                <button
                  onClick={() => setPageTransferencias(pageTransferencias - 1)}
                  disabled={pageTransferencias === 1}
                  style={{ background: "#ff0040", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 700, cursor: pageTransferencias === 1 ? "not-allowed" : "pointer", opacity: pageTransferencias === 1 ? 0.5 : 1 }}
                >
                  Anterior
                </button>
                <span style={{ color: "#ffb0c0", fontWeight: 700 }}>
                  Página {pageTransferencias} de {Math.ceil(usimTransferencias.length / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setPageTransferencias(pageTransferencias + 1)}
                  disabled={pageTransferencias >= Math.ceil(usimTransferencias.length / PAGE_SIZE)}
                  style={{ background: "#ff0040", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 700, cursor: pageTransferencias >= Math.ceil(usimTransferencias.length / PAGE_SIZE) ? "not-allowed" : "pointer", opacity: pageTransferencias >= Math.ceil(usimTransferencias.length / PAGE_SIZE) ? 0.5 : 1 }}
                >
                  Siguiente
                </button>
              </div>
            )}
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
