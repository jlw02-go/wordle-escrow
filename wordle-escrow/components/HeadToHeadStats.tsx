// components/HeadToHeadStats.tsx
import React, { useMemo, useState } from "react";

type DaySubmission = {
  score?: number | string;
  puzzleNumber?: number;
  grid?: string[] | string;
  createdAt?: string;
};

type AllSubmissions = Record<
  string,              // YYYY-MM-DD
  Record<string, DaySubmission> // player -> submission
>;

type Props = {
  allSubmissions?: AllSubmissions;
  players: string[];
  /** Optional: pass to hide today's results until reveal is true */
  today?: string;      // YYYY-MM-DD
  reveal?: boolean;    // if false, today is excluded
};

function asNumberScore(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  if (/^x/i.test(s)) return 7; // treat X/6 (fail) as worse than 6
  const m = s.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

export default function HeadToHeadStats({
  allSubmissions = {},
  players,
  today,
  reveal,
}: Props) {
  // Default the dropdowns to the first two players (Joe, Pete)
  const [a, setA] = useState(players[0] || "");
  const [b, setB] = useState(players[1] || "");

  // Build a safe, optionally “today-hidden” map so we never index undefined
  const effectiveDays = useMemo(() => {
    const copy: AllSubmissions = {};
    for (const d of Object.keys(allSubmissions)) {
      if (today && reveal === false && d === today) continue; // hide today if not revealed
      copy[d] = allSubmissions[d] || {};
    }
    return copy;
  }, [allSubmissions, today, reveal]);

  // Compute pairwise comparison for the selected players
  const comparison = useMemo(() => {
    const rows: Array<{
      date: string;
      sA: number | null;
      sB: number | null;
      winner: "A" | "B" | "TIE" | "—";
    }> = [];

    if (!a || !b || a === b) return { rows, meetings: 0, winsA: 0, winsB: 0, ties: 0 };

    const dates = Object.keys(effectiveDays).sort(); // oldest -> newest
    let winsA = 0, winsB = 0, ties = 0;

    for (const date of dates) {
      const day = effectiveDays[date] || {};
      const sA = asNumberScore(day[a]?.score);
      const sB = asNumberScore(day[b]?.score);

      if (sA == null || sB == null) continue; // need both to compare

      let winner: "A" | "B" | "TIE" = "TIE";
      if (sA !== sB) winner = sA < sB ? "A" : "B";

      if (winner === "A") winsA += 1;
      else if (winner === "B") winsB += 1;
      else ties += 1;

      rows.push({ date, sA, sB, winner });
    }

    return { rows, meetings: rows.length, winsA, winsB, ties };
  }, [effectiveDays, a, b]);

  const roster = players.filter(Boolean);

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-3">Head-to-Head</h3>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <label className="flex-1">
          <div className="text-xs text-gray-400 mb-1">Player A</div>
          <select
            value={a}
            onChange={(e) => setA(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
          >
            {roster.map((p) => (
              <option key={`A-${p}`} value={p}>{p}</option>
            ))}
          </select>
        </label>

        <label className="flex-1">
          <div className="text-xs text-gray-400 mb-1">Player B</div>
          <select
            value={b}
            onChange={(e) => setB(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
          >
            {roster.map((p) => (
              <option key={`B-${p}`} value={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>

      {(!a || !b || a === b) ? (
        <p className="text-sm text-gray-500">
          Choose two different players to see their head-to-head results.
        </p>
      ) : (
        <>
          <div className="text-sm text-gray-300 mb-3">
            Meetings: <strong>{comparison.meetings}</strong> &nbsp;•&nbsp; 
            {a} wins: <strong>{comparison.winsA}</strong> &nbsp;•&nbsp; 
            {b} wins: <strong>{comparison.winsB}</strong> &nbsp;•&nbsp; 
            Ties: <strong>{comparison.ties}</strong>
          </div>

          {comparison.rows.length === 0 ? (
            <p className="text-sm text-gray-500">
              No head-to-head games yet with scores for both players.
              {today && reveal === false ? " (Today is hidden until reveal.)" : ""}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-700">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3 text-right">{a} score</th>
                    <th className="py-2 pr-3 text-right">{b} score</th>
                    <th className="py-2 pr-0 text-right">Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((r) => (
                    <tr key={r.date} className="border-b border-gray-800">
                      <td className="py-2 pr-3">{r.date}</td>
                      <td className="py-2 pr-3 text-right">{r.sA ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">{r.sB ?? "—"}</td>
                      <td className="py-2 pr-0 text-right">
                        {r.winner === "A" ? a : r.winner === "B" ? b : "Tie"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
