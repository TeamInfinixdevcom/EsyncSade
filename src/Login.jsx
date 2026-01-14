import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { getUserProfile } from "./userProfile";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const userProfile = await getUserProfile(email);
      if (!userProfile) {
        setError("Usuario no registrado en Firestore.");
        return;
      }
      onLogin(userProfile);
    } catch (err) {
      console.error("Error de login:", err);
      setError("Credenciales incorrectas o usuario no existe.");
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      minWidth: '100vw',
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 40% 40%, #181818 60%, #0ff 100%, #23243e 120%)',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: 32,
        left: 0,
        width: '100vw',
        textAlign: 'center',
        zIndex: 2
      }}>
        <span style={{
          fontSize: 32,
          fontWeight: 900,
          letterSpacing: 2,
          color: '#ff34fc',
          textShadow: '0 0 6px #ff34fc, 0 1px 4px #fff',
          filter: 'none',
          fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
        }}>EsyncSadeCloud</span>
      </div>
      <form onSubmit={handleSubmit} style={{
        maxWidth: 370,
        width: '100%',
        background: '#181818',
        borderRadius: 24,
        boxShadow: '0 0 32px 4px #ff34fccc',
        padding: '2.5rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: '2.5px solid #ff34fc',
        marginTop: 64
      }}>
        <img src="/vite.svg" alt="Logo" style={{ width: 64, marginBottom: 18, filter: 'drop-shadow(0 0 8px #00fff7)' }} />
        <h2 style={{ marginBottom: 24, color: '#00fff7', fontWeight: 900, letterSpacing: 2, textShadow: '0 2px 12px #00fff7cc, 0 0 2px #fff' }}>Iniciar sesión</h2>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            marginBottom: 16,
            padding: 10,
            borderRadius: 8,
            border: '1.5px solid #00fff7',
            fontSize: 16,
            background: '#232323',
            color: '#fff',
            boxShadow: '0 2px 8px #00fff733',
            outline: 'none',
          }}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            marginBottom: 20,
            padding: 10,
            borderRadius: 8,
            border: '1.5px solid #00fff7',
            fontSize: 16,
            background: '#232323',
            color: '#fff',
            boxShadow: '0 2px 8px #00fff733',
            outline: 'none',
          }}
        />
        <button type="submit" style={{
          width: "100%",
          background: 'linear-gradient(90deg, #00fff7 0%, #bd34fe 100%)',
          color: '#181818',
          border: 'none',
          borderRadius: 8,
          padding: '12px 0',
          fontWeight: 900,
          fontSize: 17,
          boxShadow: '0 2px 16px #00fff7cc',
          cursor: 'pointer',
          transition: 'background 0.2s',
          letterSpacing: 1,
          textShadow: '0 1px 8px #fff',
        }}>Entrar</button>
        {error && <div style={{ color: "#ff3c2f", marginTop: 16, fontWeight: 700, textShadow: '0 1px 8px #000' }}>{error}</div>}
      </form>
    </div>
  );
}
