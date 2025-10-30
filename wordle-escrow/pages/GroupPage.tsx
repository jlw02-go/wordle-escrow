// pages/GroupPage.tsx
import React, { useMemo, useState } from "react";
import { useParams, Link, Navigate, useLocation } from "react-router-dom";

import ScoreInputForm from "../components/ScoreInputForm";
import TodaysResults from "../components/TodaysResults";
import PlayerStats from "../components/PlayerStats";
import GameHistory from "../components/GameHistory";
import HeadToHeadStats from "../components/HeadToHeadStats";
import AiSummary from "../components/AiSummary";
import GiphyDisplay from "../components/GiphyDisplay";
import EmojiReactions from "../components/EmojiReactions";

import { useWordleData } from "../hooks/useWordleData";

const TZ = "America/Chicago";
function chicagoTodayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function isRevealByTime(dayISO: string): boolean {
  // Reveal at 7:00 PM Central of that day
  const targetLocal = new Date(`${dayISO}T19:00:00-05:00`);
  return Date.now() >= targetLocal.getTime();
}

const GroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  if (!groupId) return <Navigate to="/group/main" replace />;

  // Hook: all app data
  const fakeGroup = useMemo(() => ({ id: groupId }), [groupId]);
  const {
    players,
    today,
    todaysSubmissions,
    allSubmissions,
    stats,
    loading,
    addSubmission,
  } = useWordleData({ group: fakeGroup });

  // Reveal logic
  const submittedCount = Object.keys(todaysSubmissions || {}).length;
  const forceReveal = new URLSearchParams(location.search).get("reveal") === "1";
  const revealByAll = players.length > 0 && submittedCount >= players.length;
  const revealByTime = isRevealByTime(today || chicagoTodayISO());
  const showReveal = !!(forceReveal || revealByAll || revealByTime);

  // Debug bar (optional)
  const [view, setView] = useState<"today" | "history" | "h2h">("today");
  const debug = new URLSearchParams(location.search).get("debug") === "1";

  return (
    <div className="min-h-screen bg-wordle-dark text-wordle-light font-sans p-2 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-wider uppercase">Wordle Escrow</h1>
          {/* subtitle off by default; toggle if you want to show group id */}
          {/* <div className="mt-2">
            <span className="text-xs uppercase tracking-wider text-gray-400 bg-gray-800/60 px-2 py-1 rounded">
              Group: {groupId}
            </span>
          </div> */}
          <div className="flex justify-center items-center gap-4 mt-2">
            {/* Removed "Home" as requested */}
            <Link to={`/group/${groupId}/settings`} className="text-gray-400 hover:text-wordle-green transition-colors text-sm">
              Settings
            </Link>
          </div>
          {debug && (
            <div className="mt-3 text-xs text-gray-400">
              Debug: reveal={String(showReveal)} (force={String(forceReveal)} • all={String(revealByAll)} • time={String(revealByTime)})<br />
              today={today} • players={(players || []).join(", ")} • submitted={submittedCount}
            </div>
          )}
        </header>

        <div className="mb-8 border-b border-gray-700">
          <nav className="-mb-px flex space-x-2 sm:space-x-6 justify-center" aria-label="Tabs">
            <TabButton currentView={view} viewName="today" setView={setView}>
              Today&apos;s Game
            </TabButton>
            <TabButton currentView={view} viewName="history" setView={setView}>
              Game History
            </TabButton>
            <TabButton currentView={view} viewName="h2h" setView={setView}>
              Head-to-Head
            </TabButton>
          </nav>
        </div>

        {loading && <p className="text-center">Loading…</p>}

        {!loading && view === "today" && (
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <ScoreInputForm
                addSubmission={addSubmission}
                todaysSubmissions={todaysSubmissions}
                players={players}
              />

              {/* Awaiting/submitted list + reveal handling */}
              <TodaysResults players={players} />

              {/* Revealed widgets: AI Summary, GIFs, Reactions */}
              {showReveal && (
                <>
                  <AiSummary
                    todaysSubmissions={todaysSubmissions}
                    today={today}
                    groupId={groupId}
                    reveal={showReveal}
                  />
                  <GiphyDisplay
                    today={today}
                    reveal={showReveal}
                    // optional: tag who posted, if you track current user name elsewhere
                    // currentUser={getDisplayName() ?? ""}
                  />
                  <EmojiReactions
                    today={today}
                    reveal={showReveal}
                    // currentUser={getDisplayName() ?? ""}
                    showIndexWarning={false}
                  />
                </>
              )}
            </div>

            <div className="lg:col-span-1">
              <PlayerStats
                stats={stats}
                players={players}
                reveal={showReveal}
                todaysSubmissions={todaysSubmissions}
              />
            </div>
          </main>
        )}

        {!loading && view === "history" && (
          <GameHistory allSubmissions={allSubmissions} today={today} players={players} />
        )}

        {!loading && view === "h2h" && (
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
  currentView: "today" | "history" | "h2h";
  viewName: "today" | "history" | "h2h";
  setView: (v: "today" | "history" | "h2h") => void;
  children: React.ReactNode;
}> = ({ currentView, viewName, setView, children }) => (
  <button
    onClick={() => setView(viewName)}
    className={`${
      currentView === viewName
        ? "border-wordle-green text-wordle-green"
        : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500"
    } whitespace-nowrap py-4 px-2 sm:px-4 border-b-2 font-medium text-md sm:text-lg transition-colors focus:outline-none`}
  >
    {children}
  </button>
);

export default GroupPage;
