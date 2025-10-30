// utils/autoSummary.ts
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MODEL = "gemini-1.5-flash-002";

type Submissions = Record<string, { score?: number | string }>;

function buildPrompt(groupId: string, today: string, todaysSubmissions: Submissions) {
  const players = Object.entries(todaysSubmissions || {})
    .map(([name, sub]) => `${name}: ${sub?.score ?? "?"}/6`)
    .join("\n- ");
  const scoreboard = players ? `Scores:\n- ${players}` : "";

  return `Write a witty, one-paragraph recap of today's Wordle duel between Joe and Pete. Keep it playful, friendly trash-talk, and end with a short punchline. Avoid spoilers beyond scores. ${scoreboard ? "\n" + scoreboard : ""}`;
}

/**
 * Idempotent-ish client-side generator:
 * - If a summary doc already has text, it bails.
 * - Sets a 'startedAt' field before generating (best effort to reduce dupes).
 * - Writes the final 'text' once.
 */
export async function generateSummaryIfNeeded(groupId: string, today: string, todaysSubmissions: Submissions) {
  if (!db || !GEMINI_KEY) return;

  const docId = `${groupId}_${today}`;
  const ref = doc(db, "daySummaries", docId);

  // 1) If already generated, bail.
  const existing = await getDoc(ref);
  if (existing.exists() && (existing.data()?.text as string)) return;

  // 2) Best-effort: mark started (prevents most dupes across clients)
  await setDoc(ref, { groupId, date: today, startedAt: serverTimestamp() }, { merge: true });

  // 3) Call Gemini
  const prompt = buildPrompt(groupId, today, todaysSubmissions);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
      GEMINI_KEY
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 256 },
      }),
    }
  );

  if (!res.ok) {
    // leave doc without text; UI will still allow another attempt later
    return;
  }

  const json = await res.json();
  const candidate =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ||
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ||
    "";
  const final = (candidate || "").trim() || `Daily banter for ${today}.`;

  // 4) Save text (merge to keep startedAt)
  await setDoc(
    ref,
    {
      groupId,
      date: today,
      text: final,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}
