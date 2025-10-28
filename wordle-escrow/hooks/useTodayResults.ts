// src/hooks/useTodayResults.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const TZ = "America/Chicago";

// Formats today's date as "YYYY-MM-DD" in Chicago time.
function todayStr() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(now);
}

export function useTodayResults() {
  const qc = useQueryClient();
  const day = todayStr();
  const key = ["results", day];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/results?day=${day}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load results");
      const data = await res.json();
      // Sort newest first (stable)
      return (data.results ?? []).sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  });

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Submit failed");
      return res.json();
    },
    onSuccess: () => {
      // ⬅️ This is the key to make “Today’s Results” refresh
      qc.invalidateQueries({ queryKey: key });
    }
  });

  return {
    day,
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    submit: mutation.mutateAsync,
    isSubmitting: mutation.isLoading
  };
}
