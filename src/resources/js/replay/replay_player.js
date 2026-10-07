/**
 * Replay viewer: loads a replay file, then plays, pauses and seeks it.
 * Ported from the P2P online version's replay viewer
 * (gorisanson/pikachu-volleyball-p2p-online).
 */
'use strict';
import { settings } from '@pixi/settings';
import { SCALE_MODES } from '@pixi/constants';
import { Renderer, BatchRenderer, autoDetectRenderer } from '@pixi/core';
import { Prepare } from '@pixi/prepare';
import { Container } from '@pixi/display';
import { Loader } from '@pixi/loaders';
import { SpritesheetLoader } from '@pixi/spritesheet';
import { Ticker } from '@pixi/ticker';
import { CanvasRenderer } from '@pixi/canvas-renderer';
import { CanvasGraphicsRenderer } from '@pixi/canvas-graphics';
import { CanvasSpriteRenderer } from '@pixi/canvas-sprite';
import { CanvasPrepare } from '@pixi/canvas-prepare';
import '@pixi/canvas-display';
import { ASSETS_PATH } from '../assets_path.js';
import { AI_ENGINES, DEFAULT_AI_ENGINE } from '../engines/index.js';
import { PikachuVolleyballReplay } from './pikavolley_replay.js';
import {
  setMaxForScrubberRange,
  adjustPlayPauseBtnIcon,
  showTotalTimeDuration,
  showTimeCurrent,
  enableReplayScrubberAndBtns,
  hideNoticeEndOfReplay,
  noticeFileOpenError,
  adjustFPSInputValue,
  showEngine,
  applyOverlaySwitches,
} from './ui_replay.js';
import { serialize } from '../utils/serialize.js';
import { getHashCode } from '../utils/hash_code.js';

/**
 * Which engine recorded this replay, judging by its room id: the game names
 * it "DuckLL_AI_<version>_..." (see PikachuVolleyball.restart). 4.0-7.0, and
 * the first game after "Play" in 8.0, used "DuckLL_AI_GOD_...", and P2P online
 * replays have their own ids; for those the newest engine is a guess.
 * @param {string} roomId
 * @return {{engine: import('../engines/index.js').AIEngine, detected: boolean}}
 */
export function engineForRoomId(roomId) {
  const match = /^DuckLL_AI_(\d+\.\d+)_/.exec(roomId || '');
  const engine = match && AI_ENGINES.find((e) => e.id === match[1]);
  return engine
    ? { engine, detected: true }
    : { engine: DEFAULT_AI_ENGINE, detected: false };
}

class ReplayPlayer {
  constructor() {
    Renderer.registerPlugin('prepare', Prepare);
    Renderer.registerPlugin('batch', BatchRenderer);
    CanvasRenderer.registerPlugin('prepare', CanvasPrepare);
    CanvasRenderer.registerPlugin('graphics', CanvasGraphicsRenderer);
    CanvasRenderer.registerPlugin('sprite', CanvasSpriteRenderer);
    Loader.registerPlugin(SpritesheetLoader);
    settings.RESOLUTION = 2;
    settings.SCALE_MODE = SCALE_MODES.NEAREST;
    settings.ROUND_PIXELS = true;

    this.ticker = new Ticker();
    this.ticker.minFPS = 1;
    this.renderer = autoDetectRenderer({
      width: 432,
      height: 304,
      antialias: false,
      backgroundColor: 0x000000,
      backgroundAlpha: 1,
      forceCanvas: true,
    });
    // style.css's graphic options (sharp / soft) target #game-canvas
    this.renderer.view.id = 'game-canvas';
    this.stage = new Container();
    this.loader = new Loader();
    /** @type {PikachuVolleyballReplay|null} */
    this.pikaVolley = null;
    this.playBackSpeedTimes = 1;
    this.playBackSpeedFPS = null;
  }

  /**
   * @param {File} file
   */
  readFile(file) {
    document
      .querySelector('#game-canvas-container')
      .appendChild(this.renderer.view);

    this.renderer.render(this.stage); // To make the initial canvas painting stable in the Firefox browser.
    this.ticker.add(() => {
      this.renderer.render(this.stage);
      showTimeCurrent(this.pikaVolley.timeCurrent);
      this.pikaVolley.gameLoop();
    });

    this.loader.add(ASSETS_PATH.SPRITE_SHEET);
    for (const prop in ASSETS_PATH.SOUNDS) {
      this.loader.add(ASSETS_PATH.SOUNDS[prop]);
    }
    setUpLoaderProgressBar(this.loader);

    const reader = new FileReader();
    reader.onload = (event) => {
      let pack;
      try {
        // @ts-ignore
        pack = JSON.parse(event.target.result).pack;
        const hash = pack.hash;
        pack.hash = 0;
        if (hash !== getHashCode(serialize(pack))) {
          throw 'Error: The file content is not matching the hash code';
        }
      } catch (err) {
        console.error(err);
        noticeFileOpenError();
        return;
      }
      showTotalTimeDuration(getTotalTimeDuration(pack));
      const { engine, detected } = engineForRoomId(pack.roomID);
      this.loader.load(async () => {
        const engineModule = await engine.load();
        this.pikaVolley = new PikachuVolleyballReplay(
          this.stage,
          this.loader.resources,
          pack,
          engine.id,
          engineModule
        );
        applyOverlaySwitches();
        showEngine(engine.id, detected, pack.roomID);
        setMaxForScrubberRange(pack.inputs.length);
        this.seekFrame(0);
        this.ticker.start();
        adjustPlayPauseBtnIcon();
        enableReplayScrubberAndBtns();
      });
    };
    try {
      reader.readAsText(file);
    } catch (err) {
      console.error(err);
      noticeFileOpenError();
    }
  }

  /**
   * Replay with another physics engine, staying at the current frame.
   * @param {string} id engine id
   */
  async changeEngine(id) {
    const engine = AI_ENGINES.find((e) => e.id === id);
    if (!engine || !this.pikaVolley) {
      return;
    }
    const wasPlaying = this.ticker.started;
    const frame = this.pikaVolley.replayFrameCounter;
    this.pikaVolley.setEngine(engine.id, await engine.load());
    this.seekFrame(frame);
    if (wasPlaying) {
      this.ticker.start();
    }
  }

  /**
   * Seek the specific frame
   * @param {number} frameNumber
   */
  seekFrame(frameNumber) {
    hideNoticeEndOfReplay();
    this.ticker.stop();

    this.pikaVolley.initializeForReplay();
    for (let i = 0; i < frameNumber; i++) {
      this.pikaVolley.gameLoopSilent();
    }
    this.pikaVolley.overlay.update(this.pikaVolley.physics);
    this.renderer.render(this.stage);
    showTimeCurrent(this.pikaVolley.timeCurrent);
  }

  /**
   * Seek forward/backward the relative time (seconds).
   * @param {number} seconds plus value for seeking forward, minus value for seeking backward
   */
  seekRelativeTime(seconds) {
    const seekFrameCounter = Math.max(
      0,
      this.pikaVolley.replayFrameCounter + seconds * this.pikaVolley.normalFPS
    );
    this.seekFrame(seekFrameCounter);
  }

  /**
   * Redraw the overlay after one of its switches changed while paused.
   */
  redraw() {
    if (this.pikaVolley) {
      this.pikaVolley.overlay.update(this.pikaVolley.physics);
      this.renderer.render(this.stage);
    }
  }

  /**
   * Adjust playback speed by times
   * @param {number} times
   */
  adjustPlaybackSpeedTimes(times) {
    this.playBackSpeedFPS = null;
    this.playBackSpeedTimes = times;
    this.ticker.maxFPS = this.pikaVolley.normalFPS * this.playBackSpeedTimes;
    adjustFPSInputValue();
  }

  /**
   * Adjust playback speed by fps
   * @param {number} fps
   */
  adjustPlaybackSpeedFPS(fps) {
    this.playBackSpeedTimes = null;
    this.playBackSpeedFPS = fps;
    this.ticker.maxFPS = this.playBackSpeedFPS;
    adjustFPSInputValue();
  }

  stopBGM() {
    this.pikaVolley.audio.sounds.bgm.center.stop();
  }

  playBGMProperly() {
    if (this.pikaVolley.isBGMPlaying) {
      this.pikaVolley.audio.sounds.bgm.center.play({
        start: this.pikaVolley.timeBGM,
      });
    }
  }
}

export const replayPlayer = new ReplayPlayer();

/**
 * Set ticker.maxFPS according to PikachuVolleyball object's normalFPS properly
 * @param {number} normalFPS
 */
export function setTickerMaxFPSAccordingToNormalFPS(normalFPS) {
  if (replayPlayer.playBackSpeedFPS) {
    replayPlayer.ticker.maxFPS = replayPlayer.playBackSpeedFPS;
    adjustFPSInputValue();
  } else if (replayPlayer.playBackSpeedTimes) {
    replayPlayer.ticker.maxFPS = normalFPS * replayPlayer.playBackSpeedTimes;
    adjustFPSInputValue();
  }
}

/**
 * @param {Loader} loader
 */
function setUpLoaderProgressBar(loader) {
  const loadingBox = document.getElementById('loading-box');
  const progressBar = document.getElementById('progress-bar');
  loader.onProgress.add(() => {
    progressBar.style.width = `${loader.progress}%`;
  });
  loader.onComplete.add(() => {
    loadingBox.classList.add('hidden');
  });
}

/**
 * Total duration of the replay in seconds, following its speed changes
 * @param {{inputs: number[], options: [number, {speed?: string}][]}} pack
 * @return {number}
 */
function getTotalTimeDuration(pack) {
  const FPS = { slow: 20, medium: 25, fast: 30 };
  let timeDuration = 0;
  let currentFrameCounter = 0;
  let currentFPS = 25;
  for (const [frameCounter, options] of pack.options) {
    if (options.speed && FPS[options.speed]) {
      timeDuration += (frameCounter - currentFrameCounter) / currentFPS;
      currentFrameCounter = frameCounter;
      currentFPS = FPS[options.speed];
    }
  }
  timeDuration += (pack.inputs.length - currentFrameCounter) / currentFPS;
  return timeDuration;
}
