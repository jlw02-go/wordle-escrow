// devTest.ts
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function testWriteOnce() {
  if (!db) {
    console.warn("[devTest] Firestore db is undefined (env not loaded/mismatch)");
    return;
  }
  try {
    const ref = await addDoc(collection(db, "results"), {
      playerA: "Debug",
      playerB: "Check",
      scoreA: 1,
      scoreB: 0,
      createdAt: serverTimestamp(),
    });
    console.log("[devTest] Wrote doc:", ref.id);
  } catch (e: any) {
    console.error("Firestore write failed:", e?.code, e?.message, e);
  }
}
