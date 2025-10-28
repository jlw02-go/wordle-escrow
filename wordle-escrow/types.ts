export interface Submission {
  player: string;
  date: string; // YYYY-MM-DD
  score: number; // 1-6 for wins, 7 for a loss (X)
  grid: string; // The raw grid of squares
  puzzleNumber: number;
}

export interface DailySubmissions {
  [playerName: string]: Submission;
}

export interface DailyData {
  submissions: DailySubmissions;
  aiSummary?: string;
}

export interface AllSubmissions {
  [date: string]: DailyData;
}

export interface PlayerStats {
  gamesPlayed: number;
  winPercentage: number;
  currentStreak: number;
  maxStreak: number;
  averageScore: number;
  scoreDistribution: { [score: string]: number }; // score 1-6, X -> count
}

export interface AllPlayerStats {
  [playerName: string]: PlayerStats;
}

export interface Group {
  id: string;
  name: string;
  players: string[];
  createdAt: string;
}

export interface HeadToHeadStats {
    player1: string;
    player2: string;
    gamesPlayed: number;
    player1Wins: number;
    player2Wins: number;
    ties: number;
    player1AverageScore: number;
    player2AverageScore: number;
}
