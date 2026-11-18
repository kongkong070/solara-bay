// Save and load: the run's cash, story progress, packages, difficulty
// and totals live in localStorage under one key.
const SAVE_KEY = 'solara-bay-save-v1';

export function saveGame(game) {
  try {
    const data = {
      version: 1,
      cash: game.player.cash,
      health: game.player.health,
      armor: game.player.armor,
      ammo: game.player.ammo,
      difficulty: game.difficultyKey,
      missionIndex: game.missions.index,
      missionsDone: game.missions.done,
      packagesTaken: game.missions.packages.map((p) => p.taken),
      earned: game.missions.earned,
      faresDone: game.missions.faresDone,
      bestWanted: game.police.bestWanted,
      timePlayed: game.timePlayed,
      clockMinutes: game.clockMinutes,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    // Storage may be unavailable (private mode); the game plays on.
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function applySave(game, data) {
  if (!data) return;
  game.player.cash = data.cash ?? game.player.cash;
  game.player.health = data.health ?? game.player.health;
  game.player.armor = data.armor ?? game.player.armor;
  game.player.ammo = data.ammo ?? game.player.ammo;
  game.missions.index = data.missionIndex ?? 0;
  game.missions.done = data.missionsDone ?? [];
  game.missions.earned = data.earned ?? 0;
  game.missions.faresDone = data.faresDone ?? 0;
  game.police.bestWanted = data.bestWanted ?? 0;
  game.timePlayed = data.timePlayed ?? 0;
  game.clockMinutes = data.clockMinutes ?? game.clockMinutes;
  if (Array.isArray(data.packagesTaken)) {
    data.packagesTaken.forEach((taken, i) => {
      if (game.missions.packages[i]) game.missions.packages[i].taken = !!taken;
    });
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Ignore storage errors.
  }
}
