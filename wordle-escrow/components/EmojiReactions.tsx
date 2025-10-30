// components/EmojiReactions.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

type ReactionDoc = {
  id?: string;
  groupId: string;
  date: string;       // YYYY-MM-DD
  emoji: string;      // "🎉" etc.
  postedBy?: string;  // "Joe" / "Pete"
  createdAt?: any;
};

type Props = {
  today: string;          // YYYY-MM-DD
  reveal: boolean;        // gate posting (true = can post)
  currentUser?: string;   // for tagging “postedBy”
};

const DEFAULT_EMOJIS = ["🎉", "🔥", "😅", "💀", "🤯", "👏", "😎", "🤖"];

const EmojiReactions: React.FC<Props> = ({ today, reveal, currentUser }) => {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReactionDoc[]>([]);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const disabled = !reveal; // change to false if you want to allow pre-reveal reactions

  // Live read with index fallback (like GIFs)
  useEffect(() => {
    if (!db || !groupId) return;

    setLoading(true);
    setListenerError(null);
    let unsub: (() => void) | undefined;

    try {
      const qRef = query(
        collection(db, "reactions"),
        where("groupId", "==", groupId),
        where("date", "==", today),
        orderBy("createdAt", "asc")
      );

      unsub = onSnapshot(
        qRef,
        (snap) => {
          const rows: ReactionDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          setItems(rows);
          setLoading(false);
        },
        async (err) => {
          // index not ready? fallback without orderBy
          setListenerError(err?.message || "listener error");
          const fallback = query(
            collection(db, "reactions"),
            where("groupId", "==", groupId),
            where("date", "==", today)
          );
          const snap2 = await getDocs(fallback);
          const rows: ReactionDoc[] = snap2.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
          setItems(rows);
          setLoading(false);
        }
      );
    } catch (e: any) {
      setListenerError(e?.message || String(e));
      setLoading(false);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [groupId, today]);

  // Totals by emoji
  const tallies = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of items) {
      const key = r.emoji || "";
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [items]);

  // Recent feed (last 8)
  const recent = useMemo(() => {
    const arr = items.slice().reverse().slice(0, 8);
    return arr;
  }, [items]);

  const post = async (emoji: string) => {
    if (!db || !groupId) return;
    if (!emoji) return;
    if (disabled) return;
    try {
      await addDoc(collection(db, "reactions"), {
        groupId,
        date: today,
        emoji,
        postedBy: currentUser || "",
        createdAt: serverTimestamp(),
      } as ReactionDoc);
    } catch (err) {
      console.error("[EmojiReactions] post error:", err);
    }
  };

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-2">Reactions</h3>
      <p className="text-sm text-gray-400">
        Tap an emoji to react to today’s game{disabled ? " (reactions enabled after reveal)." : "."}
      </p>

      {/* Emoji bar */}
      <div className="flex flex-wrap gap-2 mt-3">
        {DEFAULT_EMOJIS.map((e) => {
          const count = tallies.get(e) || 0;
          return (
            <button
              key={e}
              type="button"
              disabled={disabled}
              onClick={() => post(e)}
              className={`px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-800 transition
                ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              title={disabled ? "Reactions unlocked after reveal" : "Add reaction"}
            >
              <span className="text-xl">{e}</span>
              <span className="ml-2 text-sm text-gray-300">{count > 0 ? count : ""}</span>
            </button>
          );
        })}
      </div>

      {/* Recent feed */}
      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-gray-400">Loading reactions…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">No reactions yet today.</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {recent.map((r) => (
              <li key={r.id} className="rounded border border-gray-700 p-2 bg-gray-800/40">
                <div className="text-2xl">{r.emoji}</div>
                {r.postedBy ? (
                  <div className="text-xs text-gray-400 mt-1">by {r.postedBy}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {listenerError && (
          <p className="mt-2 text-xs text-yellow-400">
            Live feed fallback in use (no Firestore index). Reactions will still appear.
          </p>
        )}
      </div>
    </section>
  );
};

export default EmojiReactions;
