// components/ScoreInputForm.tsx
import React, { useState, useMemo } from "react";
import { Submission, DailySubmissions } from "../types";
import { parseWordleHeader, extractGrid } from "../utils/parsing";

interface ScoreInputFormProps {
  addSubmission: (submission: Submission) => void;
  todaysSubmissions: DailySubmissions;
  players: string[];
  today: string;                 // 🔴 canonical Chicago-day from the hook
}

const ScoreInputForm: React.FC<ScoreInputFormProps> = ({
  addSubmission,
  todaysSubmissions,
  players,
  today,
}) => {
  const [player, setPlayer] = useState("");
  const [shareText, setShareText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const availablePlayers = useMemo(
    () => players.filter((p) => !todaysSubmissions[p]),
    [players, todaysSubmissions]
  );

  const parseAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!player) {
      setError("Please select your name.");
      return;
    }
    if (!shareText) {
      setError("Please paste your Wordle score.");
      return;
    }

    const lines = shareText.trim().split(/\r?\n/);
    if (lines.length < 2) {
      setError("Invalid Wordle share format. Please paste the full text from the share button.");
      return;
    }

    const headerData = parseWordleHeader(lines[0]);
    if (!headerData) {
      setError('Could not parse Wordle score. Make sure it includes the header (e.g., "Wordle 123 4/6").');
      return;
    }

    const { puzzleNumber, score } = headerData;
    const grid = extractGrid(lines);

    // 🔴 Use the canonical date passed from GroupPage/useWordleData
    const submission: Submission = {
      player,
      date: today,
      score,
      grid,
      puzzleNumber,
    };

    addSubmission(submission);
    setSuccess(`Thanks, ${player}! Your score has been submitted.`);
    setPlayer("");
    setShareText("");
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Submit Today&apos;s Score</h2>
      <form onSubmit={parseAndSubmit} className="space-y-4">
        <div>
          <label htmlFor="player-select" className="block text-sm font-medium text-gray-300 mb-1">
            Player
          </label>
          <select
            id="player-select"
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
          >
            <option value="" disabled>Select your name</option>
            {availablePlayers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="share-text" className="block text-sm font-medium text-gray-300 mb-1">
            Paste Wordle Score
          </label>
          <textarea
            id="share-text"
            rows={6}
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
            placeholder={`Wordle 1,114 4/6

⬜🟨⬜⬜🟩
⬜⬜🟨⬜🟩
🟩🟩⬜⬜🟩
🟩🟩🟩🟩🟩`}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green placeholder-gray-500"
          ></textarea>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        <button
          type="submit"
          disabled={availablePlayers.length === 0}
          className="w-full bg-wordle-green text-white font-bold py-2 px-4 rounded-md hover:bg-green-600 transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {availablePlayers.length > 0 ? "Submit Score" : "All Scores Submitted!"}
        </button>
      </form>
    </div>
  );
};

export default ScoreInputForm;
