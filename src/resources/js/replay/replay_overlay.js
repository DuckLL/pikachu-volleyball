/**
 * Analysis overlay for the replay viewer: the ball's coming path, the six
 * predicted paths after a hit (the ones the AI weighs), and hitboxes for the
 * players and the net pillar. The physics engines compute ball.path and the
 * predictions every frame; this only draws them.
 *
 * Ported from the replay viewer DuckLL added to the P2P online version
 * (DuckLL/pikachu-volleyball-p2p-online, branch "predict").
 */
'use strict';
import { Graphics } from '@pixi/graphics';

const BALL_PATH_STYLE = { width: 3, color: 0x000000, alpha: 0.2 };
const PREDICT_PATH_COLORS = [
  0x4b0082, 0x0000ff, 0xffff00, 0x00ff00, 0xff0000, 0xff7f00,
];
const NET_X = 216;

export class ReplayOverlay {
  /**
   * @param {import('@pixi/display').Container} container the game view's container
   */
  constructor(container) {
    this.showPath = true;
    this.showPredict = true;
    this.showHitboxes = true;

    this.path = new Graphics();
    this.predict = Array.from({ length: 6 }, () => new Graphics());
    this.hitbox1 = makePlayerHitbox();
    this.hitbox2 = makePlayerHitbox();
    this.netHitboxes = makeNetHitboxes();

    container.addChild(this.path);
    for (const graphics of this.predict) {
      container.addChild(graphics);
    }
    container.addChild(this.hitbox1, this.hitbox2, this.netHitboxes);
  }

  /**
   * Redraw for the current frame.
   * @param {{player1: {x: number, y: number}, player2: {x: number, y: number}, ball: any}} physics
   */
  update(physics) {
    const { player1, player2, ball } = physics;

    this.hitbox1.visible = this.showHitboxes;
    this.hitbox2.visible = this.showHitboxes;
    this.netHitboxes.visible = this.showHitboxes;
    this.hitbox1.position.set(player1.x, player1.y);
    this.hitbox2.position.set(player2.x, player2.y);

    this.path.clear();
    for (const graphics of this.predict) {
      graphics.clear();
    }
    const path = Array.isArray(ball.path) ? ball.path : [];
    if (path.length === 0) {
      return;
    }
    if (this.showPath) {
      drawPolyline(this.path, [ball, ...path], BALL_PATH_STYLE);
    }
    if (!this.showPredict) {
      return;
    }

    // Engines store the six predictions on one point of the path; which one
    // has varied between versions, so take the first that has them.
    const withPredict = path.find(
      (point) => Array.isArray(point.predict) && point.predict.length > 0
    );
    if (!withPredict) {
      return;
    }
    for (let i = 0; i < this.predict.length; i++) {
      const predicted = withPredict.predict[i];
      if (!predicted || predicted.length === 0) {
        continue;
      }
      drawPolyline(this.predict[i], [path[0], ...predicted], {
        width: 3,
        color: PREDICT_PATH_COLORS[i],
        alpha: 0.5,
      });
    }
  }
}

function makePlayerHitbox() {
  const graphics = new Graphics();
  graphics.lineStyle({ width: 1, color: 0xffffff });
  graphics.drawRect(-32, -32, 64, 64);
  graphics.drawRect(-1, -1, 2, 2);
  return graphics;
}

function makeNetHitboxes() {
  const graphics = new Graphics();
  graphics.position.set(NET_X, 176);
  graphics.lineStyle({ width: 1, color: 0xff00ff });
  graphics.drawRect(-25, 0, 50, 16); // top of the net pillar
  graphics.lineStyle({ width: 1, color: 0x00ffff });
  graphics.drawRect(-25, 17, 50, 60);
  graphics.moveTo(0, 17);
  graphics.lineTo(0, 77); // net centre line
  return graphics;
}

/**
 * @param {Graphics} graphics
 * @param {{x: number, y: number}[]} points
 * @param {object} style
 */
function drawPolyline(graphics, points, style) {
  if (points.length < 2) {
    return;
  }
  graphics.lineStyle(style);
  graphics.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(points[i].x, points[i].y);
  }
}
