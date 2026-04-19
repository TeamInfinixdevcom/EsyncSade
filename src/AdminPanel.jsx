import React, { useState, useEffect, useMemo } from "react";
import { getFirestore, collection, addDoc, onSnapshot, doc, writeBatch, getDocs, query, where, setDoc, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth as getSecondaryAuth, sendPasswordResetEmail } from "firebase/auth";
import { deleteApp, initializeApp } from "firebase/app";
import { auth, firebaseConfig } from "./firebase";
import { getUserAgency, isAgencyAdmin, isGeneralAdmin, isUserAdmin, normalizeAgency, sameAgency } from "./userProfile";
import Dashboard from "./Dashboard";

function extractSeries(text) {
  const matches = text.match(/\b\d{20}\b/g);
  return matches ? matches.sort() : [];
}

export default function AdminPanel({ user }) {
  const PAGE_SIZE = 10;
  const generalAdmin = isGeneralAdmin(user);
  const agencyAdmin = isAgencyAdmin(user) && !generalAdmin;
  const agenciaAdmin = getUserAgency(user);
  const currentUserId = user?.id || auth.currentUser?.uid || "";

  const [view, setView] = useState("dashboard");
  const [input, setInput] = useState("");
  const [series, setSeries] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [historial, setHistorial] = useState([]);
  const [page, setPage] = useState(1);
  const [agentes, setAgentes] = useState([]);
  const [cargandoAgentes, setCargandoAgentes] = useState(false);
  const [nombreAgente, setNombreAgente] = useState("");
  const [emailAgente, setEmailAgente] = useState("");
  const [passwordAgente, setPasswordAgente] = useState("");
  const [rolNuevoUsuario, setRolNuevoUsuario] = useState("agente");
  const [agenciaNuevoUsuario, setAgenciaNuevoUsuario] = useState("");
  const [creandoAgente, setCreandoAgente] = useState(false);
  const [mensajeAgente, setMensajeAgente] = useState("");
  const [agenciasDisponibles, setAgenciasDisponibles] = useState([]);
  const [agenciaCarga, setAgenciaCarga] = useState("");
  const [filtroUsuarios, setFiltroUsuarios] = useState("");
  const [editandoUsuarioId, setEditandoUsuarioId] = useState("");
  const [editNombreUsuario, setEditNombreUsuario] = useState("");
  const [editRolUsuario, setEditRolUsuario] = useState("agente");
  const [editAgenciaUsuario, setEditAgenciaUsuario] = useState("");
  const [editActivoUsuario, setEditActivoUsuario] = useState(true);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [vistaAgrupadaAgencias, setVistaAgrupadaAgencias] = useState(true);
  const [agenciasExpandidas, setAgenciasExpandidas] = useState({});

  const panelWidth =
    view === "dashboard"
      ? "min(96vw, 1280px)"
      : view === "agentes"
      ? "min(96vw, 1000px)"
      : "min(96vw, 1120px)";

  const agenciaCargaActiva = generalAdmin ? normalizeAgency(agenciaCarga) : agenciaAdmin;

  const getRoleLabel = (rol) => {
    if (rol === "admin_general") return "Admin general";
    if (rol === "admin_agencia") return "Admin agencia";
    if (rol === "agente") return "Agente";
    return rol || "Ejecutivo";
  };

  const getAgencyDisplayLabel = (usuarioRow) => {
    if (isGeneralAdmin(usuarioRow)) return "Administrador General";
    return normalizeAgency(usuarioRow?.agencia) || "Sin agencia";
  };

  const usuariosFiltrados = useMemo(() => {
    const filtro = filtroUsuarios.trim().toLowerCase();
    if (!filtro) return agentes;

    return agentes.filter((u) =>
      [u.nombre, u.name, u.email, u.agencia, u.rol]
        .some((v) => String(v || "").toLowerCase().includes(filtro))
    );
  }, [agentes, filtroUsuarios]);

  const gruposUsuariosPorAgencia = useMemo(() => {
    const grouped = new Map();

    usuariosFiltrados.forEach((usuarioRow) => {
      const agenciaKey = getAgencyDisplayLabel(usuarioRow);
      if (!grouped.has(agenciaKey)) {
        grouped.set(agenciaKey, []);
      }
      grouped.get(agenciaKey).push(usuarioRow);
    });

    return Array.from(grouped.entries()).sort((a, b) => {
      if (a[0] === "Administrador General") return -1;
      if (b[0] === "Administrador General") return 1;
      if (a[0] === "Sin agencia") return 1;
      if (b[0] === "Sin agencia") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [usuariosFiltrados]);

  const iniciarEdicionUsuario = (usuarioRow) => {
    setEditandoUsuarioId(usuarioRow.id);
    setEditNombreUsuario((usuarioRow.nombre || usuarioRow.name || "").trim());
    setEditRolUsuario(usuarioRow.rol || "agente");
    setEditAgenciaUsuario(normalizeAgency(usuarioRow.agencia));
    setEditActivoUsuario(usuarioRow.activo !== false);
    setMensajeAgente("");
  };

  const cancelarEdicionUsuario = () => {
    setEditandoUsuarioId("");
    setEditNombreUsuario("");
    setEditRolUsuario("agente");
    setEditAgenciaUsuario("");
    setEditActivoUsuario(true);
  };

  const guardarEdicionUsuario = async (usuarioRow) => {
    const nombre = editNombreUsuario.trim();
    const rol = generalAdmin ? editRolUsuario : "agente";
    const agencia = generalAdmin
      ? normalizeAgency(editAgenciaUsuario)
      : agenciaAdmin;

    if (!nombre) {
      setMensajeAgente("El nombre no puede quedar vacío.");
      return;
    }

    if (!["agente", "admin_agencia", "admin_general"].includes(rol)) {
      setMensajeAgente("Rol inválido para actualización.");
      return;
    }

    if (rol !== "admin_general" && !agencia) {
      setMensajeAgente("Debes indicar una agencia para este usuario.");
      return;
    }

    if (agencyAdmin && !sameAgency(agencia, agenciaAdmin)) {
      setMensajeAgente("No puedes mover usuarios fuera de tu agencia.");
      return;
    }

    setGuardandoUsuario(true);
    setMensajeAgente("");

    try {
      const db = getFirestore();
      const esAdminGeneral = rol === "admin_general";
      const esAdminAgencia = rol === "admin_agencia";

      await setDoc(
        doc(db, "usuarios", usuarioRow.id),
        {
          nombre,
          name: nombre,
          rol,
          adminGeneral: esAdminGeneral,
          adminAgencia: esAdminAgencia,
          admin: esAdminGeneral || esAdminAgencia,
          agencia: esAdminGeneral ? "" : agencia,
          activo: !!editActivoUsuario,
          fechaActualizacion: new Date().toISOString(),
        },
        { merge: true }
      );

      setMensajeAgente(`Usuario ${usuarioRow.email} actualizado correctamente.`);
      cancelarEdicionUsuario();
      fetchAgentes();
      fetchAgencias();
    } catch (err) {
      setMensajeAgente("No se pudo actualizar el usuario.");
    }

    setGuardandoUsuario(false);
  };

  const puedeAdministrarAgente = (usuarioRow) => {
    const rol = String(usuarioRow?.rol || "").trim().toLowerCase();
    const mismaAgencia = sameAgency(usuarioRow?.agencia, agenciaAdmin);

    if (generalAdmin) return true;
    return agencyAdmin && rol === "agente" && mismaAgencia;
  };

  const handleEliminarUsuario = async (usuarioRow) => {
    const esUsuarioActual = currentUserId && usuarioRow.id === currentUserId;
    if (esUsuarioActual) {
      setMensajeAgente("No puedes eliminar tu propio usuario.");
      return;
    }

    if (!puedeAdministrarAgente(usuarioRow)) {
      setMensajeAgente("No tienes permiso para eliminar este usuario.");
      return;
    }

    const email = usuarioRow.email || usuarioRow.nombre || "este usuario";
    if (!window.confirm(`¿Seguro que deseas eliminar a ${email}?`)) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, "usuarios", usuarioRow.id));
      setMensajeAgente(`Usuario ${email} eliminado correctamente.`);
      fetchAgentes();
      fetchAgencias();
    } catch (err) {
      setMensajeAgente("No se pudo eliminar el usuario.");
    }
  };

  const handleResetPasswordUsuario = async (usuarioRow) => {
    const esUsuarioActual = currentUserId && usuarioRow.id === currentUserId;
    if (esUsuarioActual) {
      setMensajeAgente("No puedes resetear la contraseña de tu propio usuario desde este panel.");
      return;
    }

    if (!puedeAdministrarAgente(usuarioRow)) {
      setMensajeAgente("No tienes permiso para resetear la contraseña de este usuario.");
      return;
    }

    if (!usuarioRow?.email) {
      setMensajeAgente("El usuario no tiene correo registrado.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, usuarioRow.email);
      setMensajeAgente(`Se envió correo de restablecimiento a ${usuarioRow.email}.`);
    } catch (err) {
      if (err?.code === "auth/user-not-found") {
        setMensajeAgente("No existe usuario de Auth para ese correo.");
      } else {
        setMensajeAgente(`No se pudo enviar el correo de restablecimiento. ${err?.message || ""}`);
      }
    }
  };

  const fetchAgentes = async () => {
    setCargandoAgentes(true);
    setMensajeAgente("");
    try {
      const db = getFirestore();
      const source = generalAdmin
        ? collection(db, "usuarios")
        : query(collection(db, "usuarios"), where("agencia", "==", agenciaAdmin));
      const snap = await getDocs(source);
      const rows = snap.docs
        .map((docu) => ({ id: docu.id, ...docu.data() }))
        .filter((u) => {
          if (generalAdmin) return true;
          if (agencyAdmin) return sameAgency(u.agencia, agenciaAdmin) && !isUserAdmin(u);
          return false;
        })
        .sort((a, b) => new Date(b.fechaCreacion || b.fecha || 0) - new Date(a.fechaCreacion || a.fecha || 0));
      setAgentes(rows);
    } catch (err) {
      setMensajeAgente("No se pudo cargar la lista de agentes.");
    }
    setCargandoAgentes(false);
  };

  const fetchAgencias = async () => {
    if (!generalAdmin) {
      const agencia = normalizeAgency(agenciaAdmin);
      setAgenciasDisponibles(agencia ? [agencia] : []);
      return;
    }

    const setAgencias = new Set();

    if (agenciaAdmin) {
      setAgencias.add(agenciaAdmin);
    }

    try {
      const db = getFirestore();
      const [usuariosSnap, lotesSnap] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "lotes")),
      ]);

      usuariosSnap.forEach((docu) => {
        const agencia = normalizeAgency(docu.data().agencia);
        if (agencia) setAgencias.add(agencia);
      });

      lotesSnap.forEach((docu) => {
        const agencia = normalizeAgency(docu.data().agencia);
        if (agencia) setAgencias.add(agencia);
      });

      const agenciasOrdenadas = Array.from(setAgencias).sort((a, b) => a.localeCompare(b));
      setAgenciasDisponibles(agenciasOrdenadas);

      if (generalAdmin && !agenciaCarga && agenciasOrdenadas.length > 0) {
        setAgenciaCarga(agenciasOrdenadas[0]);
      }
    } catch {
      const agenciasOrdenadas = Array.from(setAgencias).sort((a, b) => a.localeCompare(b));
      setAgenciasDisponibles(agenciasOrdenadas);
    }
  };

  const handleCrearAgente = async (e) => {
    e.preventDefault();
    const nombre = nombreAgente.trim();
    const email = emailAgente.trim().toLowerCase();
    const rolAsignado = generalAdmin ? rolNuevoUsuario : "agente";
    const agenciaAsignada = generalAdmin ? normalizeAgency(agenciaNuevoUsuario || agenciaCargaActiva) : agenciaAdmin;

    if (!nombre || !email || !passwordAgente) {
      setMensajeAgente("Completa nombre, correo y contraseña.");
      return;
    }

    if (!agenciaAsignada) {
      setMensajeAgente("Debes indicar la agencia del usuario.");
      return;
    }

    if (!["agente", "admin_agencia"].includes(rolAsignado)) {
      setMensajeAgente("Rol no permitido.");
      return;
    }

    if (passwordAgente.length < 6) {
      setMensajeAgente("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setCreandoAgente(true);
    setMensajeAgente("");

    try {
      const db = getFirestore();
      const existingQuery = generalAdmin
        ? query(collection(db, "usuarios"), where("email", "==", email))
        : query(collection(db, "usuarios"), where("email", "==", email), where("agencia", "==", agenciaAsignada));
      const existente = await getDocs(existingQuery);
      if (!existente.empty) {
        setMensajeAgente("Ese correo ya está registrado en el sistema.");
        setCreandoAgente(false);
        return;
      }

      const secondaryApp = initializeApp(firebaseConfig, `agent-creator-${Date.now()}`);
      let uid = "";
      try {
        const secondaryAuth = getSecondaryAuth(secondaryApp);
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, passwordAgente);
        uid = cred.user.uid;
        await secondaryAuth.signOut();
      } finally {
        await deleteApp(secondaryApp);
      }

      await setDoc(
        doc(db, "usuarios", uid),
        {
          name: nombre,
          nombre,
          email,
          admin: false,
          adminGeneral: false,
          adminAgencia: rolAsignado === "admin_agencia",
          rol: rolAsignado,
          agencia: agenciaAsignada,
          activo: true,
          fechaCreacion: new Date().toISOString(),
        },
        { merge: true }
      );

      setMensajeAgente(
        rolAsignado === "admin_agencia"
          ? `Administrador de agencia creado para ${agenciaAsignada}.`
          : `Agente creado en la agencia ${agenciaAsignada}.`
      );
      setNombreAgente("");
      setEmailAgente("");
      setPasswordAgente("");
      if (generalAdmin) {
        setRolNuevoUsuario("agente");
        setAgenciaNuevoUsuario("");
      }
      fetchAgentes();
      fetchAgencias();
    } catch (err) {
      if (err?.code === "auth/email-already-in-use") {
        setMensajeAgente("El correo ya existe en Firebase Auth.");
      } else if (err?.code === "auth/weak-password") {
        setMensajeAgente("La contraseña es demasiado débil.");
      } else {
        setMensajeAgente(`No se pudo crear el agente. ${err?.message || ""}`);
      }
    }

    setCreandoAgente(false);
  };

  useEffect(() => {
    fetchAgencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generalAdmin, agenciaAdmin]);

  useEffect(() => {
    if (view === "agentes") {
      fetchAgentes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, generalAdmin, agenciaAdmin]);

  useEffect(() => {
    if (!generalAdmin) return;

    setAgenciasExpandidas((prev) => {
      let changed = false;
      const next = { ...prev };

      gruposUsuariosPorAgencia.forEach(([agencia]) => {
        if (typeof next[agencia] === "undefined") {
          next[agencia] = true;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [generalAdmin, gruposUsuariosPorAgencia]);

  const handleExtract = () => {
    const result = extractSeries(input);
    setSeries(result);
  };

  // Subir series como lote a Firestore
  const handleSubir = async () => {
    if (series.length === 0) {
      setMensaje("No hay series para subir.");
      return;
    }

    if (!agenciaCargaActiva) {
      setMensaje("Debes seleccionar una agencia para cargar eSIMs.");
      return;
    }

    setSubiendo(true);
    setMensaje("");
    try {
      const db = getFirestore();
      // Crear lote
      const loteRef = await addDoc(collection(db, "lotes"), {
        fecha: new Date().toISOString(),
        cantidad: series.length,
        usuario: auth.currentUser?.email || "Desconocido",
        agencia: agenciaCargaActiva,
        series
      });
      // Subir cada serie como documento en la colección 'esims', guardando el id del lote
      for (const serie of series) {
        await addDoc(collection(db, "esims"), {
          serie,
          codigoBarras: serie,
          estado: "disponible",
          fechaCarga: new Date().toISOString(),
          agencia: agenciaCargaActiva,
          loteId: loteRef.id
        });
      }
      setMensaje(`Se subieron ${series.length} eSIMs a la agencia ${agenciaCargaActiva}.`);
      setSeries([]);
      setInput("");
      fetchAgencias();
    } catch (err) {
      setMensaje("Error al subir las series. Intenta de nuevo.");
    }
    setSubiendo(false);
  };

  // Historial de lotes
  useEffect(() => {
    const db = getFirestore();
    const source = generalAdmin
      ? collection(db, "lotes")
      : query(collection(db, "lotes"), where("agencia", "==", agenciaAdmin));

    const unsub = onSnapshot(source, (snap) => {
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      const filtrado = arr
        .filter((lote) => {
          if (generalAdmin) {
            if (!agenciaCargaActiva) return true;
            return sameAgency(lote.agencia, agenciaCargaActiva);
          }
          return sameAgency(lote.agencia, agenciaAdmin);
        })
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      setHistorial(filtrado);
      setPage(1); // Reset page on new data
    });
    return () => unsub();
  }, [generalAdmin, agenciaAdmin, agenciaCargaActiva]);

  // Borrar lote y sus series
  const handleBorrarLote = async (lote) => {
    const loteId = lote?.id;
    if (!loteId) return;

    if (!generalAdmin && !sameAgency(lote.agencia, agenciaAdmin)) {
      setMensaje("No puedes borrar lotes de otra agencia.");
      return;
    }

    if (!window.confirm("¿Seguro que deseas borrar este lote y todas sus series?")) return;
    const db = getFirestore();
    // Borrar series asociadas
    const batch = writeBatch(db);
    const esimsQuery = query(collection(db, "esims"), where("loteId", "==", loteId));
    const esimsSnap = await getDocs(esimsQuery);
    esimsSnap.forEach((docu) => {
      batch.delete(doc(db, "esims", docu.id));
    });

    batch.delete(doc(db, "lotes", loteId));
    await batch.commit();
    setMensaje("Lote borrado correctamente.");
  };

  const alternarGrupoAgencia = (agencia) => {
    setAgenciasExpandidas((prev) => ({
      ...prev,
      [agencia]: prev[agencia] === false,
    }));
  };

  const cambiarExpansionGlobal = (expandir) => {
    setAgenciasExpandidas((prev) => {
      const next = { ...prev };
      gruposUsuariosPorAgencia.forEach(([agencia]) => {
        next[agencia] = expandir;
      });
      return next;
    });
  };

  const renderUsuarioRow = (a) => {
    const estaEditando = editandoUsuarioId === a.id;
    const esUsuarioActual = currentUserId && a.id === currentUserId;
    const puedeEditarFila = generalAdmin ? !esUsuarioActual : true;
    const puedeEliminarFila = !esUsuarioActual && puedeAdministrarAgente(a);
    const puedeResetearFila = !!a.email && !esUsuarioActual && puedeAdministrarAgente(a);
    const esAdminGeneralFila = isGeneralAdmin(a);
    const agenciaMostrar = getAgencyDisplayLabel(a);

    return (
      <tr key={a.id}>
        <td style={{ padding: 8, borderBottom: "1px solid #3b3b3b" }}>
          {estaEditando ? (
            <input
              type="text"
              value={editNombreUsuario}
              onChange={(e) => setEditNombreUsuario(e.target.value)}
              style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ffe066", background: "#181818", color: "#fff" }}
            />
          ) : (a.nombre || a.name || "-")}
        </td>
        <td style={{ padding: 8, borderBottom: "1px solid #3b3b3b" }}>{a.email || "-"}</td>
        <td style={{ padding: 8, borderBottom: "1px solid #3b3b3b" }}>
          {estaEditando ? (
            editRolUsuario === "admin_general" ? (
              <span>-</span>
            ) : (
              <input
                list="agencias-edicion"
                type="text"
                value={generalAdmin ? editAgenciaUsuario : agenciaAdmin}
                onChange={(e) => setEditAgenciaUsuario(e.target.value)}
                disabled={!generalAdmin}
                style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ffe066", background: "#181818", color: "#fff" }}
              />
            )
          ) : (
            <span style={{ color: esAdminGeneralFila || a.agencia ? "#fff" : "#ffd2a6", fontWeight: esAdminGeneralFila ? 800 : (a.agencia ? 500 : 800) }}>
              {agenciaMostrar}
            </span>
          )}
        </td>
        <td style={{ padding: 8, borderBottom: "1px solid #3b3b3b" }}>
          {estaEditando ? (
            generalAdmin ? (
              <select
                value={editRolUsuario}
                onChange={(e) => setEditRolUsuario(e.target.value)}
                style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ffe066", background: "#181818", color: "#fff" }}
              >
                <option value="agente">Agente</option>
                <option value="admin_agencia">Admin agencia</option>
                <option value="admin_general">Admin general</option>
              </select>
            ) : (
              <span>Agente</span>
            )
          ) : getRoleLabel(a.rol)}
        </td>
        <td style={{ padding: 8, borderBottom: "1px solid #3b3b3b" }}>
          {estaEditando ? (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={editActivoUsuario}
                onChange={(e) => setEditActivoUsuario(e.target.checked)}
              />
              {editActivoUsuario ? "Sí" : "No"}
            </label>
          ) : (a.activo === false ? "No" : "Sí")}
        </td>
        <td style={{ padding: 8, borderBottom: "1px solid #3b3b3b" }}>{a.fechaCreacion ? new Date(a.fechaCreacion).toLocaleString() : "-"}</td>
        <td style={{ padding: 8, borderBottom: "1px solid #3b3b3b" }}>
          {estaEditando ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => guardarEdicionUsuario(a)}
                disabled={guardandoUsuario}
                style={{ background: "#00d1b2", color: "#04151a", border: "none", borderRadius: 6, padding: "4px 10px", fontWeight: 700, cursor: guardandoUsuario ? "not-allowed" : "pointer" }}
              >
                {guardandoUsuario ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={cancelarEdicionUsuario}
                disabled={guardandoUsuario}
                style={{ background: "#555", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontWeight: 700, cursor: guardandoUsuario ? "not-allowed" : "pointer" }}
              >
                Cancelar
              </button>
            </div>
          ) : puedeEditarFila ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => iniciarEdicionUsuario(a)}
                style={{ background: "#ffe066", color: "#181818", border: "none", borderRadius: 6, padding: "4px 10px", fontWeight: 700, cursor: "pointer" }}
              >
                Editar
              </button>
              {puedeResetearFila && (
                <button
                  type="button"
                  onClick={() => handleResetPasswordUsuario(a)}
                  style={{ background: "#00d1b2", color: "#04151a", border: "none", borderRadius: 6, padding: "4px 10px", fontWeight: 700, cursor: "pointer" }}
                >
                  Reset pass
                </button>
              )}
              {puedeEliminarFila && (
                <button
                  type="button"
                  onClick={() => handleEliminarUsuario(a)}
                  style={{ background: "#ff5f56", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontWeight: 700, cursor: "pointer" }}
                >
                  Eliminar
                </button>
              )}
            </div>
          ) : (
            <span style={{ color: "#ffd58c", fontWeight: 700 }}>Tu usuario</span>
          )}
        </td>
      </tr>
    );
  };

  const renderUsuariosTable = (rows) => (
    <table style={{ width: "100%", borderCollapse: "collapse", background: "#232323", borderRadius: 12, overflow: "hidden" }}>
      <thead>
        <tr style={{ background: "#ffe06622", color: "#fff" }}>
          <th style={{ textAlign: "left", padding: 8 }}>Nombre</th>
          <th style={{ textAlign: "left", padding: 8 }}>Correo</th>
          <th style={{ textAlign: "left", padding: 8 }}>Agencia</th>
          <th style={{ textAlign: "left", padding: 8 }}>Rol</th>
          <th style={{ textAlign: "left", padding: 8 }}>Activo</th>
          <th style={{ textAlign: "left", padding: 8 }}>Fecha alta</th>
          <th style={{ textAlign: "left", padding: 8 }}>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => renderUsuarioRow(row))}
      </tbody>
    </table>
  );

  return (
    <div style={{ width: panelWidth, margin: "32px auto", background: "#181818", borderRadius: 24, boxShadow: "0 0 32px 4px #ff34fccc", border: "2.5px solid #ff34fc", padding: "1.6rem 1rem", color: "#fff", boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => setView("dashboard")}
          style={{ background: view === "dashboard" ? "#00fff7" : "#232323", color: view === "dashboard" ? "#181818" : "#00fff7", border: 'none', borderRadius: 12, padding: '0.7rem 2rem', fontWeight: 900, fontSize: 18, boxShadow: view === "dashboard" ? '0 2px 16px #00fff7cc' : 'none', cursor: 'pointer', letterSpacing: 1, textShadow: view === "dashboard" ? '0 1px 8px #fff' : '0 1px 8px #00fff7cc' }}
        >Gráficas de uso</button>
        <button
          onClick={() => setView("series")}
          style={{ background: view === "series" ? "#bd34fe" : "#232323", color: view === "series" ? "#fff" : "#bd34fe", border: 'none', borderRadius: 12, padding: '0.7rem 2rem', fontWeight: 900, fontSize: 18, boxShadow: view === "series" ? '0 2px 16px #bd34fecc' : 'none', cursor: 'pointer', letterSpacing: 1, textShadow: view === "series" ? '0 1px 8px #fff' : '0 1px 8px #bd34fecc' }}
        >Carga de Series</button>
        <button
          onClick={() => setView("agentes")}
          style={{ background: view === "agentes" ? "#ffe066" : "#232323", color: view === "agentes" ? "#181818" : "#ffe066", border: 'none', borderRadius: 12, padding: '0.7rem 2rem', fontWeight: 900, fontSize: 18, boxShadow: view === "agentes" ? '0 2px 16px #ffe066cc' : 'none', cursor: 'pointer', letterSpacing: 1, textShadow: view === "agentes" ? '0 1px 8px #fff' : '0 1px 8px #ffe066cc' }}
        >Usuarios</button>
      </div>
      {view === "dashboard" && (
        <Dashboard user={user} />
      )}
      {view === "series" && (
        <div style={{ width: '100%', maxWidth: 1100, margin: "0 auto", background: "#181818", borderRadius: 20, boxShadow: "0 0 32px 4px #bd34fecc", padding: "2.5vw 2vw", color: "#fff", boxSizing: 'border-box' }}>
          <h2 style={{ color: "#bd34fe", textShadow: '0 2px 12px #bd34fecc, 0 0 2px #fff', fontWeight: 900, letterSpacing: 2 }}>Carga de Series eSIM</h2>
          {generalAdmin ? (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 6, color: "#ffe7ff", fontWeight: 700 }}>Agencia destino</label>
              <input
                list="agencias-disponibles"
                value={agenciaCarga}
                onChange={(e) => setAgenciaCarga(e.target.value)}
                placeholder="Ejemplo: Pavas"
                style={{ width: "100%", maxWidth: 360, padding: 10, borderRadius: 8, border: "1.5px solid #bd34fe", fontSize: 15, background: "#232323", color: "#fff", outline: "none" }}
              />
              <datalist id="agencias-disponibles">
                {agenciasDisponibles.map((agencia) => (
                  <option key={agencia} value={agencia} />
                ))}
              </datalist>
              <div style={{ marginTop: 6, color: "#d4bcff", fontSize: 13 }}>Selecciona o escribe la agencia para agrupar esta carga.</div>
            </div>
          ) : (
            <div style={{ marginBottom: 14, color: "#e7d5ff", fontWeight: 700 }}>
              Agencia activa: {agenciaAdmin || "No asignada"}
            </div>
          )}
          <div style={{ maxHeight: '22vh', minHeight: 80, overflow: 'auto', marginBottom: '2vh' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={5}
              placeholder="Pega aquí el texto con las series..."
              style={{ width: "100%", minHeight: 60, maxHeight: 100, padding: 10, borderRadius: 8, border: '1.5px solid #bd34fe', fontSize: 15, background: '#232323', color: '#fff', boxShadow: '0 2px 8px #bd34fe33', outline: 'none', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '1vw', marginBottom: '2vh', flexWrap: 'wrap' }}>
            <button
              onClick={handleExtract}
              style={{ flex: 1, background: 'linear-gradient(90deg, #00fff7 0%, #bd34fe 100%)', color: '#181818', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 900, fontSize: 16, boxShadow: '0 2px 16px #00fff7cc', cursor: 'pointer', transition: 'background 0.2s', letterSpacing: 1, textShadow: '0 1px 8px #fff' }}
            >Extraer y Ordenar Series</button>
            <button
              onClick={handleSubir}
              style={{ flex: 1, background: 'linear-gradient(90deg, #bd34fe 0%, #00fff7 100%)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 900, fontSize: 16, boxShadow: '0 2px 16px #bd34fecc', cursor: subiendo ? 'not-allowed' : 'pointer', opacity: subiendo ? 0.6 : 1, transition: 'background 0.2s', letterSpacing: 1, textShadow: '0 1px 8px #fff' }}
            >{subiendo ? 'Subiendo...' : 'Subir eSIMs a la nube'}</button>
          </div>
          <div style={{ maxHeight: '22vh', minHeight: 60, overflow: 'auto', marginBottom: '2vh' }}>
            <h3 style={{ color: '#bd34fe', marginBottom: 8 }}>Series encontradas ({series.length}):</h3>
            <textarea
              value={series.join("\n")}
              readOnly
              rows={series.length > 6 ? 6 : series.length || 2}
              style={{ width: "100%", minHeight: 40, maxHeight: 90, padding: 10, borderRadius: 8, border: '1.5px solid #bd34fe', fontSize: 15, background: '#232323', color: '#bd34fe', boxShadow: '0 2px 8px #bd34fe33', outline: 'none', resize: 'vertical' }}
            />
          </div>
          {mensaje && <div style={{ color: '#00fff7', marginTop: 12, fontWeight: 700 }}>{mensaje}</div>}
          <div style={{ marginTop: 32 }}>
            <h3 style={{ color: '#ff34fc', marginBottom: 12 }}>Historial de lotes cargados</h3>
            <div style={{ maxHeight: '30vh', minHeight: 80, overflow: 'auto', background: '#232323', borderRadius: 12, padding: '1vw', border: '1.5px solid #ff34fc' }}>
              {historial.length === 0 ? (
                <div style={{ color: '#fff', opacity: 0.7 }}>Sin lotes cargados.</div>
              ) : (
                <>
                  <table style={{ width: '100%', color: '#fff', fontSize: 15, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#ff34fc', fontWeight: 700 }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Fecha</th>
                        {generalAdmin && <th style={{ padding: '6px 8px', textAlign: 'left' }}>Agencia</th>}
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Cantidad</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Usuario</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE).map(lote => (
                        <tr key={lote.id} style={{ borderBottom: '1px solid #444' }}>
                          <td style={{ padding: '6px 8px' }}>{new Date(lote.fecha).toLocaleString()}</td>
                          {generalAdmin && <td style={{ padding: '6px 8px' }}>{lote.agencia || '-'}</td>}
                          <td style={{ padding: '6px 8px' }}>{lote.cantidad}</td>
                          <td style={{ padding: '6px 8px' }}>{lote.usuario}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <button onClick={() => handleBorrarLote(lote)} style={{ background: '#ff34fc', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontWeight: 700, cursor: 'pointer' }}>Borrar lote</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 12 }}>
                    <button onClick={() => setPage(page-1)} disabled={page === 1} style={{ background: '#bd34fe', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 16px', fontWeight: 700, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>Anterior</button>
                    <span style={{ color: '#fff', fontWeight: 700 }}>Página {page} de {Math.ceil(historial.length/PAGE_SIZE)}</span>
                    <button onClick={() => setPage(page+1)} disabled={page*PAGE_SIZE >= historial.length} style={{ background: '#bd34fe', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 16px', fontWeight: 700, cursor: page*PAGE_SIZE >= historial.length ? 'not-allowed' : 'pointer', opacity: page*PAGE_SIZE >= historial.length ? 0.5 : 1 }}>Siguiente</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {view === "agentes" && (
        <div style={{ width: '100%', maxWidth: 900, margin: "0 auto", background: "#181818", borderRadius: 20, boxShadow: "0 0 32px 4px #ffe066cc", padding: "2.5vw 2vw", color: "#fff", boxSizing: 'border-box' }}>
          <h2 style={{ color: "#ffe066", textShadow: '0 2px 12px #ffe066cc, 0 0 2px #fff', fontWeight: 900, letterSpacing: 2 }}>
            {generalAdmin ? "Gestión de usuarios por agencia" : "Gestión de agentes de agencia"}
          </h2>
          <div style={{ marginBottom: 10, color: "#fff3bf", fontWeight: 600 }}>
            {generalAdmin
              ? "Puedes crear agentes y administradores de agencia, asignando su agencia." 
              : `Solo puedes crear agentes de tu agencia (${agenciaAdmin || "No asignada"}).`}
          </div>
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Buscar por nombre, correo, rol o agencia"
              value={filtroUsuarios}
              onChange={(e) => setFiltroUsuarios(e.target.value)}
              style={{ width: "100%", maxWidth: 420, padding: 10, borderRadius: 8, border: "1.5px solid #ffe066", fontSize: 15, background: "#232323", color: "#fff", outline: "none" }}
            />
          </div>
          <form onSubmit={handleCrearAgente} style={{ display: 'grid', gridTemplateColumns: generalAdmin ? '1fr 1fr 1fr 1fr 1fr auto' : '1fr 1fr 1fr auto', gap: 10, alignItems: 'center', marginBottom: 18 }}>
            <input
              type="text"
              placeholder="Nombre completo"
              value={nombreAgente}
              onChange={(e) => setNombreAgente(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #ffe066', fontSize: 15, background: '#232323', color: '#fff', outline: 'none' }}
            />
            <input
              type="email"
              placeholder="Correo"
              value={emailAgente}
              onChange={(e) => setEmailAgente(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #ffe066', fontSize: 15, background: '#232323', color: '#fff', outline: 'none' }}
            />
            {generalAdmin && (
              <select
                value={rolNuevoUsuario}
                onChange={(e) => setRolNuevoUsuario(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #ffe066', fontSize: 15, background: '#232323', color: '#fff', outline: 'none' }}
              >
                <option value="agente">Agente</option>
                <option value="admin_agencia">Admin de agencia</option>
              </select>
            )}
            {generalAdmin && (
              <input
                list="agencias-usuarios"
                type="text"
                placeholder="Agencia"
                value={agenciaNuevoUsuario}
                onChange={(e) => setAgenciaNuevoUsuario(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #ffe066', fontSize: 15, background: '#232323', color: '#fff', outline: 'none' }}
              />
            )}
            <datalist id="agencias-usuarios">
              {agenciasDisponibles.map((agencia) => (
                <option key={agencia} value={agencia} />
              ))}
            </datalist>
            <input
              type="password"
              placeholder="Contraseña temporal"
              value={passwordAgente}
              onChange={(e) => setPasswordAgente(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #ffe066', fontSize: 15, background: '#232323', color: '#fff', outline: 'none' }}
            />
            <button type="submit" disabled={creandoAgente} style={{ background: '#ffe066', color: '#181818', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 900, cursor: creandoAgente ? 'not-allowed' : 'pointer', opacity: creandoAgente ? 0.6 : 1 }}>
              {creandoAgente ? 'Creando...' : generalAdmin ? 'Crear usuario' : 'Crear agente'}
            </button>
          </form>

          {mensajeAgente && <div style={{ color: '#ffe066', marginBottom: 12, fontWeight: 700 }}>{mensajeAgente}</div>}

          {generalAdmin && usuariosFiltrados.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setVistaAgrupadaAgencias((prev) => !prev)}
                style={{ background: "#ffe066", color: "#181818", border: "none", borderRadius: 8, padding: "8px 12px", fontWeight: 800, cursor: "pointer" }}
              >
                {vistaAgrupadaAgencias ? "Ver lista plana" : "Agrupar por agencia"}
              </button>
              {vistaAgrupadaAgencias && (
                <>
                  <button
                    type="button"
                    onClick={() => cambiarExpansionGlobal(true)}
                    style={{ background: "#393939", color: "#fff", border: "1px solid #ffe06666", borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Expandir todo
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarExpansionGlobal(false)}
                    style={{ background: "#393939", color: "#fff", border: "1px solid #ffe06666", borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Contraer todo
                  </button>
                </>
              )}
            </div>
          )}

          <h3 style={{ color: '#ffe066', marginBottom: 10 }}>Usuarios registrados</h3>
          {cargandoAgentes ? (
            <div>Cargando usuarios...</div>
          ) : usuariosFiltrados.length === 0 ? (
            <div>No hay usuarios que coincidan con el filtro.</div>
          ) : (
            <>
              <datalist id="agencias-edicion">
                {agenciasDisponibles.map((agencia) => (
                  <option key={agencia} value={agencia} />
                ))}
              </datalist>

              {generalAdmin && vistaAgrupadaAgencias ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {gruposUsuariosPorAgencia.map(([agencia, rows]) => {
                    const estaExpandido = agenciasExpandidas[agencia] !== false;
                    const activos = rows.filter((u) => u.activo !== false).length;
                    const inactivos = rows.length - activos;

                    return (
                      <div key={agencia} style={{ border: "1.5px solid #ffe06655", borderRadius: 12, overflow: "hidden", background: "#1f1f1f" }}>
                        <button
                          type="button"
                          onClick={() => alternarGrupoAgencia(agencia)}
                          style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#ffe06611", color: "#fff", border: "none", cursor: "pointer", fontWeight: 800 }}
                        >
                          <span style={{ textAlign: "left" }}>{agencia}</span>
                          <span style={{ color: "#ffe066", fontWeight: 700 }}>{rows.length} usuarios</span>
                          <span style={{ color: "#9effcf", fontWeight: 700 }}>{activos} activos</span>
                          <span style={{ color: "#ffcbcb", fontWeight: 700 }}>{inactivos} inactivos</span>
                          <span style={{ color: "#fff3bf", fontWeight: 700 }}>{estaExpandido ? "Ocultar" : "Mostrar"}</span>
                        </button>

                        {estaExpandido && (
                          <div style={{ padding: 10 }}>
                            {renderUsuariosTable(rows)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                renderUsuariosTable(usuariosFiltrados)
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
