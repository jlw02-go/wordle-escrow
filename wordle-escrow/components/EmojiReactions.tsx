// components/EmojiReactions.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  Query,
  Unsubscribe,
} from "firebase/firestore";

type ReactionDoc = {
  id?: string;
  groupId: string;
  date: string;          // YYYY-MM-DD (Chicago-local normalized)
  emoji: string;         // e.g., "🎉"
  postedBy?: string;     // optional "Joe"/"Pete"
  createdAt?: any;       // Firestore Timestamp
};

type Props = {
  today: string;          // YYYY-MM-DD (passed from GroupPage/useWordleData)
  reveal: boolean;        // gate posting until reveal rules met
  currentUser?: string;   // optional, used to tag postedBy
  /** If you ever want the fallback banner back, set this to true. Defaults to false. */
  showIndexWarning?: boolean;
};

const EMOJI_PALETTE = ["🎉", "🔥", "🤣", "👏", "🤯", "😭", "😤", "💀", "🍀", "🧠"];

const EmojiReactions: React.FC<Props> = ({
  today,
  reveal,
  currentUser,
  showIndexWarning = false, // default off per your request
}) => {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState<ReactionDoc[]>([]);
  const [usedFallback, setUsedFallback] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);

  // Subscribe to today's reactions (indexed query first, then fallback if needed)
  useEffect(() => {
    if (!db || !groupId) return;
    setLoading(true);
    setUsedFallback(false);

    let unsub: Unsubscribe | undefined;

    const makePrimaryQuery = (): Query =>
      query(
        collection(db, "reactions"),
        where("groupId", "==", groupId),
        where("date", "==", today),
        orderBy("createdAt", "asc") // <-- matches your composite index
      );

    const makeFallbackQuery = (): Query =>
      query(
        collection(db, "reactions"),
        where("groupId", "==", groupId),
        where("date", "==", today)
      );

    const attach = (q: Query, isFallback = false) => {
      return onSnapshot(
        q,
        (snap) => {
          const rows: ReactionDoc[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as ReactionDoc),
          }));
          setReactions(rows);
          setLoading(false);
        },
        (err) => {
          // If the index is missing or not ready, drop to fallback once.
          const msg = String(err?.message || "");
          if (!isFallback && (err?.code === "failed-precondition" || /index/i.test(msg))) {
            setUsedFallback(true);
            unsub?.();
            unsub = attach(makeFallbackQuery(), true);
            return;
          }
          console.error("[EmojiReactions] onSnapshot error:", err);
          setLoading(false);
        }
      );
    };

    unsub = attach(makePrimaryQuery(), false);
    return () => {
      try { unsub && unsub(); } catch {}
    };
  }, [db, groupId, today]);

  // Aggregate counts by emoji
  const tally = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reactions) {
      const key = r.emoji || "";
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    // Keep palette order (only show emojis that have been used)
    return EMOJI_PALETTE.filter((e) => map.has(e)).map((e) => ({
      emoji: e,
      count: map.get(e) || 0,
    }));
  }, [reactions]);

  // Post a reaction
  const post = useCallback(
    async (emoji: string) => {
      if (!reveal || !db || !groupId || !emoji) return;
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
        console.error("[EmojiReactions] post error:", err);
      } finally {
        setPosting(null);
      }
    },
    [db, groupId, today, currentUser, reveal]
  );

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-2">Emoji Reactions</h3>

      {!reveal ? (
        <p className="text-sm text-gray-400">
          Reactions unlock after everyone submits or at 7:00 PM Central.
        </p>
      ) : (
        <>
          {/* Palette */}
          <div className="flex flex-wrap gap-2 mb-3">
            {EMOJI_PALETTE.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => post(e)}
                disabled={posting === e}
                className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 hover:border-wordle-green transition disabled:opacity-60"
                title={`React with ${e}`}
              >
                <span className="text-xl">{e}</span>
              </button>
            ))}
          </div>

          {/* Tally */}
          <div className="mb-2">
            {loading ? (
              <p className="text-sm text-gray-500">Loading reactions…</p>
            ) : tally.length === 0 ? (
              <p className="text-sm text-gray-500">No reactions yet today.</p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {tally.map((t) => (
                  <li
                    key={t.emoji}
                    className="text-sm bg-gray-800/60 border border-gray-700 rounded px-2 py-1"
                  >
                    <span className="mr-1">{t.emoji}</span>
                    <span className="text-gray-300">{t.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent feed (optional visual) */}
          {reactions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Recent:</p>
              <div className="flex flex-wrap gap-1">
                {reactions.slice(-24).map((r) => (
                  <span
                    key={r.id}
                    className="px-2 py-1 text-base rounded bg-gray-800/40 border border-gray-700"
                    title={r.postedBy ? `by ${r.postedBy}` : undefined}
                  >
                    {r.emoji}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fallback banner is intentionally suppressed by default */}
          {showIndexWarning && usedFallback ? (
            <p className="text-xs text-gray-500 mt-2">
              Live feed fallback in use (no Firestore index). Reactions will still appear.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
};

export default EmojiReactions;
