// Save and load for Solara Bay: one JSON blob in localStorage holding the
// run's progress. Saving never blocks play: a corrupt or missing save is
// treated as "no save yet".

import { SAVE_KEY } from './config.js';

export function saveGame(S) {
  if (S.shotMode) return false;
  try {
    const data = {
      v: 1,
      cash: Math.round(S.player.cash),
      hp: Math.round(S.player.hp),
      armor: Math.round(S.player.armor),
      ammo: S.player.ammo,
      difficulty: S.difficulty,
      hour: S.clock.hour,
      minute: S.clock.minute,
      missionsDone: S.missions.done.slice(),
      packagesTaken: S.city.packages.map((p) => (p.taken ? 1 : 0)),
      stats: { ...S.stats },
      x: Math.round(S.player.x),
      y: Math.round(S.player.y),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // A save that cannot be cleared is harmless.
  }
}
