// components/AiSummary.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { collection, doc, onSnapshot, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { useParams } from "react-router-dom";

type Props = {
  todaysSubmissions: Record<string, any>;
  today: string;     // YYYY-MM-DD
  groupId: string;   // passed from GroupPage
  reveal: boolean;   // after both or 7pm CT
};

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MODEL = "gemini-2.0-flash";

function promptFor(today: string, subs: Record<string, any>) {
  const lines = Object.values(subs || [])
    .map((s: any) => {
      const p = s?.player ?? "";
      const sc = s?.score ?? "";
      const puz = s?.puzzleNumber ?? "";
      const grid = Array.isArray(s?.grid) ? s.grid.join("\n") : "";
      return `Player: ${p}\nScore: ${sc}\nPuzzle: ${puz}\nGrid:\n${grid}`;
    })
    .join("\n\n");

  return `Write a punchy, witty recap of today's head-to-head Wordle (2–4 sentences). 
Tone: playful sports booth, clever metaphors, zero profanity, G-rated, no meanness. 
Mention players by name, keep it factual—use ONLY the scores and grids provided.
If tied, celebrate the stalemate. If someone wins, congratulate them with a light, fun jab at the other.
Do NOT invent details that aren't in the scores or grids.

Date: ${today}

Submissions:
${lines || "No data"}`;
}

async function callGemini(prompt: string) {
  if (!GEMINI_KEY) throw new Error("Missing VITE_GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
    GEMINI_KEY
  )}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 256,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${text}`);
  }
  const json = await res.json();
  const out =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ||
    json?.candidates?.[0]?.content?.parts?.[0]?.raw_text ||
    "";
  return (out || "").trim();
}

const AiSummary: React.FC<Props> = ({ todaysSubmissions, today, groupId, reveal }) => {
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const kicked = useRef(false);
  const docId = `${groupId}_${today}`;

  useEffect(() => {
    if (!db || !groupId || !today) return;
    setLoading(true);
    const ref = doc(collection(db, "summaries"), docId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? (snap.data() as any) : null;
        setText(data?.text || "");
        setLoading(false);
      },
      (e) => {
        console.error("[AiSummary] snapshot error:", e);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [groupId, today, docId]);

  useEffect(() => {
    const run = async () => {
      if (!reveal) return;
      if (kicked.current) return;
      if (!db || !groupId || !today) return;

      try {
        const ref = doc(collection(db, "summaries"), docId);
        const snap = await getDoc(ref);
        if (snap.exists() && (snap.data() as any)?.text) return;

        kicked.current = true;

        const prompt = promptFor(today, todaysSubmissions);
        const out = await callGemini(prompt);
        const finalText = out || `Daily banter for ${today}.`;

        await setDoc(
          ref,
          {
            groupId,
            date: today,
            text: finalText,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e: any) {
        console.error("[AiSummary] generate failed:", e);
        setErr(e?.message || String(e));
      }
    };
    run();
  }, [reveal, groupId, today, docId, todaysSubmissions]);

  const header = useMemo(() => {
    if (!reveal) {
      return (
        <p className="text-sm text-gray-400">
          AI banter appears after both players submit or at 7:00 PM Central.
        </p>
      );
    }
    return <p className="text-sm text-gray-400">AI daily banter</p>;
  }, [reveal]);

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-2">AI Summary</h3>
      {header}

      {loading ? (
        <p className="text-sm text-gray-400 mt-2">Loading…</p>
      ) : !reveal ? null : text ? (
        <p className="mt-3 leading-relaxed">{text}</p>
      ) : err ? (
        <div className="mt-3 text-sm text-red-400">Summary generation failed: {err}</div>
      ) : (
        <p className="text-sm text-gray-500 mt-2">Generating…</p>
      )}
    </section>
  );
};

export default AiSummary;
