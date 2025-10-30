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
  Timestamp,
  where,
  Unsubscribe,
  Query,
} from "firebase/firestore";

type GroupLike = { id: string };

type RawSubmission = {
  id?: string;
  groupId: string;
  player: string;
  date: string; // YYYY-MM-DD (America/Chicago)
  score: number;
  grid?: string[] | string; // stored as array of rows or a single string; we normalize to string[]
  puzzleNumber?: number;
  createdAt?: any; // Firestore Timestamp
};

type SubmissionsByPlayer = Record<string, RawSubmission>;
type AllSubmissionsByDate = Record<
  string,
  SubmissionsByPlayer & { aiSummary?: string }
>;

type StatsRow = {
  games: number;
  total: number;
  average: number;
  wins: number;
  streak: number;
};

type UseWordleDataResult = {
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

// YYYY-MM-DD in America/Chicago (DST-safe via Intl)
function todayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function dayRangeChicago(dayISO: string): { start: Date; end: Date } {
  // Interpret dayISO at local midnight and add 24h
  const start = new Date(`${dayISO}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Normalize grid to a string[] (safely handles string or array or missing)
function coerceGrid(grid: unknown): string[] {
  if (Array.isArray(grid)) return grid.map(String);
  if (typeof grid === "string") {
    // split on newlines if a single text blob was saved
    return grid.split(/\r?\n/).filter(Boolean);
  }
  return [];
}

export function useWordleData({ group }: { group: GroupLike }): UseWordleDataResult {
  const [players, setPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Per-day submissions (we at least fill today's via live listener).
  const [todaysSubmissions, setTodaysSubmissions] = useState<SubmissionsByPlayer>({});
  const [allSubmissions, setAllSubmissions] = useState<AllSubmissionsByDate>({});

  const today = useRef<string>(todayISO());
  // refresh `today` at mount; if you need midnight rollover live, you can add a timer.
  useEffect(() => {
    today.current = todayISO();
  }, []);

  // ---- Load roster strictly from Firestore (no silent fallback) ----
  useEffect(() => {
    let cancelled = false;

    async function loadRoster() {
      if (!db || !group?.id) return;
      setLoading(true);
      try {
        const gref = doc(db, "groups", group.id);
        const snap = await getDoc(gref);
        const raw = snap.exists() ? (snap.data() as any).players : undefined;

        let roster: string[] = [];
        if (Array.isArray(raw)) {
          roster = raw
            .filter((x: any) => typeof x === "string")
            .map((s: string) => s.trim())
            .filter(Boolean)
            .slice(0, 10); // cap to 10 like we discussed
        } else {
          // Show empty roster if not present — do NOT mask with defaults.
          roster = [];
        }

        if (!cancelled) setPlayers(roster);
      } catch (e) {
        console.error("[useWordleData] loadRoster error:", e);
        if (!cancelled) setPlayers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRoster();
    return () => {
      cancelled = true;
    };
  }, [group?.id]);

  // ---- Live-listen to TODAY submissions for this group ----
  useEffect(() => {
    if (!db || !group?.id) return;

    const day = today.current;
    const { start, end } = dayRangeChicago(day);

    let unsub: Unsubscribe | undefined;

    const base = [
      where("groupId", "==", group.id),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<", Timestamp.fromDate(end)),
    ];

    const primaryQuery: Query = query(
      collection(db, "submissions"),
      ...base,
      orderBy("createdAt", "asc") // prefer ascending for display, requires composite index
    );

    const fallbackQuery: Query = query(
      collection(db, "submissions"),
      ...base
      // no orderBy — avoids index requirement
    );

    const attach = (q: Query, isFallback = false) =>
      onSnapshot(
        q,
        (snap) => {
          const byPlayer: SubmissionsByPlayer = {};
          (snap?.docs || []).forEach((d) => {
            const data = (d.data() || {}) as any;
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
            const key = (s.player || "").trim();
            if (key) byPlayer[key] = s;
          });

          // update today's map and merge into allSubmissions
          setTodaysSubmissions(byPlayer);
          setAllSubmissions((prev) => ({
            ...prev,
            [day]: { ...(prev[day] || {}), ...byPlayer },
          }));
        },
        (err) => {
          const msg = String(err?.message || "");
          // If index is missing, drop to fallback once.
          if (!isFallback && (err?.code === "failed-precondition" || /index/i.test(msg))) {
            try {
              unsub && unsub();
            } catch {}
            unsub = attach(fallbackQuery, true);
            return;
          }
          console.error("[useWordleData] onSnapshot(today) error:", err);
        }
      );

    unsub = attach(primaryQuery, false);
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [db, group?.id]);

  // ---- (Optional) Load recent history to power PlayerStats/History ----
  // Keep it lightweight: last 30 days for this group
  useEffect(() => {
    let cancelled = false;
    if (!db || !group?.id) return;

    async function loadHistory() {
      try {
        const now = new Date();
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
        const qRef = query(
          collection(db, "submissions"),
          where("groupId", "==", group.id),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          orderBy("createdAt", "asc") // may need index; if not available, you can remove this line
        );
        const snap = await getDocs(qRef);
        if (cancelled) return;

        const map: AllSubmissionsByDate = {};
        (snap?.docs || []).forEach((d) => {
          const data = (d.data() || {}) as any;
          const day = data.date || today.current;
          const player = (data.player || "").trim();
          if (!day || !player) return;

          const s: RawSubmission = {
            id: d.id,
            groupId: data.groupId,
            player,
            date: day,
            score: Number(data.score ?? 0),
            grid: coerceGrid(data.grid),
            puzzleNumber: Number(data.puzzleNumber ?? 0),
            createdAt: data.createdAt,
          };

          if (!map[day]) map[day] = {};
          (map[day] as any)[player] = s;
        });

        setAllSubmissions((prev) => ({ ...map, ...prev })); // keep today's listener overrides
      } catch (e: any) {
        // If index missing, fall back to a non-ordered fetch (low risk for small datasets)
        const msg = String(e?.message || "");
        if (e?.code === "failed-precondition" || /index/i.test(msg)) {
          try {
            const qRef = query(
              collection(db, "submissions"),
              where("groupId", "==", group.id),
              where("createdAt", ">=", Timestamp.fromDate(new Date(Date.now() - 30 * 864e5)))
            );
            const snap = await getDocs(qRef);
            if (cancelled) return;

            const map: AllSubmissionsByDate = {};
            (snap?.docs || []).forEach((d) => {
              const data = (d.data() || {}) as any;
              const day = data.date || today.current;
              const player = (data.player || "").trim();
              if (!day || !player) return;
              const s: RawSubmission = {
                id: d.id,
                groupId: data.groupId,
                player,
                date: day,
                score: Number(data.score ?? 0),
                grid: coerceGrid(data.grid),
                puzzleNumber: Number(data.puzzleNumber ?? 0),
                createdAt: data.createdAt,
              };
              if (!map[day]) map[day] = {};
              (map[day] as any)[player] = s;
            });

            setAllSubmissions((prev) => ({ ...map, ...prev }));
          } catch (e2) {
            console.error("[useWordleData] loadHistory fallback error:", e2);
          }
        } else {
          console.error("[useWordleData] loadHistory error:", e);
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [db, group?.id]);

  // ---- Derived: stats across all loaded days for listed players ----
  const stats: Record<string, StatsRow> = useMemo(() => {
    const roster = players;
    const perPlayer: Record<string, StatsRow> = {};
    roster.forEach((p) => {
      perPlayer[p] = { games: 0, total: 0, average: 0, wins: 0, streak: 0 };
    });

    // Build a set of days we have data for
    const days = Object.keys(allSubmissions);
    if (days.length === 0 || roster.length === 0) return perPlayer;

    // Compute wins per day: unique lowest score among *roster* submissions
    for (const day of days) {
      const rows = allSubmissions[day] || {};
      // collect scores for roster members that submitted that day
      const dayScores: { player: string; score: number }[] = [];
      for (const p of roster) {
        const s = (rows as any)[p] as RawSubmission | undefined;
        if (s && Number.isFinite(s.score)) {
          dayScores.push({ player: p, score: Number(s.score) });
        }
      }
      // Update totals/games for each who played that day
      for (const { player, score } of dayScores) {
        perPlayer[player].games += 1;
        perPlayer[player].total += score;
      }
      // Unique min gets a win
      if (dayScores.length > 0) {
        const minScore = Math.min(...dayScores.map((d) => d.score));
        const winners = dayScores.filter((d) => d.score === minScore).map((d) => d.player);
        if (winners.length === 1) {
          perPlayer[winners[0]].wins += 1;
        }
      }
    }

    // Averages
    for (const p of roster) {
      const g = perPlayer[p].games;
      perPlayer[p].average = g > 0 ? Number((perPlayer[p].total / g).toFixed(2)) : 0;
    }

    // Streaks (consecutive days with a submission, counting back from today)
    // We’ll build a set of days per player, then walk backwards from today.
    const byPlayerDays: Record<string, Set<string>> = {};
    for (const p of roster) byPlayerDays[p] = new Set<string>();
    for (const day of days) {
      for (const p of roster) {
        if ((allSubmissions[day] as any)[p]) {
          byPlayerDays[p].add(day);
        }
      }
    }

    const todayStr = today.current;
    // Helper to go back N days
    const stepDaysBack = (iso: string, n: number): string => {
      const d = new Date(`${iso}T00:00:00`);
      d.setDate(d.getDate() - n);
      const f = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return f.format(d);
    };

    for (const p of roster) {
      let streak = 0;
      // walk backwards from today until a missing day is encountered
      for (let k = 0; k < 3650; k++) {
        const check = k === 0 ? todayStr : stepDaysBack(todayStr, k);
        if (byPlayerDays[p].has(check)) {
          streak += 1;
        } else {
          break;
        }
      }
      perPlayer[p].streak = streak;
    }

    return perPlayer;
  }, [players, allSubmissions]);

  // ---- Helper: addSubmission (write to Firestore + update local state fast) ----
  const addSubmission = useCallback<UseWordleDataResult["addSubmission"]>(
    async ({ player, date, score, grid, puzzleNumber }) => {
      if (!db || !group?.id) throw new Error("Firestore not initialized or group missing");
      const payload: RawSubmission = {
        groupId: group.id,
        player: player.trim(),
        date,
        score: Number(score),
        grid: coerceGrid(grid),
        puzzleNumber: Number(puzzleNumber ?? 0),
        createdAt: serverTimestamp(),
      };
      // Optimistic local update
      const day = date || today.current;
      setTodaysSubmissions((prev) => ({
        ...prev,
        [payload.player]: { ...payload },
      }));
      setAllSubmissions((prev) => ({
        ...prev,
        [day]: { ...(prev[day] || {}), [payload.player]: { ...payload } },
      }));

      // Persist
      await addDoc(collection(db, "submissions"), payload as any);
    },
    [db, group?.id]
  );

  return {
    players,
    today: today.current,
    todaysSubmissions,
    allSubmissions,
    stats,
    loading,
    addSubmission,
  };
}

export default useWordleData;
