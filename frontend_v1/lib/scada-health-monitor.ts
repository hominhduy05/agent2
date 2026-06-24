import { CameraChannel } from './scada-camera';

export interface CameraHealth {
  status: 'online' | 'offline' | 'degraded' | 'testing';
  lastCheckAt: number;

  latencyMs?: number;
  fps?: number;
  frameLoss?: number;

  streamOk: boolean;
  wsOk?: boolean;
  backendOk?: boolean;

  message?: string;
}

const HEALTH_INTERVAL = 5000;
const HEALTH_TIMEOUT = 4000;

export class ScadaHealthMonitor {
  private timer: any = null;
  private cameras: CameraChannel[] = [];
  private onUpdate: (cam: CameraChannel) => void;

  // chống overlap check (rất quan trọng trong SCADA)
  private checking = new Set<number>();

  constructor(
    cameras: CameraChannel[],
    onUpdate: (cam: CameraChannel) => void
  ) {
    this.cameras = cameras;
    this.onUpdate = onUpdate;
  }

  start() {
    this.stop();

    this.timer = setInterval(() => {
      this.checkAll();
    }, HEALTH_INTERVAL);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async checkAll() {
    await Promise.all(
      this.cameras.map((cam, index) => this.checkCamera(cam, index))
    );
  }

  // =========================
  // CORE CHECK ROUTER
  // =========================
  private async checkCamera(cam: CameraChannel, index: number) {
    if (!cam.isActive) return;
    if (this.checking.has(index)) return;

    this.checking.add(index);

    cam.health = {
      status: 'testing',
      lastCheckAt: Date.now(),
      streamOk: false,
    };

    this.onUpdate(cam);

    try {
      if (cam.mode === 'ip') {
        await this.checkIPCamera(cam);
      } else {
        await this.checkWebcam(cam);
      }
    } catch (err) {
      cam.health = {
        status: 'offline',
        lastCheckAt: Date.now(),
        streamOk: false,
        message: err instanceof Error ? err.message : 'Health check failed',
      };

      this.onUpdate(cam);
    } finally {
      this.checking.delete(index);
    }
  }

  private checkWS(cam: CameraChannel) {
  return cam.ws && cam.ws.readyState === WebSocket.OPEN;
}

  // =========================
  // IP CAMERA HEALTH (REAL)
  // =========================
  private async checkIPCamera(cam: CameraChannel) {
    const start = performance.now();

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, HEALTH_TIMEOUT);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/camera/health`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'ip',
            url: cam.rtspUrl,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      const data = await res.json();
      const latency = performance.now() - start;

      const fps = data.fps ?? 0;
      const ok = data.ok === true;

      cam.health = {
        status: this.computeStatus(ok, fps, latency),

        lastCheckAt: Date.now(),

        latencyMs: Math.round(latency),
        fps,
        frameLoss: data.frame_loss ?? 0,

        streamOk: ok,
        backendOk: true,

        message: data.message || 'OK',
      };

      this.onUpdate(cam);
    } catch {
      cam.health = {
        status: 'offline',
        lastCheckAt: Date.now(),
        streamOk: false,
        backendOk: false,
        message: 'RTSP unreachable / timeout',
      };

      this.onUpdate(cam);
    }
  }

  // =========================
  // WEBCAM HEALTH
  // =========================
  private async checkWebcam(cam: CameraChannel) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();

      const fps = (settings as any).frameRate ?? 0;

      cam.health = {
        status: 'online',
        lastCheckAt: Date.now(),

        streamOk: true,
        backendOk: true,

        fps,
        latencyMs: 0,

        message: 'Webcam OK',
      };

      stream.getTracks().forEach((t) => t.stop());

      this.onUpdate(cam);
    } catch {
      cam.health = {
        status: 'offline',
        lastCheckAt: Date.now(),
        streamOk: false,
        message: 'Webcam permission denied / unavailable',
      };

      this.onUpdate(cam);
    }
  }

  // =========================
  // SCADA STATUS LOGIC
  // =========================
  private computeStatus(
    ok: boolean,
    fps: number,
    latency: number
  ): CameraHealth['status'] {
    if (!ok) return 'offline';

    if (latency > 2000 || fps < 5) {
      return 'degraded';
    }

    return 'online';
  }
}