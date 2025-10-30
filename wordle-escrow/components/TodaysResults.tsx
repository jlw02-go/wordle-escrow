// components/TodaysResults.tsx
import React, { useMemo } from "react";
import { Submission } from "../hooks/useWordleData";

type Props = {
  /** Exact roster to display (hard-coded Joe/Pete in GroupPage) */
  players: ("Joe" | "Pete")[];
  /** Today’s submissions keyed by player name */
  todaysSubmissions?: Record<string, Submission>;
  /** Whether to reveal scores/grids (passed from GroupPage) */
  reveal?: boolean;
};

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

      {/* Always show status per player */}
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

      {/* Show actual scores/grids only after reveal */}
      {reveal && (
        <div className="mt-4">
          {players.map((p) => {
            const s = todaysSubmissions[p];
            return (
              <div key={p} className="rounded border border-gray-700 p-3 mb-2">
                <div className="flex items-center justify-between">
                  <strong>{p}</strong>
                  {s ? <span>{Number(s.score)}/6</span> : <span className="text-gray-500">—</span>}
                </div>
                {s?.grid?.length ? (
                  <pre className="mt-2 text-sm leading-5 whitespace-pre-wrap text-gray-300">
                    {s.grid.join("\n")}
                  </pre>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default TodaysResults;
