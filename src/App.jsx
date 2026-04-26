import React, { useState, useEffect } from "react";

/* ========= COMPONENTES ========= */
import SplashScreen from "./SplashScreen";
import Login from "./Login";
import Navbar from "./Navbar";
import LoadingScreen from "./LoadingScreen";

import EsimRequestForm from "./EsimRequestForm";
import DevolucionEsims from "./DevolucionEsims";
import UserReport from "./UserReport";
import AdminPanel from "./AdminPanel";

/* ========= FIREBASE ========= */
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getUserProfile, isUserAdmin } from "./userProfile";

function App() {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState("Solicitar eSIM");
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  const isAdmin = isUserAdmin(user);
  const sectionActiva = !isAdmin && section === "Panel Admin" ? "Solicitar eSIM" : section;

  /* ========= AUTH ========= */
  useEffect(() => {
    if (showSplash) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (firebaseUser) {
        const profile = await getUserProfile({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
        });
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

  const handleSelectSection = (nextSection) => {
    if (!isAdmin && nextSection === "Panel Admin") {
      setSection("Solicitar eSIM");
      return;
    }

    setSection(nextSection);
  };

  /* ========= SPLASH ========= */
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  /* ========= LOADING ========= */
  if (loading) {
    return <LoadingScreen />;
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
    "Solicitar eSIM": <EsimRequestForm user={user} />,
    "Devolución eSIMs": <DevolucionEsims user={user} />,
    "Mis Solicitudes": <UserReport user={user} />,
  };

  if (isAdmin) {
    sections["Panel Admin"] = (
      <>
        <AdminPanel user={user} />
      </>
    );
  }

  return (
    <div style={styles.app}>
      <Navbar
        onLogout={handleLogout}
        user={user}
        onSelect={handleSelectSection}
      />

      <main style={styles.main}>
        {sections[sectionActiva] || null}
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
    overflowX: "hidden",
    overflowY: "auto",
  },
  main: {
    padding: "2rem 0",
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
