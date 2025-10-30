// hooks/useWordleData.ts
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  getDocs,
} from "firebase/firestore";

export type Submission = {
  player: string;
  date: string;        // YYYY-MM-DD (Chicago day)
  score: number;
  grid: string[];      // emoji rows
  puzzleNumber: number;
  createdAt?: any;
  groupId?: string;
};

type DailySubmissions = Record<string, Submission>;
type AllSubsByDay = Record<string, DailySubmissions>;

const TZ = "America/Chicago";
function chicagoTodayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function chicagoDayRange(dayISO: string) {
  const startLocal = new Date(`${dayISO}T00:00:00`);
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
  return { start: startLocal, end: endLocal };
}

export function useWordleData({ group }: { group: { id: string } }) {
  const groupId = group?.id ?? "main";
  const [today] = useState(() => chicagoTodayISO()); // freeze per load
  const [players, setPlayers] = useState<string[]>([]);
  const [todaysSubmissions, setTodaysSubmissions] = useState<DailySubmissions>({});
  const [allSubmissions, setAllSubmissions] = useState<AllSubsByDay>({});
  const [loading, setLoading] = useState(true);

  // Roster (safe default = Joe/Pete so you can test)
  useEffect(() => {
    let cancelled = false;
    if (!db || !groupId) return;

    (async () => {
      try {
        const gref = doc(db, "groups", groupId);
        const gsnap = await getDoc(gref);
        const list =
          gsnap.exists() && Array.isArray((gsnap.data() as any).players)
            ? ((gsnap.data() as any).players as string[])
            : ["Joe", "Pete"];
        if (!cancelled) setPlayers(list.slice(0, 10));
      } catch (e) {
        console.error("[useWordleData] roster load error:", e);
        if (!cancelled) setPlayers(["Joe", "Pete"]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // LIVE: today submissions — exact date (no orderBy to avoid index)
  useEffect(() => {
    let cancelled = false;
    if (!db || !groupId || !today) return;

    setLoading(true);
    const baseCol = collection(db, "submissions");
    const exactQ = query(
      baseCol,
      where("groupId", "==", groupId),
      where("date", "==", today)
    );

    const unsub = onSnapshot(
      exactQ,
      (snap) => {
        const map: DailySubmissions = {};
        snap.forEach((d) => {
          const s = d.data() as any;
          const p = (s.player || "").toString();
          map[p] = {
            player: p,
            date: s.date || today,
            score: Number(s.score) || 0,
            grid: Array.isArray(s.grid) ? s.grid : [],
            puzzleNumber: Number(s.puzzleNumber) || 0,
            createdAt: s.createdAt,
            groupId: s.groupId || groupId,
          };
        });
        if (!cancelled) {
          setTodaysSubmissions(map);
          setLoading(false);
          console.log("[useWordleData] exact live count =", Object.keys(map).length);
        }
      },
      async (err) => {
        console.warn("[useWordleData] exact-date live failed, fallback:", err?.code || err);
        try {
          const { start, end } = chicagoDayRange(today);
          const fbQ = query(
            baseCol,
            where("groupId", "==", groupId),
            where("createdAt", ">=", Timestamp.fromDate(start)),
            where("createdAt", "<", Timestamp.fromDate(end))
          );
          const snap = await getDocs(fbQ);
          const map: DailySubmissions = {};
          snap.forEach((d) => {
            const s = d.data() as any;
            const p = (s.player || "").toString();
            map[p] = {
              player: p,
              date: s.date || today,
              score: Number(s.score) || 0,
              grid: Array.isArray(s.grid) ? s.grid : [],
              puzzleNumber: Number(s.puzzleNumber) || 0,
              createdAt: s.createdAt,
              groupId: s.groupId || groupId,
            };
          });
          if (!cancelled) {
            setTodaysSubmissions(map);
            setLoading(false);
            console.log("[useWordleData] fallback one-shot count =", Object.keys(map).length);
          }
        } catch (e2) {
          console.error("[useWordleData] fallback failed:", e2);
          if (!cancelled) {
            setTodaysSubmissions({});
            setLoading(false);
          }
        }
      }
    );

    return () => {
      unsub();
      cancelled = true;
    };
  }, [groupId, today]);

  // Mirror today into allSubmissions[today] (keeps stats/head-to-head working)
  useEffect(() => {
    setAllSubmissions((prev) => ({ ...prev, [today]: { ...todaysSubmissions } }));
  }, [today, todaysSubmissions]);

  async function addSubmission(s: Submission) {
    if (!db || !groupId) return;

    const clean: Submission = {
      player: (s.player || "").toString(),
      date: today, // force canonical day
      score: Number(s.score) || 0,
      grid: Array.isArray(s.grid) ? s.grid.map(String) : [],
      puzzleNumber: Number(s.puzzleNumber) || 0,
      groupId,
      createdAt: serverTimestamp(),
    };

    // Optimistic update so the debug counter bumps instantly
    setTodaysSubmissions((prev) => {
      const next = { ...prev, [clean.player]: clean };
      console.log("[useWordleData] optimistic set, count =", Object.keys(next).length);
      return next;
    });

    try {
      await addDoc(collection(db, "submissions"), clean);
    } catch (e) {
      console.error("[useWordleData] addSubmission failed:", e);
      // rollback optimistic insert
      setTodaysSubmissions((prev) => {
        const copy = { ...prev };
        delete copy[clean.player];
        console.log("[useWordleData] rollback, count =", Object.keys(copy).length);
        return copy;
      });
      throw e;
    }
  }

  // Simple stats (games/total/avg/wins) based on allSubmissions
  const stats = useMemo(() => {
    const table: Record<string, { games: number; total: number; avg: number; wins: number }> = {};
    const names = players.length ? players : [];

    names.forEach((p) => (table[p] = { games: 0, total: 0, avg: 0, wins: 0 }));

    Object.values(allSubmissions).forEach((byPlayer) => {
      const entries = Object.entries(byPlayer || {});
      entries.forEach(([p, sub]) => {
        if (!table[p]) table[p] = { games: 0, total: 0, avg: 0, wins: 0 };
        table[p].games += 1;
        table[p].total += Number(sub.score) || 0;
      });
      if (entries.length >= 2) {
        const min = Math.min(...entries.map(([, s]) => Number(s.score) || 0));
        const winners = entries.filter(([, s]) => (Number(s.score) || 0) === min);
        if (winners.length === 1) {
          const w = winners[0][0];
          table[w].wins += 1;
        }
      }
    });

    Object.values(table).forEach((r) => {
      r.avg = r.games ? Number((r.total / r.games).toFixed(2)) : 0;
    });

    return table;
  }, [allSubmissions, players]);

  return {
    players,
    today,
    todaysSubmissions,
    allSubmissions,
    stats,
    loading,
    addSubmission,
  };
}
