// components/EmojiReactions.tsx
import React, { useEffect, useState, useMemo } from "react";
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
import { motion, AnimatePresence } from "framer-motion";

type ReactionDoc = {
  id?: string;
  groupId: string;
  date: string;
  emoji: string;
  name?: string;
  createdAt?: any;
};

type Props = {
  today: string;
  reveal: boolean;
  currentUser?: string;
  showIndexWarning?: boolean;
};

const EMOJIS = ["🔥", "😂", "👏", "😩", "🤯", "💀", "🤓", "🏆", "🥶", "💅"];

const EmojiReactions: React.FC<Props> = ({
  today,
  reveal,
  currentUser,
  showIndexWarning = false,
}) => {
  const { groupId } = useParams();
  const [reactions, setReactions] = useState<ReactionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [fallbackUsed, setFallbackUsed] = useState(false);

  // live listener for today's reactions
  useEffect(() => {
    if (!db || !groupId) return;
    setLoading(true);

    const qRef = query(
      collection(db, "reactions"),
      where("groupId", "==", groupId),
      where("date", "==", today),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: ReactionDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as ReactionDoc),
        }));
        setReactions(rows);
        setLoading(false);
      },
      async (err) => {
        console.warn("[EmojiReactions] indexed query failed; fallback:", err?.code);
        setFallbackUsed(true);
        // fallback to non-indexed scan
        const fallbackRef = query(
          collection(db, "reactions"),
          where("groupId", "==", groupId),
          where("date", "==", today)
        );
        const snap = await (await import("firebase/firestore")).getDocs(fallbackRef);
        const rows: ReactionDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as ReactionDoc),
        }));
        setReactions(rows);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [groupId, today]);

  // count grouped by emoji
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of reactions) {
      if (!r.emoji) continue;
      c[r.emoji] = (c[r.emoji] || 0) + 1;
    }
    return c;
  }, [reactions]);

  const postReaction = async (emoji: string) => {
    if (!db || !groupId || !reveal) return;
    try {
      await addDoc(collection(db, "reactions"), {
        groupId,
        date: today,
        emoji,
        name: currentUser || "",
        createdAt: serverTimestamp(),
      } as ReactionDoc);
    } catch (e) {
      console.error("[EmojiReactions] post error:", e);
    }
  };

  if (!reveal) return null;

  return (
    <section className="mt-6">
      {loading && <p className="text-sm text-gray-500">Loading reactions…</p>}

      {/* fun, large emoji grid */}
      <div className="mt-3 grid grid-cols-5 sm:grid-cols-6 gap-3 justify-items-center">
        {EMOJIS.map((em) => {
          const n = counts[em] || 0;
          return (
            <motion.button
              key={em}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.9, rotate: -10 }}
              onClick={() => postReaction(em)}
              className="relative text-4xl sm:text-5xl select-none cursor-pointer"
              title={`React with ${em}`}
            >
              <span>{em}</span>
              {n > 0 && (
                <motion.span
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: -10 }}
                  exit={{ opacity: 0 }}
                  className="absolute -top-2 -right-2 bg-wordle-green text-white text-xs font-bold rounded-full px-1.5 shadow-lg"
                >
                  {n}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* live feed of what’s been clicked */}
      <AnimatePresence>
        {reactions.length > 0 && (
          <motion.div
            key="feed"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex flex-wrap gap-2 text-2xl"
          >
            {reactions.map((r) => (
              <motion.span
                key={r.id}
                layout
                whileHover={{ scale: 1.2 }}
                title={r.name || ""}
              >
                {r.emoji}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* optional warning */}
      {showIndexWarning && fallbackUsed && (
        <p className="mt-2 text-xs text-yellow-500">
          (Live feed fallback in use — no Firestore index.)
        </p>
      )}
    </section>
  );
};

export default EmojiReactions;
