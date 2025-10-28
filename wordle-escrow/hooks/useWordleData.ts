import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AllPlayerStats,
  AllSubmissions,
  DailyData,
  Group,
  PlayerStats,
  Submission,
} from '../types';
import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

const calculateStatsForPlayer = (player: string, allSubmissions: AllSubmissions, sortedDates: string[]): PlayerStats => {
    // 1. Gather player-specific data
    const gamesPlayed = sortedDates.filter(date => allSubmissions[date].submissions[player]).length;
    
    const initialStats: PlayerStats = {
        gamesPlayed: 0,
        winPercentage: 0,
        currentStreak: 0,
        maxStreak: 0,
        averageScore: 0,
        scoreDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, 'X': 0 },
    };

    if (gamesPlayed === 0) {
        return initialStats;
    }

    // 2. Calculate basic stats
    let wins = 0;
    let totalScore = 0;
    const scoreDistribution: { [key: string]: number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, 'X': 0 };
    sortedDates.forEach(date => {
        const submission = allSubmissions[date].submissions[player];
        if (submission) {
            const scoreKey = submission.score > 6 ? 'X' : submission.score.toString();
            scoreDistribution[scoreKey]++;
            if (submission.score <= 6) {
                wins++;
                totalScore += submission.score;
            }
        }
    });
    
    const winPercentage = Math.round((wins / gamesPlayed) * 100);
    const averageScore = wins > 0 ? parseFloat((totalScore / wins).toFixed(2)) : 0;
    
    // 3. Calculate streaks
    let currentStreak = 0;
    let maxStreak = 0;
    
    sortedDates.forEach(date => {
        const submission = allSubmissions[date].submissions[player];
        const othersPlayed = Object.keys(allSubmissions[date].submissions).length > (submission ? 1 : 0);

        if (submission?.score && submission.score <= 6) {
            currentStreak++;
        } else if (submission || (othersPlayed && !submission)) {
            // A loss, or missing a day others played, breaks the streak.
            currentStreak = 0;
        }
        
        if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
        }
    });

    // 4. Final check on "current" streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastDateWithAnySubmission = sortedDates[sortedDates.length - 1];
    const lastDateObj = new Date(lastDateWithAnySubmission + "T00:00:00");
    const daysSinceLastGame = Math.round((today.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));

    const playerPlayedLastGame = !!allSubmissions[lastDateWithAnySubmission].submissions[player];
    const playerWonLastGame = playerPlayedLastGame && allSubmissions[lastDateWithAnySubmission].submissions[player].score <= 6;

    if (daysSinceLastGame > 1 || !playerWonLastGame) {
        // If it's been more than a day since the last group game, or if the player didn't win (or play) that last game
        currentStreak = 0;
    }
    
    return {
        gamesPlayed,
        winPercentage,
        averageScore,
        scoreDistribution,
        currentStreak,
        maxStreak
    };
};

const calculateAllPlayerStats = (allSubmissions: AllSubmissions, players: string[]): AllPlayerStats => {
    const stats: AllPlayerStats = {};
    const sortedDates = Object.keys(allSubmissions).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

    players.forEach(player => {
        stats[player] = calculateStatsForPlayer(player, allSubmissions, sortedDates);
    });

    return stats;
};

interface UseWordleDataProps {
  group: Group | undefined;
}

export const useWordleData = ({ group }: UseWordleDataProps) => {
  const [allSubmissions, setAllSubmissions] = useState<AllSubmissions>({});
  const [loading, setLoading] = useState(true);

  const players = useMemo(() => group?.players.sort() || [], [group]);

  useEffect(() => {
    if (!group?.id || !db) {
      setAllSubmissions({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const submissionsCol = collection(db, 'groups', group.id, 'submissions');
    const unsubscribe = onSnapshot(submissionsCol, (snapshot) => {
      const submissionsData: AllSubmissions = {};
      snapshot.forEach(doc => {
        submissionsData[doc.id] = doc.data() as DailyData;
      });
      setAllSubmissions(submissionsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching submissions:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [group?.id]);

  const today = useMemo(() => new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60 * 1000)).toISOString().split('T')[0], []);

  const todaysSubmissions = useMemo(() => {
    return allSubmissions[today]?.submissions || {};
  }, [allSubmissions, today]);

  const stats = useMemo(() => {
    return calculateAllPlayerStats(allSubmissions, players);
  }, [allSubmissions, players]);

  const addSubmission = useCallback(async (submission: Submission) => {
    if (!group?.id || !db) return;

    const { date, player } = submission;
    const dayDocRef = doc(db, 'groups', group.id, 'submissions', date);

    try {
      await updateDoc(dayDocRef, {
        [`submissions.${player}`]: submission
      });
    } catch (e: any) {
      if (e.code === 'not-found') {
        try {
          await setDoc(dayDocRef, {
            submissions: { [player]: submission }
          });
        } catch (e2) {
          console.error("Failed to create submission document:", e2);
        }
      } else {
        console.error("Failed to update submission:", e);
      }
    }
  }, [group?.id]);
  
  const saveAiSummary = useCallback(async (date: string, summary: string) => {
    if (!group?.id || !db) return;

    const dayDocRef = doc(db, 'groups', group.id, 'submissions', date);
    try {
      await updateDoc(dayDocRef, { aiSummary: summary });
    } catch (e: any) {
      if (e.code === 'not-found') {
        try {
          // If doc doesn't exist, create it. This is unlikely for summary but safe.
          await setDoc(dayDocRef, { aiSummary: summary }, { merge: true });
        } catch (e2) {
            console.error("Failed to create summary document:", e2);
        }
      } else {
          console.error("Failed to update summary:", e);
      }
    }
  }, [group?.id]);

  return {
    stats,
    today,
    todaysSubmissions,
    allSubmissions,
    addSubmission,
    saveAiSummary,
    players,
    loading,
  };
};
