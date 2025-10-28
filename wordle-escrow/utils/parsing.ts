export const parseWordleHeader = (headerLine: string): { puzzleNumber: number; score: number } | null => {
    const headerMatch = headerLine.match(/Wordle (\d{1,5}) ([1-6X])\/6/);
    if (!headerMatch) {
        return null;
    }
    const puzzleNumber = parseInt(headerMatch[1], 10);
    const scoreString = headerMatch[2];
    const score = scoreString === 'X' ? 7 : parseInt(scoreString, 10);
    return { puzzleNumber, score };
};

export const extractGrid = (lines: string[]): string => {
    return lines.slice(1).filter(line => line.trim().length > 0).join('\n');
};
