export function parseWordleShare(input: string): {
  puzzleNumber: number;
  score: number;
  grid: string;
} | null {
  if (!input) return null;

  // Normalize line endings & trim
  const text = input.replace(/\r\n?/g, '\n').trim();

  // Header regex:
  // "Wordle 1,592 5/6" or "Wordle 1592 5/6*" or "Wordle 1592 X/6"
  const headerRe = /Wordle\s+([\d,]{1,7})\s+([1-6X])\/6\*?/i;

  const lines = text.split('\n');
  const headerIndex = lines.findIndex(line => headerRe.test(line));
  if (headerIndex === -1) return null;

  const headerLine = lines[headerIndex].trim();
  const m = headerLine.match(headerRe);
  if (!m) return null;

  // Remove comma from puzzle number (e.g. "1,592" → "1592")
  const puzzleNumber = parseInt(m[1].replace(/,/g, ''), 10);
  const scoreStr = m[2].toUpperCase();
  const score = scoreStr === 'X' ? 7 : parseInt(scoreStr, 10);

  // Emoji square regex
  const SQUARE_LINE = /^[\u2B1B\u2B1C\u{1F7E8}\u{1F7E9}\uFE0F]+$/u;

  // Collect grid lines
  const gridLines: string[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue; // skip blank lines
    if (!SQUARE_LINE.test(raw)) break;
    gridLines.push(raw.replace(/\uFE0F/g, ''));
  }

  return {
    puzzleNumber,
    score,
    grid: gridLines.join('\n'),
  };
}
