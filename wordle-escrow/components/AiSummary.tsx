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

      const submissionsArray = Object.entries(todaysSubmissions || {}).map(
        ([player, data]) => `${player}: ${JSON.stringify(data)}`
      );

      const prompt = `
You are a witty commentator describing the daily Wordle competition among friends.
Today's date: ${today}.
Each submission includes a player and their result.
Write a short, humorous recap (2–4 sentences) summarizing the day's outcomes.
Do NOT repeat raw data — use tone like a friendly sportscaster.
Data: ${submissionsArray.join("\n")}
`;

      console.log("[AI Summary] Sending prompt:", prompt);

      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

      const response = await fetch(`${url}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Gemini API error:", response.status, text);
        throw new Error(`Gemini HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();
      const aiText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Gemini didn’t send a summary this time.";

      console.log("[AI Summary] Received:", aiText);
      setSummary(aiText);
      await saveAiSummary(aiText);
    } catch (err: any) {
      console.error("AI Summary generation failed:", err);
      setError("AI generator failed — using local banter instead.");
      const fallback = `(${today}) Our brave Wordlers faced the grid again. Some triumphed, others cursed their fifth guess—but spirits remain high.`;
      setSummary(fallback);
      await saveAiSummary(fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="ai-summary-h"
      className="rounded-lg border border-gray-700 p-4"
    >
      <h3 id="ai-summary-h" className="text-lg font-semibold mb-3">
        Daily AI Banter
      </h3>

      {summary ? (
        <p className="text-gray-200 whitespace-pre-line mb-3">{summary}</p>
      ) : (
        <p className="text-gray-400 mb-3">
          No witty summary yet — click below to generate one!
        </p>
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

export default AiSummary;
