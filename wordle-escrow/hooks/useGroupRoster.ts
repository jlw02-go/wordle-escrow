// hooks/useGroupRoster.ts
import { useQuery } from "@tanstack/react-query";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export function useGroupRoster(groupId?: string) {
  return useQuery({
    queryKey: ["group-roster", groupId],
    enabled: !!groupId && !!db,
    queryFn: async () => {
      if (!db || !groupId) return { players: [] as string[] };
      const dref = doc(db, "groups", groupId);
      const snap = await getDoc(dref);
      const data = snap.exists() ? snap.data() : {};
      const players = Array.isArray((data as any).players) ? (data as any).players.slice(0, 10) : [];
      return { players };
    },
  });
}
