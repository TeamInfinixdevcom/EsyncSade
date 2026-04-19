import React, { useEffect, useState } from "react";

import { collection, query, where, getDocs, doc, runTransaction, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";
import { getUserAgency, isGeneralAdmin, normalizeAgency } from "./userProfile";
import "./forms.css";

const REQUEST_MODES = {
  normal: "normal",
  komercial: "komercial",
};

const LOW_STOCK_THRESHOLD = 15;

export default function EsimRequestForm({ user }) {
  const [requestMode, setRequestMode] = useState(REQUEST_MODES.normal);
  const [pedido, setPedido] = useState("");
  const [numero, setNumero] = useState("");
  const [cedula, setCedula] = useState("");
  const [msg, setMsg] = useState("");
  const [esimsDisponibles, setEsimsDisponibles] = useState(null);
  const [cargandoDisponibles, setCargandoDisponibles] = useState(false);
  const [errorDisponibles, setErrorDisponibles] = useState("");
  const [agenciasDisponibles, setAgenciasDisponibles] = useState([]);
  const [agenciaSeleccionada, setAgenciaSeleccionada] = useState("");

  const [serieAsignada, setSerieAsignada] = useState("");
  const agenciaUsuario = getUserAgency(user);
  const adminGeneral = isGeneralAdmin(user);
  const agenciaActiva = adminGeneral ? normalizeAgency(agenciaSeleccionada) : agenciaUsuario;

  useEffect(() => {
    if (!adminGeneral) {
      setAgenciasDisponibles([]);
      setAgenciaSeleccionada("");
      return;
    }

    const qAgencias = query(
      collection(db, "esims"),
      where("estado", "==", "disponible")
    );

    const unsubscribe = onSnapshot(
      qAgencias,
      (snap) => {
        const agenciesSet = new Set();
        snap.forEach((docu) => {
          const agency = normalizeAgency(docu.data().agencia);
          if (agency) agenciesSet.add(agency);
        });

        const orderedAgencies = Array.from(agenciesSet).sort((a, b) => a.localeCompare(b));
        setAgenciasDisponibles(orderedAgencies);

        setAgenciaSeleccionada((prev) => {
          const current = normalizeAgency(prev);
          if (current && orderedAgencies.includes(current)) return current;

          const agencyFromProfile = normalizeAgency(agenciaUsuario);
          if (agencyFromProfile && orderedAgencies.includes(agencyFromProfile)) return agencyFromProfile;

          return orderedAgencies[0] || "";
        });
      },
      () => {
        setAgenciasDisponibles([]);
        setAgenciaSeleccionada("");
      }
    );

    return () => unsubscribe();
  }, [adminGeneral, agenciaUsuario]);

  useEffect(() => {
    if (!agenciaActiva) {
      setEsimsDisponibles(null);
      setErrorDisponibles("");
      setCargandoDisponibles(false);
      return;
    }

    setCargandoDisponibles(true);
    setErrorDisponibles("");

    const qDisponibles = query(
      collection(db, "esims"),
      where("estado", "==", "disponible"),
      where("agencia", "==", agenciaActiva)
    );

    const unsubscribe = onSnapshot(
      qDisponibles,
      (snap) => {
        setEsimsDisponibles(snap.size);
        setCargandoDisponibles(false);
      },
      () => {
        setErrorDisponibles(`No se pudo cargar el inventario de eSIMs para la agencia ${agenciaActiva}.`);
        setCargandoDisponibles(false);
      }
    );

    return () => unsubscribe();
  }, [agenciaActiva]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    const pedidoLimpio = pedido.trim();
    const numeroLimpio = numero.trim();
    const cedulaLimpia = cedula.trim();
    const isCambioKomercial = requestMode === REQUEST_MODES.komercial;
    const agencia = agenciaActiva;

    if (!agencia) {
      setMsg(
        adminGeneral
          ? "Error: Debes seleccionar una agencia para solicitar la eSIM."
          : "Error: Tu usuario no tiene agencia asignada. Contacta al administrador general."
      );
      return;
    }

    if (!numeroLimpio || !cedulaLimpia) {
      setMsg("Error: Debes completar numero y cedula del cliente.");
      return;
    }

    if (!isCambioKomercial && !pedidoLimpio) {
      setMsg("Error: Debes ingresar numero de pedido.");
      return;
    }

    try {
      let serie = "";
      await runTransaction(db, async (transaction) => {
        const q = query(
          collection(db, "esims"),
          where("estado", "==", "disponible"),
          where("agencia", "==", agencia)
        );
        const snap = await getDocs(q);
        if (snap.empty) throw new Error(`No hay eSIMs disponibles en la agencia ${agencia}`);
        const esimDoc = snap.docs[0];
        serie = esimDoc.data().serie;
        const usuario = auth.currentUser?.email || "";
        const fecha = new Date().toISOString();
        const tipoGestion = isCambioKomercial ? "cambio_sim_komercial" : "solicitud_normal";
        const detalleGestion = isCambioKomercial ? "Cambio SIM por Komercial" : "Solicitud con pedido";

        transaction.update(esimDoc.ref, {
          estado: "usada",
          pedido: isCambioKomercial ? "" : pedidoLimpio,
          numero: numeroLimpio,
          cedula: cedulaLimpia,
          fechaUso: fecha,
          agencia,
          tipoGestion,
          detalleGestion,
        });

        transaction.set(doc(collection(db, "solicitudes")), {
          serie,
          pedido: isCambioKomercial ? "" : pedidoLimpio,
          numero: numeroLimpio,
          cedula: cedulaLimpia,
          usuario,
          fecha,
          agencia,
          tipoGestion,
          detalleGestion,
          pedidoPendiente: isCambioKomercial,
        });
      });

      setSerieAsignada(serie);
      try {
        await navigator.clipboard.writeText(serie);
      } catch {
        // Evita interrumpir el flujo si el navegador bloquea el portapapeles.
      }

      setMsg(
        isCambioKomercial
          ? "Cambio SIM por Komercial registrado. La serie fue copiada al portapapeles."
          : "Solicitud enviada correctamente. La serie fue copiada al portapapeles."
      );

      setPedido("");
      setNumero("");
      setCedula("");
    } catch (err) {
      setMsg("Error: " + (err.message || "al enviar la solicitud."));
    }
  };

  const msgIsError = msg.toLowerCase().startsWith("error");
  const isCambioKomercial = requestMode === REQUEST_MODES.komercial;
  const isLowStock =
    !cargandoDisponibles &&
    typeof esimsDisponibles === "number" &&
    esimsDisponibles <= LOW_STOCK_THRESHOLD;

  return (
    <div className="form-screen">
      <form onSubmit={handleSubmit} className="form-card">
        <p className="form-kicker">Asignacion automatica</p>
        <h2 className="form-title">Solicitar eSIM</h2>
        <p className="form-subtitle">
          Selecciona el tipo de gestion y el sistema asignara la siguiente serie disponible.
        </p>

        {adminGeneral && (
          <div className="form-field" style={{ marginBottom: 12 }}>
            <label className="form-label" htmlFor="agenciaSolicitud">Agencia (punto) para rebajar inventario</label>
            <select
              id="agenciaSolicitud"
              className="form-input"
              value={agenciaSeleccionada}
              onChange={(e) => setAgenciaSeleccionada(e.target.value)}
              required
            >
              {agenciasDisponibles.length === 0 ? (
                <option value="">No hay agencias con eSIMs disponibles</option>
              ) : (
                agenciasDisponibles.map((agencia) => (
                  <option key={agencia} value={agencia}>{agencia}</option>
                ))
              )}
            </select>
            <p className="form-hint" style={{ marginTop: 8 }}>
              Como admin general, aqui defines desde que punto/agencia se descuenta la eSIM.
            </p>
          </div>
        )}

        {agenciaActiva && (
          <div className={`form-availability ${isLowStock ? "is-low-stock" : ""}`}>
            <span className="form-availability__label">Quedan disponibles en {agenciaActiva}</span>
            <span className="form-availability__value">
              {cargandoDisponibles ? "Cargando..." : esimsDisponibles ?? 0}
            </span>
          </div>
        )}

        {agenciaActiva && isLowStock && (
          <div className="form-stock-alert">
            Alerta: quedan {esimsDisponibles} eSIMs disponibles en {agenciaActiva}.
          </div>
        )}

        {errorDisponibles && (
          <div className="form-feedback is-error">
            {errorDisponibles}
          </div>
        )}

        <div className="form-tabs">
          <button
            type="button"
            className={`form-tab ${requestMode === REQUEST_MODES.normal ? "is-active" : ""}`}
            onClick={() => setRequestMode(REQUEST_MODES.normal)}
          >
            Solicitud con pedido
          </button>
          <button
            type="button"
            className={`form-tab ${requestMode === REQUEST_MODES.komercial ? "is-active" : ""}`}
            onClick={() => setRequestMode(REQUEST_MODES.komercial)}
          >
            Cambio SIM por Komercial
          </button>
        </div>

        <div className="form-grid">
          {isCambioKomercial ? (
            <p className="form-hint">
              En este modo no se requiere pedido. El sistema registrara la gestion como Cambio SIM por Komercial.
            </p>
          ) : (
            <div className="form-field">
              <label className="form-label" htmlFor="pedido">Numero de pedido</label>
              <input
                id="pedido"
                className="form-input"
                type="text"
                placeholder="Ejemplo: PED-000123"
                value={pedido}
                onChange={(e) => setPedido(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-field">
            <label className="form-label" htmlFor="numero">Numero de cliente</label>
            <input
              id="numero"
              className="form-input"
              type="text"
              placeholder="Ejemplo: 87889999"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="cedula">Cedula del cliente</label>
            <input
              id="cedula"
              className="form-input"
              type="text"
              placeholder="Ejemplo: 1-2345-6789"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" disabled={!agenciaActiva} className="form-button form-button--primary">
          {isCambioKomercial ? "Registrar cambio SIM" : "Generar solicitud"}
        </button>

        {serieAsignada && (
          <div className="form-feedback is-info">
            Serie asignada: <span className="form-code">{serieAsignada}</span>
          </div>
        )}

        {msg && (
          <div className={`form-feedback ${msgIsError ? "is-error" : "is-success"}`}>
            {msg}
          </div>
        )}
      </form>
    </div>
  );
}
