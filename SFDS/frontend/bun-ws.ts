/**
 * bun-ws.ts — Bun WebSocket server for real-time YOLO detection proxy.
 *
 * Listens for WebSocket connections on WS_PORT (default 8080).
 * Clients send JSON messages with { type: "detect", image: "<base64>", threshold: number }.
 * This server proxies the image to the FastAPI backend POST /detect/ endpoint,
 * then sends the detection result back to the client.
 *
 * Usage:
 *   bun run --bun bun-ws.ts
 *   # or: bun --bun bun-ws.ts
 */

const API_BASE = process.env.VITE_API_URL || process.env.API_URL || "http://localhost:8000";
const WS_HOST = process.env.WS_HOST || "127.0.0.1";
const WS_PORT = parseInt(process.env.WS_PORT || "8080", 10);
const WS_URL = `ws://${WS_HOST === "0.0.0.0" ? "127.0.0.1" : WS_HOST}:${WS_PORT}`;

interface DetectMessage {
  type: "detect";
  image: string; // base64 data URL, e.g. "data:image/jpeg;base64,..."
  threshold?: number;
  id?: string;
}

interface DetectResponse {
  type: "detect_result";
  detections: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
    class_id: number;
    class_name: string;
    polygon?: number[][] | null;
    track_id?: number | null;
  }>;
  image_width: number;
  image_height: number;
  device: string;
  model_format: string;
  detection_count: number;
  session_id?: number;
  export_summary?: Record<string, number>;
  id?: string;
  error?: string;
}

const clients = new Set<any>();
let clientIdCounter = 0;

console.log(`[bun-ws] Starting WebSocket server on ${WS_HOST}:${WS_PORT}`);
console.log(`[bun-ws] Proxying detections to ${API_BASE}`);

// Bun's native WebSocket server
// @ts-ignore — Bun global types
Bun.serve({
  hostname: WS_HOST,
  port: WS_PORT,

  fetch(req: Request, server: any) {
    const url = new URL(req.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // HTTP health-check endpoint
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(
        JSON.stringify({ status: "ok", clients: clients.size, ts: Date.now() }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // WebSocket upgrade
    const success = server.upgrade(req, {
      data: { id: ++clientIdCounter },
    });
    if (success) {
      return; // WebSocket established
    }
    return new Response("WebSocket upgrade failed", { status: 500 });
  },

  websocket: {
    open(ws: any) {
      clients.add(ws);
      console.log(`[bun-ws] Client ${ws.data.id} connected (total: ${clients.size})`);
      ws.send(JSON.stringify({ type: "connected", clientId: ws.data.id }));
    },

    message(ws: any, raw: Uint8Array | string) {
      const text = raw instanceof Uint8Array
        ? new TextDecoder().decode(raw)
        : String(raw);

      let msg: DetectMessage;
      try {
        msg = JSON.parse(text);
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
        return;
      }

      if (msg.type === "detect") {
        handleDetect(ws, msg).catch((err) => {
          console.error("[bun-ws] Detect error:", err);
          ws.send(JSON.stringify({
            type: "detect_result",
            detections: [],
            image_width: 0,
            image_height: 0,
            device: "bun-ws",
            model_format: "error",
            detection_count: 0,
            error: String(err.message || err),
            id: msg.id,
          } satisfies DetectResponse));
        });
      }
    },

    close(ws: any) {
      clients.delete(ws);
      console.log(`[bun-ws] Client ${ws.data.id} disconnected (total: ${clients.size})`);
    },

    perMessageDeflate: true,
  },
});

async function handleDetect(ws: any, msg: DetectMessage): Promise<void> {
  const threshold = msg.threshold ?? 0.25;
  const startTime = Date.now();

  // Extract base64 data (strip data URL prefix if present)
  let base64Data = msg.image;
  if (base64Data.includes(",")) {
    base64Data = base64Data.split(",")[1];
  }

  // Decode base64 to bytes
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Detect MIME type from base64 header
  const mimeMatch = msg.image.match(/^data:([^;]+);base64,/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const ext = mime.includes("png") ? "png" : "jpeg";

  // Proxy to FastAPI backend
  const formData = new FormData();
  const blob = new Blob([bytes], { type: mime });
  formData.append("file", blob, `capture.${ext}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const apiRes = await fetch(`${API_BASE}/detect/`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!apiRes.ok) {
      const text = await apiRes.text();
      throw new Error(`API error ${apiRes.status}: ${text}`);
    }

    const data = await apiRes.json();
    const elapsed = Date.now() - startTime;

    // Filter by threshold client-side
    const filtered = (data.detections || []).filter(
      (d: { confidence: number }) => d.confidence >= threshold
    );

    const result: DetectResponse = {
      type: "detect_result",
      detections: filtered,
      image_width: data.image_width || 0,
      image_height: data.image_height || 0,
      device: data.device || "unknown",
      model_format: data.model_format || "unknown",
      detection_count: filtered.length,
      session_id: data.session_id,
      export_summary: data.export_summary,
      id: msg.id,
    };

    console.log(`[bun-ws] Detection done in ${elapsed}ms — ${filtered.length} results (threshold=${threshold})`);
    ws.send(JSON.stringify(result));
  } catch (err: unknown) {
    clearTimeout(timeout);

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[bun-ws] Proxy error: ${errorMsg}`);

    ws.send(JSON.stringify({
      type: "detect_result",
      detections: [],
      image_width: 0,
      image_height: 0,
      device: "bun-ws",
      model_format: "error",
      detection_count: 0,
      error: errorMsg,
      id: msg.id,
    } satisfies DetectResponse));
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[bun-ws] Shutting down...");
  for (const ws of clients) {
    ws.close(1001, "Server shutting down");
  }
  process.exit(0);
});

console.log(`[bun-ws] Ready. Health check: http://localhost:${WS_PORT}/health`);
