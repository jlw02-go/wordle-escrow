import { AllSubmissions, HeadToHeadStats } from "../types";

export const calculateHeadToHeadStats = (
    allSubmissions: AllSubmissions,
    player1: string,
    player2: string
): HeadToHeadStats => {
    let gamesPlayed = 0;
    let player1Wins = 0;
    let player2Wins = 0;
    let ties = 0;
    let player1TotalScore = 0;
    let player2TotalScore = 0;
    let p1WinCount = 0;
    let p2WinCount = 0;

    for (const date in allSubmissions) {
        const day = allSubmissions[date].submissions;
        const sub1 = day[player1];
        const sub2 = day[player2];

        if (sub1 && sub2) {
            gamesPlayed++;
            
            if (sub1.score < sub2.score) {
                player1Wins++;
            } else if (sub2.score < sub1.score) {
                player2Wins++;
            } else {
                ties++;
            }
            
            if(sub1.score <= 6) {
                player1TotalScore += sub1.score;
                p1WinCount++;
            }
            if(sub2.score <= 6) {
                player2TotalScore += sub2.score;
                p2WinCount++;
            }
        }
    }

    return {
        player1,
        player2,
        gamesPlayed,
        player1Wins,
        player2Wins,
        ties,
        player1AverageScore: p1WinCount > 0 ? parseFloat((player1TotalScore / p1WinCount).toFixed(2)) : 0,
        player2AverageScore: p2WinCount > 0 ? parseFloat((player2TotalScore / p2WinCount).toFixed(2)) : 0,
    };
};
