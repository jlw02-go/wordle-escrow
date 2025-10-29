// hooks/useWordleData.ts
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import type { Submission, DailySubmissions } from "../types";

type UseWordleDataArgs = {
  group?: { id: string; name?: string } | null | undefined;
};

type AllSubmissions = Record<
  string, // YYYY-MM-DD
  {
    aiSummary?: string;
    // Keep a player → submission map for legacy components:
    [player: string]: any;
  }
>;

// ---------- helpers ----------
const TZ = "America/Chicago";

export const safeArray = <T,>(x: T[] | undefined | null): T[] =>
  Array.isArray(x) ? x : [];

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

// ---------- hook ----------
export function useWordleData({ group }: UseWordleDataArgs) {
  const groupId = group?.id;
  const [loading, setLoading] = useState<boolean>(true);

  // Roster
  const [players, setPlayers] = useState<string[]>([]);

  // Today’s submissions (player → Submission)
  const [todaysSubmissions, setTodaysSubmissions] = useState<DailySubmissions>(
    {}
  );

  // All submissions keyed by day; each day object can also hold aiSummary
  const [allSubmissions, setAllSubmissions] = useState<AllSubmissions>({});

  const today = todayISO();

  // Load roster + today's submissions from Firestore (defensively)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!db || !groupId) {
        setPlayers([]);
        setTodaysSubmissions({});
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // 1) Load roster from groups/{groupId}
        try {
          const gref = doc(db, "groups", groupId);
          const gsnap = await getDoc(gref);
          const loadedPlayers = gsnap.exists()
            ? safeArray<string>((gsnap.data() as any)?.players)
            : [];
          if (!cancelled) setPlayers(loadedPlayers.slice(0, 10));
        } catch (e: any) {
          console.error("[useWordleData] roster load:", e?.message || e);
          if (!cancelled) setPlayers([]);
        }

        // 2) Load today's submissions for this group
        try {
          const { start, end } = chicagoDayRange(today);
          // preferred query (requires composite index groupId ASC, createdAt DESC)
          const qRef = query(
            collection(db, "submissions"),
            where("groupId", "==", groupId),
            where("createdAt", ">=", Timestamp.fromDate(start)),
            where("createdAt", "<", Timestamp.fromDate(end)),
            orderBy("createdAt", "desc")
          );

          let snap;
          try {
            snap = await getDocs(qRef);
          } catch (err: any) {
            // Fallback without orderBy if index not ready
            if (err?.code === "failed-precondition") {
              const qNoOrder = query(
                collection(db, "submissions"),
                where("groupId", "==", groupId),
                where("createdAt", ">=", Timestamp.fromDate(start)),
                where("createdAt", "<", Timestamp.fromDate(end))
              );
              snap = await getDocs(qNoOrder);
            } else {
              throw err;
            }
          }

          const docs = safeArray(snap?.docs);
          const map: DailySubmissions = {};
          for (const d of docs) {
            const data: any = d.data() ?? {};
            const player = String(data.player ?? "").trim();
            if (!player) continue;
            const submission: Submission = {
              player,
              date: String(data.date ?? today),
              score: data.score ?? "",
              grid: data.grid ?? "",
              puzzleNumber: Number(data.puzzleNumber ?? 0),
            };
            map[player] = submission;
          }

          if (!cancelled) {
            setTodaysSubmissions(map);
            setAllSubmissions((prev) => ({
              ...(prev || {}),
              [today]: { ...(prev?.[today] || {}), ...map },
            }));
          }
        } catch (e: any) {
          console.error("[useWordleData] submissions load:", e?.message || e);
          if (!cancelled) {
            setTodaysSubmissions({});
            setAllSubmissions((prev) => ({ ...(prev || {}), [today]: { ...(prev?.[today] || {}) } }));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, today]);

  // addSubmission: update local state (ScoreInputForm already writes to Firestore)
  function addSubmission(sub: Submission) {
    if (!sub || !sub.player) return;

    setTodaysSubmissions((prev) => {
      const next = { ...(prev || {}) };
      next[sub.player] = sub;
      return next;
    });

    setAllSubmissions((prev) => {
      const byDay = { ...(prev || {}) };
      const dayObj = { ...(byDay[sub.date] || {}) };
      dayObj[sub.player] = sub;
      byDay[sub.date] = dayObj;
      return byDay;
    });
  }

  // saveAiSummary: store in local state and persist to a simple doc (optional)
  async function saveAiSummary(dayISO: string, text: string) {
    const dayKey = dayISO || today;
    // local update first
    setAllSubmissions((prev) => ({
      ...(prev || {}),
      [dayKey]: { ...(prev?.[dayKey] || {}), aiSummary: text || "" },
    }));

    // optional persistence: daySummaries/{groupId}_{day}
    try {
      if (db && groupId) {
        await setDoc(
          doc(db, "daySummaries", `${groupId}_${dayKey}`),
          { groupId, day: dayKey, aiSummary: text || "" },
          { merge: true }
        );
      }
    } catch (e: any) {
      console.error("[useWordleData] saveAiSummary:", e?.message || e);
    }
  }

  // Minimal, safe stats placeholder (kept for compatibility with PlayerStats)
  const stats = useMemo(() => {
    const subs = Object.values(todaysSubmissions ?? {});
    // You can compute aggregates here if needed; return an object even if empty.
    return {
      todayCount: subs.length,
    };
  }, [todaysSubmissions]);

  // All return values are safe (no undefined .sort calls anywhere)
  return {
    stats,
    today,
    todaysSubmissions: (todaysSubmissions ?? {}) as DailySubmissions,
    allSubmissions: (allSubmissions ?? {}) as AllSubmissions,
    addSubmission,
    saveAiSummary,
    players: safeArray(players),
    loading: !!loading,
  };
}

export default useWordleData;
