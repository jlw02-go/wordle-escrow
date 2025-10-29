// pages/GroupPage.tsx (replace your file with this)
import React, { useState, useEffect, useMemo } from 'react';
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

import { useGroupRoster } from '../hooks/useGroupRoster';
import JoinGroup from '../components/JoinGroup';
import { getDisplayName } from '../utils/currentUser';

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

  // Existing wordle data (kept as-is)
  const {
    stats,
    today,
    todaysSubmissions,
    allSubmissions,
    addSubmission,
    saveAiSummary,
    players: localPlayers, // from your existing data source
    loading: wordleDataLoading,
  } = useWordleData({ group });

  // Firestore roster (preferred)
  const { data: rosterData, isLoading: rosterLoading } = useGroupRoster(groupId);
  const rosterPlayers = rosterData?.players ?? [];

  // Final players list = Firestore roster (if present) else existing local players
  const players = rosterPlayers.length > 0 ? rosterPlayers : localPlayers;

  const displayName = getDisplayName();
  const playersLower = useMemo(() => new Set(players.map(p => p.toLowerCase())), [players]);
  const isMember = !!displayName && playersLower.has(displayName.toLowerCase());

  const [view, setView] = useState<'today' | 'history' | 'h2h'>('today');

  if (!group) {
    return <div className="min-h-screen bg-wordle-dark text-wordle-light flex items-center justify-center">Loading group...</div>;
  }

  // Your existing “all submitted” logic (works with either players source)
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

        {(wordleDataLoading || rosterLoading) && <p className="text-center">Loading…</p>}

        {/* Gate the group: if not in roster, show join UI */}
        {!wordleDataLoading && !rosterLoading && !isMember && (
          <div className="flex flex-col items-center gap-6">
            <JoinGroup />
            {players.length > 0 && (
              <div className="text-sm text-gray-400">
                Current players ({players.length}/10): {players.join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Member view */}
        {!wordleDataLoading && !rosterLoading && isMember && view === 'today' && (
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <ScoreInputForm
                addSubmission={addSubmission}
                todaysSubmissions={todaysSubmissions}
                players={players}
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

        {!wordleDataLoading && !rosterLoading && isMember && view === 'history' && (
          <GameHistory allSubmissions={allSubmissions} today={today} players={players} />
        )}

        {!wordleDataLoading && !rosterLoading && isMember && view === 'h2h' && (
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
