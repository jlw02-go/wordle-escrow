// components/PlayerStats.tsx
import React, { useMemo } from "react";

type PlayerStatsRecord = {
  gamesPlayed?: number;   // total games counted
  totalScore?: number;    // sum of scores (lower is better)
  avgScore?: number;      // average score (derived if missing)
  wins?: number;          // number of day-wins
  bestStreak?: number;    // optional
  currentStreak?: number; // optional
};

interface Props {
  stats: Record<string, PlayerStatsRecord> | undefined;
  players: string[]; // the roster we intend to show
}

const PlayerStats: React.FC<Props> = ({ stats, players }) => {
  // Debug: see what we actually received
  // (Open DevTools → Console to view this once after reload)
  // eslint-disable-next-line no-console
  console.log("[PlayerStats] props:", { players, stats });

  // Normalize rows so we always render something for each roster player
  const rows = useMemo(() => {
    const safeStats = stats || {};
    const list = (players || []).map((p) => {
      const s = safeStats[p] || {};
      const games = Number.isFinite(s.gamesPlayed!) ? (s.gamesPlayed as number) : 0;
      const total = Number.isFinite(s.totalScore!) ? (s.totalScore as number) : 0;
      const avg =
        Number.isFinite(s.avgScore!) && (s.avgScore as number) > 0
          ? (s.avgScore as number)
          : games > 0
          ? +(total / games).toFixed(2)
          : 0;

      return {
        player: p,
        games,
        total,
        avg,
        wins: Number.isFinite(s.wins!) ? (s.wins as number) : 0,
        bestStreak:
          Number.isFinite(s.bestStreak!) ? (s.bestStreak as number) : undefined,
        currentStreak:
          Number.isFinite(s.currentStreak!) ? (s.currentStreak as number) : undefined,
      };
    });

    // Example sort: best average first, then more games
    list.sort((a, b) => {
      if (a.games === 0 && b.games === 0) return a.player.localeCompare(b.player);
      if (a.games === 0) return 1;
      if (b.games === 0) return -1;
      if (a.avg !== b.avg) return a.avg - b.avg; // lower avg is better
      return b.games - a.games;
    });

    return list;
  }, [players, stats]);

  const hasAnyGames = rows.some((r) => r.games > 0);

  return (
    <section aria-labelledby="player-stats-h" className="rounded-lg border p-4">
      <h3 id="player-stats-h" className="text-lg font-semibold mb-3">
        Player Statistics
      </h3>

      {!players?.length ? (
        <p className="text-sm text-gray-400">No players yet.</p>
      ) : !hasAnyGames ? (
        <p className="text-sm text-gray-400">
          No stats to show yet — submit a few scores to populate this section.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-300 border-b border-gray-700">
                <th className="py-2 pr-4">Player</th>
                <th className="py-2 pr-4">Games</th>
                <th className="py-2 pr-4">Avg</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Wins</th>
                <th className="py-2 pr-4">Streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.player} className="border-b border-gray-800">
                  <td className="py-2 pr-4 font-medium">{r.player}</td>
                  <td className="py-2 pr-4">{r.games}</td>
                  <td className="py-2 pr-4">
                    {r.games > 0 ? r.avg.toFixed(2) : "—"}
                  </td>
                  <td className="py-2 pr-4">{r.total || 0}</td>
                  <td className="py-2 pr-4">{r.wins || 0}</td>
                  <td className="py-2 pr-4">
                    {r.currentStreak ?? 0}
                    {typeof r.bestStreak === "number" &&
                      ` (best ${r.bestStreak})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default PlayerStats;
