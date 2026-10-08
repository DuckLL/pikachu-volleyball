/**
 * On-screen controls for phones and tablets: direction controls on one side,
 * a hit button (and optionally an up or down button) on the other.
 *
 * The direction control is one of:
 * - "joystick": a knob that follows the finger; past a dead zone it presses
 *   left / right and up / down.
 * - "pad": an eight-way pad. It is one touch area: the direction follows the
 *   finger as it slides, so it can roll from one direction to the next
 *   without lifting; diagonals press two keys. Left and right share the
 *   middle row, so the pad has no dead spot: lifting the finger is the only
 *   way to press nothing.
 * - "keys": the keyboard's arrow keys in their usual inverted T, each its
 *   own button, so several can be held with several fingers.
 *
 * The gear opens settings for which player (1P / 2P) the controls play,
 * which side the direction controls are on, which control, and the button
 * beside "hit".
 *
 * They press the same keys a keyboard would (keydown / keyup with the key's
 * `code`, which PikaKeyboard listens for), so the menu, the game and the AI
 * modes work unchanged. The 1P / 2P setting picks which player's keys: in
 * the menu, "hit" is then Z (play on the left) or Enter (play on the right).
 *
 * Shown on touch screens; ?touch=1 forces it on (for trying on a desktop),
 * ?touch=0 off. All choices are remembered. While shown, <html> has the
 * class "touch", which style.css uses for a compact menu bar.
 */
'use strict';

import { localStorageWrapper } from './utils/local_storage_wrapper.js';

/** The gear's settings: [storage key, values (the first is the default)] */
const SETTINGS = {
  side: ['pv-offline-touchSide', ['1', '2']],
  directionSide: ['pv-offline-touchDirectionSide', ['right', 'left']],
  direction: ['pv-offline-touchLayout', ['pad', 'joystick', 'keys']],
  // Unset, it follows the direction control: down for the keyboard layout
  // (where the keyboard's V / ↓ is), none otherwise.
  extra: ['pv-offline-touchExtra', ['none', 'up', 'down']],
};

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

/** What the hit, up and down buttons show of their key */
const KEY_NAMES = {
  1: { hit: 'Z', up: 'R', down: 'V' },
  2: { hit: 'Enter', up: '↑', down: '↓' },
};

const LABELS = {
  zh: {
    hit: '殺',
    up: '上',
    down: '下',
    1: '1P 左',
    2: '2P 右',
    player: '玩家',
    settings: '觸控設定',
    directionSide: '方向控制在',
    left: '左邊',
    right: '右邊',
    direction: '方向控制',
    joystick: '搖桿',
    pad: '八方位',
    keys: '鍵盤',
    extra: '殺旁邊的按鈕',
    none: '無',
    done: '完成',
  },
  en: {
    hit: 'Hit',
    up: 'Up',
    down: 'Down',
    1: '1P left',
    2: '2P right',
    player: 'Player',
    settings: 'Touch controls',
    directionSide: 'Direction on the',
    left: 'Left',
    right: 'Right',
    direction: 'Direction control',
    joystick: 'Joystick',
    pad: '8-way',
    keys: 'Keys',
    extra: 'Button beside hit',
    none: 'None',
    done: 'Done',
  },
  ko: {
    hit: '스파이크',
    up: '위',
    down: '아래',
    1: '1P 왼쪽',
    2: '2P 오른쪽',
    player: '플레이어',
    settings: '터치 설정',
    directionSide: '방향 조작 위치',
    left: '왼쪽',
    right: '오른쪽',
    direction: '방향 조작',
    joystick: '조이스틱',
    pad: '8방향',
    keys: '키보드',
    extra: '스파이크 옆 버튼',
    none: '없음',
    done: '완료',
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

/** Fraction of the joystick radius the knob must travel to press a direction */
const JOYSTICK_DEAD_ZONE = 0.35;

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
 * lets go. Remembering what is held means changing a setting, or lifting a
 * finger, never leaves a key stuck.
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

  /**
   * Let go of the keys a control holds.
   * @param {string} holder
   */
  releaseHolder(holder) {
    for (const code of this.holders.keys()) {
      this.set(holder, code, false);
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

/**
 * @param {string} name a SETTINGS name
 * @return {string|null} the stored value, if it is a valid one
 */
function loadSetting(name) {
  const [storageKey, values] = SETTINGS[name];
  const value = localStorageWrapper.get(storageKey);
  return values.includes(value) ? value : null;
}

/**
 * The name and value of a switch button (its one data attribute)
 * @param {Element} btn
 * @return {[string, string]}
 */
function switchChoice(btn) {
  // @ts-ignore
  return Object.entries(/** @type {HTMLElement} */ (btn).dataset)[0];
}

export function setUpTouchControls() {
  if (!touchControlsWanted()) {
    return;
  }
  document.documentElement.classList.add('touch');
  const labels = LABELS[document.documentElement.lang] || LABELS.en;
  const presser = new KeyPresser();
  const settings = {
    side: loadSetting('side') || '1',
    directionSide: loadSetting('directionSide') || 'right',
    direction: loadSetting('direction') || 'pad',
    extra: loadSetting('extra'),
  };
  const keys = () => KEYS[settings.side];
  const extra = () =>
    settings.extra || (settings.direction === 'keys' ? 'down' : 'none');

  /**
   * @param {string} attribute the buttons' data attribute (kebab-case)
   * @param {string[]} values
   * @return {string} a row of buttons, one per value
   */
  const switchHTML = (attribute, values) =>
    `<div class="touch-switch" role="group">${values
      .map(
        (v) =>
          `<button type="button" data-${attribute}="${v}">${labels[v]}</button>`
      )
      .join('')}</div>`;

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
    <div class="touch-cluster touch-action">
      <div class="touch-top-row">
        <button type="button" class="touch-gear" aria-label="${
          labels.settings
        }">⚙</button>
      </div>
      <div class="touch-buttons">
        <button type="button" class="touch-btn touch-hit" data-key="hit">
          ${labels.hit}<small class="touch-key-name"></small>
        </button>
        <button type="button" class="touch-btn touch-extra" data-key="down">
          <span class="touch-extra-label"></span><small class="touch-key-name"></small>
        </button>
      </div>
    </div>
    <div class="touch-cluster touch-direction">
      <div class="touch-joystick"><div class="touch-knob"></div></div>
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

  const panel = document.createElement('div');
  panel.id = 'touch-settings';
  panel.className = 'hidden';
  panel.innerHTML = `
    <div class="touch-settings-box" role="dialog" aria-label="${
      labels.settings
    }">
      <h3>${labels.settings}</h3>
      <div>${labels.player}</div>
      ${switchHTML('side', SETTINGS.side[1])}
      <div>${labels.directionSide}</div>
      ${switchHTML('direction-side', ['left', 'right'])}
      <div>${labels.direction}</div>
      ${switchHTML('direction', ['joystick', 'pad', 'keys'])}
      <div>${labels.extra}</div>
      ${switchHTML('extra', SETTINGS.extra[1])}
      <button type="button" class="touch-settings-done">${labels.done}</button>
    </div>`;
  document.body.appendChild(panel);

  // Buttons that hold their key while a finger is on them: hit, the extra
  // button and the arrow keys. Each is its own holder, so they can be held
  // together; each lets go of the key it pressed, even if its key changed.
  const holdButtons = /** @type {HTMLElement[]} */ ([
    ...root.querySelectorAll('[data-key]'),
  ]);
  holdButtons.forEach((btn, i) => {
    const holder = `button${i}`;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('pressed');
      presser.set(holder, keys()[btn.dataset.key], true);
    });
    const release = () => {
      btn.classList.remove('pressed');
      presser.releaseHolder(holder);
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
  });

  /**
   * Press the direction keys for x, y in -1, 0, 1.
   * @param {string} holder
   * @param {number} x
   * @param {number} y
   */
  const pressXY = (holder, x, y) => {
    const k = keys();
    presser.set(holder, k.left, x < 0);
    presser.set(holder, k.right, x > 0);
    presser.set(holder, k.up, y < 0);
    presser.set(holder, k.down, y > 0);
  };

  /**
   * A one-finger touch area: follow(event) as the finger moves, end() when
   * it lifts.
   * @param {HTMLElement} area
   * @param {(e: PointerEvent) => void} follow
   * @param {() => void} end
   * @return {() => void} lifts the finger
   */
  const trackFinger = (area, follow, end) => {
    let pointer = null;
    area.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pointer = e.pointerId;
      area.setPointerCapture(e.pointerId);
      follow(e);
    });
    area.addEventListener('pointermove', (e) => {
      if (e.pointerId === pointer) {
        follow(e);
      }
    });
    const lift = () => {
      pointer = null;
      end();
    };
    area.addEventListener('pointerup', lift);
    area.addEventListener('pointercancel', lift);
    return lift;
  };

  // Joystick: the knob follows the finger within the base.
  const base = /** @type {HTMLElement} */ (
    root.querySelector('.touch-joystick')
  );
  const knob = /** @type {HTMLElement} */ (root.querySelector('.touch-knob'));
  const endJoystick = trackFinger(
    base,
    (e) => {
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
      pressXY(
        'joystick',
        Math.abs(dx) > JOYSTICK_DEAD_ZONE ? Math.sign(dx) : 0,
        Math.abs(dy) > JOYSTICK_DEAD_ZONE ? Math.sign(dy) : 0
      );
    },
    () => {
      knob.style.transform = '';
      pressXY('joystick', 0, 0);
    }
  );

  // Direction pad
  const pad = /** @type {HTMLElement} */ (root.querySelector('.touch-dpad'));
  const cells = [...pad.querySelectorAll('.touch-dpad-cell')];
  /** @param {number} dir DIRECTIONS index, or -1 for none */
  const pressDirection = (dir) => {
    const [x, y] = dir < 0 ? [0, 0] : DIRECTIONS[dir];
    pressXY('pad', x, y);
    for (const cell of cells) {
      cell.classList.toggle(
        'pressed',
        /** @type {HTMLElement} */ (cell).dataset.dir === String(dir)
      );
    }
  };
  const endPad = trackFinger(
    pad,
    (e) => {
      // The cell under the finger, or the nearest one if it slid off.
      const rect = pad.getBoundingClientRect();
      const clamp = (v) => Math.min(Math.max(v, 0), 0.999);
      const row =
        padRows[Math.floor(clamp((e.clientY - rect.top) / rect.height) * 3)];
      const x = clamp((e.clientX - rect.left) / rect.width);
      pressDirection(row[Math.floor(x * row.length)]);
    },
    () => pressDirection(-1)
  );

  /** Let go of everything, e.g. before the keys change meaning */
  const releaseAll = () => {
    endJoystick();
    endPad();
    presser.releaseAll();
    for (const btn of holdButtons) {
      btn.classList.remove('pressed');
    }
  };

  const extraBtn = /** @type {HTMLElement} */ (
    root.querySelector('.touch-extra')
  );
  const show = () => {
    root.dataset.directionSide = settings.directionSide;
    root.dataset.direction = settings.direction;
    root.dataset.extra = extra();
    if (extra() !== 'none') {
      extraBtn.dataset.key = extra();
      extraBtn.querySelector('.touch-extra-label').textContent =
        labels[extra()];
    }
    const selected = { ...settings, extra: extra() };
    for (const btn of panel.querySelectorAll('.touch-switch button')) {
      const [name, value] = switchChoice(btn);
      btn.classList.toggle('selected', selected[name] === value);
    }
    for (const btn of root.querySelectorAll('.touch-buttons [data-key]')) {
      btn.querySelector('.touch-key-name').textContent =
        KEY_NAMES[settings.side][/** @type {HTMLElement} */ (btn).dataset.key];
    }
  };

  // The gear's settings panel
  const openSettings = (open) => {
    releaseAll();
    panel.classList.toggle('hidden', !open);
  };
  root
    .querySelector('.touch-gear')
    .addEventListener('click', () => openSettings(true));
  panel
    .querySelector('.touch-settings-done')
    .addEventListener('click', () => openSettings(false));
  panel.addEventListener('click', (e) => {
    if (e.target === panel) {
      openSettings(false); // a tap outside the box
    }
  });
  for (const btn of panel.querySelectorAll('.touch-switch button')) {
    btn.addEventListener('click', () => {
      const [name, value] = switchChoice(btn);
      releaseAll();
      settings[name] = value;
      localStorageWrapper.set(SETTINGS[name][0], value);
      show();
    });
  }
  show();

  // A finger lifted while the page lost focus must not leave a key held.
  window.addEventListener('blur', releaseAll);
}
