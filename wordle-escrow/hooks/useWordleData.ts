// hooks/useWordleData.ts
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  getDocs,
} from "firebase/firestore";

export type Submission = {
  player: string;
  date: string; // YYYY-MM-DD (Chicago day)
  score: number;
  grid: string[]; // each row string of emojis
  puzzleNumber: number;
  createdAt?: any;
  groupId?: string;
};

type DailySubmissions = Record<string, Submission>; // by player
type AllSubsByDay = Record<string, DailySubmissions>;

type UseWordleDataArgs = {
  group: { id: string };
};

const TZ = "America/Chicago";
function chicagoTodayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function chicagoDayRange(dayISO: string) {
  // 00:00 -> next 00:00 America/Chicago converted to real Date
  const startLocal = new Date(`${dayISO}T00:00:00`);
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
  return { start: startLocal, end: endLocal };
}

export function useWordleData({ group }: UseWordleDataArgs) {
  const groupId = group?.id ?? "main";
  const [today] = useState<string>(() => chicagoTodayISO()); // freeze for this render day
  const [players, setPlayers] = useState<string[]>([]);
  const [todaysSubmissions, setTodaysSubmissions] = useState<DailySubmissions>({});
  const [allSubmissions, setAllSubmissions] = useState<AllSubsByDay>({});
  const [loading, setLoading] = useState(true);

  // 1) Load roster (with safe default so you can test)
  useEffect(() => {
    let cancelled = false;
    if (!db || !groupId) return;

    (async () => {
      try {
        const gref = doc(db, "groups", groupId);
        const gsnap = await getDoc(gref);
        const p = (gsnap.exists() && Array.isArray((gsnap.data() as any).players))
          ? (gsnap.data() as any).players
          : ["Joe", "Pete"];
        if (!cancelled) setPlayers(p.slice(0, 10));
      } catch (e) {
        console.error("[useWordleData] roster load error:", e);
        if (!cancelled) setPlayers(["Joe", "Pete"]);
      }
    })();

    return () => { cancelled = true; };
  }, [groupId]);

  // 2) Live listen for TODAY submissions (primary: where date==today; fallback: createdAt range)
  useEffect(() => {
    let cancelled = false;
    if (!db || !groupId) return;

    const baseCol = collection(db, "submissions");
    const exactQ = query(
      baseCol,
      where("groupId", "==", groupId),
      where("date", "==", today),
      orderBy("player", "asc")
    );

    const unsub = onSnapshot(
      exactQ,
      (snap) => {
        // exact-date path succeeded
        const map: DailySubmissions = {};
        snap.forEach((d) => {
          const s = d.data() as any;
          map[(s.player || "").toString()] = {
            player: s.player || "",
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
        }
      },
      async (err) => {
        // If index missing OR any error, try fallback range query once
        console.warn("[useWordleData] exact-date snapshot failed, trying fallback:", err?.code || err);
        try {
          const { start, end } = chicagoDayRange(today);
          const fallbackQ = query(
            baseCol,
            where("groupId", "==", groupId),
            where("createdAt", ">=", Timestamp.fromDate(start)),
            where("createdAt", "<", Timestamp.fromDate(end)),
            orderBy("createdAt", "asc")
          );
          const snap = await getDocs(fallbackQ);
          const map: DailySubmissions = {};
          snap.forEach((d) => {
            const s = d.data() as any;
            const player = (s.player || "").toString();
            map[player] = {
              player,
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
          }
        } catch (e2) {
          console.error("[useWordleData] fallback range load failed:", e2);
          if (!cancelled) setLoading(false);
        }
      }
    );

    return () => {
      unsub();
      cancelled = true;
    };
  }, [groupId, today]);

  // 3) (Optional) Load ALL submissions for stats/history (cheap version: same-day only)
  // If you already had a working “allSubmissions” loader before, you can restore it here.
  useEffect(() => {
    // For now, just mirror todaysSubmissions into allSubmissions[today]
    setAllSubmissions((prev) => ({ ...prev, [today]: { ...todaysSubmissions } }));
  }, [today, todaysSubmissions]);

  // 4) Add a submission (ensures canonical today & groupId)
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

    // Optimistic local update so the UI feels instant
    setTodaysSubmissions((prev) => ({ ...prev, [clean.player]: clean }));

    try {
      await addDoc(collection(db, "submissions"), clean);
    } catch (e) {
      console.error("[useWordleData] addSubmission failed:", e);
      // rollback optimistic insert if needed
      setTodaysSubmissions((prev) => {
        const copy = { ...prev };
        delete copy[clean.player];
        return copy;
      });
      throw e;
    }
  }

  // 5) Basic stats (games/total/avg/wins) from allSubmissions
  const stats = useMemo(() => {
    const table: Record<string, { games: number; total: number; avg: number; wins: number }> = {};
    const todayMap = allSubmissions[today] || {};
    const playersSeen = new Set<string>([
      ...Object.keys(todayMap),
      ...players,
    ]);

    // Build per-player aggregates
    playersSeen.forEach((p) => (table[p] = { games: 0, total: 0, avg: 0, wins: 0 }));

    // Use all days we know (here we only attached today for simplicity)
    Object.values(allSubmissions).forEach((byPlayer) => {
      const entries = Object.entries(byPlayer || {});
      // Tally totals/games
      entries.forEach(([p, sub]) => {
        if (!table[p]) table[p] = { games: 0, total: 0, avg: 0, wins: 0 };
        table[p].games += 1;
        table[p].total += Number(sub.score) || 0;
      });
      // Wins: compare all pairs for this date’s set
      const list = entries.map(([p, s]) => ({ p, score: Number(s.score) || 0 }));
      // if exactly 2 players have scores, do head-to-head win
      if (list.length >= 2) {
        // lowest score wins; tie = no win
        const minScore = Math.min(...list.map((x) => x.score));
        const winners = list.filter((x) => x.score === minScore).map((x) => x.p);
        if (winners.length === 1) {
          const w = winners[0];
          if (!table[w]) table[w] = { games: 0, total: 0, avg: 0, wins: 0 };
          table[w].wins += 1;
        }
      }
    });

    // Finalize avg
    Object.values(table).forEach((r) => {
      r.avg = r.games > 0 ? parseFloat((r.total / r.games).toFixed(2)) : 0;
    });

    return table;
  }, [allSubmissions, players, today]);

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
