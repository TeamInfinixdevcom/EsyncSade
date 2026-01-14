import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { auth } from "./firebase";

export async function getUserProfile(email) {
  const db = getFirestore();
  const q = query(collection(db, "usuarios"), where("email", "==", email));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  // Devuelve el primer usuario encontrado
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}
