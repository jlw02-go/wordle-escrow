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

import { useWordleData } from "../hooks/useWordleData";

const GroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  if (!groupId) return <Navigate to="/group/main" replace />;

  const groupTitle = "Wordle Escrow";
  const showSubtitle = false;

  // Force roster to exactly Joe & Pete for this simplified build.
  const players: ("Joe" | "Pete")[] = ["Joe", "Pete"];

  // Minimal group obj for the data hook (only uses id)
  const fakeGroup = useMemo(() => ({ id: groupId }), [groupId]);

  const {
    stats,
    todaysSubmissions,
    allSubmissions,
    addSubmission,
    loading,
    today,
  } = useWordleData({ group: fakeGroup });

  // Reveal logic: force via URL (?reveal=1), or when both submitted, or at 1:00 PM CT.
  const submittedCount = Object.keys(todaysSubmissions || {}).length;
  const forceReveal = new URLSearchParams(location.search).get("reveal") === "1";
  const revealByAll = submittedCount >= players.length;
  const revealByTime = (() => {
    const now = new Date();
    const target = new Date(`${today}T13:00:00-05:00`); // 1pm Central (fixed offset)
    return now.getTime() >= target.getTime();
  })();
  const showReveal = forceReveal || revealByAll || revealByTime;

  // Tabs
  const [view, setView] = useState<"today" | "history" | "h2h">("today");

  return (
    <div className="min-h-screen bg-wordle-dark text-wordle-light font-sans p-2 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-wider uppercase">{groupTitle}</h1>
          {showSubtitle && (
            <div className="mt-2">
              <span className="text-xs uppercase tracking-wider text-gray-400 bg-gray-800/60 px-2 py-1 rounded">
                Group: {groupId}
              </span>
            </div>
          )}
          <div className="flex justify-center items-center gap-4 mt-2">
            <Link to="/" className="text-gray-400 hover:text-wordle-green transition-colors text-sm">
              Home
            </Link>
          </div>
        </header>

        {/* Tabs */}
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

              <TodaysResults
                players={players}
                todaysSubmissions={todaysSubmissions}
                reveal={showReveal}
              />

              {/* Reveal-gated extras */}
              {showReveal && (
                <>
                  <AiSummary
                    todaysSubmissions={todaysSubmissions}
                    today={today}
                    groupId={groupId}
                    existingSummary={allSubmissions[today]?.aiSummary}
                  />
                  <GiphyDisplay todaysSubmissions={todaysSubmissions} />
                </>
              )}
            </div>

            <div className="lg:col-span-1">
              {/* Hide stats entirely until reveal */}
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
