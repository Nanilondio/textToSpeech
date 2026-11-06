import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractWordSuggestions,
  findSelectedWord,
  generateWordSearch,
  getSelectionPath,
  getSuggestedGridSize,
  normalizeWord
} from '../assets/js/activities/word-search-engine.js';

function seededRandom(seed = 17) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

test('normalizes accents, punctuation, and spaces', () => {
  assert.equal(normalizeWord('  Café-au lait! '), 'CAFÉAULAIT'.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
});

test('extracts useful unique suggestions and omits common words and dialogue labels', () => {
  const suggestions = extractWordSuggestions('Speaker 1: The teacher teaches science. The student studies science.');
  assert.deepEqual(suggestions.map(item => item.word).sort(), ['SCIENCE', 'STUDENT', 'STUDIES', 'TEACHER', 'TEACHES']);
  const named = extractWordSuggestions('Sarah visits the school. Sarah speaks clearly.');
  assert.equal(named.some(item => item.word === 'SARAH'), false);
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`places every word within a ${difficulty} puzzle`, () => {
    const words = ['CLASSROOM', 'TEACHER', 'STUDENT', 'SCIENCE', 'SCHOOL'];
    const puzzle = generateWordSearch(words, { size: 12, difficulty, random: seededRandom() });
    assert.equal(puzzle.grid.length, 12);
    for (const word of words) {
      const cells = puzzle.placements.get(word);
      assert.equal(cells.length, word.length);
      assert.equal(cells.map(({ row, column }) => puzzle.grid[row][column]).join(''), word);
      for (const { row, column } of cells) {
        assert.ok(row >= 0 && row < 12 && column >= 0 && column < 12);
      }
      assert.equal(
        findSelectedWord(puzzle.grid, cells[0], cells.at(-1), [word], difficulty)?.word,
        word
      );
    }
  });
}

test('deduplicates equivalent input words', () => {
  const puzzle = generateWordSearch(['School', 'SCHOOL', 'school'], { random: seededRandom() });
  assert.deepEqual(puzzle.words, ['SCHOOL']);
});

test('rejects words longer than the requested grid and invalid grid sizes', () => {
  assert.throws(() => generateWordSearch(['TEACHER'], { size: 6 }), /longer than the 6 × 6 grid/);
  assert.throws(() => generateWordSearch(['SCHOOL'], { size: 21 }), /between 4 and 20/);
});

test('reports placement failures rather than returning an incomplete grid', () => {
  assert.throws(
    () => generateWordSearch(['AAAA', 'BBBB', 'CCCC', 'DDDD', 'EEEE', 'FFFF', 'GGGG', 'HHHH', 'IIII'], {
      size: 4, difficulty: 'easy', random: () => 0
    }),
    /Could not place/
  );
});

test('adapts grid dimensions to selected vocabulary', () => {
  assert.equal(getSuggestedGridSize(['SCHOOL']), 8);
  assert.ok(getSuggestedGridSize(['CLASSROOM', 'ENVIRONMENT', 'TRANSPORTATION']) >= 12);
});

test('finds straight word selections and rejects invalid geometry', () => {
  const grid = [['C', 'A', 'T'], ['X', 'X', 'X'], ['X', 'X', 'X']];
  assert.equal(findSelectedWord(grid, { row: 0, column: 0 }, { row: 0, column: 2 }, ['CAT']).word, 'CAT');
  assert.equal(findSelectedWord(grid, { row: 0, column: 2 }, { row: 0, column: 0 }, ['CAT']), null);
  assert.deepEqual(getSelectionPath({ row: 0, column: 0 }, { row: 1, column: 2 }), []);
});

test('hard mode accepts reversed selections', () => {
  const grid = [['T', 'A', 'C']];
  assert.equal(findSelectedWord(grid, { row: 0, column: 0 }, { row: 0, column: 2 }, ['CAT'], 'hard').word, 'CAT');
});
