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
    /function matchesNegativeVelocityForPlayerSide\(player, xVelocity\) {\s+return \(xVelocity < 0\) === player\.isPlayer2;\s+}/
  );
  assert.match(
    physicsSource,
    /function matchesPositiveVelocityForPlayerSide\(player, xVelocity\) {\s+return \(xVelocity > 0\) === player\.isPlayer2;\s+}/
  );
  assert.match(
    physicsSource,
    /function isTargetInFrontOfOriginForPlayer\(player, originX, targetX\) {\s+return \(targetX < originX\) === player\.isPlayer2;\s+}/
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

test('canblock logic keeps only the other-player helper', () => {
  assert.match(
    physicsSource,
    /function canblockOtherPlayer\(otherPlayer, predict\) {/
  );
  assert.doesNotMatch(physicsSource, /function canblockSelf\(player, predict\) {/);
  assert.doesNotMatch(physicsSource, /function canblock\(player, predict\) {/);
});

test('canblockPredict logic keeps only the other-player helper', () => {
  assert.match(
    physicsSource,
    /function canblockPredictOtherPlayer\(otherPlayer, predict\) {/
  );
  assert.doesNotMatch(
    physicsSource,
    /function canblockPredictSelf\(player, predict\) {/
  );
  assert.doesNotMatch(
    physicsSource,
    /function canblockPredict\(player, predict\) {/
  );
});

test('AI block prediction uses the split other-player block helpers', () => {
  assert.match(
    physicsSource,
    /canblockPredictOtherPlayer\(\s*theOtherPlayer,\s*copyball\.predict\[player\.direction\]\s*\)/
  );
  assert.match(
    physicsSource,
    /direct > 3[\s\S]*!canblockPredictOtherPlayer\(theOtherPlayer, predict\)/
  );
  assert.match(
    physicsSource,
    /canblockOtherPlayer\(\s*theOtherPlayer,\s*copyball\.predict\[player\.direction\]\s*\)/
  );
  assert.match(
    physicsSource,
    /\|\|[\s\S]*!canblockOtherPlayer\(theOtherPlayer, predict\)/
  );
});
