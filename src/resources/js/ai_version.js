/**
 * "AI 版本" select in the menu bar: play against any released AI engine with
 * today's UI. Engines are extracted from the git tags by
 * scripts/extract-engines.mjs and loaded on demand.
 *
 * The choice is remembered, and ?ai=<id> in the URL overrides it (the old
 * /version/<code>/ pages redirect there).
 */
'use strict';

import { AI_ENGINES, DEFAULT_AI_ENGINE } from './engines/index.js';
import { localStorageWrapper } from './utils/local_storage_wrapper.js';

/** @typedef {import('./pikavolley.js').PikachuVolleyball} PikachuVolleyball */

const STORAGE_KEY = 'pv-offline-aiVersion';

/** Asked before switching AI in the middle of a game, by page language. */
const CONFIRM_RESTART = {
  zh: '更換 AI 版本會重新開始遊戲，目前的比分與對戰紀錄（存檔）都會清除。確定要更換嗎？',
  en: 'Changing the AI version restarts the game and clears the current score and replay record. Change it?',
  ko: 'AI 버전을 바꾸면 게임이 다시 시작되고 현재 점수와 리플레이 기록이 지워집니다. 바꾸시겠습니까?',
};

/** Every AI setting in the about box; an engine's "options" name the ones it reads. */
const AI_OPTION_IDS = [
  'serve',
  'fancy',
  'block',
  'diving',
  'anti_block',
  'early_ball',
  'jump',
  'defense',
  'delay',
];

/**
 * @param {string|null} id
 * @return {import('./engines/index.js').AIEngine|undefined}
 */
function findEngine(id) {
  return AI_ENGINES.find((engine) => engine.id === id);
}

/**
 * Grey out the AI settings the selected engine does not read.
 * @param {import('./engines/index.js').AIEngine} engine
 */
function showSupportedOptions(engine) {
  for (const id of AI_OPTION_IDS) {
    const element = /** @type {HTMLInputElement|null} */ (
      document.getElementById(id)
    );
    if (!element) {
      continue;
    }
    const supported = engine.options.includes(id);
    element.disabled = !supported;
    element.parentElement.classList.toggle('unsupported', !supported);
  }
}

/** @type {PikachuVolleyball|null} set once the game exists (after "Play") */
let game = null;
/** @type {HTMLSelectElement} */
let select;

/**
 * Load the engine into the game, or just remember it if the game has not
 * been created yet.
 * @param {import('./engines/index.js').AIEngine} engine
 */
async function apply(engine) {
  select.value = engine.id;
  showSupportedOptions(engine);
  if (!game || engine.id === game.aiVersion) {
    return;
  }
  select.disabled = true;
  try {
    const engineModule = await engine.load();
    game.setAIEngine(engine.id, engineModule);
  } catch (err) {
    console.error(`could not load AI ${engine.id}`, err);
    select.value = game.aiVersion;
    showSupportedOptions(findEngine(game.aiVersion) || DEFAULT_AI_ENGINE);
  } finally {
    select.disabled = false;
  }
}

/**
 * Fill the select as soon as the page loads, so a version can be picked
 * before the game starts.
 */
export function setUpAIVersionSelect() {
  select = /** @type {HTMLSelectElement} */ (
    document.getElementById('ai-version')
  );
  for (const engine of AI_ENGINES) {
    const option = document.createElement('option');
    option.value = engine.id;
    option.textContent = engine.id;
    option.title = engine.date;
    select.appendChild(option);
  }
  select.addEventListener('change', () => {
    // Hand the keyboard back to the game; arrow keys are player 2's controls.
    select.blur();
    const engine = findEngine(select.value);
    if (engine && game && game.isInGame && engine.id !== game.aiVersion) {
      const lang = document.documentElement.lang;
      if (!window.confirm(CONFIRM_RESTART[lang] || CONFIRM_RESTART.en)) {
        select.value = game.aiVersion;
        return;
      }
    }
    if (engine) {
      localStorageWrapper.set(STORAGE_KEY, engine.id);
      apply(engine);
    }
  });
  const fromUrl = findEngine(new URLSearchParams(location.search).get('ai'));
  const saved = findEngine(localStorageWrapper.get(STORAGE_KEY));
  apply(fromUrl || saved || DEFAULT_AI_ENGINE);
}

/**
 * Hand the game to the select once it exists, and load the chosen engine.
 * @param {PikachuVolleyball} pikaVolley
 */
export function setUpAIVersion(pikaVolley) {
  game = pikaVolley;
  apply(findEngine(select.value) || DEFAULT_AI_ENGINE);
}
