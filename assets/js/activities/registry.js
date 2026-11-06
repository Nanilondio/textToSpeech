import { WordSearch } from './word-search.js';

const activities = new Map();

export function registerActivity(activity) {
  if (!activity?.id || typeof activity.mount !== 'function') {
    throw new TypeError('An activity must provide an id and mount(container, data, options).');
  }
  if (activities.has(activity.id)) throw new Error(`Activity "${activity.id}" is already registered.`);
  activities.set(activity.id, activity);
}

export function getActivities() {
  return [...activities.values()];
}

export function getActivity(id) {
  return activities.get(id) || null;
}

registerActivity({
  id: 'word-search',
  label: { en: 'Word Search', es: 'Sopa de letras' },
  mount: WordSearch.mount
});
