import React, { useState } from "react";
import { addDoc, collection, getDocs, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { getUserAgency, sameAgency, normalizeAgency, isGeneralAdmin } from "./userProfile";
import "./forms.css";

export default function DevolucionEsims({ user }) {
  const [serie, setSerie] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const adminGeneral = isGeneralAdmin(user);
  const mensajeError =
    mensaje.includes("Error") ||
    mensaje.includes("debe") ||
    mensaje.includes("No se") ||
    mensaje.includes("Debes");

  const handleDevolver = async (e) => {
    e.preventDefault();
    if (!/^\d{20}$/.test(serie)) {
      setMensaje("La serie debe tener 20 dígitos.");
      return;
    }

    const usuario = auth.currentUser?.email;
    if (!usuario) {
      setMensaje("Debes iniciar sesión para registrar devoluciones.");
      return;
    }

    const agenciaUsuario = getUserAgency(user);
    if (!agenciaUsuario && !adminGeneral) {
      setMensaje("Tu usuario no tiene agencia asignada. Contacta al administrador general.");
      return;
    }

    setLoading(true);
    setMensaje("");

    try {
      const filtros = [where("serie", "==", serie)];
      if (!adminGeneral) filtros.unshift(where("agencia", "==", agenciaUsuario));
      const q = query(collection(db, "esims"), ...filtros);
      const snap = await getDocs(q);

      if (snap.empty) {
        setMensaje("No se encontró una eSIM con esa serie.");
        setLoading(false);
        return;
      }

      const esimsUsadas = snap.docs.filter((docu) => docu.data().estado === "usada");
      if (adminGeneral && esimsUsadas.length > 1) {
        setMensaje("Hay varias eSIM usadas con esa serie. Verifica la serie antes de devolverla.");
        setLoading(false);
        return;
      }

      const esimDoc = adminGeneral && esimsUsadas.length === 1 ? esimsUsadas[0] : snap.docs[0];
      const esimData = esimDoc.data();
      const agenciaEsim = esimData.agencia || agenciaUsuario;

      if (!agenciaEsim) {
        setMensaje("Error: No se puede determinar la agencia para esta eSIM. Contacta al administrador.");
        setLoading(false);
        return;
      }

      if (!adminGeneral && esimData.agencia && !sameAgency(esimData.agencia, agenciaUsuario)) {
        setMensaje("Esa eSIM pertenece a otra agencia y no puedes devolverla desde tu perfil.");
        setLoading(false);
        return;
      }

      if (esimData.estado !== "usada") {
        setMensaje("La eSIM ya está disponible o no tiene una asignación activa.");
        setLoading(false);
        return;
      }

      const fecha = new Date().toISOString();

      // Normalizar agencia para garantizar consistencia con Firestore rules
      const agenciaNormalizada = normalizeAgency(agenciaEsim);

      try {
        await updateDoc(esimDoc.ref, {
          estado: "disponible",
          fechaDevolucion: fecha,
          usuarioDevolucion: usuario,
          agencia: agenciaNormalizada,
          pedido: null,
          numero: null,
          cedula: null,
          fechaUso: null,
        });
      } catch (updateErr) {
        console.error("ERROR UPDATE ESIM:", updateErr);
        setMensaje(`Error: Fallo al actualizar eSIM. ${updateErr.message}`);
        setLoading(false);
        return;
      }

      try {
        await addDoc(collection(db, "devoluciones"), {
          serie: esimData.serie || serie,
          usuario,
          fecha,
          pedido: esimData.pedido || "",
          numero: esimData.numero || "",
          cedula: esimData.cedula || "",
          agencia: agenciaNormalizada,
          loteId: esimData.loteId || null,
          esimId: esimDoc.id,
        });
      } catch (devErr) {
        console.error("ERROR DEVOLUCIONES:", devErr);
        setMensaje(`Error: Fallo al registrar devolución. ${devErr.message}`);
        setLoading(false);
        return;
      }

      setMensaje(`Serie ${serie} devuelta y registrada en tu historial.`);
      setSerie("");
    } catch (err) {
      console.error("Error devolucion:", err);
      setMensaje("Error: " + (err.message || "al registrar la devolución. Intenta de nuevo."));
    }

    setLoading(false);
  };

  return (
    <div className="form-screen">
      <div className={`form-card form-card--return${loading ? " is-submitting" : ""}`} style={{ maxWidth: 520 }}>
        <p className="form-kicker">Inventario</p>
        <h2 className="form-title">Devolucion de eSIM</h2>
        <p className="form-subtitle">
          {adminGeneral
            ? "Ingresa la serie de 20 dígitos. Se conserva la agencia y el lote original de la eSIM."
            : "Ingresa la serie de 20 digitos para dejar la eSIM disponible y registrar la devolucion en historial."}
        </p>

        <form onSubmit={handleDevolver}>
          <div className="form-field">
            <label className="form-label" htmlFor="serieDevolucion">Serie eSIM</label>
            <input
              id="serieDevolucion"
              className="form-input"
              type="text"
              placeholder="20 digitos"
              maxLength={20}
              value={serie}
              onChange={(e) => setSerie(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`form-button form-button--primary${loading ? " is-loading" : ""}`}
          >
            {loading ? "Registrando devolucion..." : "Registrar devolucion"}
          </button>
        </form>

        {mensaje && (
          <div className={`form-feedback ${mensajeError ? "is-error" : "is-success"}`}>
            {mensaje}
          </div>
        )}
      </div>
    </div>
  );
}
