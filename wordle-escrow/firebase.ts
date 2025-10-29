// firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// quick sanity check – projectId is the one most likely to be wrong
const isFirebaseConfigured =
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.projectId &&
  !!firebaseConfig.appId;

if (!isFirebaseConfigured) {
  // Helpful console hint during local dev / Netlify preview
  // eslint-disable-next-line no-console
  console.warn(
    "[firebase] Missing or incomplete env vars. Check VITE_FIREBASE_* values. Current projectId:",
    firebaseConfig.projectId
  );
}

const app = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : undefined;

export const db = isFirebaseConfigured ? getFirestore(app!) : undefined;
export { isFirebaseConfigured };
