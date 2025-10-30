// components/AiSummary.tsx
import React, { useState } from "react";

interface AiSummaryProps {
  todaysSubmissions: Record<string, any>;
  today: string;
  existingSummary?: string;
  saveAiSummary: (summary: string) => Promise<void> | void;
}

const AiSummary: React.FC<AiSummaryProps> = ({
  todaysSubmissions,
  today,
  existingSummary,
  saveAiSummary,
}) => {
  const [summary, setSummary] = useState(existingSummary || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing Gemini API key (VITE_GEMINI_API_KEY).");
      }

      const rows = Object.entries(todaysSubmissions || {})
        .map(([player, d]: [string, any]) => {
          const s = typeof d?.score === "number" ? d.score : Number(d?.score ?? 99);
          return `- ${player}: ${Number.isFinite(s) ? s : 99}/6`;
        })
        .join("\n");

      const prompt = `
You are a witty commentator recapping a friendly Wordle league.
Write 3–5 sentences, playful but clean. Mention the winner/ties and any big gaps.
Date: ${today}
Scores (lower is better):
${rows}
Return only the paragraph (no headers).
`.trim();

      // ✅ Use a current model that works with v1beta
      const model = "gemini-2.5-flash-lite";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const resp = await fetch(`${url}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
        }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Gemini HTTP ${resp.status}: ${text.slice(0, 300)}`);
      }

      const data = await resp.json();
      const aiText =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ||
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      if (!aiText.trim()) throw new Error("Gemini returned empty text.");

      setSummary(aiText.trim());
      await saveAiSummary(aiText.trim());
    } catch (err: any) {
      console.error("AI Summary generation failed:", err);
      setError("AI generator failed — using local banter instead.");
      const fallback = buildLocalFallback(today, todaysSubmissions);
      setSummary(fallback);
      await saveAiSummary(fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="ai-summary-h" className="rounded-lg border border-gray-700 p-4">
      <h3 id="ai-summary-h" className="text-lg font-semibold mb-3">Daily AI Banter</h3>

      {summary ? (
        <p className="text-gray-200 whitespace-pre-line mb-3">{summary}</p>
      ) : (
        <p className="text-gray-400 mb-3">No witty summary yet — click below to generate one!</p>
      )}

      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

      <button
        type="button"
        disabled={loading}
        onClick={handleGenerate}
        className="bg-wordle-green hover:bg-green-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-60"
      >
        {loading ? "Generating..." : "Generate"}
      </button>
    </section>
  );
};

function buildLocalFallback(today: string, subs: Record<string, any>) {
  const arr = Object.entries(subs || {}).map(([player, d]: [string, any]) => {
    const s = typeof d?.score === "number" ? d.score : Number(d?.score ?? 99);
    return { player, score: Number.isFinite(s) ? s : 99 };
  });
  arr.sort((a, b) => a.score - b.score);
  if (!arr.length) return `(${today}) No spoilers yet — submit those grids!`;

  const top = arr[0];
  const worst = arr[arr.length - 1];
  const tie = arr.filter(x => x.score === top.score).map(x => x.player);
  const mid = arr.slice(1, -1).map(x => x.player);

  const bits: string[] = [];
  if (tie.length > 1) {
    bits.push(`(${today}) It's a ${tie.length}-way tie at ${top.score}/6: ${tie.join(", ")}.`);
  } else {
    bits.push(`(${today}) ${top.player} leads the pack with ${top.score}/6.`);
  }
  if (mid.length) bits.push(`Solid shifts from ${mid.join(", ")}.`);
  if (arr.length > 1) {
    const margin = worst.score - top.score;
    bits.push(`${worst.player} took the scenic route on ${worst.score}/6 (${margin} behind).`);
  }
  bits.push("New day, fresh greens tomorrow.");
  return bits.join(" ");
}

export default AiSummary;
