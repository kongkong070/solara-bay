// Solara Bay entrypoint: hands game/ and screenshots/ to the grader's
// /output and writes the dossier buildDossier computes from them.
// Runs on Node 22 with the standard library only; no install, no network.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function fail(message) {
  console.error('main.ts: ' + message);
  process.exit(1);
}

const gameDir = join(here, 'game');
const shotDir = join(here, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) {
  fail('game/index.html is missing');
}
if (!existsSync(join(gameDir, 'src', 'main.js'))) {
  fail('game/src/main.js is missing');
}
if (!existsSync(join(gameDir, 'src', 'boats.js'))) {
  fail('game/src/boats.js is missing');
}
if (!existsSync(shotDir)) {
  fail('screenshots/ is missing');
}

mkdirSync(outDir, { recursive: true });
rmSync(join(outDir, 'game'), { recursive: true, force: true });
rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('main.ts: dossier written to ' + join(outDir, 'dossier.json'));
