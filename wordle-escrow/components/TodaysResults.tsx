// components/TodaysResults.tsx
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { useEffect, useState } from "react";
import {
  collection, getDocs, query, where, Timestamp
} from "firebase/firestore";

const TZ = "America/Chicago";
function todayStr() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(now); // YYYY-MM-DD
}
function chicagoDayRange(dayISO: string) {
  const startLocal = new Date(`${dayISO}T00:00:00`);
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
  return { start: startLocal, end: endLocal };
}

type SubmissionDoc = {
  id: string;
  player: string;
  score: number | string;
  puzzleNumber: number;
  createdAt: string;
};

export default function TodaysResults() {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SubmissionDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  const day = todayStr();

  useEffect(() => {
    if (!groupId || !db) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const { start, end } = chicagoDayRange(day);
        const qRef = query(
          collection(db, "submissions"),
          where("groupId", "==", groupId),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<", Timestamp.fromDate(end)),
        );
        const snap = await getDocs(qRef);
        const list: SubmissionDoc[] = snap.docs.map(d => {
          const data: any = d.data();
          const createdISO =
            data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString();
          return {
            id: d.id,
            player: data.player,
            score: data.score,
            puzzleNumber: data.puzzleNumber,
            createdAt: createdISO,
          };
        });
        // newest first
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRows(list);
      } catch (e: any) {
        console.error(e);
        setError("Couldn’t load results.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, day]);

  if (!groupId) return null;
  if (loading) return <div>Loading Today’s Results…</div>;
  if (error) return <div role="alert">{error}</div>;

  return (
    <section aria-labelledby="today-h">
      <h2 id="today-h" className="text-xl font-semibold">Today’s Results ({day})</h2>
      {rows.length === 0 ? (
        <p>No results yet for today.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map(r => (
            <li key={r.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <strong>{r.player}</strong>
                <span>Score: {r.score}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Wordle #{r.puzzleNumber} • Submitted {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
