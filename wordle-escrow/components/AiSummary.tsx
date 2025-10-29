import React, { useState } from "react";
import { Submission, DailySubmissions } from "../types";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

interface AiSummaryProps {
  todaysSubmissions: DailySubmissions;
  today: string;
  existingSummary?: string;
  saveAiSummary: (summary: string) => Promise<void>;
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

  const submissions = Object.values(todaysSubmissions || {});
  const byScore = [...submissions].sort((a, b) => a.score - b.score);

  // ---------- Gemini AI Banter Generator ----------
  async function generateWithGemini(): Promise<string> {
    const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!key) throw new Error("Missing VITE_GEMINI_API_KEY");

    const rows = byScore.map((r) => `- ${r.player}: ${r.score}/6`).join("\n");
    const prompt = `
You are a witty sports commentator recapping a friendly Wordle competition.
Write a lively, clever, and brief paragraph (3–5 sentences max).
Include winners, ties, upsets, and keep it lighthearted.
Date: ${today}
Scores (lower is better):
${rows}
Now write the recap paragraph only (no title, no intro).`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
    };

    // ✅ Use "latest" model alias + header auth
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Gemini HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }

    const json = await resp.json();
    const out =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ||
      (Array.isArray(json?.candidates?.[0]?.content?.parts)
        ? json.candidates[0].content.parts
            .map((p: any) => p?.text)
            .filter(Boolean)
            .join("\n")
        : "") ||
      "";

    if (!out.trim()) throw new Error("Gemini returned empty text");
    return out.trim();
  }

  const generateSummary = async () => {
    setError("");
    setLoading(true);
    try {
      const text = await generateWithGemini();
      setSummary(text);
      await saveAiSummary(text);
    } catch (err: any) {
      console.error("AI Summary generation failed:", err);
      const fallback = `Wordle Recap for ${today}: A tightly contested day! 
${byScore
  .map((r, i) => `${i + 1}. ${r.player} (${r.score}/6)`)
  .join(", ")}. Stay tuned for more witty commentary tomorrow!`;
      setSummary(fallback);
      setError("AI generator failed — using local banter instead.");
      await saveAiSummary(fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
      <h2 className="text-2xl font-bold text-wordle-green mb-2">
        Daily AI Banter
      </h2>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {summary ? (
        <div className="bg-gray-900 p-4 rounded-md border border-gray-700 whitespace-pre-wrap">
          {summary}
        </div>
      ) : (
        <p className="text-gray-400 italic">
          No AI summary yet — click Generate below!
        </p>
      )}

      <button
        onClick={generateSummary}
        disabled={loading}
        className="bg-wordle-green hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md transition disabled:opacity-60"
      >
        {loading ? "Generating..." : "Generate"}
      </button>
    </section>
  );
};

export default AiSummary;
