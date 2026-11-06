const STOP_WORDS = new Set((
  'about after again against all also am an and any are as at be because been before ' +
  'being below between both but by can could did do does doing down during each few ' +
  'for from further had has have having he her here hers herself him himself his how ' +
  'i if in into is it its itself just me more most my myself no nor not of off on once ' +
  'only or other our ours ourselves out over own same she should so some such than that ' +
  'the their theirs them themselves then there these they this those through to too under ' +
  'until up very was we were what when where which while who whom why will with would you ' +
  'your yours yourself yourselves speaker orador'
).split(/\s+/));

const DIRECTIONS = {
  easy: [[0, 1], [1, 0]],
  medium: [[0, 1], [1, 0], [1, 1], [1, -1]],
  hard: [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]]
};

export function normalizeWord(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

export function extractWordSuggestions(text) {
  const source = String(text ?? '').replace(/^(?:speaker|orador)\s*[12]\s*:\s*/gim, '');
  const counts = new Map();
  const firstSeen = new Map();
  const tokenPattern = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)*/g;
  const tokens = [...source.matchAll(tokenPattern)];
  const lowercaseWords = new Set(tokens
    .filter(([label]) => !/^[A-ZÀ-ÖØ-Þ]/.test(label))
    .map(([label]) => normalizeWord(label)));

  for (const match of tokens) {
    const label = match[0].replace(/[’']/g, '');
    const word = normalizeWord(label);
    if (word.length < 4 || STOP_WORDS.has(word.toLowerCase())) continue;

    const before = source.slice(0, match.index);
    const atSentenceStart = !before || /[.!?]\s*$/.test(before) || /(?:^|\n)\s*$/.test(before);
    const capitalized = /^[A-ZÀ-ÖØ-Þ]/.test(label) && !/^[A-ZÀ-ÖØ-Þ]+$/.test(label);
    if (capitalized && (!atSentenceStart || !lowercaseWords.has(word))) continue;

    counts.set(word, (counts.get(word) || 0) + 1);
    if (!firstSeen.has(word)) firstSeen.set(word, label);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || firstSeen.get(a[0]).localeCompare(firstSeen.get(b[0])))
    .map(([word]) => ({ word, label: firstSeen.get(word) }));
}

export function getDirections(difficulty = 'easy') {
  return DIRECTIONS[difficulty] || DIRECTIONS.easy;
}

function shuffle(items, random) {
  for (let index = items.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

export function getSuggestedGridSize(words) {
  const normalized = [...new Set((words || []).map(normalizeWord).filter(Boolean))];
  if (!normalized.length) return 8;
  const longest = Math.max(...normalized.map(word => word.length));
  return Math.min(20, Math.max(8, longest, Math.ceil(Math.sqrt(normalized.reduce((sum, word) => sum + word.length, 0) * 1.8))));
}

export function generateWordSearch(words, {
  size = 'auto',
  difficulty = 'easy',
  random = Math.random
} = {}) {
  const normalizedWords = [...new Set((words || []).map(normalizeWord).filter(Boolean))];
  if (!normalizedWords.length) throw new Error('Select at least one word.');

  const gridSize = size === 'auto' ? getSuggestedGridSize(normalizedWords) : Number(size);
  if (!Number.isInteger(gridSize) || gridSize < 4 || gridSize > 20) {
    throw new RangeError('Grid size must be between 4 and 20.');
  }
  const tooLong = normalizedWords.find(word => word.length > gridSize);
  if (tooLong) throw new RangeError(`“${tooLong}” is longer than the ${gridSize} × ${gridSize} grid.`);

  const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(''));
  const directions = getDirections(difficulty);
  const placements = new Map();

  for (const word of normalizedWords.slice().sort((a, b) => b.length - a.length)) {
    const candidates = [];
    for (const [rowStep, columnStep] of directions) {
      for (let row = 0; row < gridSize; row++) {
        for (let column = 0; column < gridSize; column++) {
          const endRow = row + (word.length - 1) * rowStep;
          const endColumn = column + (word.length - 1) * columnStep;
          if (endRow < 0 || endRow >= gridSize || endColumn < 0 || endColumn >= gridSize) continue;
          let fits = true;
          for (let index = 0; index < word.length; index++) {
            const letter = grid[row + index * rowStep][column + index * columnStep];
            if (letter && letter !== word[index]) { fits = false; break; }
          }
          if (fits) candidates.push({ row, column, rowStep, columnStep });
        }
      }
    }

    const position = shuffle(candidates, random).find(candidate => {
      for (let index = 0; index < word.length; index++) {
        const letter = grid[candidate.row + index * candidate.rowStep][candidate.column + index * candidate.columnStep];
        if (letter && letter !== word[index]) return false;
      }
      return true;
    });
    if (!position) throw new Error(`Could not place “${word}” in a ${gridSize} × ${gridSize} grid. Try a larger grid or fewer words.`);

    const cells = [];
    for (let index = 0; index < word.length; index++) {
      const row = position.row + index * position.rowStep;
      const column = position.column + index * position.columnStep;
      grid[row][column] = word[index];
      cells.push({ row, column });
    }
    placements.set(word, cells);
  }

  for (const row of grid) {
    for (let column = 0; column < row.length; column++) {
      if (!row[column]) row[column] = String.fromCharCode(65 + Math.floor(random() * 26));
    }
  }

  return { grid, placements, words: normalizedWords, difficulty };
}

export function getSelectionPath(start, end) {
  if (!start || !end) return [];
  const rowDelta = end.row - start.row;
  const columnDelta = end.column - start.column;
  if (rowDelta !== 0 && columnDelta !== 0 && Math.abs(rowDelta) !== Math.abs(columnDelta)) return [];

  const steps = Math.max(Math.abs(rowDelta), Math.abs(columnDelta));
  if (!steps) return [{ row: start.row, column: start.column }];
  const rowStep = Math.sign(rowDelta);
  const columnStep = Math.sign(columnDelta);
  return Array.from({ length: steps + 1 }, (_, index) => ({
    row: start.row + index * rowStep,
    column: start.column + index * columnStep
  }));
}

export function findSelectedWord(grid, start, end, words, difficulty = 'easy') {
  const path = getSelectionPath(start, end);
  if (path.length < 2) return null;

  const rowStep = path[1].row - path[0].row;
  const columnStep = path[1].column - path[0].column;
  if (!getDirections(difficulty).some(([row, column]) => row === rowStep && column === columnStep)) return null;

  const selected = path.map(({ row, column }) => grid[row]?.[column] || '').join('');
  const match = words.find(word => word === selected);
  if (match) return { word: match, path };

  if (difficulty === 'hard') {
    const reverse = words.find(word => word === [...selected].reverse().join(''));
    if (reverse) return { word: reverse, path };
  }
  return null;
}
