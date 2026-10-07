/**
 * Entry point of the replay viewer pages (src/en/replay/, src/ko/replay/)
 */
import '../utils/console_log_switch.js'; // first, so it covers everything below
import { ASSETS_PATH } from '../assets_path.js';
import { replaySaver } from './replay_saver.js';
import { setUpUI } from './ui_replay.js';

// The game records its own inputs as it plays (for "Save replay"); a replay
// being watched has nothing to record, and seeking would grow it every time.
replaySaver.recordInputs = () => {};

adjustAssetsPath();
setUpUI();

/**
 * Adjust game assets path to the path from the perspective of en/replay/index.html
 */
function adjustAssetsPath() {
  ASSETS_PATH.SPRITE_SHEET = '../' + ASSETS_PATH.SPRITE_SHEET;
  for (const prop in ASSETS_PATH.SOUNDS) {
    ASSETS_PATH.SOUNDS[prop] = '../' + ASSETS_PATH.SOUNDS[prop];
  }
}
