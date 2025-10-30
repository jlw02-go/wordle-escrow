// utils/autoSummary.ts
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// Try newest first, then a reliable fallback.
const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

type Submissions = Record<
  string,
  {
    score?: number | string;
    puzzleNumber?: number;
    grid?: string[] | string;
  }
>;

function buildPrompt(groupId: string, today: string, todaysSubmissions: Submissions) {
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

  return `Write a witty, one-paragraph recap of today's Wordle duel between Joe and Pete for group "${groupId}" on ${today}.
Keep it playful, light trash talk is okay, but keep it friendly. Include at most 2 jokes. End with a short punchline.
Do not reveal the actual word. Reference scores only at a high level.${scoreboard}`;
}

function extractText(json: any): { text: string; finishReason?: string; blockReason?: string } {
  // Typical success path
  const parts = json?.candidates?.[0]?.content?.parts;
  const finishReason = json?.candidates?.[0]?.finishReason;
  const blockReason = json?.promptFeedback?.blockReason || json?.candidates?.[0]?.safetyRatings?.[0]?.blocked;

  let text = "";
  if (Array.isArray(parts)) {
    // Newer responses: parts may be {text}, sometimes multiple lines
    const strings = parts
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean);
    text = strings.join("\n").trim();
  }

  // Older / alt shapes: some responses may put the text directly on content or candidates[0].output_text
  if (!text && typeof json?.candidates?.[0]?.output_text === "string") {
    text = json.candidates[0].output_text.trim();
  }
  if (!text && typeof json?.candidates?.[0]?.content?.text === "string") {
    text = json.candidates[0].content.text.trim();
  }

  return { text, finishReason, blockReason };
}

async function callGeminiOnce(model: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0,       // slightly lower to reduce safety triggers
        maxOutputTokens: 220,   // modest length
      },
      // You can add safetySettings here if needed.
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini HTTP ${res.status} (${model}): ${errText.slice(0, 400)}`);
  }

  const json = await res.json();
  const { text, finishReason, blockReason } = extractText(json);

  if (!text) {
    const msg = `Empty text (${model}). finishReason=${String(finishReason)} blockReason=${String(blockReason)}`;
    throw new Error(msg);
  }

  return { text, finishReason, blockReason };
}

/**
 * Idempotent client-side generator with detailed status:
 * - Skips if summary already has non-empty text.
 * - Attempts gemini-2.5-flash, then gemini-2.0-flash if needed.
 * - Writes status text fields so you can see exactly what happened.
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

  // 1) Check existing
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : undefined;
  const existingText = (existing?.text as string) || "";
  if (existingText.trim()) {
    // Already generated
    return;
  }

  // 2) Mark started
  await setDoc(
    ref,
    {
      groupId,
      date: today,
      status: "started",
      startedAt: serverTimestamp(),
      errorMessage: "",
      modelTried: "",
      finishReason: "",
      blockReason: "",
    },
    { merge: true }
  );

  const prompt = buildPrompt(groupId, today, todaysSubmissions);

  let lastError: any = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      const { text, finishReason, blockReason } = await callGeminiOnce(model, prompt);
      await setDoc(
        ref,
        {
          text,
          status: "succeeded",
          createdAt: serverTimestamp(),
          errorMessage: "",
          modelTried: model,
          finishReason: String(finishReason ?? ""),
          blockReason: String(blockReason ?? ""),
        },
        { merge: true }
      );
      return; // done
    } catch (e: any) {
      lastError = e;
      // record the failed attempt so you can see which model failed
      await setDoc(
        ref,
        {
          status: "failed",
          failedAt: serverTimestamp(),
          errorMessage: String(e?.message || e || "Unknown error"),
          modelTried: model,
        },
        { merge: true }
      );
      // try next model
    }
  }

  // If we got here, all models failed. Leave doc without text.
  if (lastError) throw lastError;
}
