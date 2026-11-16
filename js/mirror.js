// The live mirror: camera, on-device body tracking, and the garment overlay.
//
// Video frames are drawn to a canvas and never leave the page. Body tracking
// uses MediaPipe Pose Landmarker, which is downloaded once and then runs
// locally in the browser.

import { POSES, posePx, drawTop, drawEyewear, drawHat, drawMannequin, fitCanvas } from './garments.js';

const MP_VERSION = '0.10.14';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// MediaPipe pose landmark indices.
const LM = {
  eyeL: 2, eyeR: 5, earL: 7, earR: 8,
  ls: 11, rs: 12, le: 13, re: 14, lw: 15, rw: 16, lh: 23, rh: 24,
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

async function createTracker() {
  const vision = await import(/* @vite-ignore */ `${MP_BASE}/vision_bundle.mjs`);
  const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  const make = (delegate) =>
    vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  try {
    return await make('GPU');
  } catch {
    return make('CPU');
  }
}

export class Mirror {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(state: {mode: string, tracking: string, message: string, tone: string}) => void} onState
   */
  constructor(canvas, onState) {
    this.canvas = canvas;
    this.onState = onState;
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;

    this.mode = 'idle'; // idle | starting | live
    this.tracking = 'off'; // off | loading | ready | failed
    this.tracker = null;
    this.trackerPromise = null;
    this.stream = null;

    this.layers = { top: null, eyewear: null, hat: null };
    this.fit = { width: 1, length: 1, lift: 0 };

    this.smooth = null; // smoothed landmarks
    this.lastVideoTime = -1;
    this.lastSeen = 0;
    this.hasBody = false;
    this.message = '';

    this._frame = this._frame.bind(this);
    requestAnimationFrame(this._frame);
    this._emit('Your camera is off.', 'idle');
  }

  setLayers(layers) {
    this.layers = layers;
  }

  setFit(fit) {
    this.fit = fit;
  }

  async start() {
    if (this.mode !== 'idle') return;
    if (!navigator.mediaDevices?.getUserMedia) {
      this._emit('This browser can’t open a camera here. Try a current browser over HTTPS.', 'error');
      return;
    }
    this.mode = 'starting';
    this._emit('Waiting for camera permission…', 'busy');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      this.mode = 'idle';
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      const missing = err && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError');
      this._emit(
        denied
          ? 'Camera access was blocked. Allow it in your browser’s site settings, then try again.'
          : missing
            ? 'No camera was found on this device.'
            : 'The camera couldn’t start. Close other apps that may be using it and try again.',
        'error',
      );
      return;
    }
    this.video.srcObject = this.stream;
    try {
      await this.video.play();
    } catch {
      /* autoplay is allowed for muted inline video; ignore */
    }
    this.mode = 'live';
    this.smooth = null;
    this.hasBody = false;
    this.lastVideoTime = -1;

    if (this.tracker) {
      this.tracking = 'ready';
      this._emit('Step back until your shoulders and hips are in frame.', 'busy');
    } else {
      this.tracking = 'loading';
      this._emit('Camera on. Loading body tracking…', 'busy');
      this.trackerPromise ??= createTracker();
      try {
        this.tracker = await this.trackerPromise;
        if (this.mode === 'live') {
          this.tracking = 'ready';
          this._emit('Step back until your shoulders and hips are in frame.', 'busy');
        }
      } catch (err) {
        console.error('Body tracking failed to load', err);
        this.trackerPromise = null;
        if (this.mode === 'live') {
          this.tracking = 'failed';
          this._emit('Body tracking couldn’t load. The piece is centred instead — use Adjust fit to place it.', 'error');
        }
      }
    }
  }

  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    this.video.srcObject = null;
    this.mode = 'idle';
    this.tracking = 'off';
    this.smooth = null;
    this.hasBody = false;
    this._emit('Your camera is off.', 'idle');
  }

  /** PNG of the current mirror frame, garments included. */
  capture() {
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
  }

  _emit(message, tone) {
    if (message === this.message && tone === this.tone) return;
    this.message = message;
    this.tone = tone;
    this.onState({ mode: this.mode, tracking: this.tracking, message, tone });
  }

  _frame(now) {
    requestAnimationFrame(this._frame);
    const canvas = this.canvas;
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    const ctx = fitCanvas(canvas);
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (this.mode === 'live' && this.video.readyState >= 2 && this.video.videoWidth) {
      this._drawLive(ctx, W, H, now);
    } else {
      this._drawIdle(ctx, W, H, now);
    }
  }

  _drawLayers(ctx, pose) {
    const { top, eyewear, hat } = this.layers;
    if (top) drawTop(ctx, pose, top, this.fit);
    if (eyewear) drawEyewear(ctx, pose, eyewear);
    if (hat) drawHat(ctx, pose, hat);
  }

  _drawIdle(ctx, W, H, now) {
    const wide = W / H > 1.15;
    const side = wide ? H * 1.12 : Math.min(H * 0.92, W * 1.02);
    const cx = wide ? W * 0.68 : W * 0.5;
    const pose = posePx(POSES.stand, cx - side / 2, wide ? -H * 0.04 : -H * 0.02, side, side);

    if (!reducedMotion.matches) {
      // A slow sway and reach, so the piece is seen moving.
      const t = now / 1000;
      const swing = (p, pivot, angle) => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const dx = p.x - pivot.x;
        const dy = p.y - pivot.y;
        return { x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c };
      };
      const tilt = Math.sin(t * 0.7) * 0.035;
      const centre = { x: (pose.lh.x + pose.rh.x) / 2, y: (pose.lh.y + pose.rh.y) / 2 };
      for (const k of ['ls', 'rs', 'le', 're', 'lw', 'rw', 'eyeL', 'eyeR', 'earL', 'earR']) {
        pose[k] = swing(pose[k], centre, tilt);
      }
      const reachL = 0.22 + Math.sin(t * 0.9) * 0.2;
      const reachR = -0.14 - Math.sin(t * 0.9 + 1.8) * 0.12;
      pose.le = swing(pose.le, pose.ls, reachL);
      pose.lw = swing(swing(pose.lw, pose.ls, reachL), pose.le, reachL * 0.9);
      pose.re = swing(pose.re, pose.rs, reachR);
      pose.rw = swing(swing(pose.rw, pose.rs, reachR), pose.re, reachR * 0.9);
    }

    drawMannequin(ctx, pose, '#cbc2b1', H * 1.1);
    this._drawLayers(ctx, pose);
  }

  _drawLive(ctx, W, H, now) {
    const video = this.video;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(W / vw, H / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const ox = (W - dw) / 2;
    const oy = (H - dh) / 2;

    // Mirrored, cover-fitted video.
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, ox, oy, dw, dh);
    ctx.restore();

    if (this.tracking === 'failed') {
      const side = Math.min(W * 1.2, H * 1.05);
      this._drawLayers(ctx, posePx(POSES.stand, (W - side) / 2, H * 0.02, side, side));
      return;
    }
    if (this.tracking !== 'ready' || !this.tracker) return;

    if (video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      let result = null;
      try {
        result = this.tracker.detectForVideo(video, now);
      } catch (err) {
        console.error('Tracking error', err);
      }
      const lms = result?.landmarks?.[0];
      if (lms) {
        if (!this.smooth) {
          this.smooth = lms.map((p) => ({ x: p.x, y: p.y, v: p.visibility ?? 1 }));
        } else {
          const k = 0.55;
          lms.forEach((p, i) => {
            const s = this.smooth[i];
            s.x += (p.x - s.x) * k;
            s.y += (p.y - s.y) * k;
            s.v += ((p.visibility ?? 1) - s.v) * k;
          });
        }
        this.lastSeen = now;
      } else if (now - this.lastSeen > 500) {
        this.smooth = null;
      }
    }

    const lm = this.smooth;
    if (!lm) {
      this._setBody(false, false);
      return;
    }

    const px = (i) => ({ x: W - (ox + lm[i].x * dw), y: oy + lm[i].y * dh });
    const seen = (i, min = 0.45) => lm[i].v >= min;
    const pose = {};
    const shoulders = seen(LM.ls, 0.5) && seen(LM.rs, 0.5);

    if (shoulders) {
      pose.ls = px(LM.ls);
      pose.rs = px(LM.rs);
      const S = Math.hypot(pose.rs.x - pose.ls.x, pose.rs.y - pose.ls.y);
      const hipsSeen = seen(LM.lh, 0.35) && seen(LM.rh, 0.35);
      if (hipsSeen) {
        pose.lh = px(LM.lh);
        pose.rh = px(LM.rh);
      } else {
        // Hips out of frame: assume an upright torso.
        const mx = (pose.ls.x + pose.rs.x) / 2;
        const my = (pose.ls.y + pose.rs.y) / 2;
        pose.lh = { x: mx + (pose.ls.x - mx) * 0.62, y: my + S * 1.45 };
        pose.rh = { x: mx + (pose.rs.x - mx) * 0.62, y: my + S * 1.45 };
      }
      const down = (p, k) => ({ x: p.x, y: p.y + S * k });
      pose.le = seen(LM.le) ? px(LM.le) : down(pose.ls, 0.75);
      pose.re = seen(LM.re) ? px(LM.re) : down(pose.rs, 0.75);
      pose.lw = seen(LM.lw) ? px(LM.lw) : down(pose.le, 0.7);
      pose.rw = seen(LM.rw) ? px(LM.rw) : down(pose.re, 0.7);
      // Expected eye spacing for this body size, used when the head turns.
      const T = Math.hypot(
        (pose.lh.x + pose.rh.x - pose.ls.x - pose.rs.x) / 2,
        (pose.lh.y + pose.rh.y - pose.ls.y - pose.rs.y) / 2,
      );
      pose.eyeRef = Math.max(S, T * 0.6) * 0.14;
      this._setBody(true, hipsSeen);
    } else {
      this._setBody(false, false);
    }

    if (seen(LM.eyeL, 0.5) && seen(LM.eyeR, 0.5)) {
      pose.eyeL = px(LM.eyeL);
      pose.eyeR = px(LM.eyeR);
      pose.earL = px(LM.earL);
      pose.earR = px(LM.earR);
    }

    this._drawLayers(ctx, pose);
  }

  _setBody(hasBody, hasHips) {
    if (this.tracking !== 'ready') return;
    if (!hasBody) this._emit('Step back until your shoulders and hips are in frame.', 'busy');
    else if (!hasHips) this._emit('Tracking your shoulders. Step back a little to bring your hips into frame.', 'ok');
    else this._emit('Tracking. Turn, reach, move.', 'ok');
  }
}
