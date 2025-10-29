// components/AiSummary.tsx
import React, { useMemo, useState } from "react";

type Submission = {
  player: string;
  date: string;          // YYYY-MM-DD
  score: number | string;
  grid?: string;
  puzzleNumber?: number;
};

type Props = {
  todaysSubmissions: Record<string, Submission>;
  saveAiSummary: (text: string) => void;
  today: string;
  existingSummary?: string;
  forceReveal?: boolean;
};

function toNum(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 99; // treat missing as high (worse)
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const OPENERS = [
  "Spicy takes from the Wordle trenches:",
  "Today’s Wordle drama in one paragraph:",
  "Fresh tea from the Wordle board:",
  "The algorithm has spoken:",
  "Live from the pixel battlefield:",
];
const PRAISE = ["laser-focused","in absolute form","dialed in","cold-blooded","unflappable","clinical"];
const TEASE  = ["needs a coffee","might still be on airplane mode","ran out of vowels","left the brain at home","got humbled by a sneaky consonant","took the scenic route"];

export default function AiSummary({
  todaysSubmissions,
  saveAiSummary,
  today,
  existingSummary,
  forceReveal = false,
}: Props) {
  const entries = useMemo(() => {
    const e = Object.values(todaysSubmissions || {});
    return e
      .filter((r) => r && r.player)
      .map((r) => ({
        player: r.player,
        score: toNum(r.score),
        grid: r.grid || "",
        puzzleNumber: r.puzzleNumber ?? 0,
      }));
  }, [todaysSubmissions]);

  const byScore = useMemo(() => {
    const arr = [...entries];
    arr.sort((a, b) => a.score - b.score);
    return arr;
  }, [entries]);

  const [text, setText] = useState<string>(existingSummary || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  function generateLocalBanter() {
    if (!entries.length) {
      return `No spoilers yet for ${today}. Someone hit “Share” so we can stir the pot.`;
    }
    const opener = pick(OPENERS);
    const best = byScore[0];
    const worst = byScore[byScore.length - 1];
    const tieForBest = byScore.length > 1 && byScore[0].score === byScore[1].score;

    const parts: string[] = [];
    parts.push(opener);

    if (tieForBest) {
      const topPack = byScore.filter((x) => x.score === best.score).map((x) => x.player);
      parts.push(`Top spot is a **${topPack.length}-way tie** at **${best.score}/6**: ${topPack.join(", ")}.`);
    } else {
      parts.push(`**${best.player}** was ${pick(PRAISE)} with a crisp **${best.score}/6**.`);
    }

    if (byScore.length >= 2) {
      const margin = worst.score - best.score;
      if (margin >= 2) {
        parts.push(`${worst.player} ${pick(TEASE)} — finishing on **${worst.score}/6**, ${margin} behind the leader.`);
      } else if (margin === 1) {
        parts.push(`${worst.player} came up just short on **${worst.score}/6**. One tile away from glory.`);
      }
    }

    if (byScore.length > 2) {
      const mids = byScore.slice(1, -1).map((x) => x.player);
      if (mids.length) parts.push(`Solid shifts from the midfield: ${mids.join(", ")}.`);
    }

    const anyGrid = entries.some((e) => e.grid && e.grid.includes("🟩"));
    if (anyGrid) parts.push("Plenty of green squares were harmed in the making of today’s victory.");

    parts.push(`That’s the wrap for **${today}**. New day, same 🟩 grind tomorrow.`);
    return parts.join(" ");
  }

  async function generateWithGemini(): Promise<string> {
    const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!key) throw new Error("Missing VITE_GEMINI_API_KEY");

    // Build a clean, minimal prompt with today’s data
    const rows = byScore.map((r) => `- ${r.player}: ${r.score}/6`).join("\n");
    const prompt = `
You are a witty sports commentator recapping a friendly Wordle competition.
Write a single lively paragraph (3–5 sentences max), playful but clean.
Include winners, ties, notable margins, and keep it light.
Date: ${today}
Scores (lower is better):
${rows}
Now produce the recap paragraph only (no headers), in Markdown.`;

    const body = {
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
    };

    const resp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + encodeURIComponent(key),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!resp.ok) {
      throw new Error(`Gemini HTTP ${resp.status}`);
    }
    const json = await resp.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ||
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ||
      "";
    if (!text.trim()) throw new Error("Gemini returned empty text");
    return text.trim();
  }

  async function handleGenerate() {
    setErr("");
    setBusy(true);
    try {
      // If no entries and not forced, just do the local “no spoilers” line.
      if (entries.length === 0 && !forceReveal) {
        setText(generateLocalBanter());
        return;
      }
      // Try Gemini; on any failure, fall back locally.
      const out = await generateWithGemini().catch(() => "");
      setText(out || generateLocalBanter());
    } catch (e: any) {
      console.error("[AiSummary] generate error:", e?.message || e);
      setErr("AI generator failed — using local banter instead.");
      setText(generateLocalBanter());
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    const val = (text || "").trim();
    saveAiSummary(val);
  }

  const disabled = entries.length === 0 && !forceReveal;

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Daily AI Banter</h3>
        <div className="space-x-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy || disabled}
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              busy || disabled
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-wordle-green text-white hover:bg-green-600"
            }`}
            title={disabled ? "Need at least one submission (or use ?reveal=1)" : "Generate with Gemini (fallback safe)"}
          >
            {busy ? "Thinking…" : "Generate"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1 rounded-md text-sm font-medium bg-gray-700 hover:bg-gray-600"
          >
            Save
          </button>
        </div>
      </div>

      {err && <p className="text-red-400 text-sm mb-2">{err}</p>}

      <textarea
        rows={5}
        className="w-full bg-gray-800 border border-gray-700 rounded-md p-2"
        placeholder={`Click "Generate" to create a recap for ${today}...`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <p className="mt-2 text-xs text-gray-500">
        Uses Gemini when available, otherwise falls back to a local generator. Tip: add <code>?reveal=1</code> to test early.
      </p>
    </section>
  );
}
