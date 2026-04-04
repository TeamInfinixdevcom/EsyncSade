import { getFirestore, doc, getDoc } from "firebase/firestore";

export async function getUserProfile(uid) {
  if (!uid) return null;
  const db = getFirestore();
  const ref = doc(db, "usuarios", uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}
