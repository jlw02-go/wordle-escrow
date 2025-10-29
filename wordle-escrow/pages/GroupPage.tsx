// pages/GroupPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

import { useGroupData } from '../hooks/useGroupData';
import { useWordleData } from '../hooks/useWordleData';

import ScoreInputForm from '../components/ScoreInputForm';
import TodaysResults from '../components/TodaysResults';
import PlayerStats from '../components/PlayerStats';
import AiSummary from '../components/AiSummary';
import GameHistory from '../components/GameHistory';
import HeadToHeadStats from '../components/HeadToHeadStats';
import GiphyDisplay from '../components/GiphyDisplay';

// NEW: use Firestore roster directly
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const DEFAULT_PLAYERS = ["Joe", "Pete"];

const GroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { getGroupById, groups, loading: groupsLoading } = useGroupData();
  const group = getGroupById(groupId!);

  useEffect(() => {
    if (!groupsLoading && groups.length > 0 && !group) {
      navigate('/');
    }
  }, [groupsLoading, groups, group, navigate, groupId]);

  // Seed Firestore roster with Joe/Pete if group has no players yet
  useEffect(() => {
    async function seedRosterIfEmpty() {
      if (!db || !groupId) return;
      const gref = doc(db, "groups", groupId);
      const snap = await getDoc(gref);
      if (!snap.exists()) {
        await setDoc(gref, { name: group?.name ?? groupId, players: DEFAULT_PLAYERS });
        return;
      }
      const data = snap.data() as any;
      const players: string[] = Array.isArray(data.players) ? data.players : [];
      if (players.length === 0) {
        await updateDoc(gref, { players: DEFAULT_PLAYERS });
      }
    }
    seedRosterIfEmpty().catch(console.error);
  }, [groupId, group]);

  const {
    stats,
    today,
    todaysSubmissions,
    allSubmissions,
    addSubmission,
    saveAiSummary,
    players: localPlayers,
    loading: wordleDataLoading,
  } = useWordleData({ group });

  // We still show the page while data loads; ScoreInputForm pulls roster itself when needed.
  const [view, setView] = useState<'today' | 'history' | 'h2h'>('today');

  if (!group) {
    return <div className="min-h-screen bg-wordle-dark text-wordle-light flex items-center justify-center">Loading group...</div>;
  }

  // Your existing “all submitted” logic (uses local state; Firestore view handles reveal)
  const players = localPlayers.length ? localPlayers : DEFAULT_PLAYERS;
  const allSubmittedToday = players.length > 0 && Object.keys(todaysSubmissions).length === players.length;
  const todaysData = allSubmissions[today];

  const TabButton: React.FC<{ currentView: string; viewName: string; setView: (view: any) => void; children: React.ReactNode }> = ({ currentView, viewName, setView, children }) => (
    <button
      onClick={() => setView(viewName)}
      className={`${currentView === viewName ? 'border-wordle-green text-wordle-green' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}
        whitespace-nowrap py-4 px-2 sm:px-4 border-b-2 font-medium text-md sm:text-lg transition-colors focus:outline-none`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-wordle-dark text-wordle-light font-sans p-2 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-wider uppercase">{group.name}</h1>
          <div className="flex justify-center items-center gap-4 mt-2">
            <Link to="/" className="text-gray-400 hover:text-wordle-green transition-colors text-sm">Switch Group</Link>
            <Link to={`/group/${groupId}/settings`} className="text-gray-400 hover:text-wordle-green transition-colors text-sm">Settings</Link>
          </div>
        </header>

        <div className="mb-8 border-b border-gray-700">
          <nav className="-mb-px flex space-x-2 sm:space-x-6 justify-center" aria-label="Tabs">
            <TabButton currentView={view} viewName="today" setView={setView}>Today's Game</TabButton>
            <TabButton currentView={view} viewName="history" setView={setView}>Game History</TabButton>
            <TabButton currentView={view} viewName="h2h" setView={setView}>Head-to-Head</TabButton>
          </nav>
        </div>

        {wordleDataLoading && <p className="text-center">Loading scores...</p>}

        {!wordleDataLoading && view === 'today' && (
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <ScoreInputForm
                addSubmission={addSubmission}
                todaysSubmissions={todaysSubmissions}
                players={players /* still passed for your legacy local state */}
              />
              <TodaysResults
                todaysSubmissions={todaysSubmissions}
                allSubmitted={allSubmittedToday}
                players={players}
              />
              {allSubmittedToday && (
                <>
                  <AiSummary
                    todaysSubmissions={todaysSubmissions}
                    saveAiSummary={saveAiSummary}
                    today={today}
                    existingSummary={todaysData?.aiSummary}
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

        {!wordleDataLoading && view === 'history' && (
          <GameHistory allSubmissions={allSubmissions} today={today} players={players} />
        )}

        {!wordleDataLoading && view === 'h2h' && (
          <HeadToHeadStats allSubmissions={allSubmissions} players={players} />
        )}

        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>Wordle Score Escrow &copy; {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
};

export default GroupPage;
