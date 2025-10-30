// pages/GroupPage.tsx
import React, { useMemo, useState } from "react";
import { useParams, Navigate, useLocation } from "react-router-dom";

import ScoreInputForm from "../components/ScoreInputForm";
import TodaysResults from "../components/TodaysResults";
import PlayerStats from "../components/PlayerStats";
import GameHistory from "../components/GameHistory";
import HeadToHeadStats from "../components/HeadToHeadStats";
import AiSummary from "../components/AiSummary"; // keep if you're still using manual/assisted summary
import GiphyDisplay from "../components/GiphyDisplay";
import EmojiReactions from "../components/EmojiReactions";

import { useWordleData } from "../hooks/useWordleData";
import { getDisplayName } from "../utils/currentUser";

const TZ = "America/Chicago";

const GroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  if (!groupId) return <Navigate to="/group/main" replace />;

  const groupTitle = "Wordle Escrow";
  const showSubtitle = false;

  // minimal “group” shape expected by your hook
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

  // ---- Reveal logic: after all submit OR at 7:00 PM Central OR ?reveal=1 ----
  const submittedCount = Object.keys(todaysSubmissions || {}).length;
  const forceReveal = new URLSearchParams(location.search).get("reveal") === "1";
  const revealByAll = players.length > 0 && submittedCount >= players.length;

  // 7:00 PM in America/Chicago for the current "today" date
  const revealByTime = (() => {
    try {
      // today format expected as YYYY-MM-DD
      const target = new Date(`${today}T19:00:00-05:00`); // CST/CDT offset note: if DST matters, you can compute via Intl
      const now = new Date();
      return now.getTime() >= target.getTime();
    } catch {
      return false;
    }
  })();

  const showReveal = forceReveal || revealByAll || revealByTime;

  const [view, setView] = useState<"today" | "history" | "h2h">("today");

  // Current user's display name (used for Giphy & Emoji postedBy)
  const currentUser = getDisplayName() || "";

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

              {/* “Awaiting submission” / reveal status + list */}
              <TodaysResults players={players} />

              {/* Post-reveal modules */}
              {showReveal && (
                <>
                  {/* If you’re using the assisted/manual summary component, leave this in */}
                  <AiSummary
                    todaysSubmissions={todaysSubmissions}
                    today={today}
                    groupId={groupId}
                    existingSummary={allSubmissions[today]?.aiSummary}
                  />

                  {/* Giphy feed + search, scoped to this group/day */}
                  <GiphyDisplay today={today} reveal={showReveal} currentUser={currentUser} />

                  {/* NEW: Emoji reactions, gated by reveal */}
                  <EmojiReactions
                    today={today}
                    reveal={showReveal}
                    currentUser={currentUser}
                    // showIndexWarning={false} // default is false; keep hidden
                  />
                </>
              )}
            </div>

            <div className="lg:col-span-1">
              {/* Stats are computed server-side by group/day and we gate *render* by reveal */}
              {showReveal ? (
                <PlayerStats stats={stats} players={players} />
              ) : (
                <div className="rounded-lg border border-gray-700 p-4 text-sm text-gray-400">
                  Player statistics unlock after everyone submits or at 7:00 PM Central.
                </div>
              )}
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
