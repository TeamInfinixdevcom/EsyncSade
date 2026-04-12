import React, { useState } from "react";
import { addDoc, collection, getDocs, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { getUserAgency, sameAgency } from "./userProfile";
import "./forms.css";

export default function DevolucionEsims({ user }) {
  const [serie, setSerie] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
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
    if (!agenciaUsuario) {
      setMensaje("Tu usuario no tiene agencia asignada. Contacta al administrador general.");
      return;
    }

    setLoading(true);
    setMensaje("");

    try {
      const q = query(
        collection(db, "esims"),
        where("agencia", "==", agenciaUsuario),
        where("serie", "==", serie)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setMensaje("No se encontró una eSIM con esa serie.");
        setLoading(false);
        return;
      }

      const esimDoc = snap.docs[0];
      const esimData = esimDoc.data();
      const agenciaEsim = esimData.agencia || agenciaUsuario;

      if (esimData.agencia && !sameAgency(esimData.agencia, agenciaUsuario)) {
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

      await updateDoc(esimDoc.ref, {
        estado: "disponible",
        fechaDevolucion: fecha,
        usuarioDevolucion: usuario,
        agencia: agenciaEsim,
        pedido: null,
        numero: null,
        cedula: null,
        fechaUso: null,
      });

      await addDoc(collection(db, "devoluciones"), {
        serie: esimData.serie || serie,
        usuario,
        fecha,
        pedido: esimData.pedido || "",
        numero: esimData.numero || "",
        cedula: esimData.cedula || "",
        agencia: agenciaEsim,
        loteId: esimData.loteId || null,
        esimId: esimDoc.id,
      });

      setMensaje(`Serie ${serie} devuelta y registrada en tu historial.`);
      setSerie("");
    } catch (err) {
      setMensaje("Error al registrar la devolución. Intenta de nuevo.");
    }

    setLoading(false);
  };

  return (
    <div className="form-screen">
      <div className="form-card" style={{ maxWidth: 520 }}>
        <p className="form-kicker">Inventario</p>
        <h2 className="form-title">Devolucion de eSIM</h2>
        <p className="form-subtitle">
          Ingresa la serie de 20 digitos para dejar la eSIM disponible y registrar la devolucion en historial.
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

          <button type="submit" disabled={loading} className="form-button form-button--primary">
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
