// hooks/useTodayResults.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "../firebase";
import {
  collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp
} from "firebase/firestore";

const TZ = "America/Chicago";
const LS_PREFIX = "results-";

// Format YYYY-MM-DD in America/Chicago
function todayStr() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(now);
}

// Compute [start, end) Date objects for the Chicago day
function chicagoDayRange(dayISO: string) {
  // Construct a Chicago-local midnight. Using fixed offset is tricky around DST; build via Date + tz.
  // Simple approach: parse as local then adjust by tz using Intl roundtrip.
  const startLocal = new Date(`${dayISO}T00:00:00`);
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
  return { start: startLocal, end: endLocal };
}

type Result = {
  id: string;
  playerA: string;
  playerB: string;
  scoreA: number;
  scoreB: number;
  gifUrl?: string | null;
  gifAlt?: string | null;
  gifProvider?: string | null;
  createdAt: string; // ISO when read
};

// ---------- Fallback helpers ----------
function lsKey(day: string) {
  return `${LS_PREFIX}${day}`;
}
function readLocal(day: string): Result[] {
  const raw = localStorage.getItem(lsKey(day));
  const arr: Result[] = raw ? JSON.parse(raw) : [];
  return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
function writeLocal(day: string, payload: Omit<Result, "id" | "createdAt">): Result {
  const createdAt = new Date().toISOString();
  const local: Result = {
    id: `local-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    createdAt,
    ...payload,
  };
  const key = lsKey(day);
  const arr: Result[] = JSON.parse(localStorage.getItem(key) ?? "[]");
  arr.push(local);
  localStorage.setItem(key, JSON.stringify(arr));
  return local;
}

// ---------- Firestore-backed fetch/write with graceful fallback ----------
async function fetchResults(day: string): Promise<Result[]> {
  if (!db) return readLocal(day);

  const { start, end } = chicagoDayRange(day);
  // Use server timestamps for range; order on same field
  const qRef = query(
    collection(db, "results"),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end)),
  );

  const snap = await getDocs(qRef);
  const items = snap.docs.map((d) => {
    const data = d.data() as any;
    // createdAt may be a Firestore Timestamp until resolved
    const createdISO =
      data.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString();

    return {
      id: d.id,
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

  // newest first
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

async function postResult(day: string, payload: Omit<Result, "id" | "createdAt">): Promise<Result> {
  if (!db) return writeLocal(day, payload);

  const docRef = await addDoc(collection(db, "results"), {
    playerA: payload.playerA,
    playerB: payload.playerB,
    scoreA: payload.scoreA,
    scoreB: payload.scoreB,
    gifUrl: payload.gifUrl ?? null,
    gifAlt: payload.gifAlt ?? null,
    gifProvider: payload.gifProvider ?? null,
    createdAt: serverTimestamp(),
  });

  // return a lightweight optimistic item; it'll be replaced on refetch
  return {
    id: docRef.id,
    createdAt: new Date().toISOString(),
    ...payload,
  };
}

// ------------------ React Query hook -------------------
export function useTodayResults() {
  const qc = useQueryClient();
  const day = todayStr();
  const key = ["results", day];

  const queryState = useQuery({
    queryKey: key,
    queryFn: () => fetchResults(day),
  });

  const mutation = useMutation({
    mutationFn: async (payload: {
      playerA: string; playerB: string; scoreA: number; scoreB: number;
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
