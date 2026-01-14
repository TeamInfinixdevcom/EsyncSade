import React, { useState, useEffect } from "react";

/* ========= COMPONENTES ========= */
import SplashScreen from "./SplashScreen";
import Login from "./Login";
import Navbar from "./Navbar";

import EsimRequestForm from "./EsimRequestForm";
import DevolucionEsims from "./DevolucionEsims";
import UserReport from "./UserReport";
import AdminPanel from "./AdminPanel";
import TeamRequestsTable from "./TeamRequestsTable";

/* ========= FIREBASE ========= */
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getUserProfile } from "./userProfile";

function App() {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState("Solicitar eSIM");
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  const isAdmin = user?.admin || user?.email === "rmadrigalj@ice.go.cr";

  /* ========= AUTH ========= */
  useEffect(() => {
    if (showSplash) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser.email);
        setUser(profile);
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [showSplash]);

  const handleLogout = async () => {
    await auth.signOut();
    setUser(null);
  };

  /* ========= SPLASH ========= */
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  /* ========= LOADING ========= */
  if (loading) {
    return (
      <div style={styles.loading}>
        Cargando...
      </div>
    );
  }

  /* ========= LOGIN ========= */
  if (!user) {
    return (
      <div style={styles.loginWrapper}>
        <Login onLogin={setUser} />
      </div>
    );
  }

  /* ========= SECCIONES ========= */
  const sections = {
    "Solicitar eSIM": <EsimRequestForm />,
    "Devolución eSIMs": <DevolucionEsims />,
    "Mis Solicitudes": <UserReport />,
    "Panel Admin": isAdmin && (
      <>
        <AdminPanel />
        <div style={{ marginTop: 32 }}>
          <TeamRequestsTable />
        </div>
      </>
    ),
  };

  return (
    <div style={styles.app}>
      <Navbar
        onLogout={handleLogout}
        user={user}
        onSelect={setSection}
      />

      <main style={styles.main}>
        {sections[section] || null}
      </main>
    </div>
  );
}

export default App;

/* ===================== STYLES ===================== */

const styles = {
  app: {
    minHeight: "100vh",
    minWidth: "100vw",
    background:
      "radial-gradient(ellipse at 40% 40%, #181818 60%, #0ff 100%, #23243e 120%)",
    overflow: "hidden",
  },
  main: {
    padding: "2rem 0",
  },
  loading: {
    color: "#00fff7",
    textAlign: "center",
    marginTop: 80,
    fontSize: 24,
  },
  loginWrapper: {
    width: "100vw",
    height: "100vh",
    background:
      "radial-gradient(ellipse at 40% 40%, #181818 60%, #0ff 100%, #23243e 120%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
