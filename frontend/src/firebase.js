// frontend/src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAGpgnVyvslUBgVk9woIL06r7DY6bcHKWQ",
  authDomain: "whatsapp-lite-pro.firebaseapp.com",
  projectId: "whatsapp-lite-pro",
  storageBucket: "whatsapp-lite-pro.firebasestorage.app",
  messagingSenderId: "356286951848",
  appId: "1:356286951848:web:b0cc84aa009a8371cced9d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);