// pages/GroupPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import ScoreInputForm from '../components/ScoreInputForm';
import TodaysResults from '../components/TodaysResults';
import GiphyDisplay from '../components/GiphyDisplay';
import { useRevealStatus } from '../hooks/useRevealStatus';

// Firestore (read-only here; we don't seed anything)
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const DEFAULT_PLAYERS = ['Joe', 'Pete'];
const TZ = "America/Chicago";
function todayISO() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(new Date());
}

const GroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const groupName = groupId || 'Group';

  const [players, setPlayers] = useState<string[]>(DEFAULT_PLAYERS);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load roster from Firestore if present; otherwise use Joe/Pete
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!db || !groupId) {
          if (!cancelled) setPlayers(DEFAULT_PLAYERS);
          return;
        }
        const gref = doc(db, 'groups', groupId);
        const snap = await getDoc(gref);
        const list: string[] =
          snap.exists() && Array.isArray((snap.data() as any).players)
            ? (snap.data() as any).players
            : [];
        const merged = Array.from(new Set([...DEFAULT_PLAYERS, ...list])).slice(0, 10);
        if (!cancelled) setPlayers(merged);
      } catch (e: any) {
        console.error('[GroupPage] roster load:', e?.message || e);
        if (!cancelled) {
          setError("Couldn't load group roster.");
          setPlayers(DEFAULT_PLAYERS);
        }
      } finally {
        if (!cancelled) setLoadingRoster(false);
      }
    })();

    return () => { cancelled = true; };
  }, [groupId]);

  // Reveal gate (all submitted OR 1pm CT) for showing GIF picker, etc.
  const { reveal } = useRevealStatus(groupId);
  const today = todayISO();

  return (
    <div className="min-h-screen bg-wordle-dark text-wordle-light font-sans p-2 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-wider uppercase">{groupName}</h1>
          <div className="flex justify-center items-center gap-4 mt-2">
            <Link to="/" className="text-gray-400 hover:text-wordle-green transition-colors text-sm">
              Home
            </Link>
            {groupId && (
              <Link
                to={`/group/${groupId}/settings`}
                className="text-gray-400 hover:text-wordle-green transition-colors text-sm"
              >
                Settings
              </Link>
            )}
          </div>
        </header>

        {loadingRoster && <p className="text-center">Loading roster…</p>}
        {error && <p className="text-center text-red-400">{error}</p>}

        {!loadingRoster && (
          <main className="space-y-8">
            {/* Submit form: always shows Joe, Pete, and Other… */}
            <ScoreInputForm
              addSubmission={() => {}}
              todaysSubmissions={{}}
              players={players}
            />

            {/* Today’s results (handles reveal-when-all-or-1pm internally) */}
            <TodaysResults players={players} />

            {/* GIF picker once revealed */}
            {reveal && <GiphyDisplay />}
          </main>
        )}

        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>Wordle Score Escrow &copy; {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
};

export default GroupPage;
