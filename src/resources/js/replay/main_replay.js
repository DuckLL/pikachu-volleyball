/**
 * Entry point of the replay viewer page (src/replay/index.html)
 */
'use strict';
import '../utils/console_log_switch.js'; // first, so it covers everything below
import { replaySaver } from './replay_saver.js';
import { setUpUI } from './ui_replay.js';

// The game records its own inputs as it plays (for "Save replay"); a replay
// being watched has nothing to record, and seeking would grow it every time.
replaySaver.recordInputs = () => {};

setUpUI();
