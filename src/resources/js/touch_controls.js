/**
 * On-screen controls for phones and tablets, in two layouts:
 *
 * - "pad": a hit button on the left, an eight-way direction pad on the
 *   right. The pad is one touch area: the direction follows the finger as it
 *   slides, so it can roll from one direction to the next without lifting;
 *   diagonals press two keys. Left and right share the middle row, so the
 *   pad has no dead spot: lifting the finger is the only way to press
 *   nothing.
 * - "keys": the keyboard's way of playing. Hit and down on the left, arrow
 *   keys in their usual inverted T on the right, each its own button, so
 *   several can be held with several fingers.
 *
 * They press the same keys a keyboard would (keydown / keyup with the key's
 * `code`, which PikaKeyboard listens for), so the menu, the game and the AI
 * modes work unchanged. The 1P / 2P switch picks which player's keys: in the
 * menu, "hit" is then Z (play on the left) or Enter (play on the right).
 *
 * Shown on touch screens; ?touch=1 forces it on (for trying on a desktop),
 * ?touch=0 off. The 1P / 2P and layout choices are remembered. While shown,
 * <html> has the class "touch", which style.css uses for a compact menu bar.
 */
'use strict';

import { localStorageWrapper } from './utils/local_storage_wrapper.js';

const SIDE_STORAGE_KEY = 'pv-offline-touchSide';
const LAYOUT_STORAGE_KEY = 'pv-offline-touchLayout';

/** The keys PikaKeyboard listens for (see pikavolley.js). */
const KEYS = {
  1: { left: 'KeyD', right: 'KeyG', up: 'KeyR', down: 'KeyV', hit: 'KeyZ' },
  2: {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    hit: 'Enter',
  },
};

/** What the hit and down buttons show of their key in the "keys" layout */
const KEY_NAMES = {
  1: { hit: 'Z', down: 'V' },
  2: { hit: 'Enter', down: '↓' },
};

const LABELS = {
  zh: {
    hit: '殺',
    down: '下',
    p1: '1P 左',
    p2: '2P 右',
    pad: '八方位',
    keys: '鍵盤',
  },
  en: {
    hit: 'Hit',
    down: 'Down',
    p1: '1P left',
    p2: '2P right',
    pad: '8-way',
    keys: 'Keys',
  },
  ko: {
    hit: '스파이크',
    down: '아래',
    p1: '1P 왼쪽',
    p2: '2P 오른쪽',
    pad: '8방향',
    keys: '키보드',
  },
};

/** The pad's eight directions, clockwise from right: [x, y, arrow] */
const DIRECTIONS = [
  [1, 0, '→'],
  [1, 1, '↘'],
  [0, 1, '↓'],
  [-1, 1, '↙'],
  [-1, 0, '←'],
  [-1, -1, '↖'],
  [0, -1, '↑'],
  [1, -1, '↗'],
];

/**
 * Whether to show the controls on this device / page.
 * @return {boolean}
 */
export function touchControlsWanted() {
  const forced = new URLSearchParams(location.search).get('touch');
  if (forced === '1' || forced === '0') {
    return forced === '1';
  }
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Holds and releases keys. A key can be held by more than one control (the
 * down button and the ↓ arrow both hold down); it is released when the last
 * lets go. Remembering what is held means switching sides or layouts, or
 * lifting a finger, never leaves a key stuck.
 */
class KeyPresser {
  constructor() {
    /** @type {Map<string, Set<string>>} key code -> controls holding it */
    this.holders = new Map();
  }

  /**
   * @param {string} holder which control
   * @param {string} code
   * @param {boolean} pressed
   */
  set(holder, code, pressed) {
    const holders = this.holders.get(code) || new Set();
    const wasDown = holders.size > 0;
    if (pressed) {
      holders.add(holder);
    } else {
      holders.delete(holder);
    }
    this.holders.set(code, holders);
    const isDown = holders.size > 0;
    if (isDown !== wasDown) {
      window.dispatchEvent(
        new KeyboardEvent(isDown ? 'keydown' : 'keyup', { code, bubbles: true })
      );
    }
  }

  releaseAll() {
    for (const [code, holders] of this.holders) {
      for (const holder of [...holders]) {
        this.set(holder, code, false);
      }
    }
  }
}

export function setUpTouchControls() {
  if (!touchControlsWanted()) {
    return;
  }
  document.documentElement.classList.add('touch');
  const labels = LABELS[document.documentElement.lang] || LABELS.en;
  const presser = new KeyPresser();
  let side = localStorageWrapper.get(SIDE_STORAGE_KEY) === '2' ? 2 : 1;
  let layout =
    localStorageWrapper.get(LAYOUT_STORAGE_KEY) === 'keys' ? 'keys' : 'pad';
  const keys = () => KEYS[side];

  // Pad cells row by row (DIRECTIONS indexes); left and right split the
  // middle row between them.
  const padRows = [
    [5, 6, 7],
    [4, 0],
    [3, 2, 1],
  ];
  const root = document.createElement('div');
  root.id = 'touch-controls';
  root.innerHTML = `
    <div class="touch-cluster touch-left">
      <div class="touch-switch touch-side-switch" role="group">
        <button type="button" data-side="1">${labels.p1}</button>
        <button type="button" data-side="2">${labels.p2}</button>
      </div>
      <div class="touch-switch touch-layout-switch" role="group">
        <button type="button" data-layout="pad">${labels.pad}</button>
        <button type="button" data-layout="keys">${labels.keys}</button>
      </div>
      <div class="touch-buttons">
        <button type="button" class="touch-btn touch-hit" data-key="hit">
          ${labels.hit}<small class="touch-key-name"></small>
        </button>
        <button type="button" class="touch-btn touch-down" data-key="down">
          ${labels.down}<small class="touch-key-name"></small>
        </button>
      </div>
    </div>
    <div class="touch-cluster touch-right">
      <div class="touch-dpad">${padRows
        .flat()
        .map(
          (i) =>
            `<div class="touch-dpad-cell" data-dir="${i}">${DIRECTIONS[i][2]}</div>`
        )
        .join('')}</div>
      <div class="touch-arrows">
        <button type="button" class="touch-arrow" data-key="up">↑</button>
        <button type="button" class="touch-arrow" data-key="left">←</button>
        <button type="button" class="touch-arrow" data-key="down">↓</button>
        <button type="button" class="touch-arrow" data-key="right">→</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  // Buttons that hold their key while a finger is on them: hit, down and
  // the arrow keys. Each is its own holder, so they can be held together.
  const holdButtons = /** @type {HTMLElement[]} */ ([
    ...root.querySelectorAll('[data-key]'),
  ]);
  holdButtons.forEach((btn, i) => {
    const holder = `button${i}`;
    const press = (pressed) => {
      btn.classList.toggle('pressed', pressed);
      presser.set(holder, keys()[btn.dataset.key], pressed);
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      press(true);
    });
    btn.addEventListener('pointerup', () => press(false));
    btn.addEventListener('pointercancel', () => press(false));
  });

  // Direction pad
  const pad = /** @type {HTMLElement} */ (root.querySelector('.touch-dpad'));
  const cells = [...pad.querySelectorAll('.touch-dpad-cell')];
  let padPointer = null;
  /** @param {number} dir DIRECTIONS index, or -1 for none */
  const pressDirection = (dir) => {
    const [x, y] = dir < 0 ? [0, 0] : DIRECTIONS[dir];
    const k = keys();
    presser.set('pad', k.left, x < 0);
    presser.set('pad', k.right, x > 0);
    presser.set('pad', k.up, y < 0);
    presser.set('pad', k.down, y > 0);
    for (const cell of cells) {
      cell.classList.toggle(
        'pressed',
        /** @type {HTMLElement} */ (cell).dataset.dir === String(dir)
      );
    }
  };
  const followFinger = (e) => {
    // The cell under the finger, or the nearest one if it slid off the pad.
    const rect = pad.getBoundingClientRect();
    const clamp = (v) => Math.min(Math.max(v, 0), 0.999);
    const row =
      padRows[Math.floor(clamp((e.clientY - rect.top) / rect.height) * 3)];
    const x = clamp((e.clientX - rect.left) / rect.width);
    pressDirection(row[Math.floor(x * row.length)]);
  };
  const endPad = () => {
    padPointer = null;
    pressDirection(-1);
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    padPointer = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    followFinger(e);
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === padPointer) {
      followFinger(e);
    }
  });
  pad.addEventListener('pointerup', endPad);
  pad.addEventListener('pointercancel', endPad);

  /** Let go of everything, e.g. before the keys change meaning */
  const releaseAll = () => {
    endPad();
    presser.releaseAll();
    for (const btn of holdButtons) {
      btn.classList.remove('pressed');
    }
  };

  // The 1P / 2P and layout switches
  const show = () => {
    root.dataset.layout = layout;
    for (const btn of root.querySelectorAll('.touch-switch button')) {
      const { side: s, layout: l } = /** @type {HTMLElement} */ (btn).dataset;
      btn.classList.toggle('selected', s === String(side) || l === layout);
    }
    for (const btn of root.querySelectorAll('.touch-buttons [data-key]')) {
      const name =
        KEY_NAMES[side][/** @type {HTMLElement} */ (btn).dataset.key];
      btn.querySelector('.touch-key-name').textContent = name;
    }
  };
  for (const btn of root.querySelectorAll('.touch-switch button')) {
    btn.addEventListener('click', () => {
      releaseAll();
      const { side: s, layout: l } = /** @type {HTMLElement} */ (btn).dataset;
      if (s) {
        side = Number(s);
        localStorageWrapper.set(SIDE_STORAGE_KEY, s);
      } else {
        layout = l;
        localStorageWrapper.set(LAYOUT_STORAGE_KEY, l);
      }
      show();
    });
  }
  show();

  // A finger lifted while the page lost focus must not leave a key held.
  window.addEventListener('blur', releaseAll);
}
