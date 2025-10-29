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

// Optional props kept for backward compatibility with GroupPage,
// but this component now drives from Firestore directly.
type Props = {
  todaysSubmissions?: Record<string, any>;
  allSubmitted?: boolean;
  players?: string[];
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
  // Local day window [start, end)
  const start = new Date(`${dayISO}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function isRevealReached(dayISO: string) {
  // Reveal immediately for past days
  const today = todayISO();
  if (dayISO !== today) return true;

  // Or after 1:00 PM America/Chicago
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value || "";
  const h = parseInt(get("hour") || "0", 10);
  const m = parseInt(get("minute") || "0", 10);
  return h > 13 || (h === 13 && m >= 0);
}

type SubmissionRow = {
  id: string;
  player: string;
  score: number | string;
  puzzleNumber: number;
  createdAt: string; // ISO
};

export default function TodaysResults(_: Props) {
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

        // 1) Load roster (groups/{groupId}.players)
        const gref = doc(db, "groups", groupId);
        const gsnap = await getDoc(gref);
        const players: string[] =
          gsnap.exists() && Array.isArray((gsnap.data() as any).players)
            ? (gsnap.data() as any).players.slice(0, 10)
            : [];

        // 2) Load today's submissions for this group
        const { start, end } = chicagoDayRange(day);
        const qRef = query(
          collection(db, "submissions"),
          where("groupId", "==", groupId),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<", Timestamp.fromDate(end)),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(qRef);
        const list: SubmissionRow[] = snap.docs.map((d) => {
          const data: any = d.data();
          const createdISO = data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString();
          return {
            id: d.id,
            player: data.player,
            score: data.score,
            puzzleNumber: data.puzzleNumber,
            createdAt: createdISO,
          };
        });

        if (!cancelled) {
          setRoster(players);
          setRows(list);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Couldn’t load results.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, day]);

  const submittedBy = useMemo(
    () => new Set(rows.map((r) => (r.player || "").toLowerCase())),
    [rows]
  );
  const allSubmitted =
    roster.length > 0 && roster.every((p) => submittedBy.has(p.toLowerCase()));
  const reveal = allSubmitted || isRevealReached(day);

  if (!groupId) return null;
  if (loading) return <div>Loading Today’s Results…</div>;
  if (error) return <div role="alert">{error}</div>;

  return (
    <section aria-labelledby="today-h">
      <h2 id="today-h" className="text-xl font-semibold">
        Today’s Results ({day})
      </h2>

      {!reveal ? (
        <div className="mt-3 rounded-lg border p-3">
          <p className="mb-2 text-sm text-gray-600">
            Results are hidden until all players submit or 1:00 PM America/Chicago.
          </p>
          {roster.length === 0 ? (
            <p className="text-sm text-gray-500">
              No players are in this group yet. Join the group to get started.
            </p>
          ) : (
            <ul className="space-y-2">
              {roster.map((p) => {
                const done = submittedBy.has(p.toLowerCase());
                return (
                  <li key={p} className="flex items-center justify-between">
                    <span className="font-medium">{p}</span>
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
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No results yet for today.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <strong>{r.player}</strong>
                    <span>Score: {r.score}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Wordle #{r.puzzleNumber} • Submitted{" "}
                    {new Date(r.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
