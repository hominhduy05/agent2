'use client';

import { BoundingBox } from '@/lib/types';
import { classColor, classGrade } from '@/lib/demo-class-display';
import {
  configScadaCameras,
  detectScadaCamera,
  detectWebcamFrame,
  fetchScadaFrame,
  ScadaScaleSnapshot,
  startScadaCamera,
  stopScadaCamera,
} from '@/lib/api';
import { CameraHealth } from './scada-health-monitor';
import { AnalyticsEvent } from './scada-analytics';
import { fruitStore } from './fruit-store';
import { getGrade } from './fruit-grade';

export type CameraMode = 'webcam' | 'ip';

export interface ScadaResult {
  detections: BoundingBox[];
  imageWidth: number;
  imageHeight: number;
  imageDataUrl: string;
  timestamp: number;
  cropDataUrl?: string;
  rawDetectionCount?: number;
  trackedDetectionCount?: number;
  confidenceThreshold?: number;
  scale?: ScadaScaleSnapshot | null;
  quality?: {
    phase?: string;
    reason?: string;
    blurScore?: number;
    stableFrames?: number;
    areaRatio?: number;
    edgeMarginRatio?: number;
  };
}

export interface CropHistoryItem {
  dataUrl: string;
  timestamp: number;
  detections: BoundingBox[];
  imageWidth?: number;
  imageHeight?: number;
}

export type InspectionHistoryItem = CropHistoryItem;

export interface CameraChannel {
  id: number;
  label: string;
  mode: CameraMode;
  stream: MediaStream | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  result: ScadaResult | null;
  resultHistory: ScadaResult[];
  isActive: boolean;
  isDetecting: boolean;
  error: string | null;
  deviceId: string | null;
  deviceLabel: string | null;
  rtspUrl: string;
  frameCount: number;
  autoEnabled: boolean;
  captureTimer: ReturnType<typeof setInterval> | null;
  frameTimer: ReturnType<typeof setInterval> | null;
  ws?: WebSocket;
  qualityPhase?: string;
  qualityReason?: string;
  blurScore?: number;
  stableFrames?: number;
  requiredStableFrames?: number;
  lastRawDetectionCount?: number;
  lastCropDataUrl?: string;
  lastCropAt?: number;
  cropHistory?: CropHistoryItem[];
  inspectionHistory?: InspectionHistoryItem[];
  croppedTrackIds?: Set<number>;
  cropLockedUntilEmpty?: boolean;

  health?: CameraHealth;
  analytics?: {
    events: AnalyticsEvent[];
  };
}

const CAPTURE_INTERVAL_MS = 2000;
const FRAME_FETCH_INTERVAL_MS = 500;
const WS_FRAME_INTERVAL_MS = 300;
const MAX_HISTORY = 10;
const ROI = {
  x1: 0.18,
  y1: 0.16,
  x2: 0.82,
  y2: 0.84,
};
const DEMO_ROI = {
  x1: 0.08,
  y1: 0.08,
  x2: 0.92,
  y2: 0.92,
};
let activeRoi = ROI;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';
const SCADA_SESSION_STORAGE_VERSION = 'display-id-v2';
const SCADA_SESSION_VERSION_KEY = 'scada:session-storage-version';

function normalizeBaseUrl(value: string, fallbackProtocol: 'http' | 'ws') {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || /^wss?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '');
  }
  return `${fallbackProtocol}://${raw.replace(/^\/+|\/+$/g, '')}`;
}

function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function preferBrowserHostForLocalBuild(base: string) {
  if (typeof window === 'undefined') return base;

  try {
    const url = new URL(base);
    const browserHost = window.location.hostname;

    if (browserHost && isLoopbackHostname(url.hostname) && !isLoopbackHostname(browserHost)) {
      url.hostname = browserHost;
    }

    return url.toString().replace(/\/+$/, '');
  } catch {
    return base;
  }
}

function apiBaseToWsBase(apiBase: string) {
  const normalized = normalizeBaseUrl(apiBase, 'http');
  try {
    const url = new URL(normalized);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return preferBrowserHostForLocalBuild(url.toString().replace(/\/+$/, ''));
  } catch {
    return preferBrowserHostForLocalBuild('ws://localhost:9000');
  }
}

function getScadaWsBase() {
  const envWs = normalizeBaseUrl(process.env.NEXT_PUBLIC_WS_URL || '', 'ws');
  const apiWs = apiBaseToWsBase(API_BASE);

  try {
    const envUrl = envWs ? new URL(envWs) : null;
    const apiUrl = new URL(apiWs);
    if (
      envUrl &&
      !(envUrl.hostname === 'localhost' && envUrl.port === '8080') &&
      !(envUrl.hostname === '127.0.0.1' && envUrl.port === '8080')
    ) {
      return preferBrowserHostForLocalBuild(`${envUrl.protocol}//${envUrl.host}${envUrl.pathname.replace(/\/+$/, '')}`);
    }
    return preferBrowserHostForLocalBuild(`${apiUrl.protocol}//${apiUrl.host}`);
  } catch {
    return apiWs;
  }
}

const SCADA_WS_BASE = getScadaWsBase();

function scadaDetectWsUrl(slot: number) {
  const base = SCADA_WS_BASE.replace(/\/+$/, '');
  if (/\/ws\/scada\/detect$/i.test(base)) {
    return `${base}/${slot}/`;
  }
  return `${base}/ws/scada/detect/${slot}/`;
}

function cropStorageKey(cameraId: number) {
  return `scada:last-durian-crop:${cameraId}`;
}

function isDemoResult(result: ScadaResult) {
  return result.detections.some((d) => d.class_name.startsWith('demo_grade_'));
}

function loadStoredCrop(cameraId: number) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cropStorageKey(cameraId));
    return raw
      ? (JSON.parse(raw) as { dataUrl: string; timestamp: number })
      : null;
  } catch {
    return null;
  }
}

function cropHistoryStorageKey(cameraId: number) {
  return `scada:last-durian-crops:${cameraId}`;
}

function loadStoredCropHistory(cameraId: number) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(cropHistoryStorageKey(cameraId));
    const parsed = raw ? (JSON.parse(raw) as CropHistoryItem[]) : [];
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item?.dataUrl)
        .map((item) => ({
          dataUrl: item.dataUrl,
          timestamp: item.timestamp || Date.now(),
          detections: item.detections || [],
          imageWidth: item.imageWidth,
          imageHeight: item.imageHeight,
        }))
        .slice(0, 3);
    }
  } catch {
    // Ignore malformed localStorage values.
  }
  const single = loadStoredCrop(cameraId);
  return single ? [{ ...single, detections: [] }] : [];
}

function saveStoredCropHistory(cameraId: number, history: CropHistoryItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      cropHistoryStorageKey(cameraId),
      JSON.stringify(history.slice(0, 3))
    );
  } catch {
    // Ignore quota/private mode errors. The live crop still works for this session.
  }
}

function inspectionHistoryStorageKey(cameraId: number) {
  return `scada:inspection-history:${cameraId}`;
}

function loadStoredInspectionHistory(cameraId: number) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(
      inspectionHistoryStorageKey(cameraId)
    );
    const parsed = raw ? (JSON.parse(raw) as InspectionHistoryItem[]) : [];
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (item) =>
            item?.dataUrl &&
            Array.isArray(item.detections) &&
            item.detections.length > 0
        )
        .slice(0, 200);
    }
  } catch {
    // Ignore malformed localStorage values.
  }
  return [];
}

function saveStoredInspectionHistory(
  cameraId: number,
  history: InspectionHistoryItem[]
) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      inspectionHistoryStorageKey(cameraId),
      JSON.stringify(history.slice(0, 200))
    );
  } catch {
    // Ignore quota/private mode errors. The live session still keeps the history in memory.
  }
}

function clearStoredCameraSession(cameraId: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(cropStorageKey(cameraId));
    window.localStorage.removeItem(cropHistoryStorageKey(cameraId));
    window.localStorage.removeItem(inspectionHistoryStorageKey(cameraId));
  } catch {
    // Ignore private mode/localStorage errors.
  }
}

function clearStaleStoredSessions(cameraCount: number) {
  if (typeof window === 'undefined') return;
  try {
    if (
      window.localStorage.getItem(SCADA_SESSION_VERSION_KEY) ===
      SCADA_SESSION_STORAGE_VERSION
    ) {
      return;
    }
    for (let i = 0; i < cameraCount; i++) {
      clearStoredCameraSession(i);
    }
    window.localStorage.setItem(
      SCADA_SESSION_VERSION_KEY,
      SCADA_SESSION_STORAGE_VERSION
    );
  } catch {
    // Ignore localStorage errors; resetSession still clears in-memory state.
  }
}

function detectionGrade(det: BoundingBox) {
  return det.final_grade || classGrade(det.class_name);
}

function saveStoredCrop(cameraId: number, dataUrl: string, timestamp: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      cropStorageKey(cameraId),
      JSON.stringify({ dataUrl, timestamp })
    );
  } catch {
    // Ignore quota/private mode errors. The live crop still works for this session.
  }
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, content] = dataUrl.split(',');
  const mime = meta.match(/data:(.*);base64/)?.[1] || 'image/jpeg';
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function getImagePlacement(
  canvas: HTMLCanvasElement,
  imageWidth: number,
  imageHeight: number
) {
  const scale = Math.min(
    canvas.width / imageWidth,
    canvas.height / imageHeight
  );
  return {
    scale,
    offsetX: (canvas.width - imageWidth * scale) / 2,
    offsetY: (canvas.height - imageHeight * scale) / 2,
  };
}

function drawRoiGuide(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  imageWidth: number,
  imageHeight: number
) {
  const { scale, offsetX, offsetY } = getImagePlacement(
    canvas,
    imageWidth,
    imageHeight
  );
  const x = offsetX + activeRoi.x1 * imageWidth * scale;
  const y = offsetY + activeRoi.y1 * imageHeight * scale;
  const w = (activeRoi.x2 - activeRoi.x1) * imageWidth * scale;
  const h = (activeRoi.y2 - activeRoi.y1) * imageHeight * scale;

  ctx.save();
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.95)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.roundRect(x, y, w, h, 8);
  ctx.stroke();
  ctx.restore();
}

function drawMaskPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: number[][] | null | undefined,
  scale: number,
  offsetX: number,
  offsetY: number,
  color: string
) {
  if (!polygon || polygon.length < 3) return;

  ctx.save();
  ctx.beginPath();
  polygon.forEach((point, index) => {
    const [px, py] = point;
    const x = px * scale + offsetX;
    const y = py * scale + offsetY;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
  ctx.fillStyle = `${color}35`;
  ctx.strokeStyle = `${color}e6`;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawDetections(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  result: ScadaResult
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRoiGuide(ctx, canvas, result.imageWidth, result.imageHeight);

  const { scale, offsetX, offsetY } = getImagePlacement(
    canvas,
    result.imageWidth,
    result.imageHeight
  );

  result.detections.forEach((box) => {
    const x1 = Math.max(0, Math.min(canvas.width, box.x1 * scale + offsetX));
    const y1 = Math.max(0, Math.min(canvas.height, box.y1 * scale + offsetY));
    const x2 = Math.max(0, Math.min(canvas.width, box.x2 * scale + offsetX));
    const y2 = Math.max(0, Math.min(canvas.height, box.y2 * scale + offsetY));
    const w = x2 - x1;
    const h = y2 - y1;
    if (w <= 1 || h <= 1) return;

    const color = classColor(box.class_name);
    drawMaskPolygon(ctx, box.polygon, scale, offsetX, offsetY, color);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x1, y1, w, h, 4);
    ctx.stroke();

    const idLabel = `ID ${
      box.fruit_id ?? box.display_id ?? box.track_id ?? '-'
    }`;
    // const idLabel = `ID ${box.display_id ?? box.track_id ?? '-'}`;
    const gradeLabel = classGrade(box.class_name);
    const labelHeight = 24;
    const labelPadX = 8;
    const labelY = Math.max(labelHeight + 4, y1 + labelHeight);
    ctx.setLineDash([]);
    ctx.font = 'bold 15px Sora, sans-serif';

    const idW = Math.max(42, ctx.measureText(idLabel).width + labelPadX * 2);
    const gradeW = Math.max(
      34,
      ctx.measureText(gradeLabel).width + labelPadX * 2
    );
    const idX = Math.max(4, x1 + 4);
    const gradeX = Math.max(
      idX + idW + 6,
      Math.min(canvas.width - gradeW - 4, x2 - gradeW - 4)
    );

    ctx.fillStyle = `${color}dd`;
    ctx.beginPath();
    ctx.roundRect(idX, labelY - labelHeight + 3, idW, labelHeight, 4);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(gradeX, labelY - labelHeight + 3, gradeW, labelHeight, 4);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(idLabel, idX + labelPadX, labelY - 5);
    ctx.fillText(gradeLabel, gradeX + labelPadX, labelY - 5);
  });
}

function scaleCanvasToElement(
  canvas: HTMLCanvasElement,
  el: HTMLElement | null
) {
  if (!el) return;
  const w = el.clientWidth || el.offsetWidth || 640;
  const h = el.clientHeight || el.offsetHeight || 480;
  if (canvas.width === w && canvas.height === h) return;
  canvas.width = w;
  canvas.height = h;
}

export class ScadaCameraManager {
  cameras: CameraChannel[] = [];
  private threshold = 0.25;

  private fruitCounter = 0;
  private currentFruitId: string | null = null;
  private lastFruitSeenAt = 0;
  // private assignFruitId(detections: BoundingBox[]) {
  //   if (!detections.length) return;

  //   if (!this.currentFruitId) {
  //     this.fruitCounter += 1;
  //     this.currentFruitId = `F${this.fruitCounter}`;

  //     console.log(
  //       '[NEW FRUIT]',
  //       this.currentFruitId,
  //       'counter=',
  //       this.fruitCounter
  //     );
  //   }

  //   this.lastFruitSeenAt = Date.now();

  //   detections.forEach((det) => {
  //     det.fruit_id = this.currentFruitId;
  //   });

  //   console.log('[ASSIGN]', this.currentFruitId, detections.length);
  // }
  private assignFruitId(
    cameraIndex: number,
    detections: BoundingBox[],
    source: string
  ) {
    if (!detections.length) return;

    if (!this.currentFruitId) {
      this.fruitCounter += 1;
      this.currentFruitId = `F${this.fruitCounter}`;

      console.log(
        '[NEW FRUIT]',
        this.currentFruitId,
        'cam=',
        cameraIndex,
        'source=',
        source
      );
    }

    this.lastFruitSeenAt = Date.now();

    detections.forEach((det) => {
      det.fruit_id = this.currentFruitId!;
    });

    console.log(
      '[ASSIGN]',
      this.currentFruitId,
      'cam=',
      cameraIndex,
      'source=',
      source
    );
  }
  private checkFruitGone() {
    if (!this.currentFruitId) return;

    const now = Date.now();

    // if (now - this.lastFruitSeenAt > 3000) {
    //   this.currentFruitId = null;
    // }
    if (now - this.lastFruitSeenAt > 3000) {
      this.currentFruitId = null;
    }
  }

  // private onUpdate: (camera: CameraChannel) => void;
  private onUpdate: (camera: CameraChannel) => void = () => {};

  private displayIdsByTrack: Map<string, number>[] = [];
  private gradeCounters: Record<string, number>[] = [];

  // constructor(count: number, onUpdate: (c: CameraChannel) => void) {
  //   this.onUpdate = onUpdate;
  //   clearStaleStoredSessions(count);
  //   for (let i = 0; i < count; i++) {
  //     this.cameras[i] = this.makeDefault(i);
  //     this.displayIdsByTrack[i] = new Map<string, number>();
  //     this.gradeCounters[i] = this.countGrades(
  //       this.cameras[i].inspectionHistory || []
  //     );
  //   }
  // }

  constructor(count: number, onUpdate?: (c: CameraChannel) => void) {
    if (onUpdate) {
      this.onUpdate = onUpdate;
    }

    clearStaleStoredSessions(count);

    for (let i = 0; i < count; i++) {
      this.cameras[i] = this.makeDefault(i);
      this.displayIdsByTrack[i] = new Map<string, number>();
      this.gradeCounters[i] = this.countGrades(
        this.cameras[i].inspectionHistory || []
      );
    }

    setInterval(() => {
      this.checkFruitGone();
    }, 1000);
  }

  public setOnUpdate(callback?: (camera: CameraChannel) => void) {
    this.onUpdate = callback || (() => {});
  }

  // Allow pages/components to attach or replace the update callback
  // public setOnUpdate(cb: (c: CameraChannel) => void) {
  //   this.onUpdate = cb;
  // }

  private makeDefault(id: number): CameraChannel {
    const storedCrops = loadStoredCropHistory(id);
    const storedCrop = storedCrops[0];
    const storedInspections = loadStoredInspectionHistory(id);
    return {
      id,
      label: `Camera ${id + 1}`,
      mode: 'webcam',
      stream: null,
      videoRef: { current: null } as React.RefObject<HTMLVideoElement>,
      canvasRef: { current: null } as React.RefObject<HTMLCanvasElement>,
      result: null,
      resultHistory: [],
      isActive: false,
      isDetecting: false,
      error: null,
      deviceId: null,
      deviceLabel: null,
      rtspUrl: '',
      frameCount: 0,
      autoEnabled: false,
      captureTimer: null,
      frameTimer: null,
      ws: undefined,
      qualityPhase: 'idle',
      qualityReason: 'waiting_for_fruit',
      blurScore: undefined,
      stableFrames: 0,
      requiredStableFrames: undefined,
      lastRawDetectionCount: 0,
      lastCropDataUrl: storedCrop?.dataUrl,
      lastCropAt: storedCrop?.timestamp,
      cropHistory: storedCrops,
      inspectionHistory: storedInspections,
      croppedTrackIds: new Set<number>(),
      cropLockedUntilEmpty: false,
    };
  }

  private countGrades(history: InspectionHistoryItem[]) {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    history.forEach((item) => {
      (item.detections || []).forEach((det) => {
        const grade = detectionGrade(det);
        counts[grade] = Math.max(counts[grade] || 0, det.display_id || 0);
        if (!det.display_id) {
          counts[grade] = (counts[grade] || 0) + 1;
          det.display_id = counts[grade];
        }
      });
    });
    return counts;
  }

  private displayKey(det: BoundingBox) {
    if (typeof det.track_id === 'number') return `track:${det.track_id}`;
    return `box:${detectionGrade(det)}:${Math.round(det.x1)}:${Math.round(det.y1)}:${Math.round(det.x2)}:${Math.round(det.y2)}`;
  }

  private decorateDisplayIds(
    index: number,
    detections: BoundingBox[],
    allowCreate: boolean
  ) {
    const idMap = this.displayIdsByTrack[index] || new Map<string, number>();
    const counters = this.gradeCounters[index] || { A: 0, B: 0, C: 0, D: 0 };
    this.displayIdsByTrack[index] = idMap;
    this.gradeCounters[index] = counters;

    detections.forEach((det) => {
      if (typeof det.display_id === 'number') return;
      const key = this.displayKey(det);
      const known = idMap.get(key);
      if (known !== undefined) {
        det.display_id = known;
        return;
      }
      if (!allowCreate) return;
      const grade = detectionGrade(det);
      const nextId = (counters[grade] || 0) + 1;
      counters[grade] = nextId;
      idMap.set(key, nextId);
      det.display_id = nextId;
    });
  }

  private rememberCrop(index: number, item: CropHistoryItem) {
    const cam = this.cameras[index];
    const nextHistory = [item, ...(cam.cropHistory || [])].slice(0, 3);
    cam.cropHistory = nextHistory;
    cam.lastCropDataUrl = item.dataUrl;
    cam.lastCropAt = item.timestamp;
    saveStoredCrop(index, item.dataUrl, item.timestamp);
    saveStoredCropHistory(index, nextHistory);

    if (item.detections.length > 0) {
      const nextInspections = [item, ...(cam.inspectionHistory || [])].slice(
        0,
        200
      );
      cam.inspectionHistory = nextInspections;
      saveStoredInspectionHistory(index, nextInspections);
    }
  }

  private hasCapturedTrack(index: number, result: ScadaResult) {
    if (
      result.quality?.phase === 'captured' &&
      this.cameras[index].cropLockedUntilEmpty
    ) {
      return true;
    }
    const trackId = this.getPrimaryTrackId(result);
    if (trackId == null) return false;
    return this.cameras[index].croppedTrackIds?.has(trackId) ?? false;
  }

  private markCapturedTrack(index: number, result: ScadaResult) {
    if (result.quality?.phase === 'captured') {
      this.cameras[index].cropLockedUntilEmpty = true;
    }
    const trackId = this.getPrimaryTrackId(result);
    if (trackId == null) return;
    if (!this.cameras[index].croppedTrackIds) {
      this.cameras[index].croppedTrackIds = new Set<number>();
    }
    this.cameras[index].croppedTrackIds.add(trackId);
  }

  private getPrimaryTrackId(result: ScadaResult) {
    if (!result.detections.length) return null;
    const best = [...result.detections].sort(
      (a, b) => b.confidence - a.confidence
    )[0];
    return typeof best.track_id === 'number' ? best.track_id : null;
  }

  private async analyzeCrop(
    index: number,
    crop: { dataUrl: string; blob: Blob },
    fallback: ScadaResult
  ) {
    let detections: BoundingBox[] = [];
    let imageWidth: number | undefined;
    let imageHeight: number | undefined;

    // DEMO ONLY: backend already assigned B -> A -> C -> D on the accepted frame.
    // Do not run crop re-detect here, otherwise the second API call can overwrite
    // the demo label with the model's real class.
    if (
      fallback.detections.some((d) => d.class_name.startsWith('demo_grade_'))
    ) {
      detections = fallback.detections;
      imageWidth = fallback.imageWidth;
      imageHeight = fallback.imageHeight;
    } else {
      try {
        const data = await detectWebcamFrame(crop.blob, this.threshold);
        const cropDetections = (data.detections || []).filter(
          (d) => d.confidence >= this.threshold
        );
        // detections = cropDetections;
        detections = cropDetections;

        // this.assignFruitId(detections);
        this.assignFruitId(index, detections, 'ws');
        imageWidth = data.image_width;
        imageHeight = data.image_height;
      } catch {
        // Do not fall back to frame-level labels. Crop analysis is the source of truth.
      }
    }

    this.decorateDisplayIds(index, detections, true);

    const item: CropHistoryItem = {
      dataUrl: crop.dataUrl,
      timestamp: fallback.timestamp,
      detections,
      imageWidth,
      imageHeight,
    };

    const det = detections[0];

    if (det && det.fruit_id && crop.dataUrl) {
  fruitStore.addCameraResult(
    String(det.fruit_id),
    index + 1,
    getGrade(det),
    crop.dataUrl
  );
}

    this.rememberCrop(index, item);
    this.markCapturedTrack(index, fallback);
    fallback.cropDataUrl = crop.dataUrl;
    fallback.detections = detections;
  }

  setThreshold(t: number) {
    this.threshold = t;
  }

  sendThreshold(index: number) {
    const cam = this.cameras[index];
    if (cam.ws && cam.ws.readyState === WebSocket.OPEN) {
      cam.ws.send(
        JSON.stringify({ type: 'set_confidence', value: this.threshold })
      );
    }
  }

  setDemoMode(enabled: boolean) {
    activeRoi = enabled ? DEMO_ROI : ROI;
    this.cameras.forEach((cam, index) => {
      if (!cam.isActive) return;
      const result = cam.result;
      if (result?.detections.length) {
        this.drawResult(index, result);
      } else {
        this.drawGuide(index, result?.imageWidth, result?.imageHeight);
      }
    });
  }

  setRefs(
    id: number,
    videoRef: React.RefObject<HTMLVideoElement | null>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>
  ) {
    const cam = this.cameras[id];

    cam.videoRef = videoRef;
    cam.canvasRef = canvasRef;

    const video = videoRef.current;

    if (!video || !cam.isActive || cam.mode !== 'webcam' || !cam.stream) {
      return;
    }

    // tránh gán lại liên tục
    if (video.srcObject !== cam.stream) {
      video.srcObject = cam.stream;
    }

    const restore = async () => {
      try {
        await video.play();
      } catch {}

      if (cam.result) {
        this.drawResult(id, cam.result);
      } else {
        this.drawGuide(id);
      }
    };

    if (video.readyState >= 2) {
      restore();
    } else {
      video.addEventListener('loadedmetadata', restore, { once: true });
    }
  }

  // setRefs(
  //   id: number,
  //   videoRef: React.RefObject<HTMLVideoElement>,
  //   canvasRef: React.RefObject<HTMLCanvasElement>
  // )
  //  {
  //   const cam = this.cameras[id];

  //   cam.videoRef = videoRef;
  //   cam.canvasRef = canvasRef;

  //   // restore webcam stream khi quay lại page
  //   if (
  //     cam.isActive &&
  //     cam.mode === 'webcam' &&
  //     cam.stream &&
  //     videoRef.current
  //   ) {
  //     videoRef.current.srcObject = cam.stream;

  //     videoRef.current.play().catch(() => {});

  //     // vẽ lại detection
  //     if (cam.result) {
  //       this.drawResult(id, cam.result);
  //     } else {
  //       this.drawGuide(id);
  //     }
  //   }

  //   // restore IP camera
  //   if (cam.isActive && cam.mode === 'ip' && cam.result) {
  //     this.drawResult(id, cam.result);
  //   }
  // }

  resetSession(index: number) {
    const cam = this.cameras[index];
    if (!cam) return;

    const shouldResumeAuto = cam.isActive && cam.autoEnabled;
    this.stopAuto(index);
    clearStoredCameraSession(index);
    this.displayIdsByTrack[index] = new Map<string, number>();
    this.gradeCounters[index] = { A: 0, B: 0, C: 0, D: 0 };
    cam.result = null;
    cam.resultHistory = [];
    cam.frameCount = 0;
    cam.lastCropDataUrl = undefined;
    cam.lastCropAt = undefined;
    cam.cropHistory = [];
    cam.inspectionHistory = [];
    cam.croppedTrackIds = new Set<number>();
    cam.cropLockedUntilEmpty = false;
    cam.qualityPhase = 'idle';
    cam.qualityReason = 'waiting_for_fruit';
    cam.blurScore = undefined;
    cam.stableFrames = 0;
    cam.requiredStableFrames = undefined;
    cam.lastRawDetectionCount = 0;
    cam.error = null;

    if (cam.canvasRef?.current) {
      const ctx = cam.canvasRef.current.getContext('2d');
      ctx?.clearRect(
        0,
        0,
        cam.canvasRef.current.width,
        cam.canvasRef.current.height
      );
    }
    if (cam.isActive) {
      this.drawGuide(index);
    }
    this.onUpdate(cam);

    if (shouldResumeAuto) {
      setTimeout(() => this.startAuto(index), 120);
    }
  }

  // ── Webcam mode ────────────────────────────────────────────────

  async startWebcam(index: number, deviceId: string, deviceLabel: string) {
    const cam = this.cameras[index];
    if (cam.isActive) return;
    cam.error = null;
    cam.mode = 'webcam';
    try {
      // const stream = await navigator.mediaDevices.getUserMedia({
      //   video: { deviceId: { exact: deviceId } },
      // });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
        },
      });
      cam.stream = stream;
      cam.deviceId = deviceId;
      cam.deviceLabel = deviceLabel;
      cam.isActive = true;

      if (cam.videoRef?.current) {
        cam.videoRef.current.srcObject = stream;
        cam.videoRef.current.onloadedmetadata = () => {
          cam.videoRef?.current?.play().catch(() => {});
          this.drawGuide(index);
          if (cam.autoEnabled) this.startWebSocketDetect(index);
        };
        cam.videoRef.current.play().catch(() => {});
      }
      this.drawGuide(index);
      this.onUpdate(cam);
    } catch (err) {
      cam.error = err instanceof Error ? err.message : 'Loi bat camera';
      console.log(err);
      this.onUpdate(cam);
    }
  }

  // ── IP Camera (RTSP) mode ───────────────────────────────────────

  async startIPCamera(index: number, rtspUrl: string, label?: string) {
    const cam = this.cameras[index];
    if (cam.isActive) return;
    cam.error = null;
    cam.mode = 'ip';
    cam.rtspUrl = rtspUrl;
    cam.deviceLabel = label || rtspUrl;

    try {
      // Gui RTSP URL len backend truoc (luu cau hinh) roi moi start
      await configScadaCameras({ [String(index)]: rtspUrl });
      await startScadaCamera(index);
      cam.isActive = true;

      // Start frame-fetch loop: pull JPEG from backend, display in <img> via object URL
      this.startFrameLoop(index);
      this.drawGuide(index);

      if (cam.autoEnabled) this.startAuto(index);
      this.onUpdate(cam);
    } catch (err) {
      cam.error = err instanceof Error ? err.message : 'Loi ket noi IP camera';
      this.onUpdate(cam);
    }
  }

  private startFrameLoop(index: number) {
    const cam = this.cameras[index];
    if (cam.frameTimer) clearInterval(cam.frameTimer);

    let lastUrl: string | null = null;

    cam.frameTimer = setInterval(async () => {
      if (!cam.isActive || cam.mode !== 'ip') {
        if (cam.frameTimer) clearInterval(cam.frameTimer);
        return;
      }

      try {
        const blob = await fetchScadaFrame(index);
        const url = URL.createObjectURL(blob);

        if (cam.videoRef?.current) {
          cam.videoRef.current.src = url;
          cam.videoRef.current.play().catch(() => {});
        }

        // 🔥 revoke URL cũ để tránh leak + đen video
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = url;
      } catch {
        // ignore
      }
    }, FRAME_FETCH_INTERVAL_MS);
  }

  private stopFrameLoop(index: number) {
    const cam = this.cameras[index];
    if (cam.frameTimer) {
      clearInterval(cam.frameTimer);
      cam.frameTimer = null;
    }
    if (cam.videoRef?.current) {
      cam.videoRef.current.src = '';
    }
  }

  // ── Stop ───────────────────────────────────────────────────────

  stopCamera(index: number) {
    const cam = this.cameras[index];
    this.stopAuto(index);
    this.stopFrameLoop(index);

    if (cam.mode === 'ip') {
      stopScadaCamera(index).catch(() => {});
    }

    if (cam.stream) {
      cam.stream.getTracks().forEach((t) => t.stop());
      cam.stream = null;
    }
    if (cam.ws) {
      cam.ws.close();
      cam.ws = undefined;
    }
    if (cam.videoRef?.current) cam.videoRef.current.srcObject = null;
    if (cam.canvasRef?.current) {
      const ctx = cam.canvasRef.current.getContext('2d');
      ctx?.clearRect(
        0,
        0,
        cam.canvasRef.current.width,
        cam.canvasRef.current.height
      );
    }

    cam.isActive = false;
    // cam.deviceId = null;
    // cam.deviceLabel = null;
    cam.rtspUrl = '';
    cam.result = null;
    cam.resultHistory = [];
    cam.croppedTrackIds = new Set<number>();
    cam.cropLockedUntilEmpty = false;
    cam.frameCount = 0;
    cam.qualityPhase = 'idle';
    cam.qualityReason = 'waiting_for_fruit';
    cam.blurScore = undefined;
    cam.stableFrames = 0;
    cam.requiredStableFrames = undefined;
    cam.lastRawDetectionCount = 0;
    cam.error = null;
    this.onUpdate(cam);
  }

  // ── Auto capture ───────────────────────────────────────────────

  startAuto(index: number) {
    const cam = this.cameras[index];
    if (!cam.isActive || cam.autoEnabled) return;
    cam.autoEnabled = true;
    if (cam.mode === 'webcam') {
      this.startWebSocketDetect(index);
    } else {
      this.captureAndDetect(index);
      cam.captureTimer = setInterval(
        () => this.captureAndDetect(index),
        CAPTURE_INTERVAL_MS
      );
    }
    this.onUpdate(cam);
  }

  stopAuto(index: number) {
    const cam = this.cameras[index];
    if (cam.captureTimer) {
      clearInterval(cam.captureTimer);
      cam.captureTimer = null;
    }
    if (cam.ws) {
      cam.ws.close();
      cam.ws = undefined;
    }
    cam.autoEnabled = false;
    cam.isDetecting = false;
    this.onUpdate(cam);
  }

  // ── WebSocket real-time detection (via Bun WS proxy on port 8080) ─────

  startWebSocketDetect(index: number) {
    const cam = this.cameras[index];
    console.log(
      '[START WS]',
      index,
      'active=',
      cam.isActive,
      'hasWs=',
      !!cam.ws
    );

    if (!cam.isActive || cam.ws) return;

    const url = scadaDetectWsUrl(index);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      cam.isDetecting = true;
      this.onUpdate(cam);
      this._sendWebSocketFrame(index, ws);
      console.log('[WS OPEN]', index);
    };

    ws.onmessage = async (event) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (data.type === 'error') {
        cam.error = String(data.message || 'Loi nhan dien');
        this.onUpdate(cam);
        return;
      }
      if (data.type === 'quality_status') {
        const reason = data.reason as string | undefined;
        if (
          reason === 'tracked_fruit_left_frame' ||
          reason === 'active_fruit_lost_before_capture'
        ) {
          cam.cropLockedUntilEmpty = false;
        }
        cam.qualityPhase = data.phase as string | undefined;
        cam.qualityReason = reason;
        cam.blurScore = data.blur_score as number | undefined;
        cam.stableFrames = data.stable_frames as number | undefined;
        cam.requiredStableFrames = data.required_stable_frames as
          | number
          | undefined;
        cam.lastRawDetectionCount = data.raw_detection_count as
          | number
          | undefined;
        cam.frameCount += 1;
        cam.error = null;
        this.drawGuide(
          index,
          (data.image_width as number | undefined) || undefined,
          (data.image_height as number | undefined) || undefined
        );
        this.onUpdate(cam);

        if (
          cam.isActive &&
          cam.autoEnabled &&
          cam.isDetecting &&
          ws.readyState === WebSocket.OPEN
        ) {
          setTimeout(
            () => this._sendWebSocketFrame(index, ws),
            WS_FRAME_INTERVAL_MS
          );
        }
        return;
      }
      if (data.type !== 'result') return;

      const quality = data.quality as Record<string, unknown> | undefined;
      const result: ScadaResult = {
        detections: (data.detections as ScadaResult['detections']) || [],
        imageWidth: (data.image_width as number) || 640,
        imageHeight: (data.image_height as number) || 480,
        imageDataUrl: '',
        timestamp: Date.now(),
        rawDetectionCount: data.raw_detection_count as number | undefined,
        trackedDetectionCount: data.tracked_detection_count as
          | number
          | undefined,
        confidenceThreshold: data.confidence_threshold as number | undefined,
        scale: (data.scale as ScadaScaleSnapshot | null | undefined) || null,
        quality: quality
          ? {
              phase: quality.phase as string | undefined,
              reason: quality.reason as string | undefined,
              blurScore: quality.blur_score as number | undefined,
              stableFrames: quality.stable_frames as number | undefined,
              areaRatio: quality.area_ratio as number | undefined,
              edgeMarginRatio: quality.edge_margin_ratio as number | undefined,
            }
          : undefined,
      };

      // this.assignFruitId(result.detections);
      this.assignFruitId(index, result.detections, 'ws');

      const crop = this.hasCapturedTrack(index, result)
        ? null
        : this.captureCrop(index, result);
      if (crop) {
        await this.analyzeCrop(index, crop, result);
      } else {
        this.decorateDisplayIds(index, result.detections, false);
      }
      this.drawResult(index, result);
      cam.result = result;
      cam.resultHistory = [result, ...cam.resultHistory].slice(0, MAX_HISTORY);
      cam.frameCount += 1;
      cam.qualityPhase = result.quality?.phase || 'captured';
      cam.qualityReason = result.quality?.reason || 'frame_accepted';
      cam.blurScore = result.quality?.blurScore;
      cam.stableFrames = result.quality?.stableFrames;
      cam.lastRawDetectionCount = result.rawDetectionCount;
      cam.error = null;
      this.onUpdate(cam);

      if (result.detections.length > 0) {
        const isDemo = isDemoResult(result);
        cam.qualityPhase = isDemo ? 'captured' : 'cooldown';
        this.onUpdate(cam);
        if (!isDemo) {
          setTimeout(() => {
            const current = this.cameras[index];
            if (current.isActive) {
              this.drawGuide(index, result.imageWidth, result.imageHeight);
            }
          }, 700);
        }
      }

      if (
        cam.isActive &&
        cam.autoEnabled &&
        cam.isDetecting &&
        ws.readyState === WebSocket.OPEN
      ) {
        setTimeout(
          () => this._sendWebSocketFrame(index, ws),
          WS_FRAME_INTERVAL_MS
        );
      }

      console.log('[RESULT]', index, data);
    };

    ws.onerror = () => {
      cam.error = 'Loi ket noi WebSocket';
      this.onUpdate(cam);
    };

    ws.onclose = (e) => {
      // 1000 = normal close, 1001 = going away — both are intentional
      const intentional = e.code === 1000 || e.code === 1001;
      cam.isDetecting = false;
      cam.ws = undefined;
      this.onUpdate(cam);
      if (
        !intentional &&
        cam.isActive &&
        cam.autoEnabled &&
        cam.mode === 'webcam'
      ) {
        setTimeout(() => this.startWebSocketDetect(index), 2000);
      }
    };

    cam.ws = ws;
  }

  private _sendWebSocketFrame(index: number, ws: WebSocket) {
    const cam = this.cameras[index];
    if (
      !cam.isActive ||
      !cam.autoEnabled ||
      !cam.isDetecting ||
      ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const video = this.cameras[index].videoRef?.current;
    if (
      !video ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setTimeout(() => this._sendWebSocketFrame(index, ws), 100);
      return;
    }

    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const ctx = captureCanvas.getContext('2d');
    if (!ctx) {
      setTimeout(
        () => this._sendWebSocketFrame(index, ws),
        WS_FRAME_INTERVAL_MS
      );
      return;
    }
    ctx.drawImage(video, 0, 0);

    captureCanvas.toBlob(
      (blob) => {
        if (blob && ws.readyState === WebSocket.OPEN) {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            console.log(
              '[SEND]',
              index,
              video?.videoWidth,
              video?.videoHeight,
              ws.readyState
            );
            ws.send(
              JSON.stringify({
                type: 'frame',
                data: base64,
                confidence: this.threshold,
              })
            );
          };
          reader.readAsDataURL(blob);
        } else if (ws.readyState === WebSocket.OPEN) {
          setTimeout(
            () => this._sendWebSocketFrame(index, ws),
            WS_FRAME_INTERVAL_MS
          );
        }
      },
      'image/jpeg',
      0.7
    );
  }

  // ── Detect ─────────────────────────────────────────────────────

  async captureAndDetect(index: number) {
    const cam = this.cameras[index];
    if (!cam.isActive || cam.isDetecting) return;

    const video = cam.videoRef?.current;
    if (!video) return;

    // For IP camera: video.src is already set by frame loop
    // For webcam: need readyState >= 2
    if (cam.mode === 'webcam' && video.readyState < 2) return;

    cam.isDetecting = true;
    this.onUpdate(cam);

    try {
      if (cam.mode === 'ip') {
        // Use backend detection endpoint — sends RTSP frame through YOLO
        const data = await detectScadaCamera(index, this.threshold);
        const slotResult = data.results[0];

        // Create a temporary canvas to hold the latest frame image
        let dataUrl = '';
        try {
          const blob = await fetchScadaFrame(index);
          dataUrl = await blobToDataUrl(blob);
        } catch {
          // Use existing video frame
          const c = document.createElement('canvas');
          c.width = video.videoWidth || video.clientWidth || 640;
          c.height = video.videoHeight || video.clientHeight || 480;
          const ctx2 = c.getContext('2d')!;
          ctx2.drawImage(video, 0, 0);
          dataUrl = c.toDataURL('image/jpeg', 0.85);
        }

        const result: ScadaResult = {
          detections: slotResult?.detections || [],
          imageWidth: slotResult?.image_width || 640,
          imageHeight: slotResult?.image_height || 480,
          imageDataUrl: dataUrl,
          timestamp: Date.now(),
          scale: slotResult?.scale || data.scale || null,
        };
        // this.assignFruitId(result.detections);
        this.assignFruitId(index, result.detections, 'ws');

        const crop = this.hasCapturedTrack(index, result)
          ? null
          : this.captureCrop(index, result);
        if (crop) {
          await this.analyzeCrop(index, crop, result);
        } else {
          this.decorateDisplayIds(index, result.detections, false);
        }
        this.drawResult(index, result);
        cam.result = result;
        cam.resultHistory = [result, ...cam.resultHistory].slice(
          0,
          MAX_HISTORY
        );
        cam.frameCount += 1;
        if (!isDemoResult(result)) {
          setTimeout(() => {
            if (this.cameras[index].isActive) {
              this.drawGuide(index, result.imageWidth, result.imageHeight);
            }
          }, 700);
        }
      } else {
        // Webcam: capture canvas frame + upload to BE /detect/ endpoint
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tctx = tempCanvas.getContext('2d')!;
        tctx.drawImage(video, 0, 0);

        const blob = await new Promise<Blob | null>((r) =>
          tempCanvas.toBlob(r, 'image/jpeg', 0.85)
        );
        if (!blob) throw new Error('Blob creation failed');

        // Gui blob vua capture len backend de nhan dien
        const data = await detectWebcamFrame(blob, this.threshold);
        const boxes = (data.detections || []).filter(
          (d) => d.confidence >= this.threshold
        );

        const result: ScadaResult = {
          detections: boxes,
          imageWidth: data.image_width || video.videoWidth,
          imageHeight: data.image_height || video.videoHeight,
          imageDataUrl: '',
          timestamp: Date.now(),
          scale:
            data.scale ||
            (boxes[0]?.weight_kg !== undefined
              ? {
                  weight_kg: Number(boxes[0]?.weight_kg || 0),
                  raw_value: Number(boxes[0]?.weight_kg || 0),
                  unit: 'kg',
                  stable: Boolean(boxes[0]?.scale_stable ?? true),
                  fruit_id: String(boxes[0]?.fruit_id || ''),
                  source: 'detect',
                  timestamp: Date.now() / 1000,
                  age_seconds: Number(boxes[0]?.scale_age_seconds || 0),
                  timestamp_ms: Date.now(),
                }
              : null),
        };
        // this.assignFruitId(result.detections);
        this.assignFruitId(index, result.detections, 'ws');

        const crop = this.hasCapturedTrack(index, result)
          ? null
          : this.captureCrop(index, result);
        if (crop) {
          await this.analyzeCrop(index, crop, result);
        } else {
          this.decorateDisplayIds(index, result.detections, false);
        }
        this.drawResult(index, result);
        cam.result = result;
        cam.resultHistory = [result, ...cam.resultHistory].slice(
          0,
          MAX_HISTORY
        );
        cam.frameCount += 1;
        if (!isDemoResult(result)) {
          setTimeout(() => {
            if (this.cameras[index].isActive) {
              this.drawGuide(index, result.imageWidth, result.imageHeight);
            }
          }, 700);
        }
      }

      cam.error = null;
    } catch (err) {
      cam.error = err instanceof Error ? err.message : 'Loi nhan dien';
    } finally {
      cam.isDetecting = false;
      this.onUpdate(cam);
    }
  }

  private drawResult(index: number, result: ScadaResult) {
    const cam = this.cameras[index];
    const canvas = cam.canvasRef?.current;
    const video = cam.videoRef?.current;
    if (!canvas || !video) return;

    if (cam.mode === 'ip') {
      // Scale canvas to video element size
      scaleCanvasToElement(canvas, video);
      const ctx = canvas.getContext('2d')!;
      drawDetections(ctx, canvas, result);
    } else {
      scaleCanvasToElement(canvas, video);
      const ctx = canvas.getContext('2d')!;
      drawDetections(ctx, canvas, result);
    }
  }

  private drawGuide(index: number, imageWidth?: number, imageHeight?: number) {
    const cam = this.cameras[index];
    const canvas = cam.canvasRef?.current;
    const video = cam.videoRef?.current;
    if (!canvas || !video || !cam.isActive) return;

    scaleCanvasToElement(canvas, video);
    const width = imageWidth || video.videoWidth || video.clientWidth || 640;
    const height =
      imageHeight || video.videoHeight || video.clientHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRoiGuide(ctx, canvas, width, height);
  }

  private captureCrop(index: number, result: ScadaResult) {
    if (result.detections.length === 0) return null;
    const video = this.cameras[index].videoRef?.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const best = [...result.detections].sort(
      (a, b) => b.confidence - a.confidence
    )[0];
    const sx = video.videoWidth / result.imageWidth;
    const sy = video.videoHeight / result.imageHeight;
    const padX = Math.max(16, (best.x2 - best.x1) * 0.14);
    const padY = Math.max(16, (best.y2 - best.y1) * 0.14);
    const x = Math.max(0, Math.floor((best.x1 - padX) * sx));
    const y = Math.max(0, Math.floor((best.y1 - padY) * sy));
    const w = Math.min(
      video.videoWidth - x,
      Math.ceil((best.x2 - best.x1 + padX * 2) * sx)
    );
    const h = Math.min(
      video.videoHeight - y,
      Math.ceil((best.y2 - best.y1 + padY * 2) * sy)
    );
    if (w <= 8 || h <= 8) return null;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w;
    cropCanvas.height = h;
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, x, y, w, h, 0, 0, w, h);
    const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.88);
    return {
      dataUrl,
      blob: dataUrlToBlob(dataUrl),
    };
  }

  cleanup() {
    this.cameras.forEach((_, i) => this.stopCamera(i));
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
