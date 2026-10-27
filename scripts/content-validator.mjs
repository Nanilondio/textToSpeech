const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0;
const isNonEmptyArray = value => Array.isArray(value) && value.length > 0;

const LEGACY_FIELDS = [
  'levelRationale', 'context', 'objectives', 'transcript', 'activities',
  'answerKey', 'teacherGuide', 'printable', 'review', 'publishedAt', 'updatedAt',
];

function hasPath(value, path) {
  return path.split('.').every(key => {
    if (value === null || value === undefined || !(key in Object(value))) return false;
    value = value[key];
    return true;
  });
}

function validatePublishedExercise(ex) {
  const errors = [];
  const requireString = (path) => {
    if (!hasPath(ex, path) || !isNonEmptyString(path.split('.').reduce((v, k) => v?.[k], ex))) errors.push(`${path} must be a non-empty string`);
  };
  const requireArray = (path) => {
    if (!hasPath(ex, path) || !isNonEmptyArray(path.split('.').reduce((v, k) => v?.[k], ex))) errors.push(`${path} must be a non-empty array`);
  };
  const requireBoolean = (path) => {
    if (!hasPath(ex, path) || typeof path.split('.').reduce((v, k) => v?.[k], ex) !== 'boolean') errors.push(`${path} must be a boolean`);
  };

  ['slug', 'title', 'description', 'level', 'topic', 'levelRationale', 'publishedAt', 'updatedAt'].forEach(requireString);
  requireString('context.setting');
  requireArray('objectives');
  requireArray('transcript');
  requireArray('activities.preListening');
  requireArray('activities.global');
  requireArray('activities.detailed');
  requireArray('activities.extension');
  requireArray('answerKey');
  requireArray('teacherGuide.procedure');
  requireArray('teacherGuide.followUp');
  requireBoolean('printable.studentSheet');

  if (!Array.isArray(ex.dialogue) || !ex.dialogue.length) errors.push('dialogue must be a non-empty array');
  if (Array.isArray(ex.dialogue) && Array.isArray(ex.transcript)) {
    const sameLength = ex.dialogue.length === ex.transcript.length;
    const sameText = sameLength && ex.dialogue.every((line, i) => line.speaker === ex.transcript[i].speaker && line.text === ex.transcript[i].text);
    if (!sameText) errors.push('transcript must match dialogue speaker and text order');
  }
  const transcriptLines = new Set((ex.transcript || []).map(line => line.line));
  for (const answer of ex.answerKey || []) {
    if (!isNonEmptyString(answer.activityId)) errors.push('answerKey entries require activityId');
    if (!isNonEmptyString(answer.explanation)) errors.push(`answerKey ${answer.activityId || '<unknown>'} requires explanation`);
    if (!Array.isArray(answer.evidenceLines) || !answer.evidenceLines.length || answer.evidenceLines.some(line => !transcriptLines.has(line))) {
      errors.push(`answerKey ${answer.activityId || '<unknown>'} requires evidenceLines present in transcript`);
    }
  }
  return errors;
}

export function validateExercises(exercises, { log = console } = {}) {
  const warnings = [];
  const published = [];
  const seen = new Set();
  for (const ex of exercises) {
    if (!isNonEmptyString(ex.slug)) throw new Error('Exercise is missing slug');
    if (seen.has(ex.slug)) throw new Error(`Duplicate exercise slug: ${ex.slug}`);
    seen.add(ex.slug);

    const status = ex.status || 'legacy';
    if (status === 'draft' || status === 'needs_review') {
      warnings.push(`${ex.slug}: excluded from public build because status=${status}`);
      continue;
    }
    if (status === 'published') {
      const errors = validatePublishedExercise(ex);
      if (errors.length) throw new Error(`Published exercise ${ex.slug} is invalid:\n${errors.map(error => `- ${error}`).join('\n')}`);
      published.push(ex);
      continue;
    }
    if (status !== 'legacy') throw new Error(`${ex.slug}: unsupported status ${status}`);
    const missing = LEGACY_FIELDS.filter(field => !hasPath(ex, field));
    warnings.push(`${ex.slug}: legacy exercise; missing editorial fields: ${missing.join(', ')}`);
    published.push(ex);
  }
  for (const warning of warnings) log.warn(`[content] ${warning}`);
  return { published, warnings };
}

