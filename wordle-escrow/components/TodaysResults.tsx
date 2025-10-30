// components/TodaysResults.tsx
import React, { useMemo } from "react";

type Submission = {
  score?: number | string;
  puzzleNumber?: number;
  createdAt?: string; // ISO
  player?: string;
  grid?: string[] | string;
};
type Props = {
  players: string[];
  todaysSubmissions?: Record<string, Submission>;
  reveal: boolean;
  revealCutoffLabel?: string; // e.g., "7:00 PM America/Chicago"
};

export default function TodaysResults({
  players,
  todaysSubmissions = {},
  reveal,
  revealCutoffLabel = "7:00 PM America/Chicago",
}: Props) {
  const submittedBy = useMemo(() => new Set(Object.keys(todaysSubmissions || {})), [todaysSubmissions]);
  const submittedNames = players.filter(p => submittedBy.has(p));
  const awaitingNames = players.filter(p => !submittedBy.has(p));

  return (
    <section aria-labelledby="today-h">
      <h2 id="today-h" className="text-xl font-semibold">Today’s Results</h2>

      {!reveal ? (
        <div className="mt-3 rounded-lg border p-3">
          <p className="mb-2 text-sm text-gray-600">
            Results are hidden until both players submit or {revealCutoffLabel}.
          </p>
          <div className="text-sm">
            <div className="mb-1">
              <strong>Submitted:</strong>{" "}
              {submittedNames.length ? submittedNames.join(", ") : "No one yet"}
            </div>
            <div>
              <strong>Awaiting:</strong>{" "}
              {awaitingNames.length ? awaitingNames.join(", ") : "No one — all set!"}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border p-3">
          <div className="text-sm">
            <div className="mb-1">
              <strong>Submitted:</strong>{" "}
              {submittedNames.length ? submittedNames.join(", ") : "No one yet"}
            </div>
            <div>
              <strong>Awaiting:</strong>{" "}
              {awaitingNames.length ? awaitingNames.join(", ") : "No one — all set!"}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
