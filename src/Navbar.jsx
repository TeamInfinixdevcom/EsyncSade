import React from "react";
import { isUserAdmin } from "./userProfile";

export default function Navbar({ onLogout, user, onSelect }) {
  const isAdmin = isUserAdmin(user);

  const menuItems = [
    "Solicitar eSIM",
    "Devolución eSIMs",
    "Mis Solicitudes",
    isAdmin && "Panel Admin",
  ].filter(Boolean);

  const baseButton = {
    border: "2px solid #00fff7",
    background: "#181818",
    color: "#00fff7",
    borderRadius: 20,
    padding: "0.5rem 1.5rem",
    fontWeight: 900,
    fontSize: 16,
    letterSpacing: 1,
    cursor: "pointer",
    transition: "all 0.2s ease",
    outline: "none",
  };

  const primaryButton = {
    ...baseButton,
    background: "#00fff7",
    color: "#181818",
    boxShadow: "0 2px 16px #00fff7cc",
    textShadow: "0 1px 8px #fff",
  };

  const featuredButton = {
    ...baseButton,
    position: "relative",
    overflow: "hidden",
    border: "2px solid #7af9ff",
    color: "#eaffff",
    boxShadow: "0 0 18px rgba(0, 255, 247, 0.32), 0 0 34px rgba(122, 249, 255, 0.12)",
    animation: "nav-feature-glow 2.8s ease-in-out infinite",
  };

  return (
    <nav style={styles.nav}>
      {/* Logo y Usuario */}
      <div style={styles.userInfo}>
        <img src="/vite.svg" alt="Logo" style={styles.logo} />
        <div>
          <div style={styles.appName}>EsyncSadeCloud</div>
          <div style={styles.userName}>{user?.name || "Usuario"}</div>
          <div style={styles.userEmail}>{user?.email || ""}</div>
          {user?.agencia && <div style={styles.userAgency}>Agencia: {user.agencia}</div>}
        </div>
      </div>

      {/* Menú */}
      <div style={styles.menu}>
        {menuItems.map((item) => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            style={
              item === "Solicitar eSIM"
                ? primaryButton
                : item === "Mis Solicitudes"
                ? featuredButton
                : baseButton
            }
          >
            {item === "Mis Solicitudes" && (
              <>
                <span style={styles.featureSweep} aria-hidden="true" />
                <span style={styles.featureBeacon} aria-hidden="true" />
              </>
            )}
            {item}
          </button>
        ))}
      </div>

      {/* Logout */}
      <button onClick={onLogout} style={styles.logout}>
        Cerrar sesión
      </button>
    </nav>
  );
}

/* ===================== STYLES ===================== */

const styles = {
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.2rem 2vw",
    background: "#181818",
    borderBottom: "2px solid #00fff7",
    boxShadow: "0 4px 32px #00fff7cc",
    position: "relative",
    zIndex: 10,
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  logo: {
    height: 38,
    filter: "drop-shadow(0 0 8px #00fff7)",
  },
  appName: {
    fontWeight: 900,
    color: "#00fff7",
    fontSize: 18,
    letterSpacing: 1,
    textShadow: "0 1px 8px #00fff7cc",
  },
  userName: {
    fontWeight: 700,
    color: "#00fff7",
    fontSize: 13,
    letterSpacing: 1,
  },
  userEmail: {
    fontSize: 12,
    color: "#fff",
    opacity: 0.7,
  },
  userAgency: {
    fontSize: 12,
    color: "#9ef6ea",
    opacity: 0.9,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  menu: {
    display: "flex",
    gap: 12,
  },
  featureSweep: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(90deg, transparent, rgba(122, 249, 255, 0.26), transparent)",
    transform: "translateX(-130%)",
    animation: "nav-feature-sweep 4.8s linear infinite",
    pointerEvents: "none",
  },
  featureBeacon: {
    position: "absolute",
    top: 7,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#8ffcff",
    boxShadow: "0 0 10px rgba(143, 252, 255, 0.92)",
    animation: "nav-feature-beacon 1.3s ease-in-out infinite",
    pointerEvents: "none",
  },
  logout: {
    background: "#ff3c2f",
    color: "#fff",
    borderRadius: 20,
    padding: "0.5rem 1.5rem",
    fontWeight: 900,
    border: "none",
    fontSize: 16,
    boxShadow: "0 2px 16px #ff3c2fcc",
    cursor: "pointer",
    letterSpacing: 1,
  },
};
