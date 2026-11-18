// Save and continue: localStorage only, no server, no account.
const KEY = 'solara-bay-save-v1';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function writeSave(game) {
  try {
    const data = {
      cash: game.player.cash,
      missions: game.missions.completed,
      packages: game.world.packages.map((p) => p.taken),
      pickups: game.world.pickups.map((p) => p.taken),
      stats: game.stats,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    // Storage full or blocked: the game still plays, it just cannot save.
  }
}

export function applySave(game, save) {
  game.player.cash = save.cash;
  game.missions.completed = save.missions || 0;
  game.missions.index = save.missions || 0;
  if (Array.isArray(save.packages)) {
    save.packages.forEach((taken, i) => {
      if (taken && game.world.packages[i]) game.world.packages[i].taken = true;
    });
  }
  if (Array.isArray(save.pickups)) {
    save.pickups.forEach((taken, i) => {
      if (taken && game.world.pickups[i]) game.world.pickups[i].taken = true;
    });
  }
  if (save.stats) Object.assign(game.stats, save.stats);
}

export function saveSummaryText(save) {
  if (!save) return '';
  return '$' + Math.round(save.cash).toLocaleString('en-US') + ' • ' + (save.missions || 0) + '/8 missions';
}
