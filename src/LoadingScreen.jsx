import React from "react";
import "./loading-screen.css";

export default function LoadingScreen() {
  return (
    <div className="session-loader-wrap" role="status" aria-live="polite">
      <div className="session-loader-grid" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, idx) => (
          <span key={idx} className="session-loader-grid-dot" />
        ))}
      </div>

      <div className="session-loader-card">
        <div className="session-loader-ring session-loader-ring--outer" />
        <div className="session-loader-ring session-loader-ring--inner" />
        <div className="session-loader-core" />

        <p className="session-loader-kicker">EsyncSadeCloud</p>
        <h2 className="session-loader-title">Cargando sesion</h2>
        <p className="session-loader-text">Sincronizando permisos, perfil y panel de trabajo.</p>

        <div className="session-loader-progress" aria-hidden="true">
          <span className="session-loader-progress-bar" />
        </div>
      </div>
    </div>
  );
}
