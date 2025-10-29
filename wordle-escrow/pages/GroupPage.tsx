// pages/GroupPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import ScoreInputForm from '../components/ScoreInputForm';
import TodaysResults from '../components/TodaysResults';
import PlayerStats from '../components/PlayerStats';
import GameHistory from '../components/GameHistory';
import HeadToHeadStats from '../components/HeadToHeadStats';
import AiSummary from '../components/AiSummary';
import GiphyDisplay from '../components/GiphyDisplay';

import { useWordleData } from '../hooks/useWordleData';
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
  const [groupTitle, setGroupTitle] = useState<string>('Wordle Score Escrow');

  // ------- Roster (read if present, else Joe/Pete) -------
  const [players, setPlayers] = useState<string[]>(DEFAULT_PLAYERS);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!db || !groupId) {
          if (!cancelled) {
            setPlayers(DEFAULT_PLAYERS);
            setGroupTitle('Wordle Score Escrow');
          }
          return;
        }
        const gref = doc(db, 'groups', groupId);
        const snap = await getDoc(gref);

        if (snap.exists()) {
          const data = snap.data() as any;
          const list: string[] = Array.isArray(data.players) ? data.players : [];
          const merged = Array.from(new Set([...DEFAULT_PLAYERS, ...list])).slice(0, 10);
          if (!cancelled) setPlayers(merged);

          const name = (data && typeof data.name === 'string' && data.name.trim()) ? data.name.trim() : '';
          if (!cancelled) {
            setGroupTitle(name || 'Wordle Score Escrow');
          }
        } else {
          if (!cancelled) {
            setPlayers(DEFAULT_PLAYERS);
            setGroupTitle('Wordle Score Escrow');
          }
        }
      } catch (e: any) {
        console.error('[GroupPage] roster/name load:', e?.message || e);
        if (!cancelled) {
          setRosterError("Couldn't load group info.");
          setPlayers(DEFAULT_PLAYERS); // safe fallback
          setGroupTitle('Wordle Score Escrow');
        }
      } finally {
        if (!cancelled) setLoadingRoster(false);
      }
    })();

    return () => { cancelled = true; };
  }, [groupId]);

  // ------- Core data (history, today map, stats, etc.) -------
  // Provide a minimal group object so the hook has an id/name to key off
  const fakeGroup = groupId ? ({ id: groupId, name: groupTitle } as any) : undefined;
  const {
    stats,
    today,
    todaysSubmissions,
    allSubmissions,
    addSubmission,
    saveAiSummary,
    loading: wordleDataLoading,
  } = useWordleData({ group: fakeGroup });

  // ------- Reveal logic (all submitted or 1:00 PM CT) -------
  const { reveal } = useRevealStatus(groupId);

  // ------- Tabs -------
  const [view, setView] = useState<'today' | 'history' | 'h2h'>('today');

  // ------- Header helpers -------
  const subtitle = groupId ? `Group: ${groupId}` : undefined;

  return (
    <div className="min-h-screen bg-wordle-dark text-wordle-light font-sans p-2 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-wider uppercase">{groupTitle}</h1>
          <div className="flex flex-col items-center gap-1 mt-2">
            {subtitle && (
              <span className="text-xs uppercase tracking-wider text-gray-400 bg-gray-800/60 px-2 py-1 rounded">
                {subtitle}
              </span>
            )}
            <div className="flex justify-center items-center gap-4">
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
            {rosterError && <p className="text-xs text-red-400 mt-1">{rosterError}</p>}
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-700">
          <nav className="-mb-px flex space-x-2 sm:space-x-6 justify-center" aria-label="Tabs">
            <TabButton currentView={view} viewName="today" setView={setView}>Today&apos;s Game</TabButton>
            <TabButton currentView={view} viewName="history" setView={setView}>Game History</TabButton>
            <TabButton currentView={view} viewName="h2h" setView={setView}>Head-to-Head</TabButton>
          </nav>
        </div>

        {/* Loading overlays */}
        {(loadingRoster || wordleDataLoading) && (
          <p className="text-center">Loading...</p>
        )}

        {/* TODAY VIEW */}
        {!loadingRoster && !wordleDataLoading && view === 'today' && (
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Submit form: ALWAYS shows Joe, Pete, and Other… (Option A) */}
              <ScoreInputForm
                addSubmission={addSubmission}
                todaysSubmissions={todaysSubmissions}
                players={players}
              />

              {/* Today’s results:
                  - shows “awaiting submission / submitted”
                  - hides grid until all submitted or 1pm
                  - fetches from Firestore itself */}
              <TodaysResults players={players} />

              {/* Reveal-gated extras */}
              {reveal && (
                <>
                  <AiSummary
                    todaysSubmissions={todaysSubmissions}
                    saveAiSummary={(text: string) => saveAiSummary(today, text)}
                    today={today}
                    existingSummary={allSubmissions[today]?.aiSummary}
                  />
                  <GiphyDisplay todaysSubmissions={todaysSubmissions} />
                </>
              )}
            </div>

            <div className="lg:col-span-1">
              <PlayerStats stats={stats} players={players} />
            </div>
          </main>
        )}

        {/* HISTORY VIEW */}
        {!loadingRoster && !wordleDataLoading && view === 'history' && (
          <GameHistory allSubmissions={allSubmissions} today={today} players={players} />
        )}

        {/* HEAD-TO-HEAD VIEW */}
        {!loadingRoster && !wordleDataLoading && view === 'h2h' && (
          <HeadToHeadStats allSubmissions={allSubmissions} players={players} />
        )}

        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>Wordle Score Escrow &copy; {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  currentView: 'today' | 'history' | 'h2h';
  viewName: 'today' | 'history' | 'h2h';
  setView: (v: 'today' | 'history' | 'h2h') => void;
  children: React.ReactNode;
}> = ({ currentView, viewName, setView, children }) => (
  <button
    onClick={() => setView(viewName)}
    className={`${
      currentView === viewName
        ? 'border-wordle-green text-wordle-green'
        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
    } whitespace-nowrap py-4 px-2 sm:px-4 border-b-2 font-medium text-md sm:text-lg transition-colors focus:outline-none`}
  >
    {children}
  </button>
);

export default GroupPage;
