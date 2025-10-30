// components/ScoreInputForm.tsx
import React, { useMemo, useState } from "react";
import { Submission } from "../hooks/useWordleData";
import { parseWordleHeader, extractGrid } from "../utils/parsing";

interface Props {
  addSubmission: (s: Omit<Submission, "groupId">) => void | Promise<void>;
  todaysSubmissions: Record<string, Submission>;
  players: ("Joe" | "Pete")[];
}

const ScoreInputForm: React.FC<Props> = ({ addSubmission, todaysSubmissions, players }) => {
  const [player, setPlayer] = useState<"Joe" | "Pete" | "">("");
  const [shareText, setShareText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const available = useMemo(
    () => players.filter((p) => !todaysSubmissions[p]),
    [players, todaysSubmissions]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!player) return setError("Please select your name.");
    if (!shareText.trim()) return setError("Please paste your Wordle score.");

    const lines = shareText.trim().split(/\r?\n/);
    if (lines.length < 2) return setError("Invalid Wordle share text.");

    const header = parseWordleHeader(lines[0]);
    if (!header) return setError('Could not parse header (e.g., "Wordle 123 4/6").');

    const { puzzleNumber, score } = header;
    const grid = extractGrid(lines);

    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];

    const submission: Omit<Submission, "groupId"> = {
      player,
      date: today,
      score,
      grid,
      puzzleNumber,
    };
    await addSubmission(submission);
    setSuccess(`Thanks, ${player}! Your score has been submitted.`);
    setShareText("");
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Submit Today&apos;s Score</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Player</label>
          <select
            value={player}
            onChange={(e) => setPlayer(e.target.value as "Joe" | "Pete")}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
          >
            <option value="" disabled>
              Select your name
            </option>
            {available.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {available.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">Both players have submitted for today.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Paste Wordle Score</label>
          <textarea
            rows={6}
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
            placeholder={`Wordle 1,114 4/6

⬜🟨⬜⬜🟩
⬜⬜🟨⬜🟩
🟩🟩⬜⬜🟩
🟩🟩🟩🟩🟩`}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green placeholder-gray-500"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        <button
          type="submit"
          disabled={available.length === 0}
          className="w-full bg-wordle-green text-white font-bold py-2 px-4 rounded-md hover:bg-green-600 transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {available.length > 0 ? "Submit Score" : "All Scores Submitted!"}
        </button>
      </form>
    </div>
  );
};

export default ScoreInputForm;
