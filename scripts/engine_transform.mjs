/**
 * The one change made to a released engine when it is extracted: AI
 * decisions must not draw from the game's seeded RNG.
 *
 * A replay is the recorded inputs fed through the physics with the same RNG
 * seed, and during a replay nobody is computer controlled, so the AI never
 * runs. Any rand() an AI decision consumed while recording therefore shifts
 * every later random number, and the ball takes a different bounce the next
 * time it lands exactly on a head (processCollisionBetweenBallAndPlayer), or
 * the clouds differ. 4.0 introduced replays and true_rand() for that reason;
 * 1.0-3.0 still call rand() in their AI.
 *
 * So every rand() outside the functions where the physics itself uses it
 * becomes true_rand(): same distribution, but not from the seeded RNG. For
 * 4.0 and later engines this changes nothing.
 */

/** Where the physics (not the AI) uses the seeded RNG, in every version. */
export const PHYSICS_RAND_FUNCTIONS = new Set([
  'initializeForNewRound',
  'processCollisionBetweenBallAndPlayer',
]);

/**
 * @param {string} source a released physics.js
 * @return {{source: string, replaced: number}}
 */
export function keepAIOffSeededRng(source) {
  let current = null;
  let replaced = 0;
  const lines = source.split('\n').map((line) => {
    const start = line.match(
      /^(?:export )?function (\w+)|^ {2}(\w+)\(.*\) \{$|^(?:export )?class (\w+)/
    );
    if (start) {
      current = start[1] || start[2] || start[3];
    }
    if (PHYSICS_RAND_FUNCTIONS.has(current)) {
      return line;
    }
    return line.replace(/(?<![\w.])rand\(\)/g, () => {
      replaced++;
      return 'true_rand()';
    });
  });
  let result = lines.join('\n');
  if (
    replaced > 0 &&
    !/import\s*{[^}]*\btrue_rand\b[^}]*}\s*from\s*'\.\/rand\.js'/.test(result)
  ) {
    const before = result;
    result = result.replace(
      /import\s*{\s*rand\s*}\s*from\s*'\.\/rand\.js';/,
      "import { rand, true_rand } from './rand.js';"
    );
    if (result === before) {
      throw new Error('could not add true_rand to the rand.js import');
    }
  }
  return { source: result, replaced };
}
