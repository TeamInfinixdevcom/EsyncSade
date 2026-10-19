import React from "react";
import { isUserAdmin } from "./userProfile";
import "./navbar.css";

const baseMenuItems = [
  { value: "Solicitar eSIM", label: "Solicitar eSIM", tone: "pink" },
  { value: "Devolución eSIMs", label: "Devolución eSIMs", tone: "cyan" },
  { value: "Mis uSIMs", label: "Mis uSIMs", tone: "violet" },
  { value: "Mis Solicitudes", label: "Mis Solicitudes", tone: "rose", featured: true },
  { value: "uSIMs fisicas", label: "uSIMs físicas", tone: "teal" },
];

export default function Navbar({ onLogout, user, onSelect, activeSection }) {
  const menuItems = isUserAdmin(user)
    ? [...baseMenuItems, { value: "Panel Admin", label: "Panel Admin", tone: "amber" }]
    : baseMenuItems;

  return (
    <nav className="app-navbar" aria-label="Navegación principal">
      <div className="app-navbar__brand">
        <div className="app-navbar__brand-mark" aria-hidden="true">III</div>
        <div className="app-navbar__brand-copy">
          <div className="app-navbar__brand-name">Esync Sade</div>
          <div className="app-navbar__brand-subline">
            <span>Cloud III</span>
            <span className="app-navbar__version">Nueva versión</span>
          </div>
        </div>
      </div>

      <div className="app-navbar__account">
        <div className="app-navbar__account-copy">
          <span className="app-navbar__user-name">{user?.name || "Usuario"}</span>
          {user?.email && <span className="app-navbar__user-email">{user.email}</span>}
          {user?.agencia && <span className="app-navbar__agency">Agencia: {user.agencia}</span>}
        </div>
        <button type="button" className="app-navbar__logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>

      <div className="app-navbar__menu">
        {menuItems.map(({ value, label, tone, featured }) => {
          const active = value === activeSection;
          const className = [
            "app-navbar__item",
            `app-navbar__item--${tone}`,
            active && "app-navbar__item--active",
            featured && "app-navbar__item--featured",
          ].filter(Boolean).join(" ");

          return (
            <button
              key={value}
              type="button"
              className={className}
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(value)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
