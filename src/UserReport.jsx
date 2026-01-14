import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { auth } from "./firebase";

export default function UserReport() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserEmail(user?.email || "");
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchSolicitudes() {
      if (!userEmail) return;
      setLoading(true);
      const q = query(collection(db, "solicitudes"), where("usuario", "==", userEmail));
      const querySnapshot = await getDocs(q);
      setSolicitudes(querySnapshot.docs.map(doc => doc.data()));
      setLoading(false);
    }
    fetchSolicitudes();
  }, [userEmail]);

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto" }}>
      <h2>Mis Solicitudes</h2>
      {loading ? (
        <div>Cargando...</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Serie</th>
              <th>Pedido</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s, i) => (
              <tr key={i}>
                <td>{s.serie}</td>
                <td>{s.pedido}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
