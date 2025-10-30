// components/PlayerStats.tsx
import React from "react";
import { Submission } from "../hooks/useWordleData";

type StatsRecord = {
  gamesPlayed: number;
  totalScore: number;
  avgScore: number;
};

type Props = {
  stats: Record<string, StatsRecord>;
  players: ("Joe" | "Pete")[];
  /** Hide stats until reveal is true */
  reveal?: boolean;
  /** For showing today's guess patterns once revealed */
  todaysSubmissions?: Record<string, Submission | any>;
};

/** Normalize any stored grid value into an array of lines */
function asLines(grid: unknown): string[] {
  if (Array.isArray(grid)) return grid.filter(Boolean).map(String);
  if (typeof grid === "string") return grid.split(/\r?\n/).filter(Boolean);
  return [];
}

const PlayerStats: React.FC<Props> = ({
  stats = {},
  players,
  reveal = false,
  todaysSubmissions = {},
}) => {
  if (!reveal) {
    // Hide all numbers/details before reveal time or all-submitted
    return (
      <aside className="rounded-lg border border-gray-700 p-4">
        <h3 className="text-lg font-semibold mb-2">Player Statistics</h3>
        <p className="text-sm text-gray-400">
          Stats are hidden until both players submit or it’s 1:00 PM Central.
        </p>
      </aside>
    );
  }

  const rows = players.map((p) => {
    const s = stats[p] || { gamesPlayed: 0, totalScore: 0, avgScore: 0 };
    return { player: p, ...s };
  });

  return (
    <aside className="rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-3">Player Statistics</h3>

      {/* Aggregate stats table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-gray-300">
            <tr>
              <th className="text-left py-2 pr-3">Player</th>
              <th className="text-right py-2 px-3">Games</th>
              <th className="text-right py-2 px-3">Total</th>
              <th className="text-right py-2 pl-3">Avg</th>
            </tr>
          </thead>
          <tbody className="text-gray-100">
            {rows.map((r) => (
              <tr key={r.player} className="border-t border-gray-800">
                <td className="py-2 pr-3">{r.player}</td>
                <td className="py-2 px-3 text-right">{r.gamesPlayed}</td>
                <td className="py-2 px-3 text-right">{r.totalScore}</td>
                <td className="py-2 pl-3 text-right">{r.avgScore.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Today's NYT guess patterns (emoji grids) */}
      <div className="mt-5">
        <h4 className="text-md font-semibold mb-2">Today’s Guess Patterns</h4>
        {players.map((p) => {
          const sub = todaysSubmissions[p];
          const gridLines = asLines(sub?.grid);
          return (
            <div key={p} className="mb-3 rounded border border-gray-800 p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{p}</span>
                <span className="text-sm text-gray-400">
                  {sub ? `${Number(sub.score)}/6` : "—"}
                </span>
              </div>
              {gridLines.length ? (
                <pre className="mt-2 text-sm leading-5 whitespace-pre-wrap text-gray-300">
                  {gridLines.join("\n")}
                </pre>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No grid available.</p>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default PlayerStats;
