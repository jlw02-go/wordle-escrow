// hooks/useWordleData.ts
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
  player: "Joe" | "Pete";
  date: string; // YYYY-MM-DD
  score: number | string;
  grid: string[];
  puzzleNumber: number;
  createdAt?: any;
}

type StatsRecord = {
  gamesPlayed: number;
  totalScore: number;
  avgScore: number;
};

interface UseWordleDataProps {
  group?: { id?: string } | null;
}

export function useWordleData({ group }: UseWordleDataProps) {
  const PLAYERS: ("Joe" | "Pete")[] = ["Joe", "Pete"];
  const [allSubmissions, setAllSubmissions] = useState<Record<string, Submission[]>>({});
  const [todaysSubmissions, setTodaysSubmissions] = useState<Record<string, Submission>>({});
  const [stats, setStats] = useState<Record<string, StatsRecord>>({});
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offset).toISOString().split("T")[0];
  }, []);

  const groupId = (group?.id || "main") as string;
  const players = PLAYERS;

  useEffect(() => {
    if (!db) return;
    (async () => {
      setLoading(true);
      try {
        const submissionsRef = collection(db, "submissions");
        const q = query(
          submissionsRef,
          where("groupId", "==", groupId),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const snap = await getDocs(q);
        const docs: Submission[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

        const grouped: Record<string, Submission[]> = {};
        for (const s of docs) {
          if (!s?.date) continue;
          (grouped[s.date] ||= []).push(s);
        }
        setAllSubmissions(grouped);

        const todays: Record<string, Submission> = {};
        (grouped[today] || []).forEach((s) => (todays[s.player] = s));
        setTodaysSubmissions(todays);

        const agg: Record<string, StatsRecord> = {};
        Object.values(grouped).forEach((day) => {
          day.forEach((s) => {
            const p = s.player;
            const n = Number(s.score ?? 0);
            (agg[p] ||= { gamesPlayed: 0, totalScore: 0, avgScore: 0 });
            agg[p].gamesPlayed += 1;
            agg[p].totalScore += Number.isFinite(n) ? n : 0;
          });
        });
        for (const k of Object.keys(agg)) {
          const a = agg[k];
          a.avgScore = a.gamesPlayed ? +(a.totalScore / a.gamesPlayed).toFixed(2) : 0;
        }
        setStats(agg);
      } catch (e) {
        console.error("[useWordleData] read error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [db, groupId, today]);

  const addSubmission = async (submission: Omit<Submission, "groupId">) => {
    if (!db) return;
    const cleanScore = Number(submission.score ?? 0) || 0;
    const docData: Submission = {
      ...submission,
      player: submission.player as "Joe" | "Pete",
      score: cleanScore,
      groupId,
      createdAt: serverTimestamp(),
    };
    try {
      await addDoc(collection(db, "submissions"), docData);

      setTodaysSubmissions((prev) => ({ ...prev, [docData.player]: { ...docData } }));
      setAllSubmissions((prev) => {
        const next = { ...prev };
        (next[docData.date] ||= []).unshift({ ...docData });
        return next;
      });
      setStats((prev) => {
        const next = { ...prev };
        const p = docData.player;
        const base = next[p] || { gamesPlayed: 0, totalScore: 0, avgScore: 0 };
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

  return {
    allSubmissions,
    todaysSubmissions,
    stats,
    loading,
    today,
    players,
    addSubmission,
  };
}
