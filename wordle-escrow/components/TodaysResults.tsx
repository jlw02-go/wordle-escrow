// components/TodaysResults.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, query, where, orderBy, doc, getDoc } from "firebase/firestore";

const TZ = "America/Chicago";
function todayISO() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export default function TodaysResults() {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const day = todayISO();

  useEffect(() => {
    if (!db || !groupId) return;
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const gref = doc(db, "groups", groupId);
        const gsnap = await getDoc(gref);
        const players = Array.isArray((gsnap.data() as any)?.players)
          ? (gsnap.data() as any).players
          : [];
        if (!cancel) setRoster(players);
        // query by date
        let list: any[] = [];
        try {
          const qRef = query(
            collection(db, "submissions"),
            where("groupId", "==", groupId),
            where("date", "==", day),
            orderBy("createdAt", "asc")
          );
          const snap = await getDocs(qRef);
          list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        } catch {
          const qRef = query(
            collection(db, "submissions"),
            where("groupId", "==", groupId),
            where("date", "==", day)
          );
          const snap = await getDocs(qRef);
          list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        }
        if (!cancel) setRows(list);
      } catch (e: any) {
        if (!cancel) setError(String(e.message || e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [groupId, day]);

  const submitted = useMemo(() => new Set(rows.map((r) => r.player?.toLowerCase())), [rows]);
  const allSubmitted = roster.length && roster.every((p) => submitted.has(p.toLowerCase()));

  const revealByTime = (() => {
    const target = new Date(`${day}T19:00:00-05:00`); // 7pm CST
    return Date.now() >= target.getTime();
  })();
  const reveal = allSubmitted || revealByTime;

  if (loading) return <div>Loading…</div>;
  if (error) return <div>{error}</div>;

  return (
    <section className="mt-4">
      <h2 className="text-xl font-semibold">Today’s Results ({day})</h2>
      {!reveal ? (
        <div className="mt-3 border p-3 rounded-lg">
          <p className="mb-2 text-sm text-gray-500">
            Results hidden until all players submit or 7:00 PM CST.
          </p>
          <ul className="space-y-2">
            {roster.map((p) => (
              <li key={p} className="flex justify-between">
                <span>{p}</span>
                {submitted.has(p.toLowerCase()) ? (
                  <span className="text-green-600 text-sm">submitted</span>
                ) : (
                  <span className="text-gray-500 text-sm">awaiting submission</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">No results yet.</p>
          ) : (
            rows.map((r) => (
              <li key={r.id} className="border p-3 rounded">
                <div className="flex justify-between">
                  <strong>{r.player}</strong>
                  <span>Score: {r.score}</span>
                </div>
                <div className="text-xs text-gray-500">
                  Wordle #{r.puzzleNumber ?? "?"} •{" "}
                  {r.createdAt?.toDate
                    ? new Date(r.createdAt.toDate()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "just now"}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
