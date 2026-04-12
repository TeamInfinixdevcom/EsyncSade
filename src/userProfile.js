import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

const ADMIN_EMAILS = ["rmadrigalj@ice.go.cr", "caoban@ice.go.cr"];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeTextKey(value) {
  return normalizeText(value).toLowerCase();
}

function isTrueFlag(value) {
  return value === true || normalizeTextKey(value) === "true";
}

export function normalizeAgency(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

export function getUserAgency(user) {
  return normalizeAgency(user?.agencia || user?.agency || "");
}

export function sameAgency(a, b) {
  return normalizeTextKey(a) !== "" && normalizeTextKey(a) === normalizeTextKey(b);
}

function getNormalizedRole(user) {
  return normalizeTextKey(user?.rol || user?.role || "");
}

export function isGeneralAdmin(user) {
  if (!user) return false;

  const email = normalizeTextKey(user.email);
  const role = getNormalizedRole(user);
  const adminGeneralFlag = isTrueFlag(user.adminGeneral) || isTrueFlag(user.superAdmin);
  const adminLegacyFlag = isTrueFlag(user.admin) || isTrueFlag(user.isAdmin);

  if (ADMIN_EMAILS.includes(email)) return true;
  if (adminGeneralFlag) return true;
  if (["admin_general", "super_admin", "administrador_general"].includes(role)) return true;
  if (role === "admin" && !getUserAgency(user)) return true;
  if (adminLegacyFlag && !getUserAgency(user)) return true;

  return false;
}

export function isAgencyAdmin(user) {
  if (!user) return false;

  const role = getNormalizedRole(user);
  const agency = getUserAgency(user);
  const adminAgencyFlag = isTrueFlag(user.adminAgencia);

  if (!agency) return false;
  if (adminAgencyFlag) return true;
  if (["admin_agencia", "administrador_agencia"].includes(role)) return true;
  if (role === "admin") return true;

  return false;
}

export function isUserAdmin(user) {
  return isGeneralAdmin(user) || isAgencyAdmin(user);
}

export async function getUserProfile(userOrEmail) {
  const db = getFirestore();

  const uid = typeof userOrEmail === "string" ? "" : normalizeText(userOrEmail?.uid);
  const emailInput = typeof userOrEmail === "string"
    ? userOrEmail
    : (userOrEmail?.email || userOrEmail?.user?.email || "");
  const email = normalizeTextKey(emailInput);

  if (uid) {
    const byUid = await getDoc(doc(db, "usuarios", uid));
    if (byUid.exists()) {
      return { id: byUid.id, ...byUid.data() };
    }
  }

  if (!email) return null;

  const q = query(collection(db, "usuarios"), where("email", "==", email));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const byUidMatch = uid
    ? snapshot.docs.find((docSnap) => docSnap.id === uid)
    : null;
  const selected = byUidMatch || snapshot.docs[0];

  return { id: selected.id, ...selected.data() };
}
