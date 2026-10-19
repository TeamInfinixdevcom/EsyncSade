import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { getUserProfile } from "./userProfile";
import "./login.css";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userProfile = await getUserProfile({
        uid: cred.user.uid,
        email: cred.user.email || email,
      });
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
    <main className="login-screen">
      <div className="login-scene" aria-hidden="true">
        <svg viewBox="0 0 1440 310" preserveAspectRatio="xMidYMax meet">
          <defs>
            <linearGradient id="login-neon-line" x1="0" x2="1">
              <stop offset="0" stopColor="#35f5c6" />
              <stop offset="0.52" stopColor="#ff48d7" />
              <stop offset="1" stopColor="#56e7ff" />
            </linearGradient>
            <filter id="login-neon-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g fill="#11121c" stroke="url(#login-neon-line)" strokeWidth="2" opacity="0.64" filter="url(#login-neon-glow)">
            <path d="M0 310V172h85v-42h74v68h54V95h100v63h54V120h80v105h42V72h97v87h68v-42h92v82h57V86h72v70h54v-31h88v105h61V114h81v60h79v136Z" />
            <path d="M86 170h73m-73 18h73m154-30h53m-53 18h53m167-14h97m-97 18h97m192-33h92m-92 18h92m126-6h87m-87 18h87m151-42h81m-81 18h81" fill="none" opacity="0.55" />
            <path d="M0 274h1440" fill="none" strokeWidth="3" />
          </g>
          <g fill="none" stroke="#48ff70" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" opacity="0.78" filter="url(#login-neon-glow)">
            <path d="M178 273V149m0 1c-27-30-52-38-73-34 25 8 49 21 72 39-27-38-32-63-25-82 7 27 18 53 29 79-6-42 2-69 17-85-7 30-8 57-11 83 14-37 32-55 52-61-18 23-31 46-48 69 28-23 52-28 72-21-26 11-49 24-74 42" />
            <path d="M1265 273V132m0 0c-25-28-48-35-67-31 23 8 45 20 65 36-24-34-29-57-23-75 7 25 17 48 27 72-5-38 2-63 16-78-7 27-8 52-10 76 13-34 29-50 48-56-16 21-28 42-44 63 25-21 47-26 66-19-24 10-45 22-68 39" />
          </g>
          <path d="M0 296c195-27 330-16 501 0s326 24 474 0 302-28 465-2v16H0Z" fill="#080910" opacity="0.78" />
        </svg>
      </div>

      <form onSubmit={handleSubmit} className="login-card">
        <div className="login-brand" aria-label="EsyncSade Cloud III">
          <span className="login-brand__mark" aria-hidden="true">
            <svg viewBox="0 0 40 46" focusable="false">
              <path d="M22 1 5 25h12l-2 20 20-27H23l5-17Z" />
            </svg>
          </span>
          <span className="login-brand__name">EsyncSade<span>Cloud <i>III</i></span></span>
        </div>

        <div className="login-heading">
          <p className="login-kicker"><span /> Acceso corporativo</p>
          <h1 className="login-title"><span>Iniciar</span><span>sesión</span></h1>
          <p className="login-subtitle">Gestiona tus eSIM con una conexión segura.</p>
        </div>

        <div className="login-fields">
          <div className="login-field">
            <label htmlFor="loginEmail">Correo</label>
            <input
              id="loginEmail"
              type="email"
              autoComplete="username"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="loginPassword">Contraseña</label>
            <input
              id="loginPassword"
              type="password"
              autoComplete="current-password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" className="login-submit">Entrar al sistema <span aria-hidden="true">↗</span></button>

        {error && <div className="login-error" role="alert">{error}</div>}

        <div className="login-security"><span aria-hidden="true">✦</span> Acceso protegido · Cloud III</div>
      </form>
    </main>
  );
}
