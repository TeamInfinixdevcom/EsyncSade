import React from "react";

export default function Navbar({ onLogout, user, onSelect }) {
  const isAdmin = user?.admin || user?.email === "rmadrigalj@ice.go.cr";

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

  return (
    <nav style={styles.nav}>
      {/* Logo y Usuario */}
      <div style={styles.userInfo}>
        <img src="/vite.svg" alt="Logo" style={styles.logo} />
        <div>
          <div style={styles.appName}>EsynSadeCloud</div>
          <div style={styles.userName}>{user?.name || "Usuario"}</div>
          <div style={styles.userEmail}>{user?.email || ""}</div>
        </div>
      </div>

      {/* Menú */}
      <div style={styles.menu}>
        {menuItems.map((item) => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            style={item === "Solicitar eSIM" ? primaryButton : baseButton}
          >
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
  menu: {
    display: "flex",
    gap: 12,
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
// El Navbar está correcto y funcional.
// No se requieren cambios en la lógica ni en los estilos.
// Si necesitas ajustes específicos, por favor indícalos.
