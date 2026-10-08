/**
 * On-screen controls for phones and tablets: a "hit" button and a 1P / 2P
 * switch on the left, an eight-way direction pad on the right.
 *
 * They press the same keys a keyboard would (keydown / keyup with the key's
 * `code`, which PikaKeyboard listens for), so the menu, the game and the AI
 * modes work unchanged. The switch picks which player's keys: in the menu,
 * "hit" is then Z (play on the left) or Enter (play on the right).
 *
 * The pad is one touch area: the direction follows the finger as it slides,
 * so it can roll from one direction to the next without lifting; diagonals
 * press two keys.
 *
 * Shown on touch screens; ?touch=1 forces it on (for trying on a desktop),
 * ?touch=0 off. The 1P / 2P choice is remembered. While shown, <html> has
 * the class "touch", which style.css uses for a compact menu bar.
 */
'use strict';

import { localStorageWrapper } from './utils/local_storage_wrapper.js';

const SIDE_STORAGE_KEY = 'pv-offline-touchSide';

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

const LABELS = {
  zh: { hit: '殺', p1: '1P 左', p2: '2P 右' },
  en: { hit: 'Hit', p1: '1P left', p2: '2P right' },
  ko: { hit: '스파이크', p1: '1P 왼쪽', p2: '2P 오른쪽' },
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

/** Fraction of the pad's radius around its centre that presses nothing */
const DEAD_ZONE = 0.2;

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
 * Holds and releases keys, remembering which are down so switching sides or
 * lifting a finger never leaves a key stuck.
 */
class KeyPresser {
  constructor() {
    /** @type {Set<string>} */
    this.down = new Set();
  }

  /**
   * @param {string} code
   * @param {boolean} pressed
   */
  set(code, pressed) {
    if (pressed === this.down.has(code)) {
      return;
    }
    if (pressed) {
      this.down.add(code);
    } else {
      this.down.delete(code);
    }
    window.dispatchEvent(
      new KeyboardEvent(pressed ? 'keydown' : 'keyup', { code, bubbles: true })
    );
  }

  releaseAll() {
    for (const code of [...this.down]) {
      this.set(code, false);
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
  const keys = () => KEYS[side];

  // Pad cells in a 3x3 grid, centre empty; DIRECTIONS index per cell.
  const cellOrder = [5, 6, 7, 4, -1, 0, 3, 2, 1];
  const root = document.createElement('div');
  root.id = 'touch-controls';
  root.innerHTML = `
    <div class="touch-cluster touch-left">
      <div class="touch-side-switch" role="group">
        <button type="button" data-side="1">${labels.p1}</button>
        <button type="button" data-side="2">${labels.p2}</button>
      </div>
      <button type="button" class="touch-btn touch-hit">${labels.hit}</button>
    </div>
    <div class="touch-cluster touch-right">
      <div class="touch-dpad">${cellOrder
        .map((i) =>
          i < 0
            ? '<div class="touch-dpad-center"></div>'
            : `<div class="touch-dpad-cell" data-dir="${i}">${DIRECTIONS[i][2]}</div>`
        )
        .join('')}</div>
    </div>`;
  document.body.appendChild(root);

  // Hit: held while a finger is on it.
  const hitBtn = root.querySelector('.touch-hit');
  hitBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    // @ts-ignore
    hitBtn.setPointerCapture(e.pointerId);
    hitBtn.classList.add('pressed');
    presser.set(keys().hit, true);
  });
  const releaseHit = () => {
    hitBtn.classList.remove('pressed');
    presser.set(keys().hit, false);
  };
  hitBtn.addEventListener('pointerup', releaseHit);
  hitBtn.addEventListener('pointercancel', releaseHit);

  // Direction pad
  const pad = /** @type {HTMLElement} */ (root.querySelector('.touch-dpad'));
  const cells = [...pad.querySelectorAll('.touch-dpad-cell')];
  let padPointer = null;
  /** @param {number} dir DIRECTIONS index, or -1 for none */
  const pressDirection = (dir) => {
    const [x, y] = dir < 0 ? [0, 0] : DIRECTIONS[dir];
    const k = keys();
    presser.set(k.left, x < 0);
    presser.set(k.right, x > 0);
    presser.set(k.up, y < 0);
    presser.set(k.down, y > 0);
    for (const cell of cells) {
      cell.classList.toggle(
        'pressed',
        /** @type {HTMLElement} */ (cell).dataset.dir === String(dir)
      );
    }
  };
  const followFinger = (e) => {
    const rect = pad.getBoundingClientRect();
    const radius = rect.width / 2;
    const dx = e.clientX - (rect.left + radius);
    const dy = e.clientY - (rect.top + radius);
    if (Math.hypot(dx, dy) < DEAD_ZONE * radius) {
      pressDirection(-1);
      return;
    }
    // 45-degree sectors centred on each direction, clockwise from right.
    const angle = Math.atan2(dy, dx);
    pressDirection((Math.round(angle / (Math.PI / 4)) + 8) % 8);
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

  // 1P / 2P switch
  const sideBtns = root.querySelectorAll('.touch-side-switch button');
  const showSide = () => {
    for (const btn of sideBtns) {
      btn.classList.toggle(
        'selected',
        /** @type {HTMLElement} */ (btn).dataset.side === String(side)
      );
    }
  };
  for (const btn of sideBtns) {
    btn.addEventListener('click', () => {
      presser.releaseAll();
      side = Number(/** @type {HTMLElement} */ (btn).dataset.side);
      localStorageWrapper.set(SIDE_STORAGE_KEY, String(side));
      showSide();
    });
  }
  showSide();

  // A finger lifted while the page lost focus must not leave a key held.
  window.addEventListener('blur', () => {
    presser.releaseAll();
    endPad();
    releaseHit();
  });
}
