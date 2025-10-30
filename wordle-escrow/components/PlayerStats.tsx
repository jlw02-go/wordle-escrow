// components/PlayerStats.tsx
import React, { useMemo } from "react";

type BaseRow = {
  games: number;
  total: number;
  avg: number;
  wins: number;
  // optional fields
  best?: number;
  worst?: number;
  streak?: number;
  longestStreak?: number;
};

type Props = {
  stats: Record<string, BaseRow>;
  players: string[];
  reveal: boolean;
  // Used for the grid/boxes preview beneath the table
  todaysSubmissions?: Record<string, any>;
};

const PlayerStats: React.FC<Props> = ({ stats, players, reveal, todaysSubmissions = {} }) => {
  if (!reveal) {
    return (
      <section className="rounded-lg border border-gray-700 p-4">
        <h3 className="text-lg font-semibold mb-2">Player Statistics</h3>
        <p className="text-sm text-gray-400">
          Stats unlock after both players submit or at 7:00 PM Central.
        </p>
      </section>
    );
  }

  const rows = useMemo(() => {
    const list = (players || []).map((p) => {
      const r = stats?.[p] || { games: 0, total: 0, avg: 0, wins: 0 };
      return { player: p, ...r };
    });

    // Sort by wins desc, then avg asc, then name
    list.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.avg !== b.avg) return a.avg - b.avg;
      return a.player.localeCompare(b.player);
    });
    return list;
  }, [players, stats]);

  // Which optional columns exist?
  const hasBest = rows.some((r) => typeof r.best === "number");
  const hasWorst = rows.some((r) => typeof r.worst === "number");
  const hasStreak = rows.some((r) => typeof r.streak === "number");
  const hasLongest = rows.some((r) => typeof r.longestStreak === "number");

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-4">Player Statistics</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-gray-300">
            <tr>
              <th className="py-2 pr-4">Player</th>
              <th className="py-2 pr-4">Games</th>
              <th className="py-2 pr-4">Total</th>
              <th className="py-2 pr-4">Average</th>
              <th className="py-2 pr-4">Wins</th>
              {hasBest && <th className="py-2 pr-4">Best</th>}
              {hasWorst && <th className="py-2 pr-4">Worst</th>}
              {hasStreak && <th className="py-2 pr-4">Streak</th>}
              {hasLongest && <th className="py-2 pr-4">Longest</th>}
            </tr>
          </thead>
          <tbody className="text-gray-100">
            {rows.map((r) => (
              <tr key={r.player} className="border-t border-gray-700">
                <td className="py-2 pr-4 font-medium">{r.player}</td>
                <td className="py-2 pr-4">{r.games}</td>
                <td className="py-2 pr-4">{r.total}</td>
                <td className="py-2 pr-4">{r.avg}</td>
                <td className="py-2 pr-4">{r.wins}</td>
                {hasBest && <td className="py-2 pr-4">{r.best ?? "—"}</td>}
                {hasWorst && <td className="py-2 pr-4">{r.worst ?? "—"}</td>}
                {hasStreak && <td className="py-2 pr-4">{r.streak ?? "—"}</td>}
                {hasLongest && <td className="py-2 pr-4">{r.longestStreak ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Today’s grid/boxes per player */}
      <div className="mt-4 space-y-3">
        {(players || []).map((p) => {
          const sub = todaysSubmissions?.[p];
          const grid: string[] = Array.isArray(sub?.grid) ? sub.grid : [];
          if (!grid.length) return null;
          return (
            <div key={`grid-${p}`}>
              <div className="text-sm text-gray-300 mb-1">{p}&apos;s guesses</div>
              <pre className="bg-gray-800/60 p-2 rounded leading-5 whitespace-pre-wrap">
                {grid.join("\n")}
              </pre>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default PlayerStats;
