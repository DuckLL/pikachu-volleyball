/**
 * On-screen controls for phones and tablets: "jump" and "hit" buttons on the
 * left, a virtual joystick on the right, and a 1P / 2P switch.
 *
 * They press the same keys a keyboard would (keydown / keyup with the key's
 * `code`, which PikaKeyboard listens for), so the menu, the game and the AI
 * modes work unchanged. The switch picks which player's keys: in the menu,
 * "hit" is then Z (play on the left) or Enter (play on the right).
 *
 * Shown on touch screens; ?touch=1 forces it on (for trying on a desktop),
 * ?touch=0 off. The 1P / 2P choice is remembered.
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
  zh: { up: '跳', hit: '殺', p1: '1P 左', p2: '2P 右' },
  en: { up: 'Jump', hit: 'Hit', p1: '1P left', p2: '2P right' },
  ko: { up: '점프', hit: '스파이크', p1: '1P 왼쪽', p2: '2P 오른쪽' },
};

/** Fraction of the joystick radius the knob must travel to press a direction */
const DEAD_ZONE = 0.35;

/**
 * Whether to show the controls on this device / page.
 * @return {boolean}
 */
function wanted() {
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
  if (!wanted()) {
    return;
  }
  const labels = LABELS[document.documentElement.lang] || LABELS.en;
  const presser = new KeyPresser();
  let side = localStorageWrapper.get(SIDE_STORAGE_KEY) === '2' ? 2 : 1;
  const keys = () => KEYS[side];

  const root = document.createElement('div');
  root.id = 'touch-controls';
  root.innerHTML = `
    <div class="touch-cluster touch-left">
      <div class="touch-side-switch" role="group">
        <button type="button" data-side="1">${labels.p1}</button>
        <button type="button" data-side="2">${labels.p2}</button>
      </div>
      <div class="touch-buttons">
        <button type="button" class="touch-btn" data-key="up">${labels.up}</button>
        <button type="button" class="touch-btn touch-hit" data-key="hit">${labels.hit}</button>
      </div>
    </div>
    <div class="touch-cluster touch-right">
      <div class="touch-joystick"><div class="touch-knob"></div></div>
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add('with-touch-controls');

  // Buttons: held while a finger is on them.
  for (const btn of root.querySelectorAll('.touch-btn')) {
    const name = /** @type {HTMLElement} */ (btn).dataset.key;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // @ts-ignore
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('pressed');
      presser.set(keys()[name], true);
    });
    const release = () => {
      btn.classList.remove('pressed');
      presser.set(keys()[name], false);
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
  }

  // Joystick: the knob follows the finger within the base; past the dead
  // zone it presses left / right and up / down.
  const base = /** @type {HTMLElement} */ (
    root.querySelector('.touch-joystick')
  );
  const knob = /** @type {HTMLElement} */ (root.querySelector('.touch-knob'));
  let activePointer = null;
  const moveKnob = (e) => {
    const rect = base.getBoundingClientRect();
    const radius = rect.width / 2;
    let dx = (e.clientX - (rect.left + radius)) / radius;
    let dy = (e.clientY - (rect.top + radius)) / radius;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    knob.style.transform = `translate(${dx * radius * 0.6}px, ${
      dy * radius * 0.6
    }px)`;
    const k = keys();
    presser.set(k.left, dx < -DEAD_ZONE);
    presser.set(k.right, dx > DEAD_ZONE);
    presser.set(k.up, dy < -DEAD_ZONE);
    presser.set(k.down, dy > DEAD_ZONE);
  };
  const endJoystick = () => {
    activePointer = null;
    knob.style.transform = '';
    const k = keys();
    for (const code of [k.left, k.right, k.up, k.down]) {
      presser.set(code, false);
    }
  };
  base.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    activePointer = e.pointerId;
    base.setPointerCapture(e.pointerId);
    moveKnob(e);
  });
  base.addEventListener('pointermove', (e) => {
    if (e.pointerId === activePointer) {
      moveKnob(e);
    }
  });
  base.addEventListener('pointerup', endJoystick);
  base.addEventListener('pointercancel', endJoystick);

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
    endJoystick();
  });
}
