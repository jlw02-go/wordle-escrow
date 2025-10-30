// components/TodaysResults.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

// Firestore
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";

type Props = {
  todaysSubmissions?: Record<string, any>;
  players?: string[];
  reveal?: boolean; // if provided by parent, it overrides internal 1pm/all-submitted check
};

const TZ = "America/Chicago";

function todayISO() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function chicagoDayRange(dayISO: string) {
  const start = new Date(`${dayISO}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function isRevealReached(dayISO: string) {
  const today = todayISO();
  if (dayISO !== today) return true;
  const now = new Date();
  // 1:00 PM Central reveal (simple offset; good enough for now)
  const thirteenCT = new Date(`${today}T13:00:00-05:00`);
  return now.getTime() >= thirteenCT.getTime();
}

type SubmissionRow = {
  id: string;
  player: string;
  score: number | string;
  puzzleNumber: number;
  createdAt: string; // ISO
};

export default function TodaysResults({ players, reveal }: Props) {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<string[]>([]);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const day = todayISO();

  useEffect(() => {
    let cancelled = false;
    if (!db || !groupId) return;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // 1) roster: prefer Firestore group.players if present; else fallback to prop players
        const gref = doc(db, "groups", groupId);
        const gsnap = await getDoc(gref);
        let safePlayers: string[] = [];
        if (gsnap.exists() && Array.isArray((gsnap.data() as any).players)) {
          safePlayers = ((gsnap.data() as any).players as string[]).slice(0, 10);
        } else if (Array.isArray(players) && players.length) {
          safePlayers = players.slice(0, 10);
        }
        if (!cancelled) setRoster(safePlayers);

        // 2) submissions for today
        const { start, end } = chicagoDayRange(day);
        const baseFilters = [
          where("groupId", "==", groupId),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<", Timestamp.fromDate(end)),
        ];

        let list: SubmissionRow[] = [];
        try {
          const qRef = query(
            collection(db, "submissions"),
            ...baseFilters,
            orderBy("createdAt", "desc") // requires composite index; we fall back below if missing
          );
          const snap = await getDocs(qRef);
          list = (snap?.docs || []).map((d) => {
            const data: any = d.data() ?? {};
            const createdISO = data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : new Date().toISOString();
            return {
              id: d.id,
              player: data.player ?? "",
              score: data.score ?? "",
              puzzleNumber: data.puzzleNumber ?? 0,
              createdAt: createdISO,
            };
          });
        } catch (e: any) {
          // If index error, retry without orderBy (client order isn’t critical here)
          if (e?.code === "failed-precondition") {
            const qRef = query(collection(db, "submissions"), ...baseFilters);
            const snap = await getDocs(qRef);
            list = (snap?.docs || []).map((d) => {
              const data: any = d.data() ?? {};
              const createdISO = data.createdAt?.toDate
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString();
              return {
                id: d.id,
                player: data.player ?? "",
                score: data.score ?? "",
                puzzleNumber: data.puzzleNumber ?? 0,
                createdAt: createdISO,
              };
            });
          } else {
            throw e;
          }
        }

        if (!cancelled) {
          setRows(Array.isArray(list) ? list : []);
        }
      } catch (e: any) {
        console.error("[TodaysResults] load error:", e?.message || e);
        if (!cancelled) setError("Couldn’t load results.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, day, players]);

  // Who has submitted today (case-insensitive set)
  const submittedBy = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    return new Set(list.map((r) => (r.player || "").toLowerCase()));
  }, [rows]);

  // Determine reveal:
  // - If parent passed `reveal`, respect it
  // - Else: reveal by all-on-roster submitted OR after 1pm CT
  const allSubmitted =
    Array.isArray(roster) &&
    roster.length > 0 &&
    roster.every((p) => submittedBy.has((p || "").toLowerCase()));

  const shouldReveal = typeof reveal === "boolean" ? reveal : allSubmitted || isRevealReached(day);

  if (!groupId) return null;
  if (loading) return <div>Loading Today’s Results…</div>;
  if (error) return <div role="alert">{error}</div>;

  return (
    <section aria-labelledby="today-h">
      <h2 id="today-h" className="text-xl font-semibold">
        Today’s Results ({day})
      </h2>

      {!shouldReveal ? (
        <div className="mt-3 rounded-lg border p-3">
          <p className="mb-2 text-sm text-gray-600">
            Results are hidden until all players submit or 1:00 PM America/Chicago.
          </p>
          {(!Array.isArray(roster) || roster.length === 0) ? (
            <p className="text-sm text-gray-500">No players are in this group yet.</p>
          ) : (
            <ul className="space-y-2">
              {roster.map((p) => {
                const name = p || "";
                const done = submittedBy.has(name.toLowerCase());
                return (
                  <li key={name} className="flex items-center justify-between">
                    <span className="font-medium">{name}</span>
                    {done ? (
                      <span className="text-green-600 text-sm">submitted</span>
                    ) : (
                      <span className="text-gray-500 text-sm">awaiting submission</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <>
          {(!Array.isArray(rows) || rows.length === 0) ? (
            <p className="mt-3 text-sm text-gray-500">No results yet for today.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <strong>{r.player}</strong>
                    <span>Score: {String(r.score)}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Wordle #{r.puzzleNumber} • Submitted{" "}
                    {new Date(r.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {/* 🔕 Guess patterns intentionally removed from today's list */}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
