import React, { useState, useEffect } from "react";
import { getFirestore, collection, addDoc, onSnapshot, doc, writeBatch, query, where, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";
import Dashboard from "./Dashboard";

function extractSeries(text) {
  const matches = text.match(/\b\d{20}\b/g);
  if (!matches) return [];
  const unique = Array.from(new Set(matches));
  return unique.sort();
}

export default function AdminPanel() {
  const PAGE_SIZE = 10;
  const [view, setView] = useState("dashboard");
  const [input, setInput] = useState("");
  const [series, setSeries] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [historial, setHistorial] = useState([]);
  const [page, setPage] = useState(1);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoPassword, setNuevoPassword] = useState("");
  const [nuevoRol, setNuevoRol] = useState("ejecutivo");
  const [nuevoActivo, setNuevoActivo] = useState(true);
  const [mensajeUsuario, setMensajeUsuario] = useState("");
  const [creandoUsuario, setCreandoUsuario] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [mensajeUsuarios, setMensajeUsuarios] = useState("");

  const fetchUsuarios = async () => {
    setCargandoUsuarios(true);
    setMensajeUsuarios("");
    try {
      const listUsers = httpsCallable(functions, "listUsers");
      const res = await listUsers();
      setUsuarios(res.data.usuarios || []);
    } catch (err) {
      setMensajeUsuarios(err.message || "Error al obtener usuarios.");
    }
    setCargandoUsuarios(false);
  };

  const handleBorrarUsuario = async (uid, email) => {
    if (!window.confirm(`¿Seguro que deseas borrar el usuario ${email}?`)) return;
    setMensajeUsuarios("");
    try {
      const deleteUser = httpsCallable(functions, "deleteUser");
      await deleteUser({ uid });
      setMensajeUsuarios("Usuario eliminado correctamente.");
      fetchUsuarios();
    } catch (err) {
      setMensajeUsuarios(err.message || "Error al borrar usuario.");
    }
  };

  useEffect(() => {
    if (view === "usuarios") {
      fetchUsuarios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const handleExtract = () => {
    const result = extractSeries(input);
    setSeries(result);
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    setMensajeUsuario("");
    if (!nuevoNombre || !nuevoEmail || !nuevoPassword) {
      setMensajeUsuario("Completa nombre, email y contrasena.");
      return;
    }
    setCreandoUsuario(true);
    try {
      const crearUsuario = httpsCallable(functions, "createUser");
      const result = await crearUsuario({
        nombre: nuevoNombre,
        email: nuevoEmail,
        password: nuevoPassword,
        rol: nuevoRol,
        activo: nuevoActivo
      });
      setMensajeUsuario(result.data?.message || "Usuario creado correctamente.");
      setNuevoNombre("");
      setNuevoEmail("");
      setNuevoPassword("");
      setNuevoRol("ejecutivo");
      setNuevoActivo(true);
    } catch (err) {
      setMensajeUsuario(err.message || "Error al crear usuario.");
    }
    setCreandoUsuario(false);
  };

  // Subir series como lote a Firestore
  const handleSubir = async () => {
    if (series.length === 0) {
      setMensaje("No hay series para subir.");
      return;
    }
    setSubiendo(true);
    setMensaje("");
    try {
      const db = getFirestore();
      // Verificar si alguna serie ya existe en esims
      const existQuery = query(collection(db, "esims"), where("serie", "in", series.slice(0, 10)));
      // Firestore limita a 10 elementos por 'in', así que hacemos chunks
      let existentes = [];
      const CHUNK_SIZE = 10;
      for (let i = 0; i < series.length; i += CHUNK_SIZE) {
        const chunk = series.slice(i, i + CHUNK_SIZE);
        const q = query(collection(db, "esims"), where("serie", "in", chunk));
        const snap = await getDocs(q);
        snap.forEach(docu => existentes.push(docu.id));
      }
      if (existentes.length > 0) {
        setMensaje(`❌ Las siguientes series ya existen y no se subieron: \n${existentes.join(", ")}`);
        setSubiendo(false);
        return;
      }
      // Crear lote
      const loteRef = await addDoc(collection(db, "lotes"), {
        fecha: new Date().toISOString(),
        cantidad: series.length,
        usuario: auth.currentUser?.email || "Desconocido",
        series
      });
      // Subir series en batch, usando la serie como id para evitar duplicados locales
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const chunks = [];
      const CHUNK_SIZE_BATCH = 450;
      for (let i = 0; i < series.length; i += CHUNK_SIZE_BATCH) {
        chunks.push(series.slice(i, i + CHUNK_SIZE_BATCH));
      }
      for (const chunk of chunks) {
        chunk.forEach((serie) => {
          const ref = doc(db, "esims", serie);
          batch.set(ref, {
            serie,
            estado: "disponible",
            fechaCarga: now,
            loteId: loteRef.id
          });
        });
        await batch.commit();
      }
      setMensaje(`Se subieron ${series.length} eSIMs a la nube.`);
      setSeries([]);
      setInput("");
    } catch (err) {
      setMensaje("Error al subir las series. Intenta de nuevo. " + (err.message || ""));
    }
    setSubiendo(false);
  };

  // Historial de lotes
  useEffect(() => {
    const db = getFirestore();
    const unsub = onSnapshot(collection(db, "lotes"), (snap) => {
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setHistorial(arr.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
      setPage(1); // Reset page on new data
    });
    return () => unsub();
  }, []);

  // Borrar lote y sus series
  const handleBorrarLote = async (loteId) => {
    if (!window.confirm("¿Seguro que deseas borrar este lote y todas sus series?")) return;
    try {
      const db = getFirestore();
      const batch = writeBatch(db);
      
      // Buscar y borrar todas las eSIMs del lote
      const esimsQuery = query(collection(db, "esims"), where("loteId", "==", loteId));
      const esimsSnap = await getDocs(esimsQuery);
      
      esimsSnap.forEach((docu) => {
        batch.delete(doc(db, "esims", docu.id));
      });
      
      // Borrar el lote
      batch.delete(doc(db, "lotes", loteId));
      
      await batch.commit();
      setMensaje("✅ Lote borrado correctamente.");
    } catch (err) {
      setMensaje("Error al borrar el lote: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "32px auto", background: "#181818", borderRadius: 24, boxShadow: "0 0 32px 4px #ff34fccc", border: '2.5px solid #ff34fc', padding: "2rem 1rem", color: "#fff" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 32, justifyContent: 'center' }}>
        <button
          onClick={() => setView("dashboard")}
          style={{ background: view === "dashboard" ? "#00fff7" : "#232323", color: view === "dashboard" ? "#181818" : "#00fff7", border: 'none', borderRadius: 12, padding: '0.7rem 2rem', fontWeight: 900, fontSize: 18, boxShadow: view === "dashboard" ? '0 2px 16px #00fff7cc' : 'none', cursor: 'pointer', letterSpacing: 1, textShadow: view === "dashboard" ? '0 1px 8px #fff' : '0 1px 8px #00fff7cc' }}
        >Gráficas de uso</button>
        <button
          onClick={() => setView("series")}
          style={{ background: view === "series" ? "#bd34fe" : "#232323", color: view === "series" ? "#fff" : "#bd34fe", border: 'none', borderRadius: 12, padding: '0.7rem 2rem', fontWeight: 900, fontSize: 18, boxShadow: view === "series" ? '0 2px 16px #bd34fecc' : 'none', cursor: 'pointer', letterSpacing: 1, textShadow: view === "series" ? '0 1px 8px #fff' : '0 1px 8px #bd34fecc' }}
        >Carga de Series</button>
        <button
          onClick={() => setView("usuarios")}
          style={{ background: view === "usuarios" ? "#ff34fc" : "#232323", color: view === "usuarios" ? "#fff" : "#ff34fc", border: 'none', borderRadius: 12, padding: '0.7rem 2rem', fontWeight: 900, fontSize: 18, boxShadow: view === "usuarios" ? '0 2px 16px #ff34fccc' : 'none', cursor: 'pointer', letterSpacing: 1, textShadow: view === "usuarios" ? '0 1px 8px #fff' : '0 1px 8px #ff34fccc' }}
        >Usuarios</button>
      </div>
      {view === "dashboard" && (
        <Dashboard />
      )}
      {view === "series" && (
        <div style={{ width: '100%', maxWidth: 1100, margin: "0 auto", background: "#181818", borderRadius: 20, boxShadow: "0 0 32px 4px #bd34fecc", padding: "2.5vw 2vw", color: "#fff", boxSizing: 'border-box' }}>
          <h2 style={{ color: "#bd34fe", textShadow: '0 2px 12px #bd34fecc, 0 0 2px #fff', fontWeight: 900, letterSpacing: 2 }}>Carga de Series eSIM</h2>
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
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Cantidad</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Usuario</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE).map(lote => (
                        <tr key={lote.id} style={{ borderBottom: '1px solid #444' }}>
                          <td style={{ padding: '6px 8px' }}>{new Date(lote.fecha).toLocaleString()}</td>
                          <td style={{ padding: '6px 8px' }}>{lote.cantidad}</td>
                          <td style={{ padding: '6px 8px' }}>{lote.usuario}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <button onClick={() => handleBorrarLote(lote.id)} style={{ background: '#ff34fc', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontWeight: 700, cursor: 'pointer' }}>Borrar lote</button>
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
      {view === "usuarios" && (
        <div style={{ width: '100%', maxWidth: 900, margin: "0 auto", background: "#181818", borderRadius: 20, boxShadow: "0 0 32px 4px #ff34fccc", padding: "2.5vw 2vw", color: "#fff", boxSizing: 'border-box' }}>
          <h2 style={{ color: "#ff34fc", textShadow: '0 2px 12px #ff34fccc, 0 0 2px #fff', fontWeight: 900, letterSpacing: 2 }}>Usuarios del sistema</h2>
          <div style={{ marginBottom: 32 }}>
            <form onSubmit={handleCrearUsuario} style={{ display: 'flex', flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="text" placeholder="Nombre" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} style={{ flex: 2, minWidth: 120, padding: 10, borderRadius: 8, border: '1.5px solid #ff34fc', fontSize: 15, background: '#232323', color: '#fff', boxShadow: '0 2px 8px #ff34fc33', outline: 'none' }} />
              <input type="email" placeholder="Email" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} style={{ flex: 2, minWidth: 120, padding: 10, borderRadius: 8, border: '1.5px solid #ff34fc', fontSize: 15, background: '#232323', color: '#fff', boxShadow: '0 2px 8px #ff34fc33', outline: 'none' }} />
              <input type="password" placeholder="Contrasena" value={nuevoPassword} onChange={e => setNuevoPassword(e.target.value)} style={{ flex: 2, minWidth: 120, padding: 10, borderRadius: 8, border: '1.5px solid #ff34fc', fontSize: 15, background: '#232323', color: '#fff', boxShadow: '0 2px 8px #ff34fc33', outline: 'none' }} />
              <select value={nuevoRol} onChange={e => setNuevoRol(e.target.value)} style={{ flex: 1, minWidth: 100, padding: 10, borderRadius: 8, border: '1.5px solid #ff34fc', fontSize: 15, background: '#232323', color: '#fff', boxShadow: '0 2px 8px #ff34fc33', outline: 'none' }}>
                <option value="ejecutivo">Ejecutivo</option>
                <option value="admin">Admin</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', minWidth: 80 }}>
                <input type="checkbox" checked={nuevoActivo} onChange={e => setNuevoActivo(e.target.checked)} /> Activo
              </label>
              <button type="submit" disabled={creandoUsuario} style={{ background: 'linear-gradient(90deg, #ff34fc 0%, #00fff7 100%)', color: '#181818', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 900, fontSize: 16, boxShadow: '0 2px 16px #ff34fccc', cursor: creandoUsuario ? 'not-allowed' : 'pointer', opacity: creandoUsuario ? 0.6 : 1, transition: 'background 0.2s', letterSpacing: 1, textShadow: '0 1px 8px #fff' }}>{creandoUsuario ? 'Creando...' : 'Crear Usuario'}</button>
            </form>
            {mensajeUsuario && <div style={{ color: '#00fff7', marginTop: 12, fontWeight: 700 }}>{mensajeUsuario}</div>}
          </div>
          <h3 style={{ color: '#ff34fc', marginBottom: 12 }}>Lista de usuarios</h3>
          {mensajeUsuarios && <div style={{ color: '#00fff7', marginBottom: 12, fontWeight: 700 }}>{mensajeUsuarios}</div>}
          {cargandoUsuarios ? (
            <div style={{ color: '#fff', opacity: 0.7 }}>Cargando usuarios...</div>
          ) : (
            <div style={{ maxHeight: '40vh', overflow: 'auto', background: '#232323', borderRadius: 12, padding: '1vw', border: '1.5px solid #ff34fc' }}>
              {usuarios.length === 0 ? (
                <div style={{ color: '#fff', opacity: 0.7 }}>No hay usuarios registrados.</div>
              ) : (
                <table style={{ width: '100%', color: '#fff', fontSize: 15, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#ff34fc', fontWeight: 700 }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Nombre</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Email</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Rol</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Activo</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr key={u.uid} style={{ borderBottom: '1px solid #444' }}>
                        <td style={{ padding: '6px 8px' }}>{u.nombre}</td>
                        <td style={{ padding: '6px 8px' }}>{u.email}</td>
                        <td style={{ padding: '6px 8px' }}>{u.rol}</td>
                        <td style={{ padding: '6px 8px' }}>{u.activo ? 'Sí' : 'No'}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <button onClick={() => handleBorrarUsuario(u.uid, u.email)} style={{ background: '#ff34fc', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontWeight: 700, cursor: 'pointer' }}>Borrar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
