// pages/GroupPage.tsx
import React, { useMemo, useState } from "react";
import { useParams, Navigate, useLocation } from "react-router-dom";

import ScoreInputForm from "../components/ScoreInputForm";
import TodaysResults from "../components/TodaysResults";
import PlayerStats from "../components/PlayerStats";
import GameHistory from "../components/GameHistory";
import HeadToHeadStats from "../components/HeadToHeadStats";
import AiSummary from "../components/AiSummary";
import GiphyDisplay from "../components/GiphyDisplay";
import EmojiReactions from "../components/EmojiReactions";

import { useWordleData } from "../hooks/useWordleData";
import { getDisplayName } from "../utils/currentUser";

// ---- time/reveal helpers ----
const TZ = "America/Chicago";
function todayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}
function isRevealReachedByTime(dayISO: string): boolean {
  const today = todayISO();
  if (dayISO !== today) return true; // past days always reveal

  // 7:00 PM Central
  const now = new Date();
  // Note: using fixed offset version for simplicity; data elsewhere already normalized to day.
  const sevenCt = new Date(`${dayISO}T19:00:00-05:00`);
  return now.getTime() >= sevenCt.getTime();
}

const GroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  if (!groupId) return <Navigate to="/group/main" replace />;

  const fakeGroup = useMemo(() => ({ id: groupId }), [groupId]);
  const {
    stats,
    todaysSubmissions,
    allSubmissions,
    addSubmission,
    loading,
    today,
    players,
  } = useWordleData({ group: fakeGroup });

  const submittedCount = Object.keys(todaysSubmissions || {}).length;
  const forceReveal = new URLSearchParams(location.search).get("reveal") === "1";
  const revealByAll = players.length > 0 && submittedCount >= players.length;
  const revealByTime = isRevealReachedByTime(today);
  const showReveal = forceReveal || revealByAll || revealByTime;

  // current user (for tagging in GIFs / emoji)
  const currentUser = getDisplayName() || "";

  const [view, setView] = useState<"today" | "history" | "h2h">("today");

  const groupTitle = "Wordle Escrow";
  const subtitle = "Safeguarding Wordle Bragging Rights Since 2025";

  return (
    <div className="min-h-screen bg-wordle-dark text-wordle-light font-sans p-2 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-wider uppercase">
            {groupTitle}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-400">
            {subtitle}
          </p>
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

              {/* Awaiting/submitted list + reveal-controlled results */}
              <TodaysResults />

              {/* Reveal-gated fun stuff */}
              {showReveal && (
                <>
                  <AiSummary
                    todaysSubmissions={todaysSubmissions}
                    today={today}
                    groupId={groupId}
                    existingSummary={allSubmissions[today]?.aiSummary}
                  />

                  <GiphyDisplay
                    today={today}
                    reveal={showReveal}
                    currentUser={currentUser}
                  />

                  <EmojiReactions
                    today={today}
                    reveal={showReveal}
                    currentUser={currentUser}
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
