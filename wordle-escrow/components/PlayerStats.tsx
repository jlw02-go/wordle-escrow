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

type DaySubmission = {
  score?: number | string;
  puzzleNumber?: number;
  grid?: string[] | string;
  createdAt?: string;
};

type AllSubmissions = Record<
  string,                // YYYY-MM-DD
  Record<string, DaySubmission> // player -> submission
>;

type Props = {
  stats: Record<string, PerPlayerStats>;
  players: string[]; // e.g., ["Joe", "Pete"]
  reveal: boolean;
  todaysSubmissions?: Record<string, DaySubmission>;
  allSubmissions?: AllSubmissions;
  today?: string; // YYYY-MM-DD
};

function asNumberScore(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  if (/^x/i.test(s)) return 7; // treat X as worse than 6 guesses
  const m = s.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function normalizeGrid(grid: unknown): string[] {
  if (Array.isArray(grid)) {
    return grid.map((g) => (g == null ? "" : String(g))).filter((l) => l.trim() !== "");
  }
  if (typeof grid === "string") {
    return grid
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0);
  }
  return [];
}

export default function PlayerStats({
  stats,
  players,
  reveal,
  todaysSubmissions = {},
  allSubmissions = {},
  today = "",
}: Props) {
  // Build a unified day-map that includes today after reveal (in case the hook hasn't folded it in yet).
  const unifiedDays: AllSubmissions = useMemo(() => {
    const copy: AllSubmissions = { ...allSubmissions };
    if (reveal && today) {
      const existing = copy[today] || {};
      // non-destructive merge: today's local submissions override nothing, just fill in if present
      copy[today] = { ...existing, ...todaysSubmissions };
    }
    return copy;
  }, [allSubmissions, todaysSubmissions, reveal, today]);

  // Compute cumulative wins per player.
  // Count a win on days where BOTH players have numeric scores and they differ.
  // Exclude today's outcome when !reveal.
  const winsByPlayer = useMemo(() => {
    const wins: Record<string, number> = {};
    for (const p of players) wins[p] = 0;

    const dates = Object.keys(unifiedDays).sort(); // order doesn’t matter for the count
    for (const date of dates) {
      if (!today) continue;
      if (date === today && !reveal) continue; // hide today pre-reveal

      const day = unifiedDays[date] || {};
      if (players.length < 2) continue;

      // We’re doing head-to-head for first two players (Joe vs Pete)
      const [p1, p2] = players;

      const s1 = asNumberScore(day[p1]?.score);
      const s2 = asNumberScore(day[p2]?.score);
      if (s1 == null || s2 == null) continue;
      if (s1 === s2) continue;

      if (s1 < s2) wins[p1] += 1;
      else wins[p2] += 1;
    }
    return wins;
  }, [unifiedDays, players, reveal, today]);

  // Prepare rows for display
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

  // Today’s grids (only after reveal)
  const todaysGrids = useMemo(() => {
    if (!reveal) return {};
    const obj: Record<string, string[]> = {};
    for (const p of players) {
      obj[p] = normalizeGrid(todaysSubmissions[p]?.grid);
    }
    return obj;
  }, [players, todaysSubmissions, reveal]);

  return (
    <section aria-labelledby="player-stats-h" className="rounded-lg border border-gray-700 p-4">
      <h3 id="player-stats-h" className="text-lg font-semibold mb-3">Player Statistics</h3>

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
                <td className="py-2 pr-3 text-right">{r.best != null ? r.best : "—"}</td>
                <td className="py-2 pr-3 text-right">{r.worst != null ? r.worst : "—"}</td>
                <td className="py-2 pr-0 text-right">{r.streak || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Today’s Guess Patterns (after reveal) */}
      {reveal && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Today’s Guess Patterns</h4>
          {players.map((p) => {
            const lines = todaysGrids[p] || [];
            return (
              <div key={p} className="mb-3">
                <div className="text-xs text-gray-400 mb-1">{p}</div>
                {lines.length ? (
                  <div className="rounded border border-gray-700 p-2 bg-gray-800/40 leading-tight whitespace-pre-wrap">
                    {lines.map((ln, i) => (
                      <div key={i}>{ln}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">—</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!reveal && (
        <p className="mt-2 text-xs text-gray-500">
          Today’s guess patterns and head-to-head outcome are hidden until both submit or it’s 1:00 PM Central.
        </p>
      )}
    </section>
  );
}
