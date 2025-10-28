// utils/parsing.ts

// Robust parser for full Wordle share text (header + grid).
// Handles commas in puzzle number, optional hard-mode "*", blank lines, etc.
export function parseWordleShare(input: string): {
  puzzleNumber: number;
  score: number; // 1..7 (7 means X/6)
  grid: string;  // newline-joined rows of squares
} | null {
  if (!input) return null;

  // Normalize line endings & trim
  const text = input.replace(/\r\n?/g, '\n').trim();

  // Matches: "Wordle 1,592 5/6", "Wordle 1592 5/6*", "Wordle 1592 X/6"
  const headerRe = /Wordle\s+([\d,]{1,7})\s+([1-6X])\/6\*?/i;

  const lines = text.split('\n');
  const headerIndex = lines.findIndex((line) => headerRe.test(line));
  if (headerIndex === -1) return null;

  const headerLine = lines[headerIndex].trim();
  const m = headerLine.match(headerRe);
  if (!m) return null;

  const puzzleNumber = parseInt(m[1].replace(/,/g, ''), 10);
  const scoreStr = m[2].toUpperCase();
  const score = scoreStr === 'X' ? 7 : parseInt(scoreStr, 10);

  // Accept lines consisting only of Wordle square emojis (incl. VS-16 \uFE0F)
  // Using literal emojis avoids needing \u{...} escape support:
  const SQUARE_LINE = /^[⬛⬜🟨🟩\uFE0F]+$/;

  const gridLines: string[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;                 // skip blank lines
    if (!SQUARE_LINE.test(raw)) break;  // stop at the first non-grid line
    gridLines.push(raw.replace(/\uFE0F/g, '')); // strip variation selectors
  }

  // If user pasted only header, you can choose to return grid: "" instead of null.
  // Here we accept empty grid too:
  // if (gridLines.length === 0) return null;

  return {
    puzzleNumber,
    score,
    grid: gridLines.join('\n'),
  };
}

/** Back-compat wrapper: parse a "header line" or any text containing the header. */
export const parseWordleHeader = (headerLikeText: string):
  | { puzzleNumber: number; score: number }
  | null => {
  const parsed = parseWordleShare(headerLikeText);
  return parsed ? { puzzleNumber: parsed.puzzleNumber, score: parsed.score } : null;
};

/** Back-compat wrapper: given lines (header first), extract grid lines only. */
export const extractGrid = (lines: string[]): string => {
  const parsed = parseWordleShare(lines.join('\n'));
  return parsed ? parsed.grid : '';
};
