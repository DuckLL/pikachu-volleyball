const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '../src/resources/js/ui.js'),
  'utf8'
);
const managerSource = source.slice(
  source.indexOf('const pauseResumeManager ='),
  source.indexOf('/**\n * Set up the user interface')
);

test('closing touch settings preserves an earlier manual pause', () => {
  const manager = vm.runInNewContext(`${managerSource}\npauseResumeManager;`);
  const game = { paused: false };
  const manual = 3;
  const settings = 4;

  manager.pause(game, manual);
  manager.pause(game, settings);
  manager.resume(game, settings);
  assert.equal(game.paused, true);

  manager.resume(game, manual);
  assert.equal(game.paused, false);

  manager.pause(game, settings);
  assert.equal(game.paused, true);
  manager.resume(game, settings);
  assert.equal(game.paused, false);
});
