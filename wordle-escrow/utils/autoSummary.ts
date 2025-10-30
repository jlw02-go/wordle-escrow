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

  return `Write a witty, one-paragraph recap of today's Wordle duel between Joe and Pete. Keep it playful, friendly trash-talk, and end with a short punchline. Avoid spoilers beyond scores.
${scoreboard ? "\n" + scoreboard : ""}`;
}

export async function generateSummaryIfNeeded(
  groupId: string,
  today: string,
  todaysSubmissions: Submissions
) {
  if (!db || !GEMINI_KEY) {
    console.warn("[autoSummary] Missing DB or GEMINI key; skipping.");
    return;
  }

  const docId = `${groupId}_${today}`;
  const ref = doc(db, "daySummaries", docId);

  // Read current state
  const snap = await getDoc(ref);
  const cur = snap.exists() ? snap.data() : undefined;
  const existingText = (cur?.text as string) || "";

  // If already has text, bail
  if (existingText.trim()) {
    console.log("[autoSummary] Summary already exists; skipping.");
    return;
  }

  // Mark started (useful for debugging)
  await setDoc(
    ref,
    {
      groupId,
      date: today,
      status: "started",
      startedAt: serverTimestamp(),
      errorMessage: "",
    },
    { merge: true }
  );

  try {
    // Call Gemini
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
      const errText = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const json = await res.json();
    const candidate =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ||
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ||
      "";
    const final = (candidate || "").trim() || `Daily banter for ${today}.`;

    await setDoc(
      ref,
      {
        text: final,
        status: "succeeded",
        createdAt: serverTimestamp(),
        errorMessage: "",
      },
      { merge: true }
    );

    console.log("[autoSummary] Summary saved.");
  } catch (e: any) {
    console.error("[autoSummary] Generation failed:", e);
    await setDoc(
      ref,
      {
        status: "failed",
        errorMessage: String(e?.message || e || "Unknown error"),
        failedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}
