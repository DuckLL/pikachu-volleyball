// Smoke test for every AI engine in src/resources/js/engines: play AI vs AI
// through the real shims (ui.js replaced by a DOM-free stand-in) and check
// that rounds keep ending with finite positions under different settings.
//
// Run: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
);
const jsDir = path.join(root, 'src/resources/js');

// The game's sources are ES modules without "type": "module", so copy the
// pieces the engines need into a scratch package that has it.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pika-engines-'));
fs.writeFileSync(path.join(scratch, 'package.json'), '{"type": "module"}');
fs.cpSync(path.join(jsDir, 'engines'), path.join(scratch, 'js/engines'), {
  recursive: true,
});
fs.copyFileSync(
  path.join(jsDir, 'physics.js'),
  path.join(scratch, 'js/physics.js')
);
fs.copyFileSync(path.join(jsDir, 'rand.js'), path.join(scratch, 'js/rand.js'));
fs.writeFileSync(
  path.join(scratch, 'js/ui.js'),
  `export var SkillTypeForPlayer1Available = Array(10).fill(true);
export var SkillTypeForPlayer2Available = Array(8).fill(true);
export var capability = { serve: false, fancy: true, block: true, diving: true, anti_block: true, early_ball: false, jump: false };
export var delay = 0;
export var defense = 4;
export function configure(caps, newDelay, newDefense) {
  capability = { ...caps };
  delay = newDelay;
  defense = newDefense;
}
`
);
test.after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const load = (rel) => import(pathToFileURL(path.join(scratch, 'js', rel)).href);
const { AI_ENGINES } = await load('engines/index.js');
const { configure } = await load('ui.js');
const { setCustomRng } = await load('rand.js');

/** Deterministic RNG so a failure can be reproduced. */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ui.js's defaults
const DEFAULT_CAPS = {
  serve: false,
  fancy: true,
  block: true,
  diving: true,
  anti_block: true,
  early_ball: false,
  jump: false,
};
const SETTINGS = [
  { name: 'defaults', caps: DEFAULT_CAPS, delay: 0, defense: 4 },
  {
    name: 'everything on, mirror defense, delay 3',
    caps: {
      serve: true,
      fancy: true,
      block: true,
      diving: true,
      anti_block: true,
      early_ball: true,
      jump: true,
    },
    delay: 3,
    defense: 2,
  },
  {
    name: 'everything off, centre defense',
    caps: {
      serve: false,
      fancy: false,
      block: false,
      diving: false,
      anti_block: false,
      early_ball: false,
      jump: false,
    },
    delay: 10,
    defense: 0,
  },
];

const ROUNDS = 8;
const MAX_FRAMES_PER_ROUND = 3000;

function play(engineModule, seed) {
  setCustomRng(mulberry32(seed));
  const physics = new engineModule.PikaPhysics(true, true);
  const scores = [0, 0];
  let stalled = 0;
  let stuck = 0;
  let isPlayer2Serve = false;
  for (let round = 0; round < ROUNDS; round++) {
    physics.player1.initializeForNewRound();
    physics.player2.initializeForNewRound();
    physics.ball.initializeForNewRound(isPlayer2Serve);
    let ended = false;
    let crossings = 0;
    let onLeft = physics.ball.x < 216;
    for (let frame = 0; frame < MAX_FRAMES_PER_ROUND; frame++) {
      const inputs = [0, 1].map(() => ({
        xDirection: 0,
        yDirection: 0,
        powerHit: 0,
      }));
      let touched = physics.runEngineForNextFrame(inputs);
      if (Array.isArray(touched)) touched = touched[0];
      for (const value of [
        physics.ball.x,
        physics.ball.y,
        physics.player1.x,
        physics.player2.x,
      ]) {
        assert.ok(
          Number.isFinite(value),
          `non-finite position in round ${round} frame ${frame}`
        );
      }
      if (physics.ball.x < 216 !== onLeft) {
        onLeft = !onLeft;
        crossings++;
      }
      if (touched) {
        // As in pikavolley.js: landing on player 1's side scores for player 2.
        isPlayer2Serve = physics.ball.punchEffectX < 216;
        scores[isPlayer2Serve ? 1 : 0]++;
        ended = true;
        break;
      }
    }
    if (!ended) {
      stalled++;
      // Hitting the cap mid-rally is fine; hitting it with the ball not
      // going back and forth means the game got stuck.
      if (crossings < 2) stuck++;
    }
  }
  return { scores, stalled, stuck };
}

for (const engine of AI_ENGINES) {
  test(`AI ${engine.id} plays AI vs AI without errors`, async () => {
    const engineModule = await engine.load();
    // Released engines log every frame; keep the test output readable.
    const log = console.log;
    console.log = () => {};
    try {
      for (const [i, setting] of SETTINGS.entries()) {
        configure(setting.caps, setting.delay, setting.defense);
        const { scores, stalled, stuck } = play(engineModule, 1000 + i);
        // Rounds may end fast (a strong attack) or rally past the frame cap
        // (4.0-4.2 with everything off do); neither is a failure. A round
        // stuck with the ball not moving between the sides is.
        assert.equal(
          stuck,
          0,
          `${setting.name}: ${stuck} round(s) stuck (${
            scores[0] + scores[1]
          } ended, ${stalled} hit the cap)`
        );
      }
    } finally {
      console.log = log;
      configure(DEFAULT_CAPS, 0, 4);
    }
  });
}

test('every extracted engine is byte-identical to its git tag', (t) => {
  for (const engine of AI_ENGINES) {
    const file = path.join(jsDir, 'engines', `v${engine.id}`, 'physics.js');
    const source = fs.existsSync(file) ? file : path.join(jsDir, 'physics.js');
    let tagged;
    try {
      tagged = execFileSync(
        'git',
        ['show', `${engine.tag}:src/resources/js/physics.js`],
        {
          cwd: root,
          encoding: 'utf8',
          maxBuffer: 64 << 20,
        }
      );
    } catch {
      t.skip(`tag ${engine.tag} not available (shallow clone?)`);
      return;
    }
    assert.equal(
      fs.readFileSync(source, 'utf8'),
      tagged,
      fs.existsSync(file)
        ? `engines/v${engine.id}/physics.js differs from ${engine.tag}; rerun node scripts/extract-engines.mjs`
        : `main's physics.js changed since ${engine.tag}; run node scripts/extract-engines.mjs (main's engine is then listed as "dev")`
    );
  }
});
