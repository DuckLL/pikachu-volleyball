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
