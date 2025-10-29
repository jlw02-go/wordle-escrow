// hooks/useTodayResults.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "../firebase";
import {
  collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp
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

type Result = {
  id: string;
  groupId: string;
  playerA: string;
  playerB: string;
  scoreA: number;
  scoreB: number;
  gifUrl?: string | null;
  gifAlt?: string | null;
  gifProvider?: string | null;
  createdAt: string;
};

async function fetchResults(day: string, groupId: string): Promise<Result[]> {
  if (!db) return [];

  const { start, end } = chicagoDayRange(day);
  const qRef = query(
    collection(db, "results"),
    where("groupId", "==", groupId),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end)),
  );

  const snap = await getDocs(qRef);
  const items = snap.docs.map((d) => {
    const data = d.data() as any;
    const createdISO =
      data.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString();
    return {
      id: d.id,
      groupId: data.groupId,
      playerA: data.playerA,
      playerB: data.playerB,
      scoreA: data.scoreA,
      scoreB: data.scoreB,
      gifUrl: data.gifUrl ?? null,
      gifAlt: data.gifAlt ?? null,
      gifProvider: data.gifProvider ?? null,
      createdAt: createdISO,
    } as Result;
  });

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

async function postResult(day: string, payload: Omit<Result, "id" | "createdAt">): Promise<Result> {
  if (!db) throw new Error("Firestore not initialized");

  const docRef = await addDoc(collection(db, "results"), {
    groupId: payload.groupId,
    playerA: payload.playerA,
    playerB: payload.playerB,
    scoreA: payload.scoreA,
    scoreB: payload.scoreB,
    gifUrl: payload.gifUrl ?? null,
    gifAlt: payload.gifAlt ?? null,
    gifProvider: payload.gifProvider ?? null,
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    createdAt: new Date().toISOString(),
    ...payload,
  };
}

export function useTodayResults(groupId: string) {
  const qc = useQueryClient();
  const day = todayStr();
  const key = ["results", day, groupId];

  const queryState = useQuery({
    queryKey: key,
    queryFn: () => fetchResults(day, groupId),
    enabled: !!groupId, // don’t run until we have a groupId
  });

  const mutation = useMutation({
    mutationFn: async (payload: {
      groupId: string; playerA: string; playerB: string; scoreA: number; scoreB: number;
      gifUrl?: string | null; gifAlt?: string | null; gifProvider?: string | null;
    }) => postResult(day, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
    }
  });

  return {
    day,
    data: queryState.data,
    isLoading: queryState.isLoading,
    error: queryState.error,
    submit: mutation.mutateAsync,
    isSubmitting: mutation.isLoading,
  };
}
