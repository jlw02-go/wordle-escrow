// debugFirebase.ts
export function logFirebaseEnv() {
  // These aren't secrets; it's safe to log them.
  console.log("[FB ENV] PROJECT_ID =", import.meta.env.VITE_FIREBASE_PROJECT_ID);
  console.log("[FB ENV] AUTH_DOMAIN =", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
  console.log("[FB ENV] STORAGE_BUCKET =", import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
  console.log("[FB ENV] APP_ID =", import.meta.env.VITE_FIREBASE_APP_ID);
  console.log("[FB ENV] SENDER_ID =", import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
}
