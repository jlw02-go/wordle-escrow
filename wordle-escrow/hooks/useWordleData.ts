import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export interface Submission {
  id?: string;
  groupId: string;
  player: string;
  date: string; // "YYYY-MM-DD"
  score: number | string;
  grid: string[];
  puzzleNumber: number;
  createdAt?: any;
}

type StatsRecord = {
  gamesPlayed: number;
  totalScore: number;
  avgScore: number;
  wins?: number;
  bestStreak?: number;
  currentStreak?: number;
};

interface UseWordleDataProps {
  group: any; // expects { id, name, players? }
}

export function useWordleData({ group }: UseWordleDataProps) {
  const [allSubmissions, setAllSubmissions] = useState<Record<string, Submission[]>>({});
  const [todaysSubmissions, setTodaysSubmissions] = useState<Record<string, Submission>>({});
  const [stats, setStats] = useState<Record<string, StatsRecord>>({});
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offset).toISOString().split("T")[0];
  }, []);

  const groupId = group?.id || "main";
  const players = useMemo<string[]>(
    () => Array.from(new Set([...(group?.players || []), "Joe", "Pete"])).slice(0, 10),
    [group]
  );

  // One-time fetch with caps to avoid quota blowups
  useEffect(() => {
    if (!db || !groupId) return;

    async function fetchData() {
      setLoading(true);
      try {
        const submissionsRef = collection(db, "submissions");
        const q = query(
          submissionsRef,
          where("groupId", "==", groupId),
          orderBy("createdAt", "desc"),
          limit(20) // cap reads
        );

        const snap = await getDocs(q);
        const docs: Submission[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Submission),
        }));

        // Group by date
        const grouped: Record<string, Submission[]> = {};
        for (const s of docs) {
          if (!s?.date) continue;
          if (!grouped[s.date]) grouped[s.date] = [];
          grouped[s.date].push(s);
        }
        setAllSubmissions(grouped);

        // Today’s map
        const todayMap: Record<string, Submission> = {};
        (grouped[today] || []).forEach((s) => {
          todayMap[s.player] = s;
        });
        setTodaysSubmissions(todayMap);

        // Build stats that PlayerStats expects
        const agg: Record<string, StatsRecord> = {};
        Object.values(grouped).forEach((daySubs) => {
          daySubs.forEach((s) => {
            const p = s.player;
            const scoreNum = Number(s.score ?? 0);
            if (!agg[p]) agg[p] = { gamesPlayed: 0, totalScore: 0, avgScore: 0 };
            agg[p].gamesPlayed += 1;
            agg[p].totalScore += Number.isFinite(scoreNum) ? scoreNum : 0;
          });
        });
        for (const p of Object.keys(agg)) {
          const a = agg[p];
          a.avgScore = a.gamesPlayed > 0 ? +(a.totalScore / a.gamesPlayed).toFixed(2) : 0;
        }
        setStats(agg);
      } catch (e) {
        console.error("[useWordleData] Firestore read error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [db, groupId, today]);

  // Submit a score and update local state immediately
  const addSubmission = async (submission: Omit<Submission, "groupId">) => {
    if (!db) return;
    const cleanScore = Number(submission.score ?? 0) || 0;
    const docData: Submission = {
      ...submission,
      score: cleanScore,
      groupId,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "submissions"), docData);

      // Update Today’s map
      setTodaysSubmissions((prev) => ({
        ...prev,
        [submission.player]: { ...docData },
      }));

      // Update allSubmissions (prepend to today)
      setAllSubmissions((prev) => {
        const next = { ...prev };
        const list = next[submission.date] ? [...next[submission.date]] : [];
        list.unshift({ ...docData });
        next[submission.date] = list;
        return next;
      });

      // Update stats in-memory so UI reflects immediately
      setStats((prev) => {
        const next = { ...prev };
        const p = submission.player;
        const base: StatsRecord = next[p] || { gamesPlayed: 0, totalScore: 0, avgScore: 0 };
        base.gamesPlayed += 1;
        base.totalScore += cleanScore;
        base.avgScore = +(base.totalScore / base.gamesPlayed).toFixed(2);
        next[p] = base;
        return next;
      });
    } catch (e) {
      console.error("[useWordleData] addSubmission error:", e);
    }
  };

  // Optional helper if you ever want a manual refresh button
  const reloadData = async () => {
    if (!db) return;
    try {
      const submissionsRef = collection(db, "submissions");
      const q = query(
        submissionsRef,
        where("groupId", "==", groupId),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      const docs: Submission[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Submission),
      }));

      const grouped: Record<string, Submission[]> = {};
      for (const s of docs) {
        if (!s.date) continue;
        if (!grouped[s.date]) grouped[s.date] = [];
        grouped[s.date].push(s);
      }
      setAllSubmissions(grouped);
    } catch (e) {
      console.error("[useWordleData] reloadData error:", e);
    }
  };

  return {
    allSubmissions,
    todaysSubmissions,
    stats,          // { [player]: { gamesPlayed, totalScore, avgScore } }
    loading,
    today,
    players,
    addSubmission,
    reloadData,
  };
}
