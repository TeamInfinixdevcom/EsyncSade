import React from "react";
import "./loading-screen.css";

export default function LoadingScreen() {
  return (
    <main className="session-loader-wrap" role="status" aria-live="polite" aria-label="Cargando sesión">
      <div className="session-loader-sun" aria-hidden="true" />
      <div className="session-loader-city" aria-hidden="true">
        <svg viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="loader-city-neon" x1="0" x2="1">
              <stop offset="0" stopColor="#42f5bd" />
              <stop offset="0.46" stopColor="#ff4ed6" />
              <stop offset="1" stopColor="#5de9ff" />
            </linearGradient>
            <filter id="loader-city-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g fill="#100d1a" stroke="url(#loader-city-neon)" strokeWidth="2" opacity="0.72" filter="url(#loader-city-glow)">
            <path d="M0 360V198h73v-46h82v73h41V112h98v78h49v-45h88v116h53V78h94v84h62v-52h91v117h50V132h90v64h45v-39h92v117h53V96h90v94h59v-44h90v214Z" />
            <path d="M74 176h81m-81 18h81m-81 18h81m221-67h55m-55 18h55m123-67h94m-94 18h94m-94 18h94m164 17h90m-90 18h90m136-24h92m-92 18h92m154-52h90m-90 18h90" fill="none" opacity="0.62" />
            <path d="M0 319h1440" fill="none" strokeWidth="3" />
          </g>

          <g fill="none" stroke="#48ff78" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" opacity="0.86" filter="url(#loader-city-glow)">
            <path d="M150 319V170m0 1c-28-30-52-37-74-32 26 8 50 21 73 39-28-38-32-64-25-84 7 28 18 54 29 80-6-43 2-70 17-87-7 30-8 59-11 85 14-38 32-56 52-62-18 24-31 47-48 70 29-23 53-28 73-21-26 11-49 24-74 42" />
            <path d="M1290 319V151m0 1c-27-29-50-36-71-31 24 8 47 20 69 38-26-36-31-61-24-80 7 27 18 52 28 77-5-41 2-67 17-83-7 29-8 56-11 81 14-36 31-53 51-59-17 22-30 44-46 66 27-22 50-27 70-20-25 11-47 23-71 40" />
          </g>
          <path d="M0 342c197-25 347-18 511-2 174 17 325 17 476-3 165-22 304-19 453 1v22H0Z" fill="#08070e" opacity="0.9" />
        </svg>
      </div>

      <section className="session-loader-card" aria-label="Preparando tu sesión">
        <div className="session-loader-brand">
          <span className="session-loader-mark" aria-hidden="true">
            <svg viewBox="0 0 40 46" focusable="false">
              <path className="session-loader-building" d="M7 43V17h9V5h14v12h9v26H7Z" />
              <path className="session-loader-building-line" d="M16 17V5m14 12V5M7 25h32M7 34h32" />
              <rect className="session-loader-window" x="11" y="21" width="3" height="3" rx="0.5" />
              <rect className="session-loader-window" x="20" y="9" width="3" height="3" rx="0.5" />
              <rect className="session-loader-window" x="25" y="9" width="3" height="3" rx="0.5" />
              <rect className="session-loader-window" x="20" y="21" width="3" height="3" rx="0.5" />
              <rect className="session-loader-window" x="30" y="21" width="3" height="3" rx="0.5" />
              <rect className="session-loader-window" x="11" y="29" width="3" height="3" rx="0.5" />
              <rect className="session-loader-window" x="20" y="29" width="3" height="3" rx="0.5" />
              <rect className="session-loader-window" x="30" y="29" width="3" height="3" rx="0.5" />
            </svg>
          </span>
          <span>EsyncSade<small>CLOUD <b>III</b></small></span>
        </div>

        <p className="session-loader-kicker"><span /> Conexión segura</p>
        <h1 className="session-loader-title"><span>Cargando</span><span>sesión</span></h1>
        <p className="session-loader-text">Sincronizando tu espacio de trabajo</p>

        <div className="session-loader-progress" aria-hidden="true">
          <span className="session-loader-progress-bar" />
        </div>
        <div className="session-loader-status" aria-hidden="true"><span /> Conectando con Cloud III</div>
      </section>
    </main>
  );
}
