/**
 * Controls of the replay viewer page (src/replay/index.html).
 * Ported from the P2P online version's replay viewer
 * (gorisanson/pikachu-volleyball-p2p-online), minus chat, nicknames and IPs,
 * plus the physics engine select and the analysis overlay switches.
 */
'use strict';
import { replayPlayer } from './replay_player.js';
import { AI_ENGINES } from '../engines/index.js';

/** @typedef {import('../physics.js').PikaUserInput} PikaUserInput */

const scrubberRangeInput = /** @type {HTMLInputElement} */ (
  document.getElementById('scrubber-range-input')
);
const playPauseBtn = /** @type {HTMLButtonElement} */ (
  document.getElementById('play-pause-btn')
);
const seekBackward1Btn = document.getElementById('seek-backward-1');
const seekForward1Btn = document.getElementById('seek-forward-1');
const seekBackward3Btn = document.getElementById('seek-backward-3');
const seekForward3Btn = document.getElementById('seek-forward-3');
const speedBtn5FPS = document.getElementById('speed-btn-5-fps');
const speedBtnHalfTimes = document.getElementById('speed-btn-half-times');
const speedBtn1Times = document.getElementById('speed-btn-1-times');
const speedBtn2Times = document.getElementById('speed-btn-2-times');
const engineSelect = /** @type {HTMLSelectElement} */ (
  document.getElementById('engine-select')
);
const PLAYBACK_CONTROLS = [
  scrubberRangeInput,
  playPauseBtn,
  seekBackward1Btn,
  seekForward1Btn,
  seekBackward3Btn,
  seekForward3Btn,
  speedBtn5FPS,
  speedBtnHalfTimes,
  speedBtn1Times,
  speedBtn2Times,
  engineSelect,
];

let pausedByBtn = false;

export function setUpUI() {
  setPlaybackControlsDisabled(true);

  for (const engine of AI_ENGINES) {
    const option = document.createElement('option');
    option.value = engine.id;
    option.textContent = engine.date
      ? `${engine.id} (${engine.date})`
      : engine.id;
    engineSelect.appendChild(option);
  }
  engineSelect.addEventListener('change', () => {
    engineSelect.blur();
    replayPlayer.changeEngine(engineSelect.value);
  });

  const dropbox = document.getElementById('dropbox');
  const openFile = (files) => {
    if (!files || files.length === 0) {
      return;
    }
    document.getElementById('loading-box').classList.remove('hidden');
    dropbox.classList.add('hidden');
    replayPlayer.readFile(files[0]);
  };
  document.getElementById('file-input').addEventListener('change', (e) => {
    // @ts-ignore
    openFile(e.target.files);
  });
  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };
  dropbox.addEventListener('dragenter', stop, false);
  dropbox.addEventListener('dragover', stop, false);
  dropbox.addEventListener('drop', (e) => {
    stop(e);
    openFile(e.dataTransfer.files);
  });

  // Hold the playback while the scrubber is being dragged.
  const holdPlayback = () => {
    if (replayPlayer.ticker.started) {
      replayPlayer.ticker.stop();
      replayPlayer.stopBGM();
    }
  };
  const resumePlayback = () => {
    if (!pausedByBtn && !replayPlayer.ticker.started) {
      replayPlayer.ticker.start();
      replayPlayer.playBGMProperly();
    }
  };
  scrubberRangeInput.addEventListener('touchstart', holdPlayback);
  scrubberRangeInput.addEventListener('mousedown', holdPlayback);
  scrubberRangeInput.addEventListener('touchend', resumePlayback);
  scrubberRangeInput.addEventListener('mouseup', resumePlayback);
  scrubberRangeInput.addEventListener('input', () => {
    replayPlayer.seekFrame(Number(scrubberRangeInput.value));
  });

  playPauseBtn.addEventListener('click', () => {
    if (replayPlayer.ticker.started) {
      replayPlayer.ticker.stop();
      replayPlayer.stopBGM();
      pausedByBtn = true;
    } else {
      replayPlayer.ticker.start();
      replayPlayer.playBGMProperly();
      pausedByBtn = false;
    }
    adjustPlayPauseBtnIcon();
  });

  for (const [btn, seconds] of [
    [seekBackward1Btn, -1],
    [seekForward1Btn, 1],
    [seekBackward3Btn, -3],
    [seekForward3Btn, 3],
  ]) {
    // @ts-ignore
    btn.addEventListener('click', () => {
      // @ts-ignore
      replayPlayer.seekRelativeTime(seconds);
      resumePlayback();
    });
  }

  const speedBtns = [
    speedBtn5FPS,
    speedBtnHalfTimes,
    speedBtn1Times,
    speedBtn2Times,
  ];
  const unselectSpeedBtns = () => {
    for (const btn of speedBtns) {
      btn.classList.remove('selected');
    }
  };
  const onSpeedBtn = (btn, apply) => {
    btn.addEventListener('click', () => {
      unselectSpeedBtns();
      btn.classList.add('selected');
      apply();
    });
  };
  onSpeedBtn(speedBtn5FPS, () => replayPlayer.adjustPlaybackSpeedFPS(5));
  onSpeedBtn(speedBtnHalfTimes, () =>
    replayPlayer.adjustPlaybackSpeedTimes(0.5)
  );
  onSpeedBtn(speedBtn1Times, () => replayPlayer.adjustPlaybackSpeedTimes(1));
  onSpeedBtn(speedBtn2Times, () => replayPlayer.adjustPlaybackSpeedTimes(2));

  const fpsInput = /** @type {HTMLInputElement} */ (
    document.getElementById('fps-input')
  );
  fpsInput.addEventListener('change', () => {
    const value = Math.min(60, Math.max(1, Number(fpsInput.value) || 1));
    replayPlayer.adjustPlaybackSpeedFPS(value);
    unselectSpeedBtns();
  });

  for (const id of [
    'notice-end-of-replay-ok-btn',
    'notice-file-open-error-ok-btn',
  ]) {
    document
      .getElementById(id)
      .addEventListener('click', () => location.reload());
  }

  const onCheckbox = (id, apply) => {
    const checkbox = /** @type {HTMLInputElement} */ (
      document.getElementById(id)
    );
    checkbox.addEventListener('change', () => apply(checkbox.checked));
  };
  onCheckbox('show-keyboard-checkbox', (on) => {
    document
      .getElementById('keyboard-container')
      .classList.toggle('hidden', !on);
  });
  onCheckbox('turn-on-bgm-checkbox', (on) => {
    if (replayPlayer.pikaVolley) {
      replayPlayer.pikaVolley.audio.turnBGMVolume(on);
    }
  });
  onCheckbox('turn-on-sfx-checkbox', (on) => {
    if (replayPlayer.pikaVolley) {
      replayPlayer.pikaVolley.audio.turnSFXVolume(on);
    }
  });
  onCheckbox('graphic-sharp-checkbox', (on) => {
    replayPlayer.renderer.view.classList.toggle('graphic-soft', !on);
  });
  onCheckbox('show-path-checkbox', (on) => {
    if (replayPlayer.pikaVolley) {
      replayPlayer.pikaVolley.overlay.showPath = on;
      replayPlayer.redraw();
    }
  });
  onCheckbox('show-predict-checkbox', (on) => {
    if (replayPlayer.pikaVolley) {
      replayPlayer.pikaVolley.overlay.showPredict = on;
      replayPlayer.redraw();
    }
  });
  onCheckbox('show-hitboxes-checkbox', (on) => {
    if (replayPlayer.pikaVolley) {
      replayPlayer.pikaVolley.overlay.showHitboxes = on;
      replayPlayer.redraw();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (playPauseBtn.disabled) {
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      playPauseBtn.click();
    } else if (event.code === 'ArrowLeft') {
      event.preventDefault();
      seekBackward3Btn.click();
    } else if (event.code === 'ArrowRight') {
      event.preventDefault();
      seekForward3Btn.click();
    }
  });
}

/**
 * Show which engine replays the file and whether the file said so.
 * @param {string} id
 * @param {boolean} detected
 * @param {string} roomId
 */
export function showEngine(id, detected, roomId) {
  engineSelect.value = id;
  const note = document.getElementById('engine-note');
  note.textContent = detected
    ? `recorded with AI ${id} (room id ${roomId
        .split('_')
        .slice(0, 3)
        .join('_')}_…)`
    : 'this replay does not say which version recorded it; if the players start to act strangely, try another';
}

/**
 * Apply the overlay switches to a newly created game
 */
export function applyOverlaySwitches() {
  if (!replayPlayer.pikaVolley) {
    return;
  }
  const checked = (id) =>
    /** @type {HTMLInputElement} */ (document.getElementById(id)).checked;
  replayPlayer.pikaVolley.overlay.showPath = checked('show-path-checkbox');
  replayPlayer.pikaVolley.overlay.showPredict = checked(
    'show-predict-checkbox'
  );
  replayPlayer.pikaVolley.overlay.showHitboxes = checked(
    'show-hitboxes-checkbox'
  );
}

export function adjustFPSInputValue() {
  const fpsInput = /** @type {HTMLInputElement} */ (
    document.getElementById('fps-input')
  );
  fpsInput.value = String(replayPlayer.ticker.maxFPS);
}

export function adjustPlayPauseBtnIcon() {
  playPauseBtn.textContent = document.getElementById(
    replayPlayer.ticker.started ? 'pause-mark' : 'play-mark'
  ).textContent;
}

export function noticeEndOfReplay() {
  document.getElementById('notice-end-of-replay').classList.remove('hidden');
}

export function hideNoticeEndOfReplay() {
  document.getElementById('notice-end-of-replay').classList.add('hidden');
}

export function noticeFileOpenError() {
  document.getElementById('loading-box').classList.add('hidden');
  document.getElementById('notice-file-open-error').classList.remove('hidden');
}

/** @param {number} max */
export function setMaxForScrubberRange(max) {
  scrubberRangeInput.max = String(max);
}

/** @param {number} value */
export function moveScrubberTo(value) {
  scrubberRangeInput.value = String(value);
}

/** @param {number} timeCurrent unit: second */
export function showTimeCurrent(timeCurrent) {
  document.getElementById('time-current').textContent =
    getTimeText(timeCurrent);
}

/** @param {number} timeDuration unit: second */
export function showTotalTimeDuration(timeDuration) {
  document.getElementById('time-duration').textContent =
    getTimeText(timeDuration);
}

/**
 * Light up the keys each player is pressing
 * @param {PikaUserInput} player1Input
 * @param {PikaUserInput} player2Input
 */
export function showKeyboardInputs(player1Input, player2Input) {
  const press = (id, pressed) =>
    document.getElementById(id).classList.toggle('pressed', pressed);
  press('d-key', player1Input.xDirection === -1);
  press('g-key', player1Input.xDirection === 1);
  press('r-key', player1Input.yDirection === -1);
  press('v-key', player1Input.yDirection === 1);
  press('z-key', player1Input.powerHit === 1);
  press('left-key', player2Input.xDirection === -1);
  press('right-key', player2Input.xDirection === 1);
  press('up-key', player2Input.yDirection === -1);
  press('down-key', player2Input.yDirection === 1);
  press('enter-key', player2Input.powerHit === 1);
}

export function enableReplayScrubberAndBtns() {
  setPlaybackControlsDisabled(false);
}

/** @param {boolean} disabled */
function setPlaybackControlsDisabled(disabled) {
  for (const control of PLAYBACK_CONTROLS) {
    // @ts-ignore
    control.disabled = disabled;
  }
}

/**
 * @param {number} time unit: second
 * @return {string}
 */
function getTimeText(time) {
  const seconds = Math.floor(time % 60);
  const minutes = Math.floor(time / 60) % 60;
  const hours = Math.floor(time / 3600);
  const pad = (n) => ('0' + n).slice(-2);
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
