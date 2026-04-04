import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { getUserProfile } from "./userProfile";
import "./forms.css";

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
    <div className="form-screen form-screen--auth">
      <form onSubmit={handleSubmit} className="form-card" style={{ maxWidth: 430 }}>
        <div className="form-brand">
          <img src="/vite.svg" alt="Logo" />
          <span>EsyncSadeCloud</span>
        </div>

        <p className="form-kicker">Acceso seguro</p>
        <h2 className="form-title">Iniciar sesion</h2>
        <p className="form-subtitle">Ingresa con tu cuenta corporativa para gestionar solicitudes y devoluciones.</p>

        <div className="form-grid">
          <div className="form-field">
            <label className="form-label" htmlFor="loginEmail">Correo</label>
            <input
              id="loginEmail"
              className="form-input"
              type="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="loginPassword">Contrasena</label>
            <input
              id="loginPassword"
              className="form-input"
              type="password"
              placeholder="Tu contrasena"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" className="form-button form-button--primary">
          Entrar al sistema
        </button>

        {error && <div className="form-feedback is-error">{error}</div>}
      </form>
    </div>
  );
}
