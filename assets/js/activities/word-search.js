import {
  extractWordSuggestions,
  findSelectedWord,
  generateWordSearch,
  getSelectionPath,
  getSuggestedGridSize,
  normalizeWord
} from './word-search-engine.js';

const COPY = {
  en: {
    instructions: 'Select vocabulary from the text, add your own words, then build the puzzle.',
    suggested: 'Suggested words', custom: 'Add a word', add: 'Add word', count: 'Number of words',
    size: 'Grid size', auto: 'Automatic', difficulty: 'Difficulty', easy: 'Easy', medium: 'Medium', hard: 'Hard',
    easyHelp: 'Horizontal and vertical', mediumHelp: 'Horizontal, vertical, and diagonal', hardHelp: 'All directions, including backwards',
    showList: 'Show word list', showSolution: 'Show solution', title: 'Word Search',
    generate: 'Generate word search',
    reset: 'Reset activity', download: 'Download as image', words: 'Words to find',
    progress: 'Found {found} of {total} words.', complete: 'Activity complete! You found every word.',
    customPlaceholder: 'Enter a word', noSuggestions: 'No vocabulary suggestions yet. Add words manually.',
    duplicate: 'That word is already included.', noWords: 'Select at least one word to make a puzzle.',
    solutionShown: 'Solution shown below the puzzle.', solutionHidden: 'Solution hidden.',
    downloadError: 'The image could not be created. Please try again.',
    downloadSuccess: 'Word search image downloaded.',
    downloadWords: 'Words to find', downloadSolution: 'Solution',
    keyboard: 'Use arrow keys to move. Press Enter or Space on the first and last letters to select.',
    grid: 'Word search grid', pending: 'Pending words', remove: 'Remove {word}',
    wordCountError: 'Choose between 1 and {max} words.'
  },
  es: {
    instructions: 'Selecciona vocabulario del texto, agrega tus propias palabras y crea la sopa.',
    suggested: 'Palabras sugeridas', custom: 'Agregar una palabra', add: 'Agregar', count: 'Cantidad de palabras',
    size: 'Tamaño de cuadrícula', auto: 'Automático', difficulty: 'Dificultad', easy: 'Fácil', medium: 'Media', hard: 'Difícil',
    easyHelp: 'Horizontal y vertical', mediumHelp: 'Horizontal, vertical y diagonal', hardHelp: 'Todas las direcciones, también al revés',
    showList: 'Mostrar lista de palabras', showSolution: 'Mostrar solución', title: 'Sopa de letras',
    generate: 'Crear sopa de letras',
    reset: 'Reiniciar actividad', download: 'Descargar como imagen', words: 'Palabras por encontrar',
    progress: 'Encontradas {found} de {total} palabras.', complete: '¡Actividad completa! Encontraste todas las palabras.',
    customPlaceholder: 'Escribe una palabra', noSuggestions: 'Aún no hay sugerencias. Puedes agregar palabras manualmente.',
    duplicate: 'Esa palabra ya está incluida.', noWords: 'Selecciona al menos una palabra para crear la sopa.',
    solutionShown: 'La solución se muestra debajo de la sopa.', solutionHidden: 'Solución oculta.',
    downloadError: 'No se pudo crear la imagen. Inténtalo de nuevo.',
    downloadSuccess: 'Se descargó la imagen de la sopa de letras.',
    downloadWords: 'Palabras por encontrar', downloadSolution: 'Solución',
    keyboard: 'Usa las flechas para moverte. Presiona Enter o espacio en la primera y última letra para seleccionar.',
    grid: 'Cuadrícula de sopa de letras', pending: 'Palabras pendientes', remove: 'Quitar {word}',
    wordCountError: 'Elige entre 1 y {max} palabras.'
  }
};

function translate(language, key, values = {}) {
  return Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value), COPY[language][key]);
}

function makeElement(tag, attributes = {}, text = '') {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text) element.textContent = text;
  return element;
}

function makeField(label, control) {
  const wrapper = makeElement('label', { class: 'lc-ws-field' });
  wrapper.append(makeElement('span', {}, label), control);
  return wrapper;
}

export const WordSearch = {
  mount(container, data = {}, options = {}) {
    const language = options.language === 'es' ? 'es' : (document.documentElement.lang === 'es' ? 'es' : 'en');
    const t = (key, values) => translate(language, key, values);
    const model = {
      text: String(data.text ?? ''),
      suggestions: [],
      selected: new Map(),
      found: new Set(),
      puzzle: null,
      showSolution: false,
      showList: true,
      currentSelection: [],
      keyboardStart: null
    };

    const root = makeElement('div', { class: 'lc-word-search' });
    const setup = makeElement('div', { class: 'lc-ws-setup' });
    const intro = makeElement('p', { class: 'lc-ws-instructions' }, t('instructions'));
    const keyboardHelp = makeElement('p', { class: 'lc-ws-help' }, t('keyboard'));
    const suggestionsTitle = makeElement('h3', {}, t('suggested'));
    const suggestionsList = makeElement('div', { class: 'lc-ws-suggestions' });
    const customInput = makeElement('input', { type: 'text', maxlength: '32', placeholder: t('customPlaceholder') });
    const addButton = makeElement('button', { type: 'button', class: 'lc-ws-secondary' }, t('add'));
    const customRow = makeElement('div', { class: 'lc-ws-custom' });
    const fields = makeElement('div', { class: 'lc-ws-fields' });
    const countInput = makeElement('input', { type: 'number', min: '1', max: '30', value: '10', inputmode: 'numeric' });
    const sizeSelect = makeElement('select');
    const difficultySelect = makeElement('select');
    const directionHelp = makeElement('small', { class: 'lc-ws-help' });
    const showListInput = makeElement('input', { type: 'checkbox', checked: 'checked' });
    const showSolutionInput = makeElement('input', { type: 'checkbox' });
    const visibilityRow = makeElement('div', { class: 'lc-ws-toggles' });
    const generateButton = makeElement('button', { type: 'button', class: 'lc-ws-primary' }, t('generate'));
    const downloadButton = makeElement('button', { type: 'button', class: 'lc-ws-secondary' }, t('download'));
    const resetButton = makeElement('button', { type: 'button', class: 'lc-ws-secondary' }, t('reset'));
    const actionRow = makeElement('div', { class: 'lc-ws-actions' });
    const status = makeElement('p', { class: 'lc-ws-status', role: 'status', 'aria-live': 'polite' });
    const worksheet = makeElement('section', { class: 'lc-ws-worksheet' });
    worksheet.hidden = true;
    resetButton.hidden = true;
    downloadButton.hidden = true;
    showSolutionInput.disabled = true;
    const worksheetHeader = makeElement('div', { class: 'lc-ws-worksheet-header' });
    const worksheetTitle = makeElement('h3', { class: 'lc-ws-worksheet-title' });
    const puzzleHeading = makeElement('h3', { class: 'lc-ws-puzzle-heading' }, t('grid'));
    const board = makeElement('div', { class: 'lc-ws-board', role: 'grid', 'aria-label': t('grid') });
    const wordListHeading = makeElement('h3', { class: 'lc-ws-word-heading' }, t('words'));
    const wordList = makeElement('ul', { class: 'lc-ws-word-list', 'aria-label': t('pending') });
    const solution = makeElement('section', { class: 'lc-ws-solution', hidden: '' });
    const solutionHeading = makeElement('h3', {}, t('showSolution'));
    const solutionList = makeElement('ul');

    for (const [value, label] of [['auto', t('auto')], ...Array.from({ length: 15 }, (_, index) => [String(index + 6), `${index + 6} × ${index + 6}`])]) {
      sizeSelect.append(makeElement('option', { value }, label));
    }
    for (const value of ['easy', 'medium', 'hard']) difficultySelect.append(makeElement('option', { value }, t(value)));

    customRow.append(makeField(t('custom'), customInput), addButton);
    fields.append(
      makeField(t('count'), countInput),
      makeField(t('size'), sizeSelect),
      makeField(t('difficulty'), difficultySelect),
      directionHelp
    );
    visibilityRow.append(
      makeField(t('showList'), showListInput),
      makeField(t('showSolution'), showSolutionInput)
    );
    actionRow.append(generateButton, resetButton, downloadButton);
    worksheetHeader.append(worksheetTitle);
    solution.append(solutionHeading, solutionList);
    worksheet.append(worksheetHeader, puzzleHeading, board, wordListHeading, wordList, solution);
    setup.append(intro, suggestionsTitle, suggestionsList, customRow, fields, visibilityRow, actionRow, status, keyboardHelp);
    root.append(setup, worksheet);
    container.replaceChildren(root);

    function renderSuggestions() {
      suggestionsList.replaceChildren();
      if (!model.suggestions.length) {
        suggestionsList.append(makeElement('p', { class: 'lc-ws-empty' }, t('noSuggestions')));
        return;
      }
      for (const suggestion of model.suggestions) {
        const input = makeElement('input', { type: 'checkbox', value: suggestion.word });
        input.checked = model.selected.has(suggestion.word);
        input.addEventListener('change', () => {
          if (input.checked) model.selected.set(suggestion.word, suggestion.label);
          else model.selected.delete(suggestion.word);
        });
        const label = makeElement('label', { class: 'lc-ws-suggestion' });
        label.append(input, makeElement('span', {}, suggestion.label));
        suggestionsList.append(label);
      }
    }

    function renderWords() {
      wordList.replaceChildren();
      for (const word of model.puzzle.words) {
        const item = makeElement('li', {
          class: model.found.has(word) ? 'is-found' : '',
          'aria-label': `${model.selected.get(word) || word}${model.found.has(word) ? ' — found' : ''}`
        }, model.selected.get(word) || word);
        wordList.append(item);
      }
      wordList.hidden = !model.showList;
      wordListHeading.hidden = !model.showList;
      status.textContent = model.found.size === model.puzzle.words.length
        ? t('complete')
        : t('progress', { found: model.found.size, total: model.puzzle.words.length });
    }

    function drawSelection(start, end) {
      model.currentSelection = getSelectionPath(start, end);
      const selectedCells = new Set(model.currentSelection.map(({ row, column }) => `${row}:${column}`));
      board.querySelectorAll('[data-row]').forEach(cell => {
        const key = `${cell.dataset.row}:${cell.dataset.column}`;
        cell.classList.toggle('is-selecting', selectedCells.has(key));
        cell.setAttribute('aria-pressed', String(selectedCells.has(key) || cell.classList.contains('is-found')));
      });
    }

    function renderBoard() {
      if (!model.puzzle) return;
      board.style.setProperty('--grid-size', model.puzzle.grid.length);
      board.replaceChildren();
      const foundCells = new Set();
      for (const word of model.found) {
        for (const { row, column } of model.puzzle.placements.get(word) || []) {
          foundCells.add(`${row}:${column}`);
        }
      }
      model.puzzle.grid.forEach((row, rowIndex) => row.forEach((letter, columnIndex) => {
        const cell = makeElement('button', {
          type: 'button', role: 'gridcell', class: 'lc-ws-cell',
          tabindex: rowIndex === 0 && columnIndex === 0 ? '0' : '-1',
          'data-row': rowIndex, 'data-column': columnIndex,
          'aria-label': `${letter}, row ${rowIndex + 1}, column ${columnIndex + 1}`,
          'aria-pressed': String(foundCells.has(`${rowIndex}:${columnIndex}`))
        }, letter);
        if (foundCells.has(`${rowIndex}:${columnIndex}`)) cell.classList.add('is-found');
        cell.addEventListener('pointerdown', event => {
          if (event.button !== 0 && event.pointerType === 'mouse') return;
          event.preventDefault();
          model.keyboardStart = null;
          model.pointerStart = { row: rowIndex, column: columnIndex };
          drawSelection(model.pointerStart, model.pointerStart);
          cell.setPointerCapture(event.pointerId);
        });
        cell.addEventListener('pointerenter', () => {
          if (model.pointerStart) drawSelection(model.pointerStart, { row: rowIndex, column: columnIndex });
        });
        cell.addEventListener('focus', () => cell.setAttribute('aria-current', 'true'));
        cell.addEventListener('blur', () => cell.removeAttribute('aria-current'));
        cell.addEventListener('keydown', event => {
          const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
          if (moves[event.key]) {
            event.preventDefault();
            const [rowDelta, columnDelta] = moves[event.key];
            const nextCell = board.querySelector(`[data-row="${rowIndex + rowDelta}"][data-column="${columnIndex + columnDelta}"]`);
            if (nextCell) {
              board.querySelector('[tabindex="0"]')?.setAttribute('tabindex', '-1');
              nextCell.setAttribute('tabindex', '0');
              nextCell.focus();
            }
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const point = { row: rowIndex, column: columnIndex };
            if (!model.keyboardStart) {
              model.keyboardStart = point;
              drawSelection(point, point);
            } else {
              drawSelection(model.keyboardStart, point);
              finishSelection();
            }
          } else if (event.key === 'Escape') {
            model.keyboardStart = null;
            drawSelection(null, null);
          }
        });
        board.append(cell);
      }));
      board.onpointermove = event => {
        if (!model.pointerStart) return;
        const bounds = board.getBoundingClientRect();
        const gridSize = model.puzzle.grid.length;
        const row = Math.floor((event.clientY - bounds.top) / bounds.height * gridSize);
        const column = Math.floor((event.clientX - bounds.left) / bounds.width * gridSize);
        if (row >= 0 && row < gridSize && column >= 0 && column < gridSize) {
          drawSelection(model.pointerStart, { row, column });
        }
      };
      renderWords();
    }

    function finishSelection() {
      if (!model.puzzle || !model.currentSelection.length) return;
      const start = model.currentSelection[0];
      const end = model.currentSelection.at(-1);
      const match = findSelectedWord(model.puzzle.grid, start, end, model.puzzle.words.filter(word => !model.found.has(word)), model.puzzle.difficulty);
      model.pointerStart = null;
      model.keyboardStart = null;
      drawSelection(null, null);
      if (match) {
        model.found.add(match.word);
        status.textContent = t('progress', { found: model.found.size, total: model.puzzle.words.length });
        renderWords();
        renderBoard();
      }
    }

    function startPuzzle(words = [...model.selected.keys()]) {
      const limit = Math.max(1, Math.min(30, Number(countInput.value) || 10));
      if (words.length < 1) throw new Error(t('noWords'));
      if (words.length > limit) throw new Error(t('wordCountError', { max: limit }));
      model.puzzle = generateWordSearch(words, { size: sizeSelect.value, difficulty: difficultySelect.value });
      model.found.clear();
      model.showSolution = false;
      showSolutionInput.checked = false;
      showSolutionInput.disabled = false;
      solution.hidden = true;
      worksheet.hidden = false;
      resetButton.hidden = false;
      downloadButton.hidden = false;
      renderBoard();
      renderSolution();
    }

    function renderSolution() {
      if (!model.puzzle) return;
      const cells = new Set();
      if (model.showSolution) {
        for (const placement of model.puzzle.placements.values()) {
          for (const { row, column } of placement) cells.add(`${row}:${column}`);
        }
      }
      board.querySelectorAll('[data-row]').forEach(cell => {
        cell.classList.toggle('is-solution', cells.has(`${cell.dataset.row}:${cell.dataset.column}`));
      });
      solution.hidden = !model.showSolution;
      solutionList.replaceChildren();
      if (model.showSolution) {
        for (const [word, placement] of model.puzzle.placements) {
          const from = placement[0];
          const to = placement.at(-1);
          solutionList.append(makeElement('li', {}, `${model.selected.get(word) || word}: row ${from.row + 1}, column ${from.column + 1} to row ${to.row + 1}, column ${to.column + 1}`));
        }
      }
    }

    function updateWorksheetHeader() {
      worksheetTitle.textContent = model.title || t('title');
      worksheetTitle.hidden = false;
    }

    async function downloadWorksheetImage() {
      if (!model.puzzle) return;
      try {
        const grid = model.puzzle.grid;
        const padding = 64;
        const boardSize = Math.max(560, Math.min(960, grid.length * 52));
        const width = boardSize + padding * 2;
        const cellSize = boardSize / grid.length;
        const titleHeight = 100;
        const listTop = titleHeight + boardSize + 70;
        const words = model.puzzle.words.map(word => model.selected.get(word) || word);
        const widestWord = Math.max(0, ...words.map(word => word.length * 14));
        const columns = model.showList ? Math.max(1, Math.min(4, Math.floor(boardSize / (widestWord + 24)))) : 1;
        const rows = model.showList ? Math.ceil(words.length / columns) : 0;
        const solutionTop = listTop + (model.showList ? 44 + rows * 38 + 28 : 0);
        const height = solutionTop + (model.showSolution ? 110 + model.puzzle.words.length * 34 : 24) + padding;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable.');

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.fillStyle = '#17212b';
        context.textAlign = 'center';
        context.font = 'bold 42px Arial, sans-serif';
        context.fillText(model.title || t('title'), width / 2, padding + 18, width - padding * 2);

        const boardLeft = padding;
        const boardTop = titleHeight;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `bold ${Math.max(16, Math.min(32, cellSize * 0.48))}px Arial, sans-serif`;
        for (let row = 0; row < grid.length; row++) {
          for (let column = 0; column < grid.length; column++) {
            const x = boardLeft + column * cellSize;
            const y = boardTop + row * cellSize;
            context.fillStyle = '#ffffff';
            context.fillRect(x, y, cellSize, cellSize);
            context.strokeStyle = '#53616d';
            context.lineWidth = 1.5;
            context.strokeRect(x, y, cellSize, cellSize);
            context.fillStyle = '#17212b';
            context.fillText(grid[row][column], x + cellSize / 2, y + cellSize / 2);
          }
        }

        if (model.showList) {
          context.textAlign = 'left';
          context.textBaseline = 'alphabetic';
          context.fillStyle = '#17212b';
          context.font = 'bold 26px Arial, sans-serif';
          context.fillText(t('downloadWords'), padding, listTop);
          context.font = '22px Arial, sans-serif';
          words.forEach((word, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            context.fillText(word, padding + column * (boardSize / columns), listTop + 40 + row * 38, boardSize / columns - 16);
          });
        }

        if (model.showSolution) {
          context.textAlign = 'left';
          context.textBaseline = 'alphabetic';
          context.fillStyle = '#17212b';
          context.font = 'bold 26px Arial, sans-serif';
          context.fillText(t('downloadSolution'), padding, solutionTop);
          context.font = '20px Arial, sans-serif';
          model.puzzle.words.forEach((word, index) => {
            const cells = model.puzzle.placements.get(word);
            const first = cells[0];
            const last = cells.at(-1);
            context.fillText(
              `${model.selected.get(word) || word}: ${first.row + 1},${first.column + 1} – ${last.row + 1},${last.column + 1}`,
              padding,
              solutionTop + 36 + index * 34
            );
          });
        }

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG encoding failed.')), 'image/png');
        });
        const url = URL.createObjectURL(blob);
        const filename = (model.title || 'word-search').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'word-search';
        const link = makeElement('a', { download: `${filename}.png` });
        link.href = url;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = t('downloadSuccess');
      } catch (error) {
        console.error('Word search image download failed:', error);
        status.textContent = t('downloadError');
      }
    }

    function setData(nextData = {}) {
      model.text = String(nextData.text ?? '');
      const config = { ...options, ...nextData };
      model.title = typeof config.title === 'string' && config.title.trim() ? config.title.trim() : t('title');
      if (['easy', 'medium', 'hard'].includes(config.difficulty)) difficultySelect.value = config.difficulty;
      const configuredSize = config.gridSize ?? config.size;
      if (configuredSize === 'auto' || (Number.isInteger(Number(configuredSize)) && Number(configuredSize) >= 6 && Number(configuredSize) <= 20)) {
        sizeSelect.value = String(configuredSize);
      }
      updateDirectionHelp();
      updateWorksheetHeader();
      const directWords = Array.isArray(nextData.words) ? nextData.words : [];
      if (directWords.length) {
        const unique = new Map();
        directWords.map(word => String(word).trim()).filter(Boolean).forEach(label => {
          const word = normalizeWord(label);
          if (word && !unique.has(word)) unique.set(word, { word, label });
        });
        model.suggestions = [...unique.values()];
      } else {
        model.suggestions = extractWordSuggestions(model.text);
      }
      model.selected = new Map(model.suggestions.slice(0, Math.min(10, model.suggestions.length)).map(item => [item.word, item.label]));
      model.found.clear();
      model.puzzle = null;
      model.showSolution = false;
      showSolutionInput.checked = false;
      showSolutionInput.disabled = true;
      resetButton.hidden = true;
      downloadButton.hidden = true;
      worksheet.hidden = true;
      status.textContent = '';
      renderSuggestions();
      board.replaceChildren();
      wordList.replaceChildren();
      solution.hidden = true;
      if (directWords.length) {
        if (model.suggestions.length > 30) {
          status.textContent = t('wordCountError', { max: 30 });
          return;
        }
        model.selected = new Map(model.suggestions.map(item => [item.word, item.label]));
        countInput.value = String(Math.max(1, model.suggestions.length));
        if (sizeSelect.value === 'auto') {
          const sizeForWords = getSuggestedGridSize(model.suggestions.map(item => item.word));
          sizeSelect.value = sizeForWords > 20 ? '20' : 'auto';
        }
        try { startPuzzle(model.suggestions.map(item => item.word)); }
        catch (error) { status.textContent = error.message; }
      }
    }

    function updateDirectionHelp() {
      directionHelp.textContent = t(`${difficultySelect.value}Help`);
    }

    addButton.addEventListener('click', () => {
      const label = customInput.value.trim();
      const word = normalizeWord(label);
      if (!word) return;
      if (model.selected.has(word) || model.suggestions.some(item => item.word === word)) {
        status.textContent = t('duplicate');
        return;
      }
      model.selected.set(word, label);
      model.suggestions.push({ word, label });
      customInput.value = '';
      renderSuggestions();
    });
    customInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); addButton.click(); }
    });
    generateButton.addEventListener('click', () => {
      try {
        startPuzzle();
        status.textContent = t('progress', { found: 0, total: model.puzzle.words.length });
      } catch (error) { status.textContent = error.message; }
    });
    resetButton.addEventListener('click', () => {
      model.found.clear();
      if (model.puzzle) {
        countInput.value = String(model.puzzle.words.length);
        try { startPuzzle(model.puzzle.words); }
        catch (error) { model.puzzle = null; status.textContent = error.message; }
      } else {
        status.textContent = '';
      }
    });
    downloadButton.addEventListener('click', downloadWorksheetImage);
    difficultySelect.addEventListener('change', updateDirectionHelp);
    showListInput.addEventListener('change', () => {
      model.showList = showListInput.checked;
      if (model.puzzle) renderWords();
    });
    showSolutionInput.addEventListener('change', () => {
      model.showSolution = showSolutionInput.checked;
      renderSolution();
      status.textContent = model.showSolution ? t('solutionShown') : t('solutionHidden');
    });
    const stopPointerSelection = () => { model.pointerStart = null; };
    board.addEventListener('pointerup', finishSelection);
    window.addEventListener('pointerup', stopPointerSelection);
    updateDirectionHelp();
    updateWorksheetHeader();
    setData(data);

    return {
      reset() {
        model.found.clear();
        if (model.puzzle) {
          countInput.value = String(model.puzzle.words.length);
          startPuzzle(model.puzzle.words);
        }
        else status.textContent = '';
      },
      updateData(nextData) { setData(nextData); },
      destroy() {
        board.removeEventListener('pointerup', finishSelection);
        window.removeEventListener('pointerup', stopPointerSelection);
        container.replaceChildren();
      },
      hasProgress() { return model.found.size > 0; },
      getState() {
        return {
          found: new Set(model.found),
          words: model.puzzle?.words.slice() || [],
          grid: model.puzzle?.grid.map(row => row.slice()) || null
        };
      }
    };
  }
};
