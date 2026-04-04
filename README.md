# EsyncSade — eSIM Management App

Aplicación web para la gestión de eSIMs, solicitudes y usuarios, construida con **React + Vite** y **Firebase** (Hosting, Firestore y Cloud Functions).

---

## Requisitos previos

> **Sin Chocolatey** — todo se instala con los instaladores oficiales o con `npm`.

### 1. Node.js (v18 o superior)

Descarga el instalador oficial desde <https://nodejs.org/en/download> (elige "LTS – Windows Installer (.msi)") e instálalo normalmente.  
Verifica la instalación:

```bash
node -v
npm -v
```

### 2. Firebase CLI

Una vez que Node.js está instalado, instala Firebase CLI **sin Chocolatey** usando `npm`:

```bash
npm install -g firebase-tools
```

Verifica:

```bash
firebase --version
```

---

## Configuración del proyecto

### Clonar el repositorio

```bash
git clone <URL-del-repositorio>
cd EsyncSade
```

### Instalar dependencias (app + functions de una sola vez)

```bash
npm run install:all
```

O por separado:

```bash
# Dependencias de la app React
npm install

# Dependencias de las Cloud Functions
npm run install:functions
```

### Iniciar sesión en Firebase

```bash
firebase login
```

---

## Desarrollo local

Inicia el servidor de desarrollo de Vite:

```bash
npm run dev
```

---

## Despliegue (Deploy)

### Desplegar todo (Hosting + Functions)

```bash
npm run deploy
```

### Solo Hosting (app React)

```bash
npm run deploy:hosting
```

### Solo Cloud Functions

```bash
npm run deploy:functions
```

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia servidor de desarrollo |
| `npm run build` | Genera build de producción en `dist/` |
| `npm run preview` | Previsualiza el build de producción localmente |
| `npm run lint` | Ejecuta ESLint |
| `npm run install:all` | Instala dependencias de la app y de functions |
| `npm run install:functions` | Instala dependencias solo de `functions/` |
| `npm run deploy` | Build + deploy completo (Hosting + Functions) |
| `npm run deploy:hosting` | Build + deploy solo Hosting |
| `npm run deploy:functions` | Deploy solo Cloud Functions |

---

## Estructura del proyecto

```
EsyncSade/
├── src/                  # Código fuente React
├── functions/            # Cloud Functions de Firebase
│   ├── index.js          # Funciones: listUsers, deleteUser, createUser
│   └── package.json
├── public/               # Archivos estáticos
├── firebase.json         # Configuración Firebase
├── firestore.rules       # Reglas de seguridad Firestore
├── vite.config.js        # Configuración Vite
└── package.json
```

---

## Tecnologías

- **Frontend**: React 19, Vite 7, Recharts
- **Backend**: Firebase Cloud Functions (Node.js 22)
- **Base de datos**: Firestore
- **Autenticación**: Firebase Auth
- **Hosting**: Firebase Hosting

