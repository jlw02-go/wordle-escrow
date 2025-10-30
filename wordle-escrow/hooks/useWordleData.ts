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
  score: number;
  grid: string[];
  puzzleNumber: number;
  createdAt?: any;
}

interface UseWordleDataProps {
  group: any;
}

export function useWordleData({ group }: UseWordleDataProps) {
  const [allSubmissions, setAllSubmissions] = useState<Record<string, Submission[]>>({});
  const [todaysSubmissions, setTodaysSubmissions] = useState<Record<string, Submission>>({});
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offset).toISOString().split("T")[0];
  });

  const groupId = group?.id || "main";
  const players = useMemo(() => group?.players || ["Joe", "Pete"], [group]);

  // 🔹 Fetch submissions safely (read cap and no live listener)
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
          limit(20) // ✅ prevents read explosion
        );

        const snap = await getDocs(q);
        const docs: Submission[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Submission),
        }));

        // Group by date
        const grouped: Record<string, Submission[]> = {};
        for (const s of docs) {
          if (!s.date) continue;
          if (!grouped[s.date]) grouped[s.date] = [];
          grouped[s.date].push(s);
        }

        setAllSubmissions(grouped);

        // Today’s submissions
        const todaySubs: Record<string, Submission> = {};
        grouped[today]?.forEach((s) => {
          todaySubs[s.player] = s;
        });
        setTodaysSubmissions(todaySubs);

        // Basic stats
        const playerStats: Record<string, any> = {};
        for (const [date, subs] of Object.entries(grouped)) {
          subs.forEach((s) => {
            if (!playerStats[s.player]) playerStats[s.player] = { games: 0, totalScore: 0 };
            playerStats[s.player].games++;
            playerStats[s.player].totalScore += Number(s.score || 0);
          });
        }
        setStats(playerStats);
      } catch (e) {
        console.error("[useWordleData] Firestore read error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [db, groupId, today]);

  // 🔹 Add a new submission
  const addSubmission = async (submission: Omit<Submission, "groupId">) => {
    if (!db) return;
    const docData = { ...submission, groupId, createdAt: serverTimestamp() };

    try {
      await addDoc(collection(db, "submissions"), docData);

      setTodaysSubmissions((prev) => ({
        ...prev,
        [submission.player]: { ...submission, groupId },
      }));

      setAllSubmissions((prev) => {
        const newAll = { ...prev };
        if (!newAll[submission.date]) newAll[submission.date] = [];
        newAll[submission.date].unshift({ ...submission, groupId });
        return newAll;
      });
    } catch (e) {
      console.error("[useWordleData] addSubmission error:", e);
    }
  };

  // 🔹 (Optional helper) Force refresh
  const reloadData = async () => {
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
  };

  return {
    allSubmissions,
    todaysSubmissions,
    stats,
    loading,
    today,
    players,
    addSubmission,
    reloadData,
  };
}
