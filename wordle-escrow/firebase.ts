// FIX: Use namespace imports for Firebase to resolve potential module resolution issues.
import * as firebaseApp from "firebase/app";
import * as firestore from "firebase/firestore";

// IMPORTANT: Replace with your Firebase project's configuration.
// You can find this in your Firebase project console:
// Project Settings > General > Your apps > Web app > Config
const firebaseConfig = {
  apiKey: "AIzaSyA0qK2BZY-aB_Ll3fz_tzdzxOkzucY3t6M",
  authDomain: "wordle-escrow.firebaseapp.com",
  projectId: "wordle-escrow",
  storageBucket: "wordle-escrow.firebasestorage.app",
  messagingSenderId: "133728655772",
  appId: "1:133728655772:web:c0fd394f22de012a949059"
};

// This check helps guide the user to set up their config.
export const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

// Initialize Firebase
// We check if the config is populated before initializing to prevent errors.
const app = isFirebaseConfigured ? firebaseApp.initializeApp(firebaseConfig) : null;

// Get a Firestore instance
export const db = isFirebaseConfigured ? firestore.getFirestore(app!) : null;