import assert from 'node:assert/strict';
import { validateExercises } from './content-validator.mjs';

const legacy = { slug: 'old', title: 'Old', level: 'a1', dialogue: [{ speaker: '1', text: 'Hi' }] };
const draft = { ...legacy, slug: 'draft', status: 'draft' };
const valid = {
  ...legacy,
  slug: 'published', status: 'published', description: 'A complete lesson.', topic: 'test',
  levelRationale: 'Short, familiar language.', publishedAt: '2026-10-26', updatedAt: '2026-10-26',
  context: { setting: 'classroom' }, objectives: [{ text: 'Identify the greeting.' }],
  transcript: [{ speaker: '1', text: 'Hi', line: 1 }],
  activities: { preListening: [{}], global: [{}], detailed: [{}], extension: [{}] },
  answerKey: [{ activityId: 'q1', explanation: 'The speaker says Hi.', evidenceLines: [1] }],
  teacherGuide: { procedure: [{}], followUp: [{}] }, printable: { studentSheet: true },
  review: { status: 'approved', author: 'Author', reviewer: 'Reviewer', reviewedAt: '2026-10-26' },
};

const result = validateExercises([legacy, draft, valid], { log: { warn() {} } });
assert.equal(result.published.length, 2);
assert.equal(result.warnings.length, 2);
assert.throws(() => validateExercises([{ ...valid, slug: 'bad', answerKey: [{ activityId: 'q1' }] }], { log: { warn() {} } }), /answerKey/);
assert.throws(() => validateExercises([{ ...valid, slug: 'bad-status', status: 'approved' }], { log: { warn() {} } }), /unsupported status/);
console.log('content-validator tests passed');
