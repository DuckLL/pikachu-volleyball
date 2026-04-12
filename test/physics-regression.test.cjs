const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const physicsPath = path.join(
  __dirname,
  '..',
  'src',
  'resources',
  'js',
  'physics.js'
);
const physicsSource = fs.readFileSync(physicsPath, 'utf8');
const zhIndexPath = path.join(__dirname, '..', 'src', 'zh', 'index.html');
const enIndexPath = path.join(__dirname, '..', 'src', 'en', 'index.html');
const koIndexPath = path.join(__dirname, '..', 'src', 'ko', 'index.html');
const zhIndexSource = fs.readFileSync(zhIndexPath, 'utf8');
const enIndexSource = fs.readFileSync(enIndexPath, 'utf8');
const koIndexSource = fs.readFileSync(koIndexPath, 'utf8');
const uiPath = path.join(__dirname, '..', 'src', 'resources', 'js', 'ui.js');
const uiSource = fs.readFileSync(uiPath, 'utf8');

test('physics engine no longer logs ball state every frame', () => {
  assert.doesNotMatch(
    physicsSource,
    /console\.log\(ball\.x,\s*ball\.y,\s*ball\.xVelocity,\s*ball\.yVelocity\);/
  );
});

test('AI movement target falls back to current player position', () => {
  assert.match(
    physicsSource,
    /let virtualExpectedLandingPointX = player\.x;/
  );
});

test('physics engine calculates the landing prediction once before player movement', () => {
  assert.match(
    physicsSource,
    /const isBallTouchingGround =\s+processCollisionBetweenBallAndWorldAndSetBallPosition\(ball\);\s+\s*calculateExpectedLandingPointXFor\(ball\);/
  );
  assert.doesNotMatch(
    physicsSource,
    /for \(let i = 0; i < 2; i\+\+\) \{[\s\S]*?calculateExpectedLandingPointXFor\(ball\);[\s\S]*?processPlayerMovementAndSetPlayerPosition/
  );
});

test('serve machine picks directly from the available skill pool', () => {
  assert.match(
    physicsSource,
    /this\.usingFullSkill =\s+availableSkills\[Math\.floor\(Math\.random\(\) \* availableSkills\.length\)\];/
  );
});

test('serve machine handles fully disabled skill lists without an infinite loop', () => {
  assert.match(
    physicsSource,
    /const availableSkills = this\.skillList\.filter\(\(skillIndex\) =>[\s\S]*?availableSkills\.length === 0/
  );
});

test('physics AI avoids ambiguous chained comparison expressions', () => {
  assert.doesNotMatch(physicsSource, /player\.isPlayer2 === ball\.xVelocity [<>] 0/);
  assert.doesNotMatch(physicsSource, /copyball\.xVelocity [<>] 0 === player\.isPlayer2/);
  assert.doesNotMatch(physicsSource, /predictball\.x < copyball\.x === player\.isPlayer2/);
  assert.doesNotMatch(physicsSource, /player\.isPlayer2 === copyball\.x > predictball\.x/);
  assert.doesNotMatch(
    physicsSource,
    /ball\.expectedLandingPointX > player\.x === ball\.x > player\.x/
  );
});

test('physics AI helper semantics preserve player-side comparisons', () => {
  assert.match(
    physicsSource,
    /function matchesNegativeVelocityForPlayerSide\(player, xVelocity\) {\s+const isNegativeVelocity = xVelocity < 0;\s+return isNegativeVelocity === player\.isPlayer2;\s+}/
  );
  assert.match(
    physicsSource,
    /function matchesPositiveVelocityForPlayerSide\(player, xVelocity\) {\s+const isPositiveVelocity = xVelocity > 0;\s+return isPositiveVelocity === player\.isPlayer2;\s+}/
  );
  assert.match(
    physicsSource,
    /function isTargetInFrontOfOriginForPlayer\(player, originX, targetX\) {\s+const isTargetInFront = targetX < originX;\s+return isTargetInFront === player\.isPlayer2;\s+}/
  );
});

test('other-player Y prediction is split by engine-order state', () => {
  assert.match(
    physicsSource,
    /function otherPlayerYpredictBeforeMove\(otherPlayer, frame\) {/
  );
  assert.match(
    physicsSource,
    /function otherPlayerYpredictAfterMove\(otherPlayer, frame\) {/
  );
  assert.match(
    physicsSource,
    /function otherPlayerYpredictByEngineOrder\(otherPlayer, frame\) {\s+return otherPlayer\.isPlayer2\s+\?\s+otherPlayerYpredictBeforeMove\(otherPlayer, frame\)\s+:\s+otherPlayerYpredictAfterMove\(otherPlayer, frame\);\s+}/
  );
  assert.doesNotMatch(physicsSource, /function otherPlayerYpredict\(player, frame\) {/);
});

test('other-player already-moved Y prediction clamps to the ground', () => {
  assert.match(
    physicsSource,
    /function otherPlayerYpredictAfterMove\(otherPlayer, frame\) \{[\s\S]*if \(realY > PLAYER_TOUCHING_GROUND_Y_COORD\) \{\s*realY = PLAYER_TOUCHING_GROUND_Y_COORD;\s*\}[\s\S]*return realY;[\s\S]*\}/
  );
});

test('cantouch logic is split into self and other-player helpers', () => {
  assert.match(physicsSource, /function cantouchSelf\(player, copyball, frame\) {/);
  assert.match(
    physicsSource,
    /function cantouchOtherPlayer\(otherPlayer, copyball, frame\) {/
  );
  assert.doesNotMatch(physicsSource, /function cantouch\(player, copyball, frame\) {/);
});

test('AI touch prediction uses the split self and other-player helpers', () => {
  assert.match(
    physicsSource,
    /!sameside\(theOtherPlayer, copyball\.x\)\s*&&\s*cantouchSelf\(player, copyball, frame\)/
  );
  assert.match(
    physicsSource,
    /if \(cantouchOtherPlayer\(theOtherPlayer, copyball, frame\)\) \{/
  );
});

test('canblock logic uses one other-player helper', () => {
  assert.match(
    physicsSource,
    /function canblockOtherPlayer\(otherPlayer, predict\) {/
  );
  assert.doesNotMatch(physicsSource, /function canblockPredictOtherPlayer\(otherPlayer, predict\) {/);
  assert.doesNotMatch(physicsSource, /function canblockSelf\(player, predict\) {/);
  assert.doesNotMatch(physicsSource, /function canblock\(player, predict\) {/);
});

test('canblock helper checks the entry frame and uses a single net range', () => {
  assert.match(
    physicsSource,
    /function canblockOtherPlayer\(otherPlayer, predict\) \{[\s\S]*if \(sameside\(otherPlayer, predict\[frame\]\.x\)\) \{[\s\S]*if \(first\) \{[\s\S]*first = false;[\s\S]*\}[\s\S]*if \(Math\.abs\(predict\[frame\]\.x - GROUND_HALF_WIDTH\) > 80\) \{/
  );
  assert.match(
    physicsSource,
    /function canblockOtherPlayer\(otherPlayer, predict\) \{[\s\S]*if \(first\) \{[\s\S]*first = false;\s*\}[\s\S]*if \(Math\.abs\(predict\[frame\]\.x - GROUND_HALF_WIDTH\) > 80\) \{[\s\S]*return false;\s*\}[\s\S]*return false;\s*\}/
  );
  assert.doesNotMatch(
    physicsSource,
    /Math\.abs\(predict\[frame\]\.x - GROUND_HALF_WIDTH\) > 60/
  );
});

test('AI block prediction uses the consolidated other-player block helper', () => {
  assert.match(
    physicsSource,
    /canblockOtherPlayer\(\s*theOtherPlayer,\s*copyball\.predict\[player\.direction\]\s*\)/
  );
  assert.match(
    physicsSource,
    /direct > 3[\s\S]*!canblockOtherPlayer\(theOtherPlayer, predict\)/
  );
  assert.doesNotMatch(
    physicsSource,
    /canblockPredictOtherPlayer\(\s*theOtherPlayer,\s*copyball\.predict\[player\.direction\]\s*\)/
  );
  assert.doesNotMatch(
    physicsSource,
    /theOtherPlayer\.state === 0 \|\| theOtherPlayer\.yVelocity > 12/
  );
});

test('zh index includes restored graphic option controls', () => {
  assert.match(zhIndexSource, /id="graphic-submenu-btn"/);
  assert.match(zhIndexSource, /id="graphic-sharp-btn"/);
  assert.match(zhIndexSource, /id="graphic-soft-btn"/);
  assert.match(zhIndexSource, /id="reset-to-default-btn"/);
});

test('en index includes restored graphic option controls', () => {
  assert.match(enIndexSource, /id="graphic-submenu-btn"/);
  assert.match(enIndexSource, /id="graphic-sharp-btn"/);
  assert.match(enIndexSource, /id="graphic-soft-btn"/);
  assert.match(enIndexSource, /id="reset-to-default-btn"/);
});

test('ko index includes restored graphic option controls', () => {
  assert.match(koIndexSource, /id="graphic-submenu-btn"/);
  assert.match(koIndexSource, /id="graphic-sharp-btn"/);
  assert.match(koIndexSource, /id="graphic-soft-btn"/);
  assert.match(koIndexSource, /id="reset-to-default-btn"/);
});

test('ui.js wires restored graphic controls, persistence, and reset behavior', () => {
  assert.match(
    uiSource,
    /document\.getElementById\('game-canvas'\)\.classList\.remove\('graphic-soft'\)/
  );
  assert.match(
    uiSource,
    /document\.getElementById\('game-canvas'\)\.classList\.add\('graphic-soft'\)/
  );
  assert.match(
    uiSource,
    /localStorage\.getItem\('pv-offline-graphic'\)/
  );
  assert.match(
    uiSource,
    /localStorage\.setItem\('pv-offline-graphic',\s*options\.graphic\)/
  );
  assert.match(
    uiSource,
    /document\s*\.\s*getElementById\('reset-to-default-btn'\)\s*\.\s*addEventListener\('click'/
  );
});
