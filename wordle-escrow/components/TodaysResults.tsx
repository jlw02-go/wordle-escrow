// components/TodaysResults.tsx
import React, { useMemo } from "react";
import { Submission } from "../hooks/useWordleData";

type Props = {
  /** Exact roster to display (hard-coded Joe/Pete in GroupPage) */
  players: ("Joe" | "Pete")[];
  /** Today’s submissions keyed by player name */
  todaysSubmissions?: Record<string, Submission | any>;
  /** Whether to reveal scores/grids (passed from GroupPage) */
  reveal?: boolean;
};

/** Normalize any stored grid value into an array of lines */
function asLines(grid: unknown): string[] {
  if (Array.isArray(grid)) return grid.filter(Boolean).map(String);
  if (typeof grid === "string") return grid.split(/\r?\n/).filter(Boolean);
  return [];
}

const TodaysResults: React.FC<Props> = ({
  players,
  todaysSubmissions = {},
  reveal = false,
}) => {
  const submitted = useMemo(
    () => new Set(Object.keys(todaysSubmissions || {})),
    [todaysSubmissions]
  );
  const awaiting = useMemo(
    () => players.filter((p) => !submitted.has(p)),
    [players, submitted]
  );

  return (
    <section aria-labelledby="today-h" className="rounded-lg border border-gray-700 p-4">
      <h2 id="today-h" className="text-xl font-semibold">Today’s Results</h2>

      {/* Status */}
      <div className="space-y-2 mt-2">
        <p className="text-sm text-gray-300">
          <span className="font-semibold">Submitted:</span>{" "}
          {players.filter((p) => submitted.has(p)).length > 0
            ? players.filter((p) => submitted.has(p)).join(", ")
            : "None yet"}
        </p>
        <p className="text-sm text-gray-300">
          <span className="font-semibold">Awaiting:</span>{" "}
          {awaiting.length > 0 ? awaiting.join(", ") : "No one — all set!"}
        </p>
      </div>

      {/* Pre-reveal guidance */}
      {!reveal && (
        <div className="mt-3 rounded-md border border-gray-700 bg-gray-800/50 p-3 text-sm text-gray-300">
          Results are hidden until <span className="font-semibold">both players</span> submit
          or it’s <span className="font-semibold">1:00 PM Central</span>.
        </div>
      )}

      {/* Revealed content */}
      {reveal && (
        <div className="mt-4">
          {players.map((p) => {
            const s = todaysSubmissions[p];
            const gridLines = asLines(s?.grid);
            return (
              <div key={p} className="rounded border border-gray-700 p-3 mb-2">
                <div className="flex items-center justify-between">
                  <strong>{p}</strong>
                  {s ? <span>{Number(s.score)}/6</span> : <span className="text-gray-500">—</span>}
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
          {players.every((p) => !todaysSubmissions[p]) && (
            <p className="text-sm text-gray-500 mt-2">No results yet for today.</p>
          )}
        </div>
      )}
    </section>
  );
};

export default TodaysResults;
