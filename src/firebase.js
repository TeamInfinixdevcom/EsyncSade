
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBxMikh35jEED4tMOIiSzexr25WVtXr6f8",
  authDomain: "homewise-77.firebaseapp.com",
  projectId: "homewise-77",
  storageBucket: "homewise-77.appspot.com",
  messagingSenderId: "154140858874",
  appId: "1:154140858874:web:505af37aa26ef24dfa6c43",
  measurementId: "G-D8NGP9NSE0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
