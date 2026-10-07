# Pikachu Volleyball with new AI

The original JavaScript version of Pikachu Volleyball is developed by gorisanson.

This is a modified version with new AI.  
There are many skills in new AI, such as super serve/receive, dynamic defense and predict attack.  
You can turn off serve options below to reduce difficulty.  
The 2 players mode is change to AI vs. AI. You can watch a top game in this mode.  
Thank pxter7777 for the serve machine. Thank CBKM for testing.  

You can play this game on the website: https://pika.duckll.tw/

## AI versions

Every released AI can be played with the current game: pick it under "AI Version" in the menu bar, or open `/en/?ai=<version>` (for example `/en/?ai=4.2`). The choice is remembered. Switching during a game asks first, since it restarts the game and clears the score and the replay record. Settings the selected AI does not read are greyed out (1.0–2.0 have none; 4.2 added anti-block and early ball; 6.0 added defense mode and delay).

Each release is a git tag `vX.Y.YYYYMMDD`. The engine of a release is that tag's `src/resources/js/physics.js`, copied into `src/resources/js/engines/vX.Y/` (byte for byte, except that 1.0–3.0's AI is moved off the seeded RNG; see "Replay viewer") together with a small generated `ui.js` that maps today's settings onto the names that engine reads. `src/_redirects` is generated from the same tags: the old `/version/<code>/` builds and the `/version.html` list are gone, and their links now open today's game (with that AI).

To release a new version:

```sh
git tag -a v9.0.20270101 -m "Pikachu Volleyball Super AI 9.0.20270101"
node scripts/extract-engines.mjs   # regenerates engines/ and _redirects
npm test                           # AI-vs-AI smoke test of every engine, plus the regression tests
npm run build
git push && git push --tags
```

`npm test` also fails when main's `physics.js` has changed since the newest tag; running the extract script fixes that by listing main's engine as `dev`.

Until main's `physics.js` changes after a tag, the newest tag is served by `physics.js` itself; once it does, the tag is extracted like the others and main's engine shows up as `dev`.

### Replay viewer

`/en/replay/` (also `/zh/replay/` and `/ko/replay/`; `/replay/` redirects to English) plays replay files: this game's "Save replay" files and the P2P online version's alike. It is the P2P online version's replay viewer, on this game's modules: the same controls, chat, nicknames and IPs, plus the analysis overlay from DuckLL's `predict` branch of the P2P fork, each part switchable: "Path" (where the ball is going), "Predict" (the six paths it could take after a hit) and "Hitboxes" (players and net pillar). Space plays/pauses, ←/→ seek 3 seconds.

A replay is the recorded inputs fed through `physics.js` with the game's RNG seed, nobody computer controlled. The ball and the players move the same in every version and in the P2P game, so one engine plays every file. For that to hold, the AI must never draw from the seeded RNG (it uses `true_rand()`): 1.0–3.0 did, so the extract script rewrites their AI's `rand()` calls (`scripts/engine_transform.mjs`), and a test records a game with every engine and checks the replay frame by frame.

### Console logging

The AI engines call `console.log` every frame (logging only occasionally made play stutter). `console.log` is off by default; open the game with `?log=1` to turn it on, `?log=0` to turn it off again. The choice is remembered. The default is in `src/resources/js/utils/console_log_switch.js`.

---

# Pikachu Volleyball

_&check;_ _English_ | [_Korean(한국어)_](README.ko.md)

Pikachu Volleyball (対戦ぴかちゅ～　ﾋﾞｰﾁﾊﾞﾚｰ編) is an old Windows game that was developed by "(C) SACHI SOFT / SAWAYAKAN Programmers" and "(C) Satoshi Takenouchi" in 1997. The source code on this repository was obtained by reverse engineering the core parts of the machine code &mdash; including the physics engine and the AI &mdash; of the original game and reimplementing them in JavaScript.

You can play this game on the website: https://gorisanson.github.io/pikachu-volleyball/en/

<img src="src/resources/assets/images/screenshot.png" alt="Pikachu Volleyball game screenshot" width="648">

## How to run locally

1. Clone this repository and get into the directory.

```sh
git clone https://github.com/gorisanson/pikachu-volleyball.git
cd pikachu-volleyball
```

2. Install dependencies. (If errors occur, you can try with `node v16` and `npm v8`.)

```sh
npm install
```

3. Bundle the code.

```sh
npm run build
```

4. Run a local web server.

```sh
npx http-server dist
```

5. Connect to the local web server on a web browser. (In most cases, the URL for connecting to the server would be `http://localhost:8080`. For the exact URL, it is supposed to be found on the printed messages on your terminal.)

## Game structure

- Physics Engine: The physics engine, which calculates the position of the ball and the players (Pikachus), is contained in the file [`src/resources/js/physics.js`](src/resources/js/physics.js). (This file also containes the AI which determines the keyboard input of the computer when you are playing against your computer.) This source code file is gained by reverse engineering the function at the address 00403dd0 of the machine code of the original game.

- Rendering: [PixiJS](https://github.com/pixijs/pixi.js) library is used for rendering the game.

Refer comments on [`src/resources/js/main.js`](src/resources/js/main.js) for other details.

## Methods used for reverse engineering

The main tools used for reverse engineering are following.

- [Ghidra](https://ghidra-sre.org/)
- [Cheat Engine](https://www.cheatengine.org/)
- [OllyDbg](http://www.ollydbg.de/)
- [Resource Hacker](http://www.angusj.com/resourcehacker/)

[Ghidra](https://ghidra-sre.org/) is used for decompiling the machine code to C code. At first look, the decompiled C code looked incomprehensible. One of the reason was that the variable names (`iVar1`, `iVar2`, ...) and function names (`FUN_00402dc0`, `FUN_00403070`, ...) in the decompiled C code are meaningless. But, with the aid of [Cheat Engine](https://www.cheatengine.org/), I could find the location of some significant variables &mdash; x, y coordinate of the ball and the players. And reading from the location of the variables, the decompiled C code was comprehensible! [OllyDbg](http://www.ollydbg.de/) was used for altering a specific part of the machine code. For example, to make slower version of the game so that it would be easier to count the number of frames of "Ready?" message on the start of new round in the game. [Resource Hacker](http://www.angusj.com/resourcehacker/) was used for extract the assets (sprites and sounds) of the game.

## An intended deviation from the original game

If there is no keyboard input, AI vs AI match is started after a while. In the original game, the match lasts only for about 40 seconds. But in this JavaScript version, there's no time limit to the AI vs AI match so you can watch it as long as you want.
