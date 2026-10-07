/**
 * The game, driven by a replay file's recorded inputs instead of keyboards
 * or the AI. Ported from the P2P online version's replay viewer
 * (gorisanson/pikachu-volleyball-p2p-online), minus chat, nicknames and IPs,
 * plus a choice of physics engine (engines/index.js) and the analysis overlay.
 */
'use strict';
import seedrandom from 'seedrandom';
import { PikachuVolleyball } from '../pikavolley.js';
import { setCustomRng } from '../rand.js';
import { Cloud, Wave } from '../cloud_and_wave.js';
import { convert5bitNumberToUserInput } from '../utils/input_conversion.js';
import { ReplayOverlay } from './replay_overlay.js';
import {
  noticeEndOfReplay,
  moveScrubberTo,
  showKeyboardInputs,
} from './ui_replay.js';
import { setTickerMaxFPSAccordingToNormalFPS } from './replay_player.js';

/** @typedef {{PikaPhysics: any}} EngineModule an engine's physics.js */

// @ts-ignore
export class PikachuVolleyballReplay extends PikachuVolleyball {
  /**
   * @param {import('@pixi/display').Container} stage
   * @param {Object.<string,import('@pixi/loaders').LoaderResource>} resources
   * @param {{roomID: string, inputs: number[], options: any[]}} pack replay file content
   * @param {string} engineId
   * @param {EngineModule} engineModule
   */
  constructor(stage, resources, pack, engineId, engineModule) {
    super(stage, resources);
    this.noInputFrameTotal.menu = Infinity;

    this.roomId = pack.roomID;
    this.inputs = pack.inputs;
    this.options = pack.options;
    this.aiVersion = engineId;
    this.engineModule = engineModule;
    this.overlay = new ReplayOverlay(this.view.game.container);
    this.drawOverlay = true;

    const keyboard = () => ({
      xDirection: 0,
      yDirection: 0,
      powerHit: 0,
      getInput: () => {},
    });
    this.player1Keyboard = keyboard();
    this.player2Keyboard = keyboard();
    this.keyboardArray = [this.player1Keyboard, this.player2Keyboard];

    const fakeSound = { play: () => {}, stop: () => {} };
    const fakeBGM = {
      fake: true,
      center: { isPlaying: false },
      play: function () {
        this.center.isPlaying = true;
      },
      stop: function () {
        this.center.isPlaying = false;
      },
    };
    this.fakeAudio = {
      sounds: {
        bgm: fakeBGM,
        pipikachu: fakeSound,
        pika: fakeSound,
        chu: fakeSound,
        pi: fakeSound,
        pikachu: fakeSound,
        powerHit: fakeSound,
        ballTouchesGround: fakeSound,
      },
    };

    this.initializeForReplay();
  }

  /**
   * Use another physics engine from the next initializeForReplay on.
   * @param {string} engineId
   * @param {EngineModule} engineModule
   */
  setEngine(engineId, engineModule) {
    this.aiVersion = engineId;
    this.engineModule = engineModule;
  }

  /**
   * Back to frame 0, ready to replay again (also used for every seek)
   */
  initializeForReplay() {
    for (const prop in this.audio.sounds) {
      this.audio.sounds[prop].stop();
    }

    this.timeCurrent = 0; // unit: second
    this.timeBGM = 0;
    this.isBGMPlaying = false;
    this.replayFrameCounter = 0;
    this.optionsCounter = 0;

    // The same RNG the recording game used (see PikachuVolleyball.restart)
    setCustomRng(seedrandom.alea(this.roomId.slice(10)));

    this.view.game.cloudArray = [];
    for (let i = 0; i < 10; i++) {
      this.view.game.cloudArray.push(new Cloud());
    }
    this.view.game.wave = new Wave();
    this.view.intro.visible = false;
    this.view.menu.visible = false;
    this.view.game.visible = false;
    this.view.fadeInOut.visible = false;

    this.physics = new this.engineModule.PikaPhysics(true, true);

    this.normalFPS = 25;
    this.slowMotionFPS = 5;
    this.SLOW_MOTION_FRAMES_NUM = 6;
    this.slowMotionFramesLeft = 0;
    this.slowMotionNumOfSkippedFrames = 0;
    this.selectedWithWho = 0;
    this.scores = [0, 0];
    this.winningScore = 15;
    this.gameEnded = false;
    this.roundEnded = false;
    this.isPlayer2Serve = false;
    this.frameCounter = 0;
    this.noInputFrameCounter = 0;

    this.paused = false;
    this.isStereoSound = true;
    this._isPracticeMode = false;
    this.state = this.intro;
  }

  /**
   * Game loop with no sound and no overlay drawing, for seeking
   */
  gameLoopSilent() {
    const audio = this.audio;
    // @ts-ignore
    this.audio = this.fakeAudio;
    this.drawOverlay = false;
    this.gameLoop();
    this.drawOverlay = true;
    this.audio = audio;
  }

  /**
   * One frame of the replay
   */
  gameLoop() {
    if (this.replayFrameCounter >= this.inputs.length) {
      noticeEndOfReplay();
      return;
    }

    moveScrubberTo(this.replayFrameCounter);

    const usersInputNumber = this.inputs[this.replayFrameCounter];
    const player1Input = convert5bitNumberToUserInput(usersInputNumber >>> 5);
    const player2Input = convert5bitNumberToUserInput(
      usersInputNumber % (1 << 5)
    );
    for (const [keyboard, input] of [
      [this.player1Keyboard, player1Input],
      [this.player2Keyboard, player2Input],
    ]) {
      keyboard.xDirection = input.xDirection;
      keyboard.yDirection = input.yDirection;
      keyboard.powerHit = input.powerHit;
    }
    showKeyboardInputs(player1Input, player2Input);

    let options = this.options[this.optionsCounter];
    while (options && options[0] === this.replayFrameCounter) {
      if (options[1].speed) {
        this.normalFPS = { slow: 20, medium: 25, fast: 30 }[options[1].speed];
        setTickerMaxFPSAccordingToNormalFPS(this.normalFPS);
      }
      if ([5, 10, 15].includes(options[1].winningScore)) {
        this.winningScore = options[1].winningScore;
      }
      this.optionsCounter++;
      options = this.options[this.optionsCounter];
    }
    this.timeCurrent += 1 / this.normalFPS;

    this.isBGMPlaying = this.audio.sounds.bgm.center.isPlaying;
    if (this.isBGMPlaying) {
      this.timeBGM = (this.timeBGM + 1 / this.normalFPS) % 83; // 83 is total duration of bgm
    } else {
      this.timeBGM = 0;
    }

    this.replayFrameCounter++;
    // Inputs come from the file; the AI must not decide anything.
    this.physics.player1.isComputer = false;
    this.physics.player2.isComputer = false;
    super.gameLoop();
    if (this.drawOverlay) {
      this.overlay.update(this.physics);
    }
  }
}
