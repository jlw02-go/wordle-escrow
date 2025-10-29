// hooks/useRevealStatus.ts
import { useQuery } from "@tanstack/react-query";
import { db } from "../firebase";
import {
  collection, getDocs, query, where, orderBy, Timestamp, doc, getDoc
} from "firebase/firestore";

const TZ = "America/Chicago";
function todayISO() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}
function chicagoDayRange(dayISO: string) {
  const start = new Date(`${dayISO}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
function isTimePast1pmChicago(dayISO: string) {
  const today = todayISO();
  if (dayISO !== today) return true;
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, hour12: false, hour: "2-digit", minute: "2-digit",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === t)?.value || "";
  const h = parseInt(get("hour") || "0", 10);
  const m = parseInt(get("minute") || "0", 10);
  return h > 13 || (h === 13 && m >= 0);
}

export function useRevealStatus(groupId?: string) {
  return useQuery({
    queryKey: ["reveal-status", groupId],
    enabled: !!groupId && !!db,
    queryFn: async () => {
      if (!db || !groupId) return { reveal: false, players: [] as string[], submittedBy: new Set<string>(), day: "" };
      const day = todayISO();

      // roster
      const gref = doc(db, "groups", groupId);
      const gsnap = await getDoc(gref);
      const players: string[] = gsnap.exists() && Array.isArray((gsnap.data() as any).players)
        ? (gsnap.data() as any).players.slice(0, 10)
        : [];

      // subs
      const { start, end } = chicagoDayRange(day);
      const qRef = query(
        collection(db, "submissions"),
        where("groupId", "==", groupId),
        where("createdAt", ">=", Timestamp.fromDate(start)),
        where("createdAt", "<", Timestamp.fromDate(end)),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(qRef);
      const submittedBy = new Set<string>(
        snap.docs.map(d => ((d.data() as any).player || "").toLowerCase())
      );

      const allSubmitted = players.length > 0 && players.every(p => submittedBy.has(p.toLowerCase()));
      const reveal = allSubmitted || isTimePast1pmChicago(day);

      return { reveal, players, submittedBy, day };
    },
  });
}
