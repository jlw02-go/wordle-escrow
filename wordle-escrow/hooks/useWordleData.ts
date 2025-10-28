import { useState, useEffect, useMemo, useCallback } from 'react';
import { AllSubmissions, AllPlayerStats, DailySubmissions, Submission, DailyData, Group } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';

const getTodayDateString = (): string => {
  const today = new Date();
  // Adjust for timezone to prevent date changing mid-day
  const offset = today.getTimezoneOffset();
  const todayInLocalTime = new Date(today.getTime() - (offset * 60 * 1000));
  return todayInLocalTime.toISOString().split('T')[0];
};

const calculateAllPlayerStats = (data: AllSubmissions, players: string[]): AllPlayerStats => {
  const stats: AllPlayerStats = {};

  players.forEach(player => {
    const playerSubmissions = Object.values(data)
      .map(dailyData => dailyData.submissions?.[player]) // Use optional chaining here
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (playerSubmissions.length === 0) {
      stats[player] = {
        gamesPlayed: 0,
        winPercentage: 0,
        currentStreak: 0,
        maxStreak: 0,
        averageScore: 0,
        scoreDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, 'X': 0 },
      };
      return;
    }

    let wins = 0;
    let totalScore = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    let lastGameDate: Date | null = null;
    const scoreDistribution: { [key: string]: number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, 'X': 0 };

    playerSubmissions.forEach(sub => {
      const subDate = new Date(sub.date + "T00:00:00"); // Treat date as local
      if (sub.score <= 6) {
        wins++;
        totalScore += sub.score;
        scoreDistribution[sub.score.toString()]++;
        if (lastGameDate && (subDate.getTime() - lastGameDate.getTime() === 24 * 60 * 60 * 1000)) {
            currentStreak++;
        } else {
            currentStreak = 1;
        }
      } else {
        scoreDistribution['X']++;
        currentStreak = 0;
      }
      
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
      lastGameDate = subDate;
    });

    const today = new Date(getTodayDateString() + "T00:00:00");
    if (lastGameDate && (today.getTime() - lastGameDate.getTime() > 24 * 60 * 60 * 1000)) {
        currentStreak = 0;
    }

    stats[player] = {
      gamesPlayed: playerSubmissions.length,
      winPercentage: playerSubmissions.length > 0 ? Math.round((wins / playerSubmissions.length) * 100) : 0,
      currentStreak,
      maxStreak,
      averageScore: wins > 0 ? parseFloat((totalScore / wins).toFixed(2)) : 0,
      scoreDistribution,
    };
  });

  return stats;
};

interface UseWordleDataProps {
    group: Group | undefined;
}


export const useWordleData = ({ group }: UseWordleDataProps) => {
    const [allSubmissions, setAllSubmissions] = useState<AllSubmissions>({});
    const [loading, setLoading] = useState(true);

    const players = useMemo(() => group?.players || [], [group]);

    useEffect(() => {
        if (!group?.id || !db) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const submissionsCol = collection(db, 'groups', group.id, 'submissions');
        const unsubscribe = onSnapshot(submissionsCol, (snapshot) => {
            const subs: AllSubmissions = {};
            snapshot.forEach(doc => {
                subs[doc.id] = doc.data() as DailyData;
            });
            setAllSubmissions(subs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching submissions:", error);
            setLoading(false);
        });

        return () => unsubscribe();

    }, [group?.id]);
  
  const today = useMemo(() => getTodayDateString(), []);
  
  const todaysSubmissions = useMemo<DailySubmissions>(() => allSubmissions[today]?.submissions || {}, [allSubmissions, today]);

  const stats = useMemo(() => calculateAllPlayerStats(allSubmissions, players), [allSubmissions, players]);
  
  const addSubmission = useCallback(async (submission: Submission) => {
    if (!group?.id || !db) return;

    const date = submission.date;
    const submissionDocRef = doc(db, 'groups', group.id, 'submissions', date);

    const newSubmissionPayload = {
        [`submissions.${submission.player}`]: submission
    };
    
    // **THIS IS THE FIX: Optimistic UI Update**
    // Immediately update the local state to make the UI feel instant.
    setAllSubmissions(prev => {
        const currentDateData = prev[date] || { submissions: {} };
        const updatedSubmissions = {
            ...currentDateData.submissions,
            [submission.player]: submission
        };
        return {
            ...prev,
            [date]: {
                ...currentDateData,
                submissions: updatedSubmissions
            }
        };
    });
    
    try {
      // Then, send the update to Firebase in the background.
      await setDoc(submissionDocRef, newSubmissionPayload, { merge: true });
    } catch(e) {
      console.error("Error adding submission: ", e);
      // In a production app, you might add logic here to revert the optimistic
      // update if the server call fails.
    }
  }, [group?.id]);

  const saveAiSummary = useCallback(async (date: string, summary: string) => {
    if (!group?.id || !db) return;
    const submissionDocRef = doc(db, 'groups', group.id, 'submissions', date);
    await updateDoc(submissionDocRef, { aiSummary: summary });
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
