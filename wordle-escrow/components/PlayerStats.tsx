// components/PlayerStats.tsx
import React, { useMemo } from "react";

type PerPlayerStats = {
  gamesPlayed?: number;
  avgScore?: number;
  bestScore?: number;
  worstScore?: number;
  streak?: number;
  lastPlayed?: number | string;
};

type AllSubmissions = Record<
  string, // YYYY-MM-DD
  Record<
    string, // player name
    {
      score?: number | string;
      puzzleNumber?: number;
      grid?: string[] | string;
      createdAt?: string;
    }
  >
>;

type Props = {
  stats: Record<string, PerPlayerStats>;
  players: string[]; // e.g., ["Joe", "Pete"]
  reveal: boolean;
  todaysSubmissions?: Record<string, any>;
  // NEW: we’ll compute Wins by scanning daily submissions
  allSubmissions: AllSubmissions;
  // NEW: to avoid leaking today’s winner before reveal
  today: string; // "YYYY-MM-DD"
};

function asNumberScore(v: unknown): number | null {
  if (v == null) return null;
  // Common shapes: 3, "3", "3/6", "X/6"
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  if (/^x/i.test(s)) return 7; // treat X as 7 guesses (worse than 6)
  const m = s.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

export default function PlayerStats({
  stats,
  players,
  reveal,
  allSubmissions,
  today,
}: Props) {
  // Compute cumulative Wins per player.
  // A "win" is counted on days where BOTH players have a numeric score and those scores differ.
  // We exclude *today* if reveal === false to avoid leaking the outcome.
  const winsByPlayer = useMemo(() => {
    const wins: Record<string, number> = {};
    for (const p of players) wins[p] = 0;

    const dates = Object.keys(allSubmissions || {});
    for (const date of dates) {
      const day = allSubmissions[date] || {};
      // Skip today if not revealed yet
      if (date === today && !reveal) continue;

      // Only handle head-to-head for Joe & Pete for now (or first two players present).
      // If you later support more than 2 players, you can extend this to a round-robin per day.
      if (players.length < 2) continue;
      const [p1, p2] = players;

      const s1 = asNumberScore(day[p1]?.score);
      const s2 = asNumberScore(day[p2]?.score);

      if (s1 == null || s2 == null) continue; // must have both
      if (s1 === s2) continue; // tie → no win

      if (s1 < s2) {
        wins[p1] = (wins[p1] || 0) + 1;
      } else {
        wins[p2] = (wins[p2] || 0) + 1;
      }
    }
    return wins;
  }, [allSubmissions, players, reveal, today]);

  // Prepare rows in a stable player order
  const rows = useMemo(() => {
    return players.map((p) => {
      const s = stats[p] || {};
      return {
        player: p,
        games: s.gamesPlayed ?? 0,
        avg: s.avgScore ?? 0,
        best: s.bestScore ?? null,
        worst: s.worstScore ?? null,
        streak: s.streak ?? 0,
        wins: winsByPlayer[p] ?? 0,
      };
    });
  }, [players, stats, winsByPlayer]);

  return (
    <section aria-labelledby="player-stats-h" className="rounded-lg border border-gray-700 p-4">
      <h3 id="player-stats-h" className="text-lg font-semibold mb-3">
        Player Statistics
      </h3>

      {/* Hide stats table if not revealed? You already hide “today’s” details elsewhere.
          Here we allow lifetime stats (minus today if hidden). If you want to hide the table
          entirely before reveal, uncomment the block below:
      
      {!reveal && (
        <p className="text-sm text-gray-500">
          Statistics are hidden until both players submit or it’s 1:00 PM Central.
        </p>
      )}
      {reveal && (...table...)}
      */}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-700">
              <th className="py-2 pr-3">Player</th>
              <th className="py-2 pr-3 text-right">Wins</th>
              <th className="py-2 pr-3 text-right">Games</th>
              <th className="py-2 pr-3 text-right">Avg</th>
              <th className="py-2 pr-3 text-right">Best</th>
              <th className="py-2 pr-3 text-right">Worst</th>
              <th className="py-2 pr-0 text-right">Streak</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player} className="border-b border-gray-800">
                <td className="py-2 pr-3 font-medium">{r.player}</td>
                <td className="py-2 pr-3 text-right">{r.wins}</td>
                <td className="py-2 pr-3 text-right">{r.games}</td>
                <td className="py-2 pr-3 text-right">
                  {r.games ? (Math.round((Number(r.avg) || 0) * 100) / 100).toFixed(2) : "—"}
                </td>
                <td className="py-2 pr-3 text-right">
                  {r.best != null ? r.best : "—"}
                </td>
                <td className="py-2 pr-3 text-right">
                  {r.worst != null ? r.worst : "—"}
                </td>
                <td className="py-2 pr-0 text-right">{r.streak || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!reveal && (
        <p className="mt-2 text-xs text-gray-500">
          Today’s head-to-head result is hidden until both submit or it’s 1:00 PM Central. Wins exclude today until reveal.
        </p>
      )}
    </section>
  );
}
