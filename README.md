# solara-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kongkong070/solara-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kongkong070/solara-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solara Bay** — an open-world crime game in the spirit of GTA 6, built from scratch in plain HTML5 Canvas and JavaScript. You are Rio Vega, a driver new to the sun-soaked coastal city of Solara Bay. Steal cars, outrun the SBPD, run six story missions for Lena Cruz, drive taxi fares, and hunt 12 hidden cash packages — all offline, in your browser, with no build step and no network requests.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` through any static server. The game is only static files under `game/`.

## How to play

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive a car |
| E | Enter / exit a car, hail a taxi |
| F | Punch |
| Mouse | Aim and shoot (click), R reload |
| Space | Handbrake |
| Shift | Sprint |
| M | Start the next story mission |
| C | Change radio station (while driving) |
| P / Esc | Pause |
| Q | Mute |

## What's in the city

- **Open world**: a 3400×2600 coastal grid city — avenues, parks, a beach with a pier, docks, a stadium and a marina, with traffic and pedestrians living their own lives.
- **Driving**: arcade car physics with drift and handbrake; sedans, taxis, sports cars, trucks, vans and coupes to steal and drive.
- **Wanted system**: five stars. Steal a car, hit a pedestrian or open fire and the SBPD sends interceptors and foot cops; hide to cool the heat, or get busted.
- **Story**: six missions — *Welcome to Solara*, *Wheels Up*, *Special Delivery*, *The Getaway*, *Harbor Heist* and *King of Solara* — with timers, chases and a finale at the Marina Penthouse.
- **Side work**: taxi fares and 12 hidden cash packages worth $250 each.
- **HUD**: wanted stars, cash, health and armour, ammo, clock, speedometer, radio, objective banner and a live minimap with mission, police and fare blips.
- **Feel**: synthesised WebAudio sound — engine hum, sirens, gunshots and three radio stations — plus particles, skid feedback and a save that continues your run.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game itself, staged deterministically with `?shot=chase|mission|start|night` (see `shots.json` and `game/src/shots.js`).

## Structure

- `game/index.html` — the page; `game/src/main.js` — boot and game loop
- `game/src/world.js` — city generation and collision
- `game/src/player.js` — Rio on foot and behind the wheel
- `game/src/vehicles.js` — car physics and traffic AI
- `game/src/peds.js` — pedestrians
- `game/src/police.js` — wanted levels and the SBPD
- `game/src/missions.js` — story missions and taxi fares
- `game/src/render.js` — the city, the HUD, the minimap and the menus
- `game/src/audio.js` — synthesised sound and radio
- `game/src/input.js`, `game/src/save.js`, `game/src/shots.js`, `game/src/config.js`, `game/src/random.js`
- `main.ts` — hands `game/` and `screenshots/` to the grader's `/output` with a dossier

## Notes

Everything here is original: the city, the names, the story, the art and the sounds are made for this game. No Rockstar Games content, no borrowed assets, no copied code.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1cpdpcxn&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
