// pages/GroupPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';

import ScoreInputForm from '../components/ScoreInputForm';
import TodaysResults from '../components/TodaysResults';
import PlayerStats from '../components/PlayerStats';
import GameHistory from '../components/GameHistory';
import HeadToHeadStats from '../components/HeadToHeadStats';
import AiSummary from '../components/AiSummary';
import GiphyDisplay from '../components/GiphyDisplay';

import { useWordleData } from '../hooks/useWordleData';
import { useRevealStatus } from '../hooks/useRevealStatus';

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

// Minimal error boundary so broken children don't fail silently
class SafeBox extends React.Component<
  { title: string; children: React.ReactNode },
  { hasError: boolean; msg?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, msg: String(err?.message || err) };
  }
  componentDidCatch(err: any, info: any) {
    // Also log to console for details
    // eslint-disable-next-line no-console
    console.error(`[SafeBox:${this.props.title}]`, err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
          <div className="font-semibold">Error in {this.props.title}</div>
          <div className="opacity-80 break-words">{this.state.msg}</div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

const GroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();

  // Title is fixed per your request
  const groupTitle = 'Wordle Escrow';
  const showSubtitle = false;
  const subtitle = useMemo(() => (groupId ? `Group: ${groupId}` : ''), [groupId]);

  // Roster (read if present; union with Joe/Pete)
  const [players, setPlayers] = useState<string[]>(DEFAULT_PLAYERS);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);

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
          setRosterError("Couldn't load group roster.");
          setPlayers(DEFAULT_PLAYERS);
        }
      } finally {
        if (!cancelled) setLoadingRoster(false);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  // Core data
  const today = todayISO();
  const fakeGroup = groupId ? ({ id: groupId, name: groupTitle } as any) : undefined;
  const {
    stats,
    todaysSubmissions,
    allSubmissions,
    addSubmission,
    saveAiSummary,
    loading: wordleDataLoading,
  } = useWordleData({ group: fakeGroup });

  // Reveal logic + debug override
  const { reveal } = useRevealStatus(groupId);
  const forceReveal = new URLSearchParams(location.search).get('reveal') === '1';
  const showReveal = forceReveal || reveal;

  // Tabs
  const [view, setView] = useState<'today' | 'history' | 'h2h'>('today');

  return (
    <div className="min-h-screen bg-wordle-dark text-wordle-light font-sans p-2 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-wider uppercase">{groupTitle}</h1>
          <div className="flex flex-col items-center gap-1 mt-2">
            {showSubtitle && subtitle && (
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

        {(loadingRoster || wordleDataLoading) && <p className="text-center">Loading...</p>}

        {/* Debug panel only when ?reveal=1 */}
        {forceReveal && (
          <div className="mx-auto mb-6 max-w-3xl rounded-md border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm">
            <div className="font-semibold">Debug mode (reveal=1)</div>
            <div className="opacity-80">
              showReveal: {String(showReveal)} • forceReveal: {String(forceReveal)} • realReveal: {String(reveal)}
            </div>
            <div className="opacity-80">
              players: {players.join(', ') || '(none)'} • today: {today}
            </div>
            <div className="opacity-80">
              submissions today: {Object.keys(todaysSubmissions || {}).length}
            </div>
          </div>
        )}

        {/* TODAY */}
        {!loadingRoster && !wordleDataLoading && view === 'today' && (
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <ScoreInputForm
                addSubmission={addSubmission}
                todaysSubmissions={todaysSubmissions}
                players={players}
              />

              {/* Shows submitted/awaiting, hides grids until reveal */}
              <TodaysResults players={players} />

              {/* Normal: only show when revealed */}
              {showReveal && !forceReveal && (
                <>
                  <SafeBox title="AiSummary">
                    <AiSummary
                      todaysSubmissions={todaysSubmissions}
                      saveAiSummary={(text: string) => saveAiSummary(today, text)}
                      today={today}
                      existingSummary={allSubmissions[today]?.aiSummary}
                    />
                  </SafeBox>
                  <SafeBox title="GiphyDisplay">
                    <GiphyDisplay todaysSubmissions={todaysSubmissions} />
                  </SafeBox>
                </>
              )}

              {/* Debug override: force-mount even if internal conditions would hide */}
              {forceReveal && (
                <>
                  <SafeBox title="AiSummary (forced)">
                    <AiSummary
                      todaysSubmissions={todaysSubmissions}
                      saveAiSummary={(text: string) => saveAiSummary(today, text)}
                      today={today}
                      existingSummary={allSubmissions[today]?.aiSummary}
                    />
                  </SafeBox>
                  <SafeBox title="GiphyDisplay (forced)">
                    <GiphyDisplay todaysSubmissions={todaysSubmissions} />
                  </SafeBox>
                </>
              )}
            </div>

            <div className="lg:col-span-1">
              <PlayerStats stats={stats} players={players} />
            </div>
          </main>
        )}

        {/* HISTORY */}
        {!loadingRoster && !wordleDataLoading && view === 'history' && (
          <GameHistory allSubmissions={allSubmissions} today={today} players={players} />
        )}

        {/* H2H */}
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
