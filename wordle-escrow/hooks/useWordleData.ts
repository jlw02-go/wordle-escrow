// hooks/useWordleData.ts
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  Unsubscribe,
  Query,
} from "firebase/firestore";

type GroupLike = { id: string };
type RawSubmission = {
  id?: string;
  groupId: string;
  player: string;
  date: string;
  score: number;
  grid?: string[] | string;
  puzzleNumber?: number;
  createdAt?: any;
};
type SubmissionsByPlayer = Record<string, RawSubmission>;
type AllSubmissionsByDate = Record<string, SubmissionsByPlayer & { aiSummary?: string }>;
type StatsRow = { games: number; total: number; average: number; wins: number; streak: number };

export type UseWordleDataResult = {
  players: string[];
  today: string;
  todaysSubmissions: SubmissionsByPlayer;
  allSubmissions: AllSubmissionsByDate;
  stats: Record<string, StatsRow>;
  loading: boolean;
  addSubmission: (s: {
    player: string;
    date: string;
    score: number;
    grid?: string[] | string;
    puzzleNumber?: number;
  }) => Promise<void>;
};

const TZ = "America/Chicago";
function todayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}
function coerceGrid(grid: unknown): string[] {
  if (Array.isArray(grid)) return grid.map(String);
  if (typeof grid === "string") return grid.split(/\r?\n/).filter(Boolean);
  return [];
}

export function useWordleData({ group }: { group: GroupLike }): UseWordleDataResult {
  const [players, setPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [todaysSubmissions, setTodaysSubmissions] = useState<SubmissionsByPlayer>({});
  const [allSubmissions, setAllSubmissions] = useState<AllSubmissionsByDate>({});
  const today = useRef(todayISO());

  useEffect(() => {
    today.current = todayISO();
  }, []);

  // 🔹 Load roster
  useEffect(() => {
    let cancelled = false;
    async function loadRoster() {
      if (!db || !group?.id) return;
      try {
        setLoading(true);
        const gref = doc(db, "groups", group.id);
        const snap = await getDoc(gref);
        const raw = snap.exists() ? (snap.data() as any).players : undefined;
        let roster: string[] = [];
        if (Array.isArray(raw))
          roster = raw.filter((x: any) => typeof x === "string").map((s) => s.trim());
        if (!cancelled) setPlayers(roster);
      } catch (e) {
        console.error("[useWordleData] loadRoster", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRoster();
    return () => {
      cancelled = true;
    };
  }, [group?.id]);

  // 🔹 Listen to today’s submissions (by date, not createdAt)
  useEffect(() => {
    if (!db || !group?.id) return;
    const day = today.current;
    let unsub: Unsubscribe | undefined;
    const base = [where("groupId", "==", group.id), where("date", "==", day)];

    const attach = (q: Query) =>
      onSnapshot(q, (snap) => {
        const byPlayer: SubmissionsByPlayer = {};
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const s: RawSubmission = {
            id: d.id,
            groupId: data.groupId,
            player: data.player ?? "",
            date: data.date ?? day,
            score: Number(data.score ?? 0),
            grid: coerceGrid(data.grid),
            puzzleNumber: Number(data.puzzleNumber ?? 0),
            createdAt: data.createdAt,
          };
          if (s.player) byPlayer[s.player] = s;
        });
        setTodaysSubmissions(byPlayer);
        setAllSubmissions((prev) => ({ ...prev, [day]: { ...(prev[day] || {}), ...byPlayer } }));
      });

    try {
      unsub = attach(
        query(collection(db, "submissions"), ...base, orderBy("createdAt", "asc"))
      );
    } catch {
      unsub = attach(query(collection(db, "submissions"), ...base));
    }

    return () => {
      unsub && unsub();
    };
  }, [group?.id]);

  // 🔹 History
  useEffect(() => {
    let cancelled = false;
    if (!db || !group?.id) return;
    (async () => {
      const qRef = query(collection(db, "submissions"), where("groupId", "==", group.id));
      const snap = await getDocs(qRef);
      if (cancelled) return;
      const map: AllSubmissionsByDate = {};
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const day = data.date || today.current;
        const p = (data.player || "").trim();
        if (!day || !p) return;
        if (!map[day]) map[day] = {};
        (map[day] as any)[p] = {
          id: d.id,
          ...data,
          grid: coerceGrid(data.grid),
        };
      });
      setAllSubmissions((prev) => ({ ...map, ...prev }));
    })();
    return () => {
      cancelled = true;
    };
  }, [group?.id]);

  // 🔹 Stats (Games, Wins, etc.)
  const stats = useMemo(() => {
    const out: Record<string, StatsRow> = {};
    players.forEach((p) => (out[p] = { games: 0, total: 0, average: 0, wins: 0, streak: 0 }));

    const days = Object.keys(allSubmissions);
    for (const day of days) {
      const rows = allSubmissions[day];
      const dayScores = players
        .map((p) => ({ p, s: rows?.[p]?.score }))
        .filter((x) => Number.isFinite(x.s)) as any[];
      for (const { p, s } of dayScores) {
        out[p].games++;
        out[p].total += s;
      }
      if (dayScores.length > 1) {
        const min = Math.min(...dayScores.map((x) => x.s));
        const winners = dayScores.filter((x) => x.s === min).map((x) => x.p);
        if (winners.length === 1) out[winners[0]].wins++;
      }
    }

    for (const p of players) {
      const g = out[p].games;
      out[p].average = g ? Number((out[p].total / g).toFixed(2)) : 0;
    }
    return out;
  }, [players, allSubmissions]);

  const addSubmission = useCallback(
    async ({ player, date, score, grid, puzzleNumber }) => {
      if (!db || !group?.id) throw new Error("Firestore missing");
      const payload: RawSubmission = {
        groupId: group.id,
        player: player.trim(),
        date,
        score: Number(score),
        grid: coerceGrid(grid),
        puzzleNumber: puzzleNumber ?? 0,
        createdAt: serverTimestamp(),
      };
      setTodaysSubmissions((p) => ({ ...p, [player]: payload }));
      setAllSubmissions((p) => ({ ...p, [date]: { ...(p[date] || {}), [player]: payload } }));
      await addDoc(collection(db, "submissions"), payload);
    },
    [group?.id]
  );

  return { players, today: today.current, todaysSubmissions, allSubmissions, stats, loading, addSubmission };
}
export default useWordleData;
