// components/AiSummary.tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";

type Props = {
  today: string;       // YYYY-MM-DD
  groupId?: string;    // optional (defaults to router)
};

const AiSummary: React.FC<Props> = ({ today, groupId: groupIdProp }) => {
  const params = useParams();
  const groupId = groupIdProp || params.groupId || "main";

  const [loading, setLoading] = useState(true);
  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const docId = `${groupId}_${today}`;
    const ref = doc(db, "daySummaries", docId);

    const unsub = onSnapshot(
      ref,
      async (snap) => {
        if (snap.exists()) {
          const t = (snap.data()?.text as string) || "";
          setText(t);
        } else {
          // one-shot read fallback (rare)
          const once = await getDoc(ref);
          setText(((once.data()?.text as string) || ""));
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [groupId, today]);

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-2">AI Daily Summary</h3>
      {loading ? (
        <p className="text-sm text-gray-400">Loading summary…</p>
      ) : text ? (
        <article className="prose prose-invert max-w-none">
          <p className="whitespace-pre-wrap">{text}</p>
        </article>
      ) : (
        <p className="text-sm text-gray-500">No summary yet for today.</p>
      )}
    </section>
  );
};

export default AiSummary;
