/*
 * Turns the original exercise fields into a usable editorial lesson shape.
 * The generated fields are deliberately derived from the existing dialogue,
 * questions, vocabulary and teacher tips; this module must not invent a
 * transcript, audio, answer, citation or classroom fact.
 */

const answerText = (exercise, question) => question.options?.[question.answer] ?? '';

// These line references are editorial mappings to the unchanged source
// dialogue. They are explicit because lexical overlap alone is not evidence:
// e.g. “True” can match several unrelated lines. The map covers only legacy
// sources; published exercises keep their authored answer keys unchanged.
export const EVIDENCE_LINES = {
  'at-school': { q: [[2], [5], [8]], tf: [[2, 3], [8]] },
  'at-the-supermarket': { q: [[2], [7, 8], [8]], tf: [[6], [4, 5]] },
  'daily-routine': { q: [[2], [6], [4]], tf: [[2], [8]] },
  'my-family': { q: [[2], [4], [5]], tf: [[2], [7]] },
  'at-the-airport': { q: [[2], [4], [7]], tf: [[4], [7]] },
  'at-the-restaurant': { q: [[2], [4], [10]], tf: [[6], [2]] },
  'making-an-appointment': { q: [[2], [4], [7]], tf: [[5, 6], [7]] },
  'weekend-plans': { q: [[2], [6, 8], [7]], tf: [[2], [7, 8]] },
  'giving-advice': { q: [[1], [4], [6]], tf: [[3], [8]] },
  'making-a-complaint': { q: [[4], [7], [9]], tf: [[4], [5]] },
  'planning-a-trip': { q: [[2], [2], [5, 6]], tf: [[3], [4]] },
  'travel-problems': { q: [[2], [4], [5, 7]], tf: [[4], [6, 7]] },
};

function evidenceLines(exercise, type, index) {
  return EVIDENCE_LINES[exercise.slug]?.[type]?.[index] || [];
}

function editorialAnswerKey(exercise) {
  const questions = (exercise.questions || []).map((question, index) => {
    const answer = answerText(exercise, question);
    const lines = evidenceLines(exercise, 'q', index);
    return {
      activityId: `question-${index + 1}`,
      answer,
      explanation: `The answer is stated or directly established in line${lines.length === 1 ? '' : 's'} ${lines.join(', ')}.`,
      evidenceLines: lines,
    };
  });
  const trueFalse = (exercise.trueFalse || []).map((item, index) => {
    const lines = evidenceLines(exercise, 'tf', index);
    return {
      activityId: `true-false-${index + 1}`,
      answer: item.answer ? 'True' : 'False',
      explanation: item.explanation,
      evidenceLines: lines,
    };
  });
  return [...questions, ...trueFalse];
}

export function editorializeLegacy(exercise) {
  if (exercise.status !== undefined) return exercise;
  const title = exercise.title;
  const vocabulary = exercise.vocabulary || [];
  const questions = exercise.questions || [];
  const tips = exercise.teacherTips || [];
  const questionPrompts = questions.map((question, index) => `Listen again and answer question ${index + 1}: ${question.q}`);
  const vocabPrompts = vocabulary.slice(0, 3).map(item => `Before listening, predict when you may hear “${item.word}” and explain it using the definition: ${item.definition}.`);
  const transcript = exercise.dialogue.map((line, index) => ({ ...line, line: index + 1 }));

  return {
    ...exercise,
    status: 'published',
    levelRationale: `${exercise.level.toUpperCase()} is retained from the existing catalogue classification. This lesson uses the dialogue, vocabulary and comprehension tasks already provided for “${title}”.`,
    context: {
      setting: `A listening dialogue about ${title}.`,
      estimatedDuration: `${exercise.duration}; estimate based on the existing audio activity and follow-up tasks.`,
    },
    objectives: [
      `Identify the main situation in the ${title} dialogue after a first listen.`,
      `Locate answers to the existing comprehension questions after a second listen.`,
      `Use selected vocabulary from the dialogue in a short follow-up exchange.`,
    ],
    activities: {
      preListening: vocabPrompts.length ? vocabPrompts : ['Read the title and predict the situation before listening.'],
      global: [`Listen once without reading and state the main situation described in the summary: ${exercise.summary}`],
      detailed: questionPrompts.length ? questionPrompts : ['Listen again and note two details you can verify in the transcript.'],
      extension: tips.length ? [tips[tips.length - 1]] : ['Use one phrase from the dialogue in a short pair exchange.'],
    },
    transcript,
    answerKey: editorialAnswerKey(exercise),
    teacherGuide: {
      procedure: [
        `Before listening: use the existing vocabulary for ${title}; do not pre-teach every word.`,
        'First listen: play the existing audio without the transcript and check the main situation.',
        'Second listen: learners complete the existing questions and then verify each answer against the transcript.',
        'Feedback: require learners to point to the transcript line that supports an answer.',
      ],
      differentiation: [
        'Support: allow learners to use the vocabulary list and transcript on the second listen.',
        'Stretch: ask learners to paraphrase one answer using a different phrase from the dialogue.',
      ],
      followUp: tips.length ? [tips[tips.length - 1]] : ['Ask learners to reuse one dialogue phrase in a relevant pair exchange.'],
    },
    printable: { studentSheet: false, teacherSheet: false },
    review: { status: 'automated-migration-pending-human-review' },
    updatedAt: '2026-10-28',
    publishedAt: '2026-10-28',
  };
}

