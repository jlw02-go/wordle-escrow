// components/EmojiReactions.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

type ReactionDoc = {
  id?: string;
  groupId: string;
  date: string;        // YYYY-MM-DD
  emoji: string;
  postedBy?: string;   // optional "Joe"/"Pete"
  createdAt?: any;
};

type Props = {
  today: string;               // YYYY-MM-DD
  reveal: boolean;             // gate posting/visibility until reveal
  currentUser?: string;        // optional, tag who posted
  showIndexWarning?: boolean;  // show the "fallback used" banner (default true)
};

const QUICK_EMOJIS = ["🎉", "🔥", "🤯", "😭", "💪", "🤖", "👏", "🍀", "😅", "🧠"];

const EmojiReactions: React.FC<Props> = ({
  today,
  reveal,
  currentUser,
  showIndexWarning = true,
}) => {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);
  const [rows, setRows] = useState<ReactionDoc[]>([]);

  // Live feed (tries indexed query first, falls back if missing index)
  useEffect(() => {
    if (!db || !groupId) return;
    setLoading(true);
    setUsedFallback(false);

    const handleSnap = (snap: any) => {
      const items: ReactionDoc[] = snap.docs.map((d: any) => {
        const data = d.data() as any;
        return { id: d.id, ...(data as ReactionDoc) };
      });
      setRows(items);
      setLoading(false);
    };

    const handleErr = (err: any) => {
      console.error("[EmojiReactions] onSnapshot error:", err);
      setLoading(false);
    };

    // Try: requires composite index on (groupId ASC, date ASC, createdAt ASC)
    try {
      const qRef = query(
        collection(db, "reactions"),
        where("groupId", "==", groupId),
        where("date", "==", today),
        orderBy("createdAt", "asc")
      );
      const unsub = onSnapshot(qRef, handleSnap, (err) => {
        // If the backend throws here (e.g., missing index), switch to fallback
        if (err?.code === "failed-precondition") {
          setUsedFallback(true);
          const fbRef = query(
            collection(db, "reactions"),
            where("groupId", "==", groupId),
            where("date", "==", today)
          );
          const unsubFb = onSnapshot(fbRef, handleSnap, handleErr);
          return () => unsubFb();
        }
        handleErr(err);
      });
      return () => unsub();
    } catch (e: any) {
      // Synchronous failure path (rare), also fall back
      if (e?.code === "failed-precondition") {
        setUsedFallback(true);
        const fbRef = query(
          collection(db, "reactions"),
          where("groupId", "==", groupId),
          where("date", "==", today)
        );
        const unsubFb = onSnapshot(fbRef, handleSnap, handleErr);
        return () => unsubFb();
      }
      console.error("[EmojiReactions] query error:", e);
      setLoading(false);
    }
  }, [groupId, today]);

  const canPost = reveal && !!groupId && !!db;

  const postEmoji = async (emoji: string) => {
    if (!canPost) return;
    try {
      setPosting(emoji);
      await addDoc(collection(db, "reactions"), {
        groupId,
        date: today,
        emoji,
        postedBy: currentUser || "",
        createdAt: serverTimestamp(),
      } as ReactionDoc);
    } catch (err) {
      console.error("[EmojiReactions] postEmoji error:", err);
    } finally {
      setPosting(null);
    }
  };

  // Group duplicates for a compact visual (e.g., "🎉 x3")
  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = r.emoji || "";
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-2">Reactions</h3>

      {!reveal ? (
        <p className="text-sm text-gray-500">
          Reactions are hidden until both players submit or it’s 7:00 PM Central.
        </p>
      ) : (
        <>
          {/* Quick-post row */}
          <div className="flex flex-wrap gap-2">
            {QUICK_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                disabled={!canPost || posting === em}
                onClick={() => postEmoji(em)}
                className="px-2 py-1 rounded border border-gray-700 bg-gray-800 hover:border-wordle-green disabled:opacity-60"
                title={posting === em ? "Posting…" : `React with ${em}`}
              >
                <span className="text-lg">{em}</span>
                {posting === em ? <span className="ml-2 text-xs">Posting…</span> : null}
              </button>
            ))}
          </div>

          {/* Fallback banner (optional) */}
          {showIndexWarning && usedFallback && (
            <p className="text-xs text-gray-500 mt-2">
              Live feed fallback in use (no Firestore index). Reactions will still appear.
            </p>
          )}

          {/* Live tally + stream */}
          <div className="mt-3">
            {loading ? (
              <p className="text-sm text-gray-400">Loading reactions…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-gray-500">No reactions yet today.</p>
            ) : (
              <>
                {/* Compact tally */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {grouped.map(([em, count]) => (
                    <span
                      key={em}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 border border-gray-700"
                    >
                      <span className="text-lg">{em}</span>
                      <span className="text-xs text-gray-300">×{count}</span>
                    </span>
                  ))}
                </div>

                {/* Recent feed (lightweight) */}
                <ul className="space-y-1">
                  {rows.map((r) => (
                    <li key={r.id} className="text-sm text-gray-300">
                      <span className="text-lg mr-1">{r.emoji}</span>
                      {r.postedBy ? <span className="text-gray-400">by {r.postedBy}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default EmojiReactions;
