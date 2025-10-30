// utils/autoSummary.ts
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

/**
 * Use a model that is available for v1beta:generateContent.
 * If you still get 404, list models with:
 *   GET https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY
 * and pick from the results (e.g., "gemini-2.0-flash", "gemini-2.5-flash").
 */
const MODEL = "gemini-2.5-flash";

type Submissions = Record<
  string,
  {
    score?: number | string;
    puzzleNumber?: number;
    grid?: string[] | string;
  }
>;

function buildPrompt(groupId: string, today: string, todaysSubmissions: Submissions) {
  // Build a tiny scoreboard from the object you pass in (e.g., { Joe: {score: 3}, Pete: {score: 4} })
  const lines: string[] = [];
  try {
    for (const [name, sub] of Object.entries(todaysSubmissions || {})) {
      const s = (sub?.score ?? "?") as any;
      lines.push(`${name}: ${String(s)}/6`);
    }
  } catch {
    // ignore
  }
  const scoreboard = lines.length ? `\nScores today:\n- ${lines.join("\n- ")}` : "";

  // Keep prompt short, playful, and deterministic enough
  return `Write a witty, one-paragraph recap of today's Wordle duel between Joe and Pete for group "${groupId}" on ${today}.
Keep it playful and friendly with light trash talk, 1–2 jokes max, and end with a short punchline.
Do not reveal the actual word; only reference the scores subtly.${scoreboard}`;
}

/**
 * Idempotent client-side generator:
 * - Skips if summary already has text.
 * - Writes status fields to help debug ("started" | "succeeded" | "failed").
 * - On failure, records errorMessage so you can see exactly why in Firestore.
 *
 * The summary is stored at:
 *   Collection: daySummaries
 *   Doc ID: `${groupId}_${today}`
 *   Fields: { groupId, date, text, status, createdAt, startedAt?, failedAt?, errorMessage? }
 */
export async function generateSummaryIfNeeded(
  groupId: string,
  today: string,
  todaysSubmissions: Submissions
) {
  if (!db) {
    console.warn("[autoSummary] No Firestore DB; skipping.");
    return;
  }
  if (!GEMINI_KEY) {
    console.warn("[autoSummary] Missing VITE_GEMINI_API_KEY; skipping.");
    return;
  }

  const docId = `${groupId}_${today}`;
  const ref = doc(db, "daySummaries", docId);

  // 1) Check if a summary already exists with text
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : undefined;
  const existingText = (existing?.text as string) || "";
  if (existingText.trim()) {
    // Already done — nothing to do
    return;
  }

  // 2) Mark "started" (best-effort coordination)
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
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 400)}`);
    }

    const json = await res.json();
    const candidate =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ||
      (Array.isArray(json?.candidates?.[0]?.content?.parts)
        ? json.candidates[0].content.parts
            .map((p: any) => p?.text)
            .filter(Boolean)
            .join("\n")
        : "") ||
      "";

    const finalText = (candidate || "").trim() || `Daily banter for ${today}.`;

    // 4) Save success with text
    await setDoc(
      ref,
      {
        text: finalText,
        status: "succeeded",
        createdAt: serverTimestamp(),
        errorMessage: "",
      },
      { merge: true }
    );
  } catch (e: any) {
    // 5) Record failure reason
    await setDoc(
      ref,
      {
        status: "failed",
        errorMessage: String(e?.message || e || "Unknown error"),
        failedAt: serverTimestamp(),
      },
      { merge: true }
    );
    // Re-throw is optional; callers can swallow
    throw e;
  }
}
