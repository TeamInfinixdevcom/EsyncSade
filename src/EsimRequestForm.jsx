import React, { useEffect, useState } from "react";

import { collection, query, where, getDocs, doc, runTransaction, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";
import { getUserAgency, isGeneralAdmin, normalizeAgency } from "./userProfile";
import "./forms.css";

const REQUEST_MODES = {
  normal: "normal",
  komercial: "komercial",
  planNuevoKomercial: "plan_nuevo_komercial",
};

const LOW_STOCK_THRESHOLD = 15;
const ASSIGNMENT_SEQUENCE = [
  "Buscando canal disponible...",
  "Verificando inventario...",
  "Asignando eSIM...",
  "Lock acquired",
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  const [submitting, setSubmitting] = useState(false);
  const [assignmentStep, setAssignmentStep] = useState("");
  const [activeField, setActiveField] = useState("");
  const [serieAsignada, setSerieAsignada] = useState("");
  const agenciaUsuario = getUserAgency(user);
  const adminGeneral = isGeneralAdmin(user);
  const agenciaActiva = normalizeAgency(adminGeneral ? agenciaSeleccionada : agenciaUsuario);
  const errorDisponiblesVisible = agenciaActiva ? errorDisponibles : "";

  useEffect(() => {
    if (!adminGeneral) {
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
      return;
    }

    const initTimerId = setTimeout(() => {
      setCargandoDisponibles(true);
      setErrorDisponibles("");
    }, 0);

    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        setCargandoDisponibles(false);
        setErrorDisponibles(`La consulta de inventario para ${agenciaActiva} esta tardando mas de lo esperado. Intenta recargar.`);
      }
    }, 12000);

    const qDisponibles = query(
      collection(db, "esims"),
      where("estado", "==", "disponible"),
      where("agencia", "==", agenciaActiva)
    );

    const unsubscribe = onSnapshot(
      qDisponibles,
      (snap) => {
        settled = true;
        clearTimeout(timeoutId);
        setEsimsDisponibles(snap.size);
        setCargandoDisponibles(false);
      },
      () => {
        settled = true;
        clearTimeout(timeoutId);
        setErrorDisponibles(`No se pudo cargar el inventario de eSIMs para la agencia ${agenciaActiva}.`);
        setEsimsDisponibles(0);
        setCargandoDisponibles(false);
      }
    );

    return () => {
      clearTimeout(initTimerId);
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [agenciaActiva]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setSerieAsignada("");

    const pedidoLimpio = pedido.trim();
    const numeroLimpio = numero.trim();
    const cedulaLimpia = cedula.trim();
    const isPlanNuevoKomercial = requestMode === REQUEST_MODES.planNuevoKomercial;
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

    if (!cedulaLimpia) {
      setMsg("Error: Debes completar la cedula del cliente.");
      return;
    }

    if (!isPlanNuevoKomercial && !numeroLimpio) {
      setMsg("Error: Debes completar numero del cliente.");
      return;
    }

    if (!isCambioKomercial && !isPlanNuevoKomercial && !pedidoLimpio) {
      setMsg("Error: Debes ingresar numero de pedido.");
      return;
    }

    if (isPlanNuevoKomercial && !pedidoLimpio) {
      setMsg("Error: Debes ingresar numero de pedido.");
      return;
    }

    try {
      setSubmitting(true);
      for (const [index, step] of ASSIGNMENT_SEQUENCE.entries()) {
        setAssignmentStep(step);
        await wait(index === ASSIGNMENT_SEQUENCE.length - 1 ? 220 : 300);
      }

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
        
        let tipoGestion, detalleGestion;
        if (isPlanNuevoKomercial) {
          tipoGestion = "plan_nuevo_komercial";
          detalleGestion = "Plan nuevo en Komercial";
        } else if (isCambioKomercial) {
          tipoGestion = "cambio_sim_komercial";
          detalleGestion = "Cambio SIM por Komercial";
        } else {
          tipoGestion = "solicitud_normal";
          detalleGestion = "Solicitud con pedido";
        }

        transaction.update(esimDoc.ref, {
          estado: "usada",
          pedido: (isCambioKomercial) ? "" : pedidoLimpio,
          numero: (isPlanNuevoKomercial) ? "" : numeroLimpio,
          cedula: cedulaLimpia,
          fechaUso: fecha,
          agencia,
          tipoGestion,
          detalleGestion,
        });

        transaction.set(doc(collection(db, "solicitudes")), {
          serie,
          pedido: (isCambioKomercial) ? "" : pedidoLimpio,
          numero: (isPlanNuevoKomercial) ? "" : numeroLimpio,
          cedula: cedulaLimpia,
          usuario,
          fecha,
          agencia,
          tipoGestion,
          detalleGestion,
          pedidoPendiente: (isCambioKomercial || isPlanNuevoKomercial),
        });
      });

      setSerieAsignada(serie);
      try {
        await navigator.clipboard.writeText(serie);
      } catch {
        // Evita interrumpir el flujo si el navegador bloquea el portapapeles.
      }

      const successMsg = isPlanNuevoKomercial
        ? "Plan nuevo en Komercial registrado. La serie fue copiada al portapapeles."
        : isCambioKomercial
        ? "Cambio SIM por Komercial registrado. La serie fue copiada al portapapeles."
        : "Solicitud enviada correctamente. La serie fue copiada al portapapeles.";

      setMsg(successMsg);

      setPedido("");
      setNumero("");
      setCedula("");
    } catch (err) {
      setMsg("Error: " + (err.message || "al enviar la solicitud."));
    } finally {
      setSubmitting(false);
      setTimeout(() => setAssignmentStep(""), 520);
    }
  };

  const msgIsError = msg.toLowerCase().startsWith("error");
  const isCambioKomercial = requestMode === REQUEST_MODES.komercial;
  const isPlanNuevoKomercial = requestMode === REQUEST_MODES.planNuevoKomercial;
  const modeVisualClass = isPlanNuevoKomercial
    ? "is-plan-mode"
    : isCambioKomercial
    ? "is-komercial-mode"
    : "is-normal-mode";
  const modeLabel = isPlanNuevoKomercial
    ? "Modo plan nuevo"
    : isCambioKomercial
    ? "Modo cambio"
    : "Modo solicitud";
  const modeDescription = isPlanNuevoKomercial
    ? "Ruta ligera para activaciones nuevas."
    : isCambioKomercial
    ? "Canal de reemplazo con flujo directo."
    : "Flujo estandar con pedido y cliente.";
  const isLowStock =
    !cargandoDisponibles &&
    typeof esimsDisponibles === "number" &&
    esimsDisponibles <= LOW_STOCK_THRESHOLD;

  return (
    <div className="form-screen">
      <form onSubmit={handleSubmit} className={`form-card ${modeVisualClass}`}>
        <div className="form-hero">
          <div className="form-hero__copy">
            <p className="form-kicker">Asignacion automatica</p>
            <h2 className="form-title">Solicitar eSIM</h2>
            <p className="form-subtitle">
              Selecciona el tipo de gestion y el sistema asignara la siguiente serie disponible.
            </p>
          </div>

          <div className="form-hero__visual" aria-hidden="true">
            <div className="form-orbit form-orbit--outer" />
            <div className="form-orbit form-orbit--mid" />
            <div className="form-orbit form-orbit--inner" />
            <div className="form-orbit-core" />
            <span className="form-orbit-blip form-orbit-blip--1" />
            <span className="form-orbit-blip form-orbit-blip--2" />
            <span className="form-orbit-blip form-orbit-blip--3" />
          </div>
        </div>

        <div className="form-mode-banner">
          <div>
            <strong>{modeLabel}</strong>
            <span>{modeDescription}</span>
          </div>
          <span className="form-mode-banner__pulse" />
        </div>

        {adminGeneral && (
          <div className="form-field" style={{ marginBottom: 12 }}>
            <label className="form-label" htmlFor="agenciaSolicitud">Agencia (punto) para rebajar inventario</label>
            <select
              id="agenciaSolicitud"
              className={`form-input ${activeField === "agencia" ? "is-focused" : ""}`}
              value={agenciaSeleccionada}
              onChange={(e) => setAgenciaSeleccionada(e.target.value)}
              onFocus={() => setActiveField("agencia")}
              onBlur={() => setActiveField("")}
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
            <div className="form-availability__scan" aria-hidden="true" />
            <span className="form-availability__label">Quedan disponibles en {agenciaActiva}</span>
            <span className={`form-availability__value ${cargandoDisponibles ? "is-loading" : ""}`}>
              {cargandoDisponibles ? "Cargando..." : esimsDisponibles ?? 0}
            </span>
          </div>
        )}

        {agenciaActiva && isLowStock && (
          <div className="form-stock-alert">
            Alerta: quedan {esimsDisponibles} eSIMs disponibles en {agenciaActiva}.
          </div>
        )}

        {errorDisponiblesVisible && (
          <div className="form-feedback is-error">
            {errorDisponiblesVisible}
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
          <button
            type="button"
            className={`form-tab ${requestMode === REQUEST_MODES.planNuevoKomercial ? "is-active" : ""}`}
            onClick={() => setRequestMode(REQUEST_MODES.planNuevoKomercial)}
          >
            Plan nuevo en Komercial
          </button>
        </div>

        <div className="form-grid">
          {isCambioKomercial ? (
            <p className="form-hint">
              En este modo no se requiere pedido. El sistema registrara la gestion como Cambio SIM por Komercial.
            </p>
          ) : isPlanNuevoKomercial ? (
            <p className="form-hint">
              En este modo solo se requiere cedula del cliente y pedido. El numero de linea sera asignado posteriormente por Komercial.
            </p>
          ) : null}

          {!isCambioKomercial && (
            <div className="form-field">
              <label className="form-label" htmlFor="pedido">Numero de pedido</label>
              <input
                id="pedido"
                className={`form-input ${activeField === "pedido" ? "is-focused" : ""}`}
                type="text"
                placeholder="Ejemplo: PED-000123"
                value={pedido}
                onChange={(e) => setPedido(e.target.value)}
                onFocus={() => setActiveField("pedido")}
                onBlur={() => setActiveField("")}
                required
              />
            </div>
          )}

          {!isPlanNuevoKomercial && (
            <div className="form-field">
              <label className="form-label" htmlFor="numero">Numero de cliente</label>
              <input
                id="numero"
                className={`form-input ${activeField === "numero" ? "is-focused" : ""}`}
                type="text"
                placeholder="Ejemplo: 87889999"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                onFocus={() => setActiveField("numero")}
                onBlur={() => setActiveField("")}
                required
              />
            </div>
          )}

          <div className="form-field">
            <label className="form-label" htmlFor="cedula">Cedula del cliente</label>
            <input
              id="cedula"
              className={`form-input ${activeField === "cedula" ? "is-focused" : ""}`}
              type="text"
              placeholder="Ejemplo: 1-2345-6789"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              onFocus={() => setActiveField("cedula")}
              onBlur={() => setActiveField("")}
              required
            />
          </div>
        </div>

        {assignmentStep && (
          <div className="form-system-status" aria-live="polite">
            <span className="form-system-status__dot" />
            <span>{assignmentStep}</span>
          </div>
        )}

        <button type="submit" disabled={!agenciaActiva || submitting} className="form-button form-button--primary">
          {submitting
            ? "Asignando eSIM..."
            : isPlanNuevoKomercial
            ? "Registrar plan nuevo"
            : isCambioKomercial
            ? "Registrar cambio SIM"
            : "Generar solicitud"}
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
