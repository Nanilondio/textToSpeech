import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { editorializeLegacy, EVIDENCE_LINES } from './legacy-editorial.mjs';

const files = readdirSync('data/exercises').flatMap(level =>
  readdirSync(`data/exercises/${level}`)
    .filter(file => file.endsWith('.json'))
    .map(file => `data/exercises/${level}/${file}`));

let exercises = 0;
let questions = 0;
for (const file of files) {
  const source = JSON.parse(readFileSync(file, 'utf8'));
  const exercise = editorializeLegacy(source);
  exercises += 1;

  assert.ok(Array.isArray(source.dialogue) && source.dialogue.length, `${source.slug}: dialogue missing`);
  for (const question of source.questions || []) {
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.options.length,
      `${source.slug}: invalid answer index`);
    questions += 1;
  }
  assert.deepEqual(exercise.transcript.map(line => ({ speaker: line.speaker, text: line.text })), source.dialogue,
    `${source.slug}: transcript changes dialogue`);

  if (source.status === undefined) {
    const mapping = EVIDENCE_LINES[source.slug];
    assert.ok(mapping, `${source.slug}: evidence mapping missing`);
    assert.equal(exercise.answerKey.length, (source.questions?.length || 0) + (source.trueFalse?.length || 0),
      `${source.slug}: answer key count mismatch`);
    for (const answer of exercise.answerKey) {
      assert.ok(answer.evidenceLines.length, `${source.slug}/${answer.activityId}: empty evidence`);
      for (const line of answer.evidenceLines) {
        assert.ok(source.dialogue[line - 1], `${source.slug}/${answer.activityId}: invalid evidence line ${line}`);
      }
    }
  }
}

console.log(`editorial quality tests passed: ${exercises} exercises, ${questions} multiple-choice questions`);

