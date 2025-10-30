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

const GroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  if (!groupId) return <Navigate to="/group/main" replace />;

  const groupTitle = "Wordle Escrow";
  const showSubtitle = true;

  // Hook: roster/submissions/stats for this group
  const groupLike = useMemo(() => ({ id: groupId }), [groupId]);
  const {
    players,
    today,                 // YYYY-MM-DD (from hook)
    todaysSubmissions,     // map { [player]: submission }
    allSubmissions,        // map { [date]: { [player]: submission, aiSummary? } }
    stats,                 // computed stats by player
    loading,
    addSubmission,
  } = useWordleData({ group: groupLike });

  // Reveal logic
  const submittedCount = Object.keys(todaysSubmissions || {}).length;
  const revealByAll = players.length > 0 && submittedCount >= players.length;

  const revealByTime = useMemo(() => {
    try {
      // 7:00 PM Central; for simplicity assume -05:00 offset (works fine for now)
      const target = new Date(`${today}T19:00:00-05:00`);
      return Date.now() >= target.getTime();
    } catch {
      return false;
    }
  }, [today]);

  const forceReveal = new URLSearchParams(location.search).get("reveal") === "1";
  const reveal = forceReveal || revealByAll || revealByTime;

  const currentUser = getDisplayName() || "";

  const [view, setView] = useState<"today" | "history" | "h2h">("today");

  // Tiny on-screen debug to confirm reveal state & players
  const DebugBar = () => (
    <div className="mb-3 rounded bg-gray-800/60 p-2 text-xs text-gray-300">
      <div>Debug: reveal={String(reveal)} (force={String(forceReveal)} • all={String(revealByAll)} • time={String(revealByTime)})</div>
      <div>today={today} • players={[...players].join(", ") || "—"} • submitted={submittedCount}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-wordle-dark text-wordle-light font-sans p-2 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-wider uppercase">{groupTitle}</h1>
          {showSubtitle && (
            <div className="mt-2">
              <span className="text-xs uppercase tracking-wider text-gray-400 bg-gray-800/60 px-2 py-1 rounded">
                Safeguarding Wordle Bragging Rights Since 2025 • Group: {groupId}
              </span>
            </div>
          )}
        </header>

        {/* Debug — remove later if you want */}
        <DebugBar />

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-700">
          <nav className="-mb-px flex space-x-2 sm:space-x-6 justify-center" aria-label="Tabs">
            <TabButton currentView={view} viewName="today" setView={setView}>Today&apos;s Game</TabButton>
            <TabButton currentView={view} viewName="history" setView={setView}>Game History</TabButton>
            <TabButton currentView={view} viewName="h2h" setView={setView}>Head-to-Head</TabButton>
          </nav>
        </div>

        {loading && <p className="text-center">Loading…</p>}

        {!loading && view === "today" && (
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Submit */}
              <ScoreInputForm
                addSubmission={addSubmission}
                todaysSubmissions={todaysSubmissions}
                players={players}
              />

              {/* Awaiting/submitted list + reveal messaging */}
              <TodaysResults />

              {/* Post-reveal features */}
              {reveal && (
                <>
                  <AiSummary
                    groupId={groupId}
                    today={today}
                    todaysSubmissions={todaysSubmissions}
                    existingSummary={allSubmissions[today]?.aiSummary}
                  />

                  <GiphyDisplay
                    today={today}
                    reveal={reveal}
                    currentUser={currentUser}
                  />

                  <EmojiReactions
                    groupId={groupId}
                    date={today}                 // IMPORTANT: prop name is "date"
                    reveal={reveal}
                    hideIndexWarning={true}
                    currentUser={currentUser}
                  />
                </>
              )}
            </div>

            {/* Stats — hidden until reveal */}
            <div className="lg:col-span-1">
              {!reveal ? (
                <div className="rounded-lg border border-gray-700 p-3 text-sm text-gray-400">
                  Player statistics are hidden until all players submit or 7:00 PM America/Chicago.
                </div>
              ) : (
                <PlayerStats stats={stats} players={players} />
              )}
            </div>
          </main>
        )}

        {!loading && view === "history" && (
          <GameHistory allSubmissions={allSubmissions} today={today} players={players} />
        )}

        {!loading && view === "h2h" && (
          reveal ? (
            <HeadToHeadStats allSubmissions={allSubmissions} players={players} />
          ) : (
            <div className="rounded-lg border border-gray-700 p-3 text-sm text-gray-400">
              Head-to-Head is hidden until all players submit or 7:00 PM America/Chicago.
            </div>
          )
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
