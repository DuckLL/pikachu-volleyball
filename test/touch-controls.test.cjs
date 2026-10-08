const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeElement {
  constructor() {
    this.listeners = new Map();
    this.captured = new Set();
    this.dataset = {};
    this.style = {};
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        if (force === undefined ? !classes.has(name) : force) classes.add(name);
        else classes.delete(name);
      },
    };
  }

  set className(value) {
    for (const name of value.split(' ')) this.classList.add(name);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || [])
      listener(event);
  }

  fire(type, pointerId, clientX = 0, clientY = 0) {
    this.dispatchEvent({
      type,
      pointerId,
      clientX,
      clientY,
      preventDefault() {},
    });
  }

  setPointerCapture(pointerId) {
    this.captured.add(pointerId);
  }

  hasPointerCapture(pointerId) {
    return this.captured.has(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.captured.delete(pointerId);
    this.fire('lostpointercapture', pointerId);
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 300, height: 300 };
  }
}

function setUpControls() {
  const root = new FakeElement();
  const panel = new FakeElement();
  const pad = new FakeElement();
  const gear = new FakeElement();
  const buttons = Object.fromEntries(
    ['hit', 'extra', 'up', 'left', 'down', 'right'].map((name) => [
      name,
      new FakeElement(),
    ])
  );
  for (const name of ['hit', 'down', 'up', 'left', 'right']) {
    buttons[name].dataset.key = name;
  }
  buttons.extra.dataset.key = 'down';
  buttons.hit.querySelector = buttons.extra.querySelector = () => ({
    textContent: '',
    innerHTML: '',
  });
  const cells = Array.from({ length: 8 }, (_, i) => {
    const cell = new FakeElement();
    cell.dataset.dir = String(i);
    return cell;
  });
  pad.querySelectorAll = () => cells;
  const elements = {
    '.touch-joystick': new FakeElement(),
    '.touch-knob': new FakeElement(),
    '.touch-dpad': pad,
    '.touch-extra': buttons.extra,
    '.touch-gear': gear,
  };
  root.querySelector = (selector) => elements[selector];
  root.querySelectorAll = (selector) =>
    selector === '[data-key]'
      ? Object.values(buttons)
      : selector === '.touch-buttons [data-key]'
      ? [buttons.hit, buttons.extra]
      : [];
  panel.querySelector = () => new FakeElement();
  panel.querySelectorAll = () => [];
  const pressed = new Set();
  const keyboardEvents = [];
  const source = fs
    .readFileSync(
      path.join(__dirname, '../src/resources/js/touch_controls.js'),
      'utf8'
    )
    .replace(
      "import { localStorageWrapper } from './utils/local_storage_wrapper.js';",
      ''
    )
    .replaceAll('export function', 'function');
  let created = 0;
  const document = {
    documentElement: { lang: 'en', classList: new FakeElement().classList },
    body: { appendChild() {} },
    createElement: () => (created++ === 0 ? root : panel),
    getElementById: () => null,
  };
  const window = {
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    dispatchEvent(event) {
      keyboardEvents.push([event.type, event.code]);
      if (event.type === 'keydown') pressed.add(event.code);
      else pressed.delete(event.code);
    },
  };
  const context = {
    document,
    window,
    location: { search: '?touch=1' },
    URLSearchParams,
    Event,
    KeyboardEvent: class {
      constructor(type, options) {
        this.type = type;
        this.code = options.code;
      }
    },
    localStorageWrapper: { get: () => null, set() {} },
  };
  vm.runInNewContext(source + '\nsetUpTouchControls();', context);
  return { root, panel, pad, gear, buttons, pressed, keyboardEvents };
}

test('pad restores a held direction after a second finger taps the opposite side', () => {
  const { pad, pressed } = setUpControls();
  pad.fire('pointerdown', 1, 250, 150);
  assert.equal(pressed.has('KeyG'), true);
  pad.fire('pointerdown', 2, 50, 150);
  assert.equal(pressed.has('KeyD'), true);
  pad.fire('pointerup', 2);
  assert.equal(pressed.has('KeyD'), false);
  assert.equal(pressed.has('KeyG'), true);
  pad.fire('pointerup', 1);
  assert.equal(pressed.has('KeyG'), false);
});

test('a button stays held until its own last pointer is released', () => {
  const { buttons, pressed, keyboardEvents } = setUpControls();
  buttons.right.fire('pointerdown', 1);
  buttons.right.fire('pointerdown', 2);
  buttons.right.fire('pointerup', 99);
  buttons.right.fire('pointerup', 2);
  assert.equal(pressed.has('KeyG'), true);
  assert.deepEqual(keyboardEvents, [['keydown', 'KeyG']]);
  buttons.right.fire('pointerup', 1);
  assert.equal(pressed.has('KeyG'), false);
});

test('releasing the left arrow leaves the right arrow held', () => {
  const { buttons, pressed } = setUpControls();
  buttons.right.fire('pointerdown', 1);
  buttons.left.fire('pointerdown', 2);
  buttons.left.fire('pointerup', 2);
  assert.equal(pressed.has('KeyD'), false);
  assert.equal(pressed.has('KeyG'), true);
  buttons.right.fire('pointerup', 1);
  assert.equal(pressed.has('KeyG'), false);
});

test('opening settings releases held controls and announces its visibility', () => {
  const { gear, panel, buttons, pressed } = setUpControls();
  const visibility = [];
  panel.addEventListener('touchsettingschange', () => {
    visibility.push(!panel.classList.contains('hidden'));
  });
  buttons.right.fire('pointerdown', 1);
  gear.fire('click');
  assert.equal(pressed.has('KeyG'), false);
  assert.deepEqual(visibility, [true]);
});
