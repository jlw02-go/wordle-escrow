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
  string, // YYYY-MM-DD
  Record<string, DaySubmission> // player -> submission
>;

type Props = {
  // upstream stats allowed but we compute display locally to enforce reveal
  stats?: Record<string, PerPlayerStats>;
  players: string[];
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
  if (/^x/i.test(s)) return 7; // treat X as worse than 6
  const m = s.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function normalizeGrid(grid: unknown): string[] {
  if (Array.isArray(grid)) {
    return grid.map(g => (g == null ? "" : String(g))).filter(l => l.trim() !== "");
  }
  if (typeof grid === "string") {
    return grid
      .split(/\r?\n/)
      .map(l => l.trimEnd())
      .filter(l => l.length > 0);
  }
  return [];
}

export default function PlayerStats({
  players,
  reveal,
  todaysSubmissions = {},
  allSubmissions = {},
  today = "",
}: Props) {
  // Build an effective map:
  // - If NOT revealed, exclude today entirely (prevents leakage).
  // - If revealed, start with allSubmissions and MERGE todaysSubmissions into today.
  const effectiveDays: AllSubmissions = useMemo(() => {
    const copy: AllSubmissions = {};
    for (const d of Object.keys(allSubmissions)) {
      if (!reveal && d === today) continue; // hide today until reveal
      copy[d] = allSubmissions[d];
    }
    if (reveal && today) {
      const base = copy[today] || {};
      // don't blow away existing; add what's in todaysSubmissions
      copy[today] = { ...base, ...todaysSubmissions };
    }
    return copy;
  }, [allSubmissions, todaysSubmissions, reveal, today]);

  // Aggregate per-player stats from effectiveDays
  const aggregates = useMemo(() => {
    type Agg = {
      games: number;
      total: number;
      best: number | null;
      worst: number | null;
      datesPlayed: string[];
    };
    const base: Record<string, Agg> = {};
    for (const p of players) {
      base[p] = { games: 0, total: 0, best: null, worst: null, datesPlayed: [] };
    }

    const dates = Object.keys(effectiveDays).sort();
    for (const date of dates) {
      const day = effectiveDays[date] || {};
      for (const p of players) {
        const s = asNumberScore(day[p]?.score);
        if (s == null) continue;
        const a = base[p];
        a.games += 1;
        a.total += s;
        a.best = a.best == null ? s : Math.min(a.best, s);
        a.worst = a.worst == null ? s : Math.max(a.worst, s);
        a.datesPlayed.push(date);
      }
    }

    // streak = consecutive most-recent days with a submission
    const streaks: Record<string, number> = {};
    for (const p of players) {
      const played = new Set(base[p].datesPlayed);
      let tail = 0;
      for (let i = dates.length - 1; i >= 0; i--) {
        const d = dates[i];
        if (played.has(d)) tail += 1;
        else break;
      }
      streaks[p] = tail;
    }

    const rows = players.map(p => {
      const a = base[p];
      return {
        player: p,
        games: a.games,
        avg: a.games ? a.total / a.games : 0,
        best: a.best,
        worst: a.worst,
        streak: streaks[p] || 0,
      };
    });

    return { rows, dates };
  }, [effectiveDays, players]);

  // Wins (pairwise Joe vs Pete style). If you add more players later,
  // adjust to do round-robin; for now we compare the first two players.
  const winsByPlayer = useMemo(() => {
    const wins: Record<string, number> = {};
    for (const p of players) wins[p] = 0;
    if (players.length < 2) return wins;

    const [p1, p2] = players;
    for (const date of Object.keys(effectiveDays)) {
      const day = effectiveDays[date] || {};
      const s1 = asNumberScore(day[p1]?.score);
      const s2 = asNumberScore(day[p2]?.score);
      if (s1 == null || s2 == null) continue;
      if (s1 === s2) continue;
      if (s1 < s2) wins[p1] += 1;
      else wins[p2] += 1;
    }
    return wins;
  }, [effectiveDays, players]);

  // Today’s grids only after reveal
  const todaysGrids = useMemo(() => {
    if (!reveal) return {};
    const obj: Record<string, string[]> = {};
    for (const p of players) obj[p] = normalizeGrid(todaysSubmissions[p]?.grid);
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
            {aggregates.rows.map(r => (
              <tr key={r.player} className="border-b border-gray-800">
                <td className="py-2 pr-3 font-medium">{r.player}</td>
                <td className="py-2 pr-3 text-right">{winsByPlayer[r.player] ?? 0}</td>
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

      {/* Today’s Guess Patterns after reveal */}
      {reveal ? (
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Today’s Guess Patterns</h4>
          {players.map(p => {
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
      ) : (
        <p className="mt-2 text-xs text-gray-500">
          Today’s guess patterns and head-to-head outcome are hidden until both submit or it’s 7:00 PM Central.
        </p>
      )}
    </section>
  );
}
