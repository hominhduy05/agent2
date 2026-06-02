/**
 * ws-client.ts — WebSocket client singleton for real-time detection.
 *
 * Wraps a WebSocket connection to the bun-ws.ts server.
 * Call getDetectionClient() to get the singleton, then:
 *   await client.connect()
 *   const result = await client.detect(base64DataUrl, threshold)
 */

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 5;

export interface DetectionResult {
  detections: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
    class_id: number;
    class_name: string;
  }>;
  image_width: number;
  image_height: number;
  device: string;
  model_format: string;
  detection_count: number;
  session_id?: number;
  export_summary?: Record<string, number>;
  error?: string;
}

interface WsMessage {
  type: string;
  [key: string]: unknown;
}

class DetectionClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private pending = new Map<string, {
    resolve: (v: DetectionResult) => void;
    reject: (e: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private _connected = false;
  private _connecting = false;

  constructor(url = WS_URL) {
    this.url = url;
  }

  get connected() { return this._connected; }
  get connecting() { return this._connecting; }

  connect(): Promise<void> {
    if (this._connected) return Promise.resolve();
    if (this._connecting) {
      return new Promise((resolve) => {
        this.on("connected", () => resolve());
      });
    }
    return this._doConnect();
  }

  private _doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._connecting = true;
      console.log(`[ws-client] Connecting to ${this.url}...`);

      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        this._connecting = false;
        reject(err);
        return;
      }

      this.ws.addEventListener("open", () => {
        this._connected = true;
        this._connecting = false;
        this.reconnectAttempts = 0;
        console.log("[ws-client] Connected");
        this._emit("connected", {});
        resolve();
      });

      this.ws.addEventListener("message", (event) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          console.warn("[ws-client] Received non-JSON message:", event.data);
          return;
        }

        // Handle pending detect call
        if (msg.type === "detect_result" && msg.id && this.pending.has(String(msg.id))) {
          const { resolve, timeout } = this.pending.get(String(msg.id))!;
          clearTimeout(timeout);
          this.pending.delete(String(msg.id));
          resolve(msg as unknown as DetectionResult);
          return;
        }

        // Emit to listeners
        this._emit(msg.type, msg);
      });

      this.ws.addEventListener("close", (event) => {
        const wasConnected = this._connected;
        this._connected = false;
        this._connecting = false;
        console.log(`[ws-client] Disconnected (code=${event.code}, reason=${event.reason || "none"})`);

        // Reject all pending
        for (const [id, { reject, timeout }] of this.pending) {
          clearTimeout(timeout);
          reject(new Error(`WebSocket closed: ${event.reason || `code ${event.code}`}`));
        }
        this.pending.clear();

        // Auto-reconnect
        if (wasConnected && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
          console.log(`[ws-client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          setTimeout(() => this._doConnect().catch(() => {}), delay);
        }

        this._emit("disconnected", { code: event.code, reason: event.reason });
      });

      this.ws.addEventListener("error", (err) => {
        console.error("[ws-client] WebSocket error:", err);
        this._emit("error", err);
      });
    });
  }

  /**
   * Send a base64 image for detection. Returns a promise that resolves
   * with the detection result.
   */
  async detect(imageDataUrl: string, threshold = 0.25, timeoutMs = 30000): Promise<DetectionResult> {
    if (!this._connected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const msg = JSON.stringify({
        type: "detect",
        image: imageDataUrl,
        threshold,
        id,
      });

      if (this.ws?.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("Detection timeout"));
        }
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeout: timer });
      this.ws.send(msg);
    });
  }

  /**
   * Send a raw blob/File for detection. Converts to base64 internally.
   */
  async detectFile(file: File | Blob, threshold = 0.25, timeoutMs = 30000): Promise<DetectionResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        this.detect(dataUrl, threshold, timeoutMs).then(resolve).catch(reject);
      };
      reader.onerror = () => reject(new Error("Failed to read file as data URL"));
      reader.readAsDataURL(file);
    });
  }

  disconnect() {
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // prevent auto-reconnect
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this._connected = false;
    this._connecting = false;
  }

  on(event: string, cb: (data: unknown) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  private _emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

// Singleton instance
let _client: DetectionClient | null = null;

export function getDetectionClient(): DetectionClient {
  if (!_client) {
    _client = new DetectionClient();
  }
  return _client;
}
