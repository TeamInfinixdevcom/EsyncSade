import React, { useState, useEffect, useMemo } from "react";
import { getFirestore, collection, addDoc, onSnapshot, doc, writeBatch, getDocs, query, where, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth as getSecondaryAuth, sendPasswordResetEmail } from "firebase/auth";
import { deleteApp, initializeApp } from "firebase/app";
import { auth, firebaseConfig } from "./firebase";
import { getUserAgency, isAgencyAdmin, isGeneralAdmin, isUserAdmin, normalizeAgency, sameAgency } from "./userProfile";
import Dashboard from "./Dashboard";
import TeamReturnsTable from "./TeamReturnsTable";
import * as XLSX from "xlsx";

function extractSeries(text) {
  const matches = text.match(/\b\d{20}\b/g);
  return matches ? matches.sort() : [];
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

export default function AdminPanel({ user }) {
  const PAGE_SIZE = 10;
  const generalAdmin = isGeneralAdmin(user);
  const agencyAdmin = isAgencyAdmin(user) && !generalAdmin;
  const agenciaAdmin = getUserAgency(user);
  const currentUserId = user?.id || auth.currentUser?.uid || "";
  const currentUserEmail = (user?.email || auth.currentUser?.email || "").trim().toLowerCase();

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
  
  // Estados para reportes
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);
  const [filtroReportes, setFiltroReportes] = useState("");
  const [paginaReportes, setPaginaReportes] = useState(1);
  const [agenciaReportesSeleccionada, setAgenciaReportesSeleccionada] = useState("");

  // Estados para gestión de eSIMs individuales
  const [esims, setEsims] = useState([]);
  const [filtroEsims, setFiltroEsims] = useState("");
  const [loteSeleccionado, setLoteSeleccionado] = useState("");
  const [modalReserva, setModalReserva] = useState(false);
  const [esimAReservar, setEsimAReservar] = useState(null);
  const [motivoReserva, setMotivoReserva] = useState("");
  const [guardandoReserva, setGuardandoReserva] = useState(false);
  const [esimABorrar, setEsimABorrar] = useState(null);

  // Estados para uSIMs (SIM físicas)
  const [usimInput, setUsimInput] = useState("");
  const [usimSeries, setUsimSeries] = useState([]);
  const [subiendoUsims, setSubiendoUsims] = useState(false);
  const [usimHistorial, setUsimHistorial] = useState([]);
  const [usimPage, setUsimPage] = useState(1);
  const [usims, setUsims] = useState([]);
  const [usimLotesLoaded, setUsimLotesLoaded] = useState(false);
  const [filtroUsims, setFiltroUsims] = useState("");
  const [usimFiltroUsuarioId, setUsimFiltroUsuarioId] = useState("");
  const [usimFiltroLoteUsuarioId, setUsimFiltroLoteUsuarioId] = useState("");
  const [usimLoteSeleccionado, setUsimLoteSeleccionado] = useState("");
  const [usimAsignando, setUsimAsignando] = useState(false);
  const [usimAsignarUsuarioId, setUsimAsignarUsuarioId] = useState("");
  const [usimAsignarCantidad, setUsimAsignarCantidad] = useState(25);

  // Estados para transferir uSIMs entre usuarios
  const [usimTransferirUsuarioOrigen, setUsimTransferirUsuarioOrigen] = useState("");
  const [usimTransferirUsuarioDestino, setUsimTransferirUsuarioDestino] = useState("");
  const [usimTransferirSeries, setUsimTransferirSeries] = useState([]);
  const [transferiendoUsims, setTransferiendoUsims] = useState(false);
  const [usimUsosPendientes, setUsimUsosPendientes] = useState([]);
  const [usimUsosPendientesPage, setUsimUsosPendientesPage] = useState(1);
  const [usimFiltroConciliacionUsuarioId, setUsimFiltroConciliacionUsuarioId] = useState("");
  const [usimNotasRevision, setUsimNotasRevision] = useState({});
  const [usimRevisandoId, setUsimRevisandoId] = useState("");

  // Estados para descarga de eSIMs disponibles (emergencia)
  const [agenciaDescargarEsims, setAgenciaDescargarEsims] = useState("");
  const [descargandoEsims, setDescargandoEsims] = useState(false);

  const panelWidth =
    view === "dashboard"
      ? "min(96vw, 1280px)"
      : view === "agentes"
      ? "min(96vw, 1000px)"
      : view === "reportes" || view === "esims" || view === "usims" || view === "emergencia"
      ? "min(96vw, 1280px)"
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

  const solicitudesFiltradas = useMemo(() => {
    const filtro = filtroReportes.trim().toLowerCase();
    if (!filtro) return solicitudes;

    return solicitudes.filter((s) =>
      [s.numero, s.cedula, s.pedido, s.tipoGestion, s.detalleGestion, s.usuario, s.agencia]
        .some((v) => String(v || "").toLowerCase().includes(filtro))
    );
  }, [solicitudes, filtroReportes]);

  const solicitudesPaginadas = useMemo(() => {
    const inicio = (paginaReportes - 1) * PAGE_SIZE;
    const fin = inicio + PAGE_SIZE;
    return solicitudesFiltradas.slice(inicio, fin);
  }, [solicitudesFiltradas, paginaReportes]);

  const totalPaginasReportes = useMemo(() => {
    return Math.ceil(solicitudesFiltradas.length / PAGE_SIZE);
  }, [solicitudesFiltradas]);

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
    } catch {
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
    } catch {
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
    } catch {
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

  const fetchSolicitudes = async () => {
    setCargandoSolicitudes(true);
    try {
      const db = getFirestore();
      let q;

      if (generalAdmin) {
        const agenciaFiltro = agenciaReportesSeleccionada
          ? normalizeAgency(agenciaReportesSeleccionada)
          : null;

        if (agenciaFiltro) {
          q = query(
            collection(db, "solicitudes"),
            where("agencia", "==", agenciaFiltro)
          );
        } else {
          q = collection(db, "solicitudes");
        }
      } else {
        q = query(
          collection(db, "solicitudes"),
          where("agencia", "==", agenciaAdmin)
        );
      }

      const snap = await getDocs(q);
      const rows = snap.docs
        .map((docu) => ({ id: docu.id, ...docu.data() }))
        .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

      setSolicitudes(rows);
      setPaginaReportes(1);
    } catch (err) {
      console.error("Error cargando solicitudes:", err);
      setSolicitudes([]);
    }
    setCargandoSolicitudes(false);
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
    if (view === "agentes" || view === "usims") {
      fetchAgentes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, generalAdmin, agenciaAdmin]);

  useEffect(() => {
    if (view === "reportes") {
      fetchSolicitudes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, generalAdmin, agenciaAdmin, agenciaReportesSeleccionada]);

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

  const handleExtractUsims = () => {
    const result = extractSeries(usimInput);
    setUsimSeries(result);
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
    } catch {
      setMensaje("Error al subir las series. Intenta de nuevo.");
    }
    setSubiendo(false);
  };

  // Subir uSIMs como lote a Firestore (colecciones separadas)
  const handleSubirUsims = async () => {
    if (usimSeries.length === 0) {
      setMensaje("No hay series uSIM para subir.");
      return;
    }

    if (!agenciaCargaActiva) {
      setMensaje("Debes seleccionar una agencia para cargar uSIMs.");
      return;
    }

    setSubiendoUsims(true);
    setMensaje("");
    try {
      const db = getFirestore();
      const loteRef = await addDoc(collection(db, "usim_lotes"), {
        fecha: new Date().toISOString(),
        cantidad: usimSeries.length,
        usuario: auth.currentUser?.email || "Desconocido",
        agencia: agenciaCargaActiva,
        series: usimSeries,
      });

      for (const serie of usimSeries) {
        await addDoc(collection(db, "usims"), {
          serie,
          codigoBarras: serie,
          estado: "disponible",
          fechaCarga: new Date().toISOString(),
          agencia: agenciaCargaActiva,
          loteId: loteRef.id,
          asignadoAUid: null,
          asignadoAEmail: null,
          fechaAsignacion: null,
          fechaUso: null,
          usuarioUsoUid: null,
          usuarioUsoEmail: null,
        });
      }

      setMensaje(`Se subieron ${usimSeries.length} uSIMs a la agencia ${agenciaCargaActiva}.`);
      setUsimSeries([]);
      setUsimInput("");
      fetchAgencias();
    } catch {
      setMensaje("Error al subir las uSIMs. Intenta de nuevo.");
    }
    setSubiendoUsims(false);
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

  // Historial de lotes uSIM
  useEffect(() => {
    const db = getFirestore();
    const source = generalAdmin
      ? collection(db, "usim_lotes")
      : query(collection(db, "usim_lotes"), where("agencia", "==", agenciaAdmin));

    const unsub = onSnapshot(source, (snap) => {
      const arr = [];
      snap.forEach((docu) => arr.push({ id: docu.id, ...docu.data() }));
      const filtrado = arr
        .filter((lote) => {
          if (generalAdmin) {
            if (!agenciaCargaActiva) return true;
            return sameAgency(lote.agencia, agenciaCargaActiva);
          }
          return sameAgency(lote.agencia, agenciaAdmin);
        })
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      setUsimHistorial(filtrado);
      setUsimPage(1);
      setUsimLotesLoaded(true);
    });

    return () => unsub();
  }, [generalAdmin, agenciaAdmin, agenciaCargaActiva]);

  // Borrar lote - solo eSIMs disponibles
  const handleBorrarLote = async (lote) => {
    const loteId = lote?.id;
    if (!loteId) return;

    if (!generalAdmin && !sameAgency(lote.agencia, agenciaAdmin)) {
      setMensaje("No puedes borrar lotes de otra agencia.");
      return;
    }

    if (!window.confirm("¿Seguro que deseas borrar este lote? Solo se borrarán las eSIMs disponibles.")) return;
    const db = getFirestore();
    
    try {
      console.log("=== INICIO BORRADO LOTE ===");
      console.log("Lote ID:", loteId);
      console.log("Agencia del lote:", lote.agencia);
      console.log("General Admin:", generalAdmin);
      console.log("Agencia Admin user (mvega):", agenciaAdmin);
      
      // La consulta de un admin de agencia debe estar acotada por agencia para pasar reglas.
      const esimsQuery = generalAdmin
        ? query(collection(db, "esims"), where("loteId", "==", loteId))
        : query(
            collection(db, "esims"),
            where("loteId", "==", loteId),
            where("agencia", "==", lote.agencia)
          );
      const esimsSnap = await getDocs(esimsQuery);
      
      console.log("Total eSIMs encontradas:", esimsSnap.size);
      
      let disponiblesCount = 0;
      let mantenidas = 0;
      let sinAgencia = 0;
      let agenciasMismatch = 0;
      
      const batch = writeBatch(db);
      
      // Revisar cada eSIM antes de agregar al batch
      esimsSnap.forEach((docu, idx) => {
        const esimData = docu.data();
        const esimAgencia = esimData.agencia || "SIN ASIGNAR";
        const estado = esimData.estado || "DESCONOCIDO";
        
        console.log(`eSIM ${idx + 1}/${esimsSnap.size}:`, { 
          id: docu.id, 
          estado: estado,
          agencia: esimAgencia,
          loteId: esimData.loteId,
          agenciaCoincide: esimAgencia === lote.agencia
        });
        
        // Verificar agencia
        if (!esimData.agencia) {
          sinAgencia++;
          console.warn(`  ⚠️ eSIM SIN AGENCIA ASIGNADA`);
          return;
        }
        
        if (esimData.agencia !== lote.agencia) {
          agenciasMismatch++;
          console.warn(`  ⚠️ AGENCIA MISMATCH: ${esimData.agencia} !== ${lote.agencia}`);
          return;
        }
        
        // Solo borrar si está disponible
        if (estado === "disponible") {
          batch.delete(doc(db, "esims", docu.id));
          disponiblesCount++;
        } else {
          mantenidas++;
        }
      });

      console.log("=== RESUMEN ===");
      console.log(`Total: ${esimsSnap.size}`);
      console.log(`- Disponibles a borrar: ${disponiblesCount}`);
      console.log(`- En uso/reservadas: ${mantenidas}`);
      console.log(`- Sin agencia asignada: ${sinAgencia}`);
      console.log(`- Agencia mismatch: ${agenciasMismatch}`);
      
      if (disponiblesCount === 0 && mantenidas === 0 && sinAgencia === 0 && agenciasMismatch === 0) {
        setMensaje("No hay eSIMs para procesar.");
        console.log("Cancelado: No hay eSIMs");
        return;
      }
      
      console.log("Borrando lote documento:", loteId);
      batch.delete(doc(db, "lotes", loteId));
      
      console.log("Ejecutando batch.commit()...");
      await batch.commit();
      
      let mensajeDetalle = `Lote borrado. `;
      if (disponiblesCount > 0) {
        mensajeDetalle += `Se borraron ${disponiblesCount} eSIM(s) disponible(s). `;
      }
      if (mantenidas > 0) {
        mensajeDetalle += `${mantenidas} eSIM(s) en uso/reservada(s) se mantuvieron en historial. `;
      }
      if (sinAgencia > 0) {
        mensajeDetalle += `⚠️ ${sinAgencia} eSIM(s) sin agencia asignada (no se borraron). `;
      }
      if (agenciasMismatch > 0) {
        mensajeDetalle += `⚠️ ${agenciasMismatch} eSIM(s) con agencia diferente (no se borraron).`;
      }
      
      console.log("=== ✅ ÉXITO ===");
      setMensaje(mensajeDetalle);
    } catch (error) {
      console.error("=== ❌ ERROR EN BORRADO ===");
      console.error("Error completo:", error);
      console.error("Código:", error.code);
      console.error("Mensaje:", error.message);
      console.error("Detalles:", error.details);
      setMensaje(`Error al borrar: ${error.message}`);
    }
  };

  // Asignar uSIMs disponibles a un usuario (por cantidad)
  const handleAsignarUsims = async () => {
    const uid = (usimAsignarUsuarioId || "").trim();
    const cantidad = 25;

    if (!uid) {
      setMensaje("Debes seleccionar un usuario para asignar uSIMs.");
      return;
    }

    const agenciaActiva = generalAdmin ? normalizeAgency(agenciaCargaActiva) : agenciaAdmin;
    if (!agenciaActiva) {
      setMensaje("No hay agencia activa para asignar uSIMs.");
      return;
    }

    setUsimAsignando(true);
    setMensaje("");

    try {
      const db = getFirestore();
      const usuarioSnap = await getDocs(query(collection(db, "usuarios"), where("__name__", "==", uid)));
      const usuarioDoc = usuarioSnap.docs[0];
      const usuarioData = usuarioDoc ? usuarioDoc.data() : null;
      const usuarioEmail = String(usuarioData?.email || "").trim().toLowerCase() || "-";

      const asignadasQuery = query(
        collection(db, "usims"),
        where("agencia", "==", agenciaActiva),
        where("estado", "==", "asignada"),
        where("asignadoAUid", "==", uid)
      );
      const asignadasSnap = await getDocs(asignadasQuery);

      if (asignadasSnap.size > 0) {
        setMensaje("El usuario aun tiene uSIMs asignadas. Debe usarlas antes de recibir otro lote.");
        setUsimAsignando(false);
        return;
      }

      const disponiblesQuery = query(
        collection(db, "usims"),
        where("agencia", "==", agenciaActiva),
        where("estado", "==", "disponible")
      );
      const snap = await getDocs(disponiblesQuery);
      const disponibles = snap.docs.slice(0, cantidad);

      if (disponibles.length === 0) {
        setMensaje("No hay uSIMs disponibles para asignar en esta agencia.");
        setUsimAsignando(false);
        return;
      }

      if (disponibles.length < cantidad) {
        setMensaje(`Solo hay ${disponibles.length} uSIM(s) disponible(s) en esta agencia. Se asignarán esas.`);
      }

      const batch = writeBatch(db);
      const ahora = new Date().toISOString();
      disponibles.forEach((docu) => {
        batch.update(doc(db, "usims", docu.id), {
          estado: "asignada",
          asignadoAUid: uid,
          asignadoAEmail: usuarioEmail,
          fechaAsignacion: ahora,
        });
      });
      await batch.commit();

      setMensaje(`Asignadas ${disponibles.length} uSIM(s) a ${usuarioEmail}.`);
    } catch (err) {
      setMensaje(`Error al asignar uSIMs: ${err?.message || "desconocido"}`);
    }

    setUsimAsignando(false);
  };

  // Transferir uSIMs entre usuarios
  const handleTransferirUsims = async () => {
    const origenId = usimTransferirUsuarioOrigen.trim();
    const destinoId = usimTransferirUsuarioDestino.trim();

    if (!origenId || !destinoId) {
      setMensaje("Debes seleccionar usuario origen y destino.");
      return;
    }

    if (origenId === destinoId) {
      setMensaje("El usuario origen y destino deben ser diferentes.");
      return;
    }

    if (usimTransferirSeries.length === 0) {
      setMensaje("No hay series seleccionadas para transferir.");
      return;
    }

    const agenciaActiva = generalAdmin ? normalizeAgency(agenciaCargaActiva) : agenciaAdmin;
    if (!agenciaActiva) {
      setMensaje("No hay agencia activa para transferir uSIMs.");
      return;
    }

    setTransferiendoUsims(true);
    setMensaje("");

    try {
      const db = getFirestore();
      const batch = writeBatch(db);
      const ahora = new Date().toISOString();

      // Obtener datos de usuarios
      const [origenSnap, destinoSnap] = await Promise.all([
        getDocs(query(collection(db, "usuarios"), where("__name__", "==", origenId))),
        getDocs(query(collection(db, "usuarios"), where("__name__", "==", destinoId)))
      ]);

      const origenData = origenSnap.docs[0]?.data();
      const destinoData = destinoSnap.docs[0]?.data();
      const origenEmail = origenData?.email || "-";
      const destinoEmail = destinoData?.email || "-";

      // Transferir cada serie
      usimTransferirSeries.forEach((serie) => {
        const usimDoc = usims.find(u => u.serie === serie);
        if (usimDoc) {
          batch.update(doc(db, "usims", usimDoc.id), {
            asignadoAUid: destinoId,
            asignadoAEmail: destinoEmail,
            fechaAsignacion: ahora,
          });
        }
      });

      await batch.commit();

      // Registrar transferencias en historial
      for (const serie of usimTransferirSeries) {
        await addDoc(collection(db, "usim_transferencias"), {
          fecha: ahora,
          agencia: agenciaActiva,
          serie,
          usuarioOrigenUid: origenId,
          usuarioOrigenEmail: origenEmail,
          usuarioDestinoUid: destinoId,
          usuarioDestinoEmail: destinoEmail,
          adminUid: currentUserId,
          adminEmail: currentUserEmail,
        });
      }

      setMensaje(`Transferidas ${usimTransferirSeries.length} uSIM(s) de ${origenEmail} a ${destinoEmail}.`);
      setUsimTransferirSeries([]);
      setUsimTransferirUsuarioOrigen("");
      setUsimTransferirUsuarioDestino("");
    } catch (err) {
      setMensaje(`Error al transferir uSIMs: ${err?.message || "desconocido"}`);
    }

    setTransferiendoUsims(false);
  };

  const handleAprobarUsoUsim = async (uso) => {
    if (!uso?.id) return;

    setUsimRevisandoId(uso.id);
    setMensaje("");

    try {
      const nota = String(usimNotasRevision[uso.id] || "").trim();
      const ahora = new Date().toISOString();
      const db = getFirestore();
      await updateDoc(doc(db, "usim_usos", uso.id), {
        estadoRevision: "rebajada",
        notaAdmin: nota,
        fechaRevision: ahora,
        revisadoPorUid: currentUserId || null,
        revisadoPorEmail: currentUserEmail || null,
      });

      setUsimNotasRevision((prev) => ({ ...prev, [uso.id]: "" }));
    } catch (err) {
      setMensaje(`Error al aprobar uSIM: ${err?.message || "desconocido"}`);
    }

    setUsimRevisandoId("");
  };

  const handleRechazarUsoUsim = async (uso) => {
    if (!uso?.id) return;

    const nota = String(usimNotasRevision[uso.id] || "").trim();
    if (!nota) {
      setMensaje("Debes indicar una nota con lo que debe corregir el agente.");
      return;
    }

    setUsimRevisandoId(uso.id);
    setMensaje("");

    try {
      const ahora = new Date().toISOString();
      const db = getFirestore();
      await updateDoc(doc(db, "usim_usos", uso.id), {
        estadoRevision: "correccion",
        notaAdmin: nota,
        fechaRevision: ahora,
        revisadoPorUid: currentUserId || null,
        revisadoPorEmail: currentUserEmail || null,
      });
    } catch (err) {
      setMensaje(`Error al pedir correccion: ${err?.message || "desconocido"}`);
    }

    setUsimRevisandoId("");
  };

  // Registrar uso de una uSIM (agente)
  const handleRegistrarUsoUsim = async (usim) => {
    if (!usim?.id) return;

    if (!window.confirm(`¿Registrar uso de la uSIM ${usim.serie}?`)) return;

    try {
      const db = getFirestore();
      const ahora = new Date().toISOString();

      await updateDoc(doc(db, "usims", usim.id), {
        estado: "usada",
        fechaUso: ahora,
        usuarioUsoUid: currentUserId || null,
        usuarioUsoEmail: currentUserEmail || null,
      });

      await addDoc(collection(db, "usim_usos"), {
        fecha: ahora,
        agencia: usim.agencia || agenciaAdmin,
        serie: usim.serie,
        loteId: usim.loteId || null,
        usuarioUid: currentUserId || null,
        usuarioEmail: currentUserEmail || null,
      });

      setMensaje(`uSIM ${usim.serie} registrada como usada.`);
    } catch (err) {
      setMensaje(`Error registrando uso: ${err?.message || "desconocido"}`);
    }
  };

  // Eliminar uSIM individual
  const handleEliminarUsim = async (usim) => {
    if (!usim?.id) return;
    if (!window.confirm(`¿Eliminar permanentemente la uSIM ${usim.serie}? Esta acción no se puede deshacer.`)) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, "usims", usim.id));
      setMensaje(`uSIM ${usim.serie} eliminada correctamente.`);
    } catch (err) {
      setMensaje(`Error eliminando uSIM: ${err?.message || "desconocido"}`);
    }
  };

  // Eliminar lote completo de uSIMs
  const handleEliminarLoteUsims = async (loteId) => {
    if (!loteId) return;
    const lote = usimHistorial.find(l => l.id === loteId);
    if (!lote) return;
    if (!window.confirm(`¿Eliminar las uSIMs disponibles del lote de ${lote.cantidad} uSIMs? Las usadas o asignadas se mantienen.`)) return;

    try {
      const db = getFirestore();
      const batch = writeBatch(db);

      const baseConstraints = [where("loteId", "==", loteId)];
      const agenciaFiltro = generalAdmin ? normalizeAgency(agenciaCargaActiva) : agenciaAdmin;
      if (agenciaFiltro) {
        baseConstraints.push(where("agencia", "==", agenciaFiltro));
      }

      const totalQuery = query(collection(db, "usims"), ...baseConstraints);
      const eliminablesQuery = query(
        collection(db, "usims"),
        ...baseConstraints,
        where("estado", "in", ["disponible", "asignada"])
      );

      const [totalSnap, eliminablesSnap] = await Promise.all([
        getDocs(totalQuery),
        getDocs(eliminablesQuery),
      ]);

      eliminablesSnap.docs.forEach((docu) => {
        batch.delete(doc(db, "usims", docu.id));
      });

      // Eliminar el lote
      batch.delete(doc(db, "usim_lotes", loteId));

      await batch.commit();
      const disponiblesCount = eliminablesSnap.size;
      const totalCount = totalSnap.size;
      const mantenidas = Math.max(0, totalCount - disponiblesCount);
      let detalle = `Se borraron ${disponiblesCount} uSIM(s) disponible(s) o asignada(s).`;
      if (mantenidas > 0) {
        detalle += ` ${mantenidas} uSIM(s) usada(s) se mantuvieron.`;
      }
      setMensaje(detalle);
    } catch (err) {
      setMensaje(`Error eliminando lote: ${err?.message || "desconocido"}`);
    }
  };

  // Cargar eSIMs para visualizar y gestionar individualmente
  useEffect(() => {
    const db = getFirestore();
    const agenciaFiltro = generalAdmin ? (agenciaCargaActiva || null) : agenciaAdmin;
    
    if (!agenciaFiltro) {
      setEsims([]);
      return;
    }

    let source;
    if (loteSeleccionado) {
      source = query(
        collection(db, "esims"),
        where("loteId", "==", loteSeleccionado),
        where("agencia", "==", agenciaFiltro)
      );
    } else {
      source = query(
        collection(db, "esims"),
        where("agencia", "==", agenciaFiltro)
      );
    }

    const unsub = onSnapshot(source, (snap) => {
      const arr = [];
      snap.forEach(docu => arr.push({ id: docu.id, ...docu.data() }));
      const ordenado = arr.sort((a, b) => {
        const fechaA = new Date(a.fechaCarga || 0);
        const fechaB = new Date(b.fechaCarga || 0);
        return fechaB - fechaA;
      });
      setEsims(ordenado);
    });
    return () => unsub();
  }, [generalAdmin, agenciaAdmin, agenciaCargaActiva, loteSeleccionado]);

  // Cargar uSIMs (segun rol)
  useEffect(() => {
    const db = getFirestore();
    const agenciaFiltro = generalAdmin ? (agenciaCargaActiva || null) : agenciaAdmin;

    if (generalAdmin) {
      if (!agenciaFiltro) {
        setUsims([]);
        return;
      }
    }

    let source;
    if (generalAdmin || agencyAdmin) {
      const agencia = generalAdmin ? normalizeAgency(agenciaFiltro) : agenciaAdmin;
      if (!agencia) {
        setUsims([]);
        return;
      }

      if (usimLoteSeleccionado) {
        source = query(
          collection(db, "usims"),
          where("loteId", "==", usimLoteSeleccionado),
          where("agencia", "==", agencia)
        );
      } else {
        source = query(collection(db, "usims"), where("agencia", "==", agencia));
      }
    } else {
      // Agente: solo ve lo asignado
      if (!currentUserId && !currentUserEmail) {
        setUsims([]);
        return;
      }

      if (currentUserId) {
        source = query(collection(db, "usims"), where("asignadoAUid", "==", currentUserId));
      } else {
        source = query(collection(db, "usims"), where("asignadoAEmail", "==", currentUserEmail));
      }
    }

    const unsub = onSnapshot(source, (snap) => {
      const arr = [];
      snap.forEach((docu) => arr.push({ id: docu.id, ...docu.data() }));
      arr.sort((a, b) => new Date(b.fechaCarga || 0) - new Date(a.fechaCarga || 0));
      setUsims(arr);
    });

    return () => unsub();
  }, [
    generalAdmin,
    agencyAdmin,
    agenciaAdmin,
    agenciaCargaActiva,
    usimLoteSeleccionado,
    currentUserId,
    currentUserEmail,
  ]);

  useEffect(() => {
    if (!generalAdmin && !agencyAdmin) {
      setUsimUsosPendientes([]);
      return undefined;
    }

    if (view !== "usims") {
      setUsimUsosPendientes([]);
      return undefined;
    }

    const agenciaActiva = generalAdmin ? normalizeAgency(agenciaCargaActiva) : agenciaAdmin;
    if (!agenciaActiva) {
      setUsimUsosPendientes([]);
      return undefined;
    }

    const db = getFirestore();
    const source = query(
      collection(db, "usim_usos"),
      where("agencia", "==", agenciaActiva),
      where("estadoRevision", "==", "pendiente")
    );

    const unsub = onSnapshot(source, (snap) => {
      const rows = [];
      snap.forEach((docu) => rows.push({ id: docu.id, ...docu.data() }));
      rows.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
      setUsimUsosPendientes(rows);
      setUsimUsosPendientesPage(1);
    });

    return () => unsub();
  }, [view, generalAdmin, agencyAdmin, agenciaAdmin, agenciaCargaActiva]);

  // Reservar eSIM con motivo
  const handleReservarEsim = async () => {
    if (!esimAReservar || !motivoReserva.trim()) {
      setMensaje("Debes ingresar un motivo para la reserva.");
      return;
    }

    setGuardandoReserva(true);
    try {
      const db = getFirestore();
      await updateDoc(doc(db, "esims", esimAReservar.id), {
        estado: "reservada",
        motivoReserva: motivoReserva.trim(),
        fechaReserva: new Date().toISOString(),
        usuarioReserva: auth.currentUser?.email || "Desconocido"
      });
      setMensaje(`eSIM ${esimAReservar.serie} reservada: "${motivoReserva.trim()}"`);
      setModalReserva(false);
      setEsimAReservar(null);
      setMotivoReserva("");
    } catch (err) {
      setMensaje(`Error al reservar eSIM: ${err.message}`);
    }
    setGuardandoReserva(false);
  };

  // Borrar eSIM individual
  const handleBorrarEsim = async (esim) => {
    const serie = esim?.serie || "desconocida";
    if (!window.confirm(`¿Seguro que deseas borrar la eSIM ${serie}?`)) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, "esims", esim.id));
      setMensaje(`eSIM ${serie} borrada correctamente.`);
      setEsimABorrar(null);
    } catch (err) {
      setMensaje(`Error al borrar eSIM: ${err.message}`);
    }
  };

  // Liberar eSIM reservada (volver a disponible)
  const handleLiberarEsim = async (esim) => {
    if (esim.estado !== "reservada") {
      setMensaje("Esta eSIM no está reservada.");
      return;
    }

    if (!window.confirm(`¿Liberar eSIM ${esim.serie} de vuelta a disponible?`)) return;

    try {
      const db = getFirestore();
      await updateDoc(doc(db, "esims", esim.id), {
        estado: "disponible",
        motivoReserva: null,
        fechaReserva: null,
        usuarioReserva: null
      });
      setMensaje(`eSIM ${esim.serie} liberada a disponible.`);
    } catch (err) {
      setMensaje(`Error al liberar eSIM: ${err.message}`);
    }
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

  const usimUsosPendientesFiltrados = useMemo(() => {
    if (!usimFiltroConciliacionUsuarioId) return usimUsosPendientes;
    return usimUsosPendientes.filter((uso) => uso.usuarioUid === usimFiltroConciliacionUsuarioId);
  }, [usimUsosPendientes, usimFiltroConciliacionUsuarioId]);

  const usimFiltroLoteUsuarioEmail = useMemo(() => {
    if (!usimFiltroLoteUsuarioId) return "";
    const selected = agentes.find((a) => a.id === usimFiltroLoteUsuarioId);
    return String(selected?.email || "").trim().toLowerCase();
  }, [usimFiltroLoteUsuarioId, agentes]);

  const usimHistorialFiltrado = useMemo(() => {
    if (!usimFiltroLoteUsuarioEmail) return usimHistorial;
    return usimHistorial.filter((lote) => String(lote.usuario || "").trim().toLowerCase() === usimFiltroLoteUsuarioEmail);
  }, [usimHistorial, usimFiltroLoteUsuarioEmail]);

  const usimsFiltradasPorLote = useMemo(() => {
    if (!usimLotesLoaded) return usims;
    const loteIds = new Set(usimHistorial.map((lote) => lote.id));
    if (loteIds.size === 0) {
      return usims.filter((usim) => usim.estado === "usada" || !usim.loteId);
    }
    return usims.filter((usim) =>
      usim.estado === "usada" || !usim.loteId || loteIds.has(usim.loteId)
    );
  }, [usims, usimHistorial, usimLotesLoaded]);

  const totalPaginasUsimUsosPendientes = Math.max(1, Math.ceil(usimUsosPendientesFiltrados.length / PAGE_SIZE));
  const paginaUsimUsosPendientesActual = Math.min(usimUsosPendientesPage, totalPaginasUsimUsosPendientes);
  const usimUsosPendientesPagina = usimUsosPendientesFiltrados.slice(
    (paginaUsimUsosPendientesActual - 1) * PAGE_SIZE,
    paginaUsimUsosPendientesActual * PAGE_SIZE
  );

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

  const renderSolicitudesTable = (rows) => (
    <table style={{ width: "100%", borderCollapse: "collapse", background: "#232323", borderRadius: 12, overflow: "hidden", fontSize: 13 }}>
      <thead>
        <tr style={{ background: "#ff66ff22", color: "#fff" }}>
          <th style={{ textAlign: "left", padding: 8 }}>Número</th>
          <th style={{ textAlign: "left", padding: 8 }}>Cédula</th>
          <th style={{ textAlign: "left", padding: 8 }}>Pedido</th>
          <th style={{ textAlign: "left", padding: 8 }}>Tipo</th>
          <th style={{ textAlign: "left", padding: 8 }}>Agencia</th>
          <th style={{ textAlign: "left", padding: 8 }}>Usuario</th>
          <th style={{ textAlign: "left", padding: 8 }}>Fecha</th>
          <th style={{ textAlign: "left", padding: 8 }}>Serie</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id} style={{ borderBottom: "1px solid #3b3b3b", "&:hover": { background: "#2a2a2a" } }}>
            <td style={{ padding: 8 }}>{s.numero || "-"}</td>
            <td style={{ padding: 8 }}>{s.cedula || "-"}</td>
            <td style={{ padding: 8 }}>{s.pedido || "-"}</td>
            <td style={{ padding: 8 }}>
              <span style={{
                background: s.tipoGestion === "plan_nuevo_komercial" ? "#ff66ff" : s.tipoGestion === "cambio_sim_komercial" ? "#bd34fe" : "#00fff7",
                color: "#181818",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700
              }}>
                {s.detalleGestion || s.tipoGestion || "-"}
              </span>
            </td>
            <td style={{ padding: 8 }}>{s.agencia || "-"}</td>
            <td style={{ padding: 8 }}>{s.usuario ? s.usuario.split("@")[0] : "-"}</td>
            <td style={{ padding: 8 }}>{formatDateTimeWithSeconds(s.fecha)}</td>
            <td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }}>{s.serie || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Descargar eSIMs disponibles en Excel
  const handleDescargarEsimsDisponibles = async () => {
    const agenciaActiva = agenciaDescargarEsims || agenciaCargaActiva;
    
    if (!agenciaActiva) {
      setMensaje("Debes seleccionar una agencia para descargar las eSIMs.");
      return;
    }

    setDescargandoEsims(true);
    setMensaje("");

    try {
      const db = getFirestore();
      const esimsQuery = query(
        collection(db, "esims"),
        where("agencia", "==", agenciaActiva),
        where("estado", "==", "disponible")
      );

      const snap = await getDocs(esimsQuery);
      const esimDisponibles = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (esimDisponibles.length === 0) {
        setMensaje(`No hay eSIMs disponibles en la agencia ${agenciaActiva}.`);
        setDescargandoEsims(false);
        return;
      }

      // Preparar datos para Excel
      const dataExcel = esimDisponibles.map((esim, idx) => ({
        "N°": idx + 1,
        "Serie": esim.serie || "-",
        "Estado": "disponible",
        "Agencia": esim.agencia || "-",
        "Fecha Carga": esim.fechaCarga ? new Date(esim.fechaCarga).toLocaleString("es-CR") : "-",
      }));

      // Crear workbook y worksheet
      const ws = XLSX.utils.json_to_sheet(dataExcel);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "eSIMs Disponibles");

      // Ajustar ancho de columnas
      ws["!cols"] = [
        { wch: 6 },  // N°
        { wch: 25 }, // Serie
        { wch: 12 }, // Estado
        { wch: 15 }, // Agencia
        { wch: 25 }, // Fecha Carga
      ];

      // Descargar archivo
      const nombreArchivo = `eSIMs_Disponibles_${agenciaActiva}_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, nombreArchivo);

      setMensaje(`✅ Descargado: ${esimDisponibles.length} eSIM(s) disponible(s) de ${agenciaActiva}`);
    } catch (err) {
      setMensaje(`Error al descargar eSIMs: ${err?.message || "desconocido"}`);
      console.error(err);
    }

    setDescargandoEsims(false);
  };

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
        <button
          onClick={() => setView("reportes")}
          style={{ background: view === "reportes" ? "#ff66ff" : "#232323", color: view === "reportes" ? "#fff" : "#ff66ff", border: 'none', borderRadius: 12, padding: '0.7rem 2rem', fontWeight: 900, fontSize: 18, boxShadow: view === "reportes" ? '0 2px 16px #ff66ffcc' : 'none', cursor: 'pointer', letterSpacing: 1, textShadow: view === "reportes" ? '0 1px 8px #fff' : '0 1px 8px #ff66ffcc' }}
        >Reportes</button>
        <button
          onClick={() => setView("esims")}
          style={{ background: view === "esims" ? "#ff6b6b" : "#232323", color: view === "esims" ? "#fff" : "#ff6b6b", border: 'none', borderRadius: 12, padding: '0.7rem 2rem', fontWeight: 900, fontSize: 18, boxShadow: view === "esims" ? '0 2px 16px #ff6b6bcc' : 'none', cursor: 'pointer', letterSpacing: 1, textShadow: view === "esims" ? '0 1px 8px #fff' : '0 1px 8px #ff6b6bcc' }}
        >Gestión eSIMs</button>
        <button
          onClick={() => setView("usims")}
          style={{ background: view === "usims" ? "#ff0055" : "#232323", color: view === "usims" ? "#fff" : "#ff0055", border: "none", borderRadius: 12, padding: "0.7rem 2rem", fontWeight: 900, fontSize: 18, boxShadow: view === "usims" ? "0 2px 16px #ff0055cc" : "none", cursor: "pointer", letterSpacing: 1, textShadow: view === "usims" ? "0 1px 8px #fff" : "0 1px 8px #ff0055cc" }}
        >
          uSIMs
        </button>
        {(generalAdmin || agencyAdmin) && (
          <button
            onClick={() => setView("emergencia")}
            style={{ background: view === "emergencia" ? "#ff9800" : "#232323", color: view === "emergencia" ? "#fff" : "#ff9800", border: "none", borderRadius: 12, padding: "0.7rem 2rem", fontWeight: 900, fontSize: 18, boxShadow: view === "emergencia" ? "0 2px 16px #ff9800cc" : "none", cursor: "pointer", letterSpacing: 1, textShadow: view === "emergencia" ? "0 1px 8px #fff" : "0 1px 8px #ff9800cc" }}
          >
            🚨 Emergencia
          </button>
        )}
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
      {view === "reportes" && (
        <div style={{ width: '100%', maxWidth: 1280, margin: "0 auto", background: "#181818", borderRadius: 20, boxShadow: "0 0 32px 4px #ff66ffcc", padding: "2.5vw 2vw", color: "#fff", boxSizing: 'border-box' }}>
          <h2 style={{ color: "#ff66ff", textShadow: '0 2px 12px #ff66ffcc, 0 0 2px #fff', fontWeight: 900, letterSpacing: 2 }}>Reportes de Solicitudes</h2>

          {generalAdmin && (
            <div style={{ marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, color: "#ff99ff", fontWeight: 700, fontSize: 13 }}>Filtrar por agencia</label>
                <select
                  value={agenciaReportesSeleccionada}
                  onChange={(e) => setAgenciaReportesSeleccionada(e.target.value)}
                  style={{ padding: 8, borderRadius: 6, border: "1.5px solid #ff66ff", background: "#232323", color: "#fff", fontSize: 13 }}
                >
                  <option value="">Todas las agencias</option>
                  {agenciasDisponibles.map((agencia) => (
                    <option key={agencia} value={agencia}>{agencia}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Buscar por número, cédula, pedido, tipo o usuario..."
              value={filtroReportes}
              onChange={(e) => setFiltroReportes(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #ff66ff", background: "#232323", color: "#fff", fontSize: 14, outline: "none" }}
            />
          </div>

          <div style={{ marginBottom: 12, color: "#ff99ff", fontSize: 13, fontWeight: 700 }}>
            Mostrando {solicitudesPaginadas.length} de {solicitudesFiltradas.length} solicitudes
          </div>

          {cargandoSolicitudes ? (
            <div style={{ color: "#ff99ff", fontWeight: 700 }}>Cargando reportes...</div>
          ) : solicitudesFiltradas.length === 0 ? (
            <div style={{ color: "#ffccff", fontWeight: 700 }}>No hay solicitudes que coincidan con los filtros.</div>
          ) : (
            <>
              <div style={{ overflowX: "auto", marginBottom: 20 }}>
                {renderSolicitudesTable(solicitudesPaginadas)}
              </div>

              {totalPaginasReportes > 1 && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setPaginaReportes(1)}
                    disabled={paginaReportes === 1}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ff66ff", background: paginaReportes === 1 ? "#4a4a4a" : "#232323", color: "#ff66ff", fontWeight: 700, cursor: paginaReportes === 1 ? "not-allowed" : "pointer" }}
                  >
                    Primera
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaginaReportes(Math.max(1, paginaReportes - 1))}
                    disabled={paginaReportes === 1}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ff66ff", background: paginaReportes === 1 ? "#4a4a4a" : "#232323", color: "#ff66ff", fontWeight: 700, cursor: paginaReportes === 1 ? "not-allowed" : "pointer" }}
                  >
                    Anterior
                  </button>
                  {Array.from({ length: totalPaginasReportes }, (_, i) => i + 1)
                    .filter((n) => Math.abs(n - paginaReportes) <= 2 || n === 1 || n === totalPaginasReportes)
                    .map((n, idx, arr) => (
                      <span key={n}>
                        {idx > 0 && arr[idx - 1] !== n - 1 && <span style={{ color: "#ff99ff" }}>...</span>}
                        <button
                          type="button"
                          onClick={() => setPaginaReportes(n)}
                          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ff66ff", background: paginaReportes === n ? "#ff66ff" : "#232323", color: paginaReportes === n ? "#181818" : "#ff66ff", fontWeight: paginaReportes === n ? 900 : 700, cursor: "pointer" }}
                        >
                          {n}
                        </button>
                      </span>
                    ))}
                  <button
                    type="button"
                    onClick={() => setPaginaReportes(Math.min(totalPaginasReportes, paginaReportes + 1))}
                    disabled={paginaReportes === totalPaginasReportes}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ff66ff", background: paginaReportes === totalPaginasReportes ? "#4a4a4a" : "#232323", color: "#ff66ff", fontWeight: 700, cursor: paginaReportes === totalPaginasReportes ? "not-allowed" : "pointer" }}
                  >
                    Siguiente
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaginaReportes(totalPaginasReportes)}
                    disabled={paginaReportes === totalPaginasReportes}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ff66ff", background: paginaReportes === totalPaginasReportes ? "#4a4a4a" : "#232323", color: "#ff66ff", fontWeight: 700, cursor: paginaReportes === totalPaginasReportes ? "not-allowed" : "pointer" }}
                  >
                    Última
                  </button>
                </div>
              )}
            </>
          )}

          <div style={{ marginTop: 28 }}>
            <TeamReturnsTable user={user} />
          </div>
        </div>
      )}
      {view === "esims" && (
        <div style={{ width: '100%', maxWidth: 1280, margin: "0 auto", background: "#181818", borderRadius: 20, boxShadow: "0 0 32px 4px #ff6b6bcc", padding: "2.5vw 2vw", color: "#fff", boxSizing: 'border-box' }}>
          <h2 style={{ color: "#ff6b6b", textShadow: '0 2px 12px #ff6b6bcc, 0 0 2px #fff', fontWeight: 900, letterSpacing: 2 }}>Gestión de eSIMs Individuales</h2>

          <div style={{ marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", marginBottom: 6, color: "#ff9b9b", fontWeight: 700, fontSize: 13 }}>Filtrar por lote</label>
              <select
                value={loteSeleccionado}
                onChange={(e) => setLoteSeleccionado(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1.5px solid #ff6b6b", background: "#232323", color: "#fff", fontSize: 13 }}
              >
                <option value="">Todas las eSIMs</option>
                {historial.map((lote) => (
                  <option key={lote.id} value={lote.id}>
                    Lote {new Date(lote.fecha).toLocaleDateString("es-CR")} ({lote.cantidad} series)
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", marginBottom: 6, color: "#ff9b9b", fontWeight: 700, fontSize: 13 }}>Buscar por serie</label>
              <input
                type="text"
                placeholder="Serie..."
                value={filtroEsims}
                onChange={(e) => setFiltroEsims(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1.5px solid #ff6b6b", background: "#232323", color: "#fff", fontSize: 13, outline: "none" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12, color: "#ff9b9b", fontSize: 13, fontWeight: 700 }}>
            Total eSIMs: {esims.length}
          </div>

          {esims.length === 0 ? (
            <div style={{ color: "#ffcccc", fontWeight: 700, textAlign: "center", padding: "2rem" }}>
              No hay eSIMs en esta agencia o lote.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#232323", borderRadius: 12, overflow: "hidden", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#ff6b6b33", color: "#fff" }}>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ff6b6b" }}>Serie</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ff6b6b" }}>Estado</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ff6b6b" }}>Motivo/Persona (si reservada)</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ff6b6b" }}>Reservado por / Fecha</th>
                    <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid #ff6b6b" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {esims
                    .filter((esim) =>
                      filtroEsims === "" || String(esim.serie || "").includes(filtroEsims)
                    )
                    .map((esim, idx) => (
                      <tr key={esim.id} style={{ borderBottom: "1px solid #3b3b3b", background: idx % 2 === 0 ? "#1a1a1a" : "#232323" }}>
                        <td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }}>{esim.serie}</td>
                        <td style={{ padding: 8 }}>
                          <span style={{
                            background: esim.estado === "disponible" ? "#00ff7733" : esim.estado === "reservada" ? "#ffaa0033" : "#ff000033",
                            color: esim.estado === "disponible" ? "#00ff77" : esim.estado === "reservada" ? "#ffaa00" : "#ff0000",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700
                          }}>
                            {esim.estado || "sin estado"}
                          </span>
                        </td>
                        <td style={{ padding: 8, fontSize: 11, color: esim.motivoReserva ? "#ffaa00" : "#999" }}>
                          {esim.motivoReserva || "-"}
                        </td>
                        <td style={{ padding: 8, fontSize: 11, color: "#ccc" }}>
                          {esim.usuarioReserva && esim.fechaReserva ? (
                            <>
                              <div>{esim.usuarioReserva.split("@")[0]}</div>
                              <div style={{ fontSize: 10, color: "#999" }}>{new Date(esim.fechaReserva).toLocaleString("es-CR")}</div>
                            </>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td style={{ padding: 8, textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                            {esim.estado !== "reservada" && (
                              <button
                                onClick={() => {
                                  setEsimAReservar(esim);
                                  setMotivoReserva("");
                                  setModalReserva(true);
                                }}
                                style={{ background: "#ffaa00", color: "#181818", border: "none", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                              >
                                Reservar
                              </button>
                            )}
                            {esim.estado === "reservada" && (
                              <button
                                onClick={() => handleLiberarEsim(esim)}
                                style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                              >
                                Liberar
                              </button>
                            )}
                            <button
                              onClick={() => setEsimABorrar(esim)}
                              style={{ background: "#ff6b6b", color: "#fff", border: "none", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                            >
                              Borrar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {mensaje && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: mensaje.includes("Error") ? "#ff000033" : "#00ff0033", color: mensaje.includes("Error") ? "#ff6b6b" : "#00ff77", fontWeight: 700 }}>
              {mensaje}
            </div>
          )}
        </div>
      )}

      {view === "usims" && (
        <div style={{ width: "100%", maxWidth: 1280, margin: "0 auto", background: "#181818", borderRadius: 20, boxShadow: "0 0 32px 4px #ff0055cc", padding: "2.5vw 2vw", color: "#fff", boxSizing: "border-box" }}>
          <h2 style={{ color: "#ff0055", textShadow: "0 2px 12px #ff0055cc, 0 0 2px #fff", fontWeight: 900, letterSpacing: 2 }}>Gestión de uSIMs (SIM Física)</h2>

          {(generalAdmin || agencyAdmin) && (
            <div style={{ marginTop: 14, marginBottom: 18, padding: 14, borderRadius: 12, border: "1.5px solid #ff005555", background: "#220011" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                {generalAdmin ? (
                  <div style={{ minWidth: 260 }}>
                    <label style={{ display: "block", marginBottom: 6, color: "#ffccdd", fontWeight: 700 }}>Agencia destino</label>
                    <input
                      list="agencias-usims"
                      value={agenciaCarga}
                      onChange={(e) => setAgenciaCarga(e.target.value)}
                      placeholder="Ejemplo: Pavas"
                      style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #ff0055", fontSize: 15, background: "#1a0011", color: "#fff", outline: "none" }}
                    />
                    <datalist id="agencias-usims">
                      {agenciasDisponibles.map((agencia) => (
                        <option key={agencia} value={agencia} />
                      ))}
                    </datalist>
                  </div>
                ) : (
                  <div style={{ color: "#ffccdd", fontWeight: 800 }}>
                    Agencia activa: {agenciaAdmin || "No asignada"}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleExtractUsims}
                  style={{ background: "#ff0055", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 900, cursor: "pointer", boxShadow: "0 2px 14px #ff0055aa" }}
                >
                  Extraer Series
                </button>
                <button
                  type="button"
                  onClick={handleSubirUsims}
                  disabled={subiendoUsims}
                  style={{ background: subiendoUsims ? "#661133" : "#ff0055", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 900, cursor: subiendoUsims ? "not-allowed" : "pointer", boxShadow: "0 2px 14px #ff0055aa", opacity: subiendoUsims ? 0.7 : 1 }}
                >
                  {subiendoUsims ? "Subiendo..." : "Subir uSIMs"}
                </button>
              </div>

              <div style={{ marginTop: 12 }}>
                <textarea
                  value={usimInput}
                  onChange={(e) => setUsimInput(e.target.value)}
                  rows={5}
                  placeholder="Pega aquí las series uSIM (20 dígitos)..."
                  style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 8, border: "1.5px solid #ff0055", fontSize: 14, background: "#1a0011", color: "#fff", outline: "none", resize: "vertical" }}
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ color: "#ffccdd", fontWeight: 800, marginBottom: 6 }}>Series uSIM encontradas ({usimSeries.length}):</div>
                <textarea
                  value={usimSeries.join("\n")}
                  readOnly
                  rows={Math.min(6, Math.max(2, usimSeries.length))}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #ff005555", fontSize: 13, background: "#220011", color: "#ffccdd", outline: "none", resize: "vertical" }}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  <h3 style={{ color: "#ff0055", margin: 0 }}>Historial de lotes uSIM</h3>
                  <div style={{ minWidth: 240, flex: 1 }}>
                    <label style={{ display: "block", marginBottom: 6, color: "#ffccdd", fontWeight: 800, fontSize: 12 }}>Filtrar por usuario</label>
                    <select
                      value={usimFiltroLoteUsuarioId}
                      onChange={(e) => {
                        setUsimFiltroLoteUsuarioId(e.target.value);
                        setUsimPage(1);
                      }}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1.5px solid #ff0055", background: "#1a0011", color: "#fff", fontSize: 13 }}
                    >
                      <option value="">Todos los usuarios</option>
                      {agentes
                        .filter((u) => (generalAdmin ? !!u.id : sameAgency(u.agencia, agenciaAdmin)))
                        .filter((u) => !isUserAdmin(u))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {(u.email || u.nombre || u.name || u.id) + (u.agencia ? ` (${u.agencia})` : "")}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div style={{ maxHeight: "24vh", overflow: "auto", border: "1.5px solid #ff005555", borderRadius: 12, background: "#220011" }}>
                  {usimHistorialFiltrado.length === 0 ? (
                    <div style={{ padding: 12, color: "#bfe9ff", opacity: 0.8 }}>Sin lotes uSIM.</div>
                  ) : (
                    <>
                      <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: 14 }}>
                        <thead>
                          <tr style={{ background: "#ff005522" }}>
                            <th style={{ textAlign: "left", padding: 8 }}>Fecha</th>
                            {generalAdmin && <th style={{ textAlign: "left", padding: 8 }}>Agencia</th>}
                            <th style={{ textAlign: "left", padding: 8 }}>Cantidad</th>
                            <th style={{ textAlign: "left", padding: 8 }}>Usuario</th>
                            <th style={{ textAlign: "center", padding: 8 }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usimHistorialFiltrado.slice((usimPage - 1) * PAGE_SIZE, usimPage * PAGE_SIZE).map((lote) => (
                            <tr key={lote.id} style={{ borderBottom: "1px solid #1c3444" }}>
                              <td style={{ padding: 8 }}>{new Date(lote.fecha).toLocaleString("es-CR")}</td>
                              {generalAdmin && <td style={{ padding: 8 }}>{lote.agencia || "-"}</td>}
                              <td style={{ padding: 8 }}>{lote.cantidad || 0}</td>
                              <td style={{ padding: 8 }}>{lote.usuario || "-"}</td>
                              <td style={{ padding: 8, textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => handleEliminarLoteUsims(lote.id)}
                                  style={{ background: "#ff6b6b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontWeight: 900, cursor: "pointer", fontSize: 12 }}
                                >
                                  Eliminar lote
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, padding: 10 }}>
                        <button
                          type="button"
                          onClick={() => setUsimPage(usimPage - 1)}
                          disabled={usimPage === 1}
                          style={{ background: "#ff0055", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 900, cursor: usimPage === 1 ? "not-allowed" : "pointer", opacity: usimPage === 1 ? 0.5 : 1 }}
                        >
                          Anterior
                        </button>
                        <span style={{ color: "#ffccdd", fontWeight: 800 }}>
                          Página {usimPage} de {Math.max(1, Math.ceil(usimHistorialFiltrado.length / PAGE_SIZE))}
                        </span>
                        <button
                          type="button"
                          onClick={() => setUsimPage(usimPage + 1)}
                          disabled={usimPage * PAGE_SIZE >= usimHistorialFiltrado.length}
                          style={{ background: "#ff0055", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 900, cursor: usimPage * PAGE_SIZE >= usimHistorialFiltrado.length ? "not-allowed" : "pointer", opacity: usimPage * PAGE_SIZE >= usimHistorialFiltrado.length ? 0.5 : 1 }}
                        >
                          Siguiente
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {(generalAdmin || agencyAdmin) && (
            <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, border: "1.5px solid #ff005555", background: "#220011" }}>
              <h3 style={{ color: "#ff0055", marginBottom: 10 }}>Asignar uSIMs a usuario</h3>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ minWidth: 320, flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 6, color: "#ffccdd", fontWeight: 800, fontSize: 13 }}>Usuario</label>
                  <select
                    value={usimAsignarUsuarioId}
                    onChange={(e) => setUsimAsignarUsuarioId(e.target.value)}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #ff0055", background: "#1a0011", color: "#fff", fontSize: 14 }}
                  >
                    <option value="">Seleccionar usuario...</option>
                    {agentes
                      .filter((u) => (generalAdmin ? !!u.id : sameAgency(u.agencia, agenciaAdmin)))
                      .filter((u) => !isUserAdmin(u))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.email || u.nombre || u.name || u.id) + (u.agencia ? ` (${u.agencia})` : "")}
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ width: 160 }}>
                  <label style={{ display: "block", marginBottom: 6, color: "#ffccdd", fontWeight: 800, fontSize: 13 }}>Cantidad</label>
                  <div style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #ff0055", background: "#1a0011", color: "#fff", fontSize: 14, outline: "none", textAlign: "center", fontWeight: 900 }}>
                    25
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAsignarUsims}
                  disabled={usimAsignando}
                  style={{ background: usimAsignando ? "#661133" : "#ff0055", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 900, cursor: usimAsignando ? "not-allowed" : "pointer", boxShadow: "0 2px 14px #ff0055aa", opacity: usimAsignando ? 0.7 : 1 }}
                >
                  {usimAsignando ? "Asignando..." : "Asignar"}
                </button>
              </div>
            </div>
          )}

          {(generalAdmin || agencyAdmin) && (
            <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, border: "1.5px solid #ff005555", background: "#220011" }}>
              <h3 style={{ color: "#ff0055", marginBottom: 10 }}>Transferir uSIMs entre usuarios</h3>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ minWidth: 280, flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 6, color: "#ffccdd", fontWeight: 800, fontSize: 13 }}>Usuario origen</label>
                  <select
                    value={usimTransferirUsuarioOrigen}
                    onChange={(e) => {
                      setUsimTransferirUsuarioOrigen(e.target.value);
                      setUsimTransferirSeries([]);
                    }}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #ff0055", background: "#1a0011", color: "#fff", fontSize: 14 }}
                  >
                    <option value="">Seleccionar usuario origen...</option>
                    {agentes
                      .filter((u) => (generalAdmin ? !!u.id : sameAgency(u.agencia, agenciaAdmin)))
                      .filter((u) => !isUserAdmin(u))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.email || u.nombre || u.name || u.id) + (u.agencia ? ` (${u.agencia})` : "")}
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ minWidth: 280, flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 6, color: "#ffccdd", fontWeight: 800, fontSize: 13 }}>Usuario destino</label>
                  <select
                    value={usimTransferirUsuarioDestino}
                    onChange={(e) => setUsimTransferirUsuarioDestino(e.target.value)}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #ff0055", background: "#1a0011", color: "#fff", fontSize: 14 }}
                  >
                    <option value="">Seleccionar usuario destino...</option>
                    {agentes
                      .filter((u) => (generalAdmin ? !!u.id : sameAgency(u.agencia, agenciaAdmin)))
                      .filter((u) => !isUserAdmin(u))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.email || u.nombre || u.name || u.id) + (u.agencia ? ` (${u.agencia})` : "")}
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleTransferirUsims}
                  disabled={transferiendoUsims || usimTransferirSeries.length === 0}
                  style={{ background: transferiendoUsims ? "#661133" : "#ff0055", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 900, cursor: transferiendoUsims || usimTransferirSeries.length === 0 ? "not-allowed" : "pointer", boxShadow: "0 2px 14px #ff0055aa", opacity: transferiendoUsims || usimTransferirSeries.length === 0 ? 0.7 : 1 }}
                >
                  {transferiendoUsims ? "Transfiriendo..." : `Transferir ${usimTransferirSeries.length} uSIM(s)`}
                </button>
              </div>
              {usimTransferirSeries.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#ffccdd", fontWeight: 800, marginBottom: 6 }}>Series seleccionadas para transferir:</div>
                  <div style={{ maxHeight: 100, overflow: "auto", background: "#1a0011", borderRadius: 8, padding: 8, border: "1px solid #ff005555" }}>
                    {usimTransferirSeries.map((serie, idx) => (
                      <span key={idx} style={{ display: "inline-block", background: "#ff005522", color: "#ffccdd", padding: "2px 6px", margin: "2px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" }}>
                        {serie}
                        <button
                          onClick={() => setUsimTransferirSeries(usimTransferirSeries.filter(s => s !== serie))}
                          style={{ marginLeft: 4, background: "none", border: "none", color: "#ff6b6b", cursor: "pointer", fontSize: 10 }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(generalAdmin || agencyAdmin) && (
            <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, border: "1.5px solid #ff005555", background: "#1a0011" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                <h3 style={{ color: "#ff0055", margin: 0 }}>Conciliacion uSIMs usadas</h3>
                <div style={{ minWidth: 240, flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 6, color: "#ffccdd", fontWeight: 800, fontSize: 12 }}>Filtrar por usuario</label>
                  <select
                    value={usimFiltroConciliacionUsuarioId}
                    onChange={(e) => {
                      setUsimFiltroConciliacionUsuarioId(e.target.value);
                      setUsimUsosPendientesPage(1);
                    }}
                    style={{ width: "100%", padding: 8, borderRadius: 8, border: "1.5px solid #ff0055", background: "#1a0011", color: "#fff", fontSize: 13 }}
                  >
                    <option value="">Todos los usuarios</option>
                    {agentes
                      .filter((u) => (generalAdmin ? !!u.id : sameAgency(u.agencia, agenciaAdmin)))
                      .filter((u) => !isUserAdmin(u))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.email || u.nombre || u.name || u.id) + (u.agencia ? ` (${u.agencia})` : "")}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              {usimUsosPendientes.length === 0 ? (
                <div style={{ color: "#ffccdd", fontWeight: 700 }}>No hay usos pendientes de conciliacion.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#ff005522", color: "#fff" }}>
                        <th style={{ textAlign: "left", padding: 8 }}>Serie</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Usuario</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Pedido</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Numero</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Cedula</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Fecha uso</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Nota</th>
                        <th style={{ textAlign: "center", padding: 8 }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usimUsosPendientesPagina.map((uso, idx) => (
                        <tr key={uso.id} style={{ borderBottom: "1px solid #441122", background: idx % 2 === 0 ? "#14000b" : "#1a0011" }}>
                          <td style={{ padding: 8, fontFamily: "monospace" }}>{uso.serie || "-"}</td>
                          <td style={{ padding: 8, color: "#ffccdd" }}>{uso.usuarioEmail || "-"}</td>
                          <td style={{ padding: 8 }}>{uso.pedido || "-"}</td>
                          <td style={{ padding: 8 }}>{uso.numero || "-"}</td>
                          <td style={{ padding: 8 }}>{uso.cedula || "-"}</td>
                          <td style={{ padding: 8 }}>{formatDateTimeWithSeconds(uso.fecha)}</td>
                          <td style={{ padding: 8, minWidth: 180 }}>
                            <input
                              type="text"
                              value={usimNotasRevision[uso.id] || ""}
                              onChange={(e) => setUsimNotasRevision((prev) => ({ ...prev, [uso.id]: e.target.value }))}
                              placeholder="Nota para correccion..."
                              style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ff005555", background: "#220011", color: "#fff", fontSize: 11 }}
                            />
                          </td>
                          <td style={{ padding: 8, textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => handleAprobarUsoUsim(uso)}
                                disabled={usimRevisandoId === uso.id}
                                style={{ background: "#ff0055", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 900, cursor: usimRevisandoId === uso.id ? "not-allowed" : "pointer", opacity: usimRevisandoId === uso.id ? 0.6 : 1 }}
                              >
                                Rebajar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRechazarUsoUsim(uso)}
                                disabled={usimRevisandoId === uso.id}
                                style={{ background: "#ff6b6b", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 900, cursor: usimRevisandoId === uso.id ? "not-allowed" : "pointer", opacity: usimRevisandoId === uso.id ? 0.6 : 1 }}
                              >
                                Pedir correccion
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, padding: 10 }}>
                    <button
                      type="button"
                      onClick={() => setUsimUsosPendientesPage((prev) => Math.max(1, prev - 1))}
                      disabled={paginaUsimUsosPendientesActual === 1}
                      style={{ background: "#ff0055", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 900, cursor: paginaUsimUsosPendientesActual === 1 ? "not-allowed" : "pointer", opacity: paginaUsimUsosPendientesActual === 1 ? 0.5 : 1 }}
                    >
                      Anterior
                    </button>
                    <span style={{ color: "#ffccdd", fontWeight: 800 }}>
                      Pagina {paginaUsimUsosPendientesActual} de {totalPaginasUsimUsosPendientes}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUsimUsosPendientesPage((prev) => Math.min(totalPaginasUsimUsosPendientes, prev + 1))}
                      disabled={paginaUsimUsosPendientesActual === totalPaginasUsimUsosPendientes}
                      style={{ background: "#ff0055", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 900, cursor: paginaUsimUsosPendientesActual === totalPaginasUsimUsosPendientes ? "not-allowed" : "pointer", opacity: paginaUsimUsosPendientesActual === totalPaginasUsimUsosPendientes ? 0.5 : 1 }}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            {(generalAdmin || agencyAdmin) && (
              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={{ display: "block", marginBottom: 6, color: "#ffccdd", fontWeight: 800, fontSize: 13 }}>Filtrar por lote</label>
                <select
                  value={usimLoteSeleccionado}
                  onChange={(e) => setUsimLoteSeleccionado(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #ff0055", background: "#1a0011", color: "#fff", fontSize: 14 }}
                >
                  <option value="">Todas las uSIMs</option>
                  {usimHistorial.map((lote) => (
                    <option key={lote.id} value={lote.id}>
                      Lote {new Date(lote.fecha).toLocaleDateString("es-CR")} ({lote.cantidad || 0})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(generalAdmin || agencyAdmin) && (
              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={{ display: "block", marginBottom: 6, color: "#ffccdd", fontWeight: 800, fontSize: 13 }}>Filtrar por usuario</label>
                <select
                  value={usimFiltroUsuarioId}
                  onChange={(e) => setUsimFiltroUsuarioId(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #ff0055", background: "#1a0011", color: "#fff", fontSize: 14 }}
                >
                  <option value="">Todos los usuarios</option>
                  {agentes
                    .filter((u) => (generalAdmin ? !!u.id : sameAgency(u.agencia, agenciaAdmin)))
                    .filter((u) => !isUserAdmin(u))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.email || u.nombre || u.name || u.id) + (u.agencia ? ` (${u.agencia})` : "")}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ display: "block", marginBottom: 6, color: "#ffccdd", fontWeight: 800, fontSize: 13 }}>Buscar por serie</label>
              <input
                type="text"
                placeholder="Serie..."
                value={filtroUsims}
                onChange={(e) => setFiltroUsims(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #ff0055", background: "#1a0011", color: "#fff", fontSize: 14, outline: "none" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12, color: "#ffccdd", fontSize: 13, fontWeight: 900 }}>
            Total uSIMs: {usimsFiltradasPorLote.length}
          </div>

          {usimsFiltradasPorLote.length === 0 ? (
            <div style={{ color: "#ffccdd", fontWeight: 800, textAlign: "center", padding: "2rem", opacity: 0.85 }}>
              No hay uSIMs para mostrar.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#220011", borderRadius: 12, overflow: "hidden", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#ff005522", color: "#fff" }}>
                    {(generalAdmin || agencyAdmin) && <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid #ff0055" }}>Sel</th>}
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ff0055" }}>Serie</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ff0055" }}>Estado</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ff0055" }}>Asignado a</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ff0055" }}>Fecha asignación</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ff0055" }}>Fecha uso</th>
                    <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid #ff0055" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usimsFiltradasPorLote
                    .filter((u) => {
                      // Si hay usuario origen seleccionado, filtrar solo sus USIMs
                      if (usimTransferirUsuarioOrigen && u.asignadoAUid !== usimTransferirUsuarioOrigen) {
                        return false;
                      }
                      if (usimFiltroUsuarioId && u.asignadoAUid !== usimFiltroUsuarioId) {
                        return false;
                      }
                      return filtroUsims === "" || String(u.serie || "").includes(filtroUsims);
                    })
                    .map((u, idx) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid #441122", background: idx % 2 === 0 ? "#1a0011" : "#220011" }}>
                        {(generalAdmin || agencyAdmin) && (
                          <td style={{ padding: 8, textAlign: "center" }}>
                            {u.estado === "asignada" && (
                              <input
                                type="checkbox"
                                checked={usimTransferirSeries.includes(u.serie)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setUsimTransferirSeries([...usimTransferirSeries, u.serie]);
                                  } else {
                                    setUsimTransferirSeries(usimTransferirSeries.filter(s => s !== u.serie));
                                  }
                                }}
                              />
                            )}
                          </td>
                        )}
                        <td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }}>{u.serie || "-"}</td>
                        <td style={{ padding: 8 }}>
                          <span style={{ background: u.estado === "disponible" ? "#22c55e33" : u.estado === "asignada" ? "#fbbf2433" : "#ef444433", color: u.estado === "disponible" ? "#22c55e" : u.estado === "asignada" ? "#fbbf24" : "#ef4444", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 900 }}>
                            {u.estado || "sin estado"}
                          </span>
                        </td>
                        <td style={{ padding: 8, fontSize: 11, color: "#ffccdd" }}>{u.asignadoAEmail || "-"}</td>
                        <td style={{ padding: 8, fontSize: 11, color: "#ffccdd" }}>{u.fechaAsignacion ? new Date(u.fechaAsignacion).toLocaleString("es-CR") : "-"}</td>
                        <td style={{ padding: 8, fontSize: 11, color: "#ffccdd" }}>{u.fechaUso ? new Date(u.fechaUso).toLocaleString("es-CR") : "-"}</td>
                        <td style={{ padding: 8, textAlign: "center" }}>
                          {(generalAdmin || agencyAdmin) ? (
                            <button
                              type="button"
                              onClick={() => handleEliminarUsim(u)}
                              style={{ background: "#ff6b6b", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 900, cursor: "pointer" }}
                            >
                              Eliminar
                            </button>
                          ) : u.estado === "asignada" ? (
                            <button
                              type="button"
                              onClick={() => handleRegistrarUsoUsim(u)}
                              style={{ background: "#ff0055", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 900, cursor: "pointer" }}
                            >
                              Registrar uso
                            </button>
                          ) : (
                            <span style={{ color: "#ffccdd", fontWeight: 800 }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {mensaje && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: mensaje.includes("Error") ? "#ff005533" : "#22c55e33", color: mensaje.includes("Error") ? "#ffccdd" : "#bbf7d0", fontWeight: 900 }}>
              {mensaje}
            </div>
          )}
        </div>
      )}

      {view === "emergencia" && (generalAdmin || agencyAdmin) && (
        <div style={{ width: "100%", maxWidth: 1000, margin: "0 auto", background: "#181818", borderRadius: 20, boxShadow: "0 0 32px 4px #ff9800cc", padding: "2.5vw 2vw", color: "#fff", boxSizing: "border-box" }}>
          <h2 style={{ color: "#ff9800", textShadow: "0 2px 12px #ff9800cc, 0 0 2px #fff", fontWeight: 900, letterSpacing: 2 }}>🚨 Modo Emergencia - Descargar eSIMs Disponibles</h2>
          
          <div style={{ marginTop: 20, padding: 18, borderRadius: 12, border: "2px solid #ff9800", background: "#332200", marginBottom: 20 }}>
            <p style={{ color: "#ffccaa", marginBottom: 14, fontSize: 14, lineHeight: 1.6 }}>
              Utiliza esta función para descargar un archivo Excel con todas las eSIMs disponibles de una agencia. Esto es útil cuando el sistema no funciona correctamente y los administradores de punto necesitan asignar manualmente las series.
            </p>
            
            <div style={{ marginBottom: 16 }}>
              {generalAdmin ? (
                <>
                  <label style={{ display: "block", marginBottom: 8, color: "#ffdd99", fontWeight: 700, fontSize: 14 }}>Selecciona la agencia:</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <select
                      value={agenciaDescargarEsims}
                      onChange={(e) => setAgenciaDescargarEsims(e.target.value)}
                      style={{ flex: 1, minWidth: 220, padding: 12, borderRadius: 8, border: "1.5px solid #ff9800", fontSize: 15, background: "#232323", color: "#fff", outline: "none", cursor: "pointer" }}
                    >
                      <option value="">-- Selecciona una agencia --</option>
                      {agenciasDisponibles.map((agencia) => (
                        <option key={agencia} value={agencia}>{agencia}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleDescargarEsimsDisponibles}
                      disabled={descargandoEsims || !agenciaDescargarEsims}
                      style={{
                        background: descargandoEsims || !agenciaDescargarEsims ? "#996633" : "linear-gradient(90deg, #ff9800, #ffb84d)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "12px 24px",
                        fontWeight: 900,
                        fontSize: 15,
                        cursor: descargandoEsims || !agenciaDescargarEsims ? "not-allowed" : "pointer",
                        boxShadow: descargandoEsims || !agenciaDescargarEsims ? "none" : "0 2px 16px #ff9800cc",
                        opacity: descargandoEsims || !agenciaDescargarEsims ? 0.6 : 1,
                        transition: "all 0.2s",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {descargandoEsims ? "Descargando..." : "📥 Descargar Excel"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label style={{ display: "block", marginBottom: 8, color: "#ffdd99", fontWeight: 700, fontSize: 14 }}>Agencia:</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: 1, minWidth: 220, padding: 12, borderRadius: 8, border: "1.5px solid #ff9800", background: "#232323", color: "#fff", fontWeight: 700, fontSize: 15 }}>
                      {agenciaAdmin}
                    </div>
                    <button
                      onClick={handleDescargarEsimsDisponibles}
                      disabled={descargandoEsims}
                      style={{
                        background: descargandoEsims ? "#996633" : "linear-gradient(90deg, #ff9800, #ffb84d)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "12px 24px",
                        fontWeight: 900,
                        fontSize: 15,
                        cursor: descargandoEsims ? "not-allowed" : "pointer",
                        boxShadow: descargandoEsims ? "none" : "0 2px 16px #ff9800cc",
                        opacity: descargandoEsims ? 0.6 : 1,
                        transition: "all 0.2s",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {descargandoEsims ? "Descargando..." : "📥 Descargar Excel"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {mensaje && (
              <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: mensaje.includes("Error") ? "#ff005533" : "#22c55e33", color: mensaje.includes("Error") ? "#ffccdd" : "#bbf7d0", fontWeight: 900, fontSize: 14 }}>
                {mensaje}
              </div>
            )}
          </div>

          <div style={{ padding: 14, borderRadius: 8, background: "#1a2600", border: "1px solid #66bb00", color: "#ccffcc" }}>
            <strong style={{ fontSize: 13 }}>ℹ️ Información:</strong>
            <ul style={{ marginTop: 10, marginLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
              <li>El archivo incluye todas las eSIMs con estado <strong>"disponible"</strong></li>
              <li>Cada fila contiene: N°, Serie, Estado, Agencia y Fecha de Carga</li>
              <li>El nombre del archivo incluye la agencia y la fecha de descarga</li>
              <li>El Admin General puede descargar de cualquier agencia</li>
              <li>Los Admins de Agencia pueden descargar solo de su agencia</li>
            </ul>
          </div>
        </div>
      )}

      {/* Modal para reservar eSIM */}
      {modalReserva && esimAReservar && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#00000080", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#181818", borderRadius: 16, border: "2px solid #ffaa00", padding: "2rem", maxWidth: 500, width: "90%", boxShadow: "0 0 32px 4px #ffaa00cc" }}>
            <h3 style={{ color: "#ffaa00", marginBottom: 12 }}>Reservar eSIM</h3>
            <p style={{ color: "#fff", marginBottom: 12, fontSize: 13 }}>
              Serie: <strong style={{ fontFamily: "monospace" }}>{esimAReservar.serie}</strong>
            </p>
            <label style={{ display: "block", marginBottom: 8, color: "#ffaa00", fontWeight: 700, fontSize: 13 }}>
              Motivo o Persona:
            </label>
            <textarea
              value={motivoReserva}
              onChange={(e) => setMotivoReserva(e.target.value)}
              placeholder="Ej: Reservada para Juan Pérez o Cambio de SIM pendiente"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #ffaa00", background: "#232323", color: "#fff", fontSize: 13, resize: "vertical", minHeight: 60, outline: "none" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setModalReserva(false);
                  setEsimAReservar(null);
                  setMotivoReserva("");
                }}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #999", background: "#232323", color: "#999", fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleReservarEsim}
                disabled={guardandoReserva || !motivoReserva.trim()}
                style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: guardandoReserva || !motivoReserva.trim() ? "#aa6600" : "#ffaa00", color: "#181818", fontWeight: 700, cursor: guardandoReserva || !motivoReserva.trim() ? "not-allowed" : "pointer", opacity: guardandoReserva || !motivoReserva.trim() ? 0.6 : 1 }}
              >
                {guardandoReserva ? "Reservando..." : "Reservar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de borrado */}
      {esimABorrar && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#00000080", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#181818", borderRadius: 16, border: "2px solid #ff6b6b", padding: "2rem", maxWidth: 400, width: "90%", boxShadow: "0 0 32px 4px #ff6b6bcc" }}>
            <h3 style={{ color: "#ff6b6b", marginBottom: 12 }}>Confirmar Borrado</h3>
            <p style={{ color: "#ffcccc", marginBottom: 16, fontSize: 13 }}>
              ¿Estás seguro de que deseas borrar la eSIM <strong style={{ fontFamily: "monospace" }}>{esimABorrar.serie}</strong>?
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setEsimABorrar(null)}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #999", background: "#232323", color: "#999", fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleBorrarEsim(esimABorrar)}
                style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#ff6b6b", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
