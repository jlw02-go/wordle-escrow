import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// All configuration is now read from secure environment variables using Vite's required prefix.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// This check helps guide the user to set up their config in the environment.
export const isFirebaseConfigured = !!firebaseConfig.apiKey;

// Initialize Firebase
// We check if the config is populated before initializing to prevent errors.
const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

// Get a Firestore instance
export const db = isFirebaseConfigured ? getFirestore(app!) : null;
