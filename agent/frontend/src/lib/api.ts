const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface VisionResponse {
  analysis: string;
  analysis_type: string;
  confidence?: number;
  suggestions: string[];
}

interface ReportItem {
  report_id: string;
  title: string;
  analysis_type: string;
  format: string;
  created_at: string;
  size_bytes?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SFDSHealthData {
  sfds_status?: "online" | "offline";
  status_code?: number | null;
  status?: string;
  cameras?: number;
  message?: string;
  [key: string]: unknown;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${err}`);
  }
  return res.json() as Promise<T>;
}

// ─── Vision ────────────────────────────────────────────────────────────────────

export async function analyzeImage(
  file: File,
  prompt: string,
  analysisType: string
): Promise<VisionResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("prompt", prompt);
  form.append("analysis_type", analysisType);
  return request("/api/vision/analyze", {
    method: "POST",
    body: form,
  });
}

export async function analyzeDashboard(
  file: File,
  prompt: string
): Promise<VisionResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("prompt", prompt);
  return request("/api/vision/dashboard", {
    method: "POST",
    body: form,
  });
}

export async function analyzeError(
  file: File,
  prompt: string
): Promise<VisionResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("prompt", prompt);
  return request("/api/vision/error", {
    method: "POST",
    body: form,
  });
}

export async function analyzeCameraFrame(
  imageB64: string,
  prompt: string
): Promise<VisionResponse> {
  const form = new FormData();
  form.append("image_b64", imageB64);
  form.append("prompt", prompt);
  return request("/api/vision/camera", {
    method: "POST",
    body: form,
  });
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface ReportGenerateReq {
  title: string;
  content: string;
  analysis_type: string;
  format: "pdf" | "docx" | "html" | "all";
  metadata?: Record<string, string>;
}

export async function generateReport(req: ReportGenerateReq) {
  return request("/api/report/generate", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function listReports(): Promise<{ reports: ReportItem[]; total: number }> {
  return request("/api/report/list");
}

export function downloadReport(reportId: string, fmt: string = "pdf") {
  window.open(`${API_BASE}/api/report/download/${reportId}?fmt=${fmt}`, "_blank");
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  sessionId?: string
): Promise<{ reply: string; session_id: string; suggestions: string[] }> {
  return request("/api/chat/message", {
    method: "POST",
    body: JSON.stringify({ message, session_id: sessionId }),
  });
}

export async function getChatHistory(
  sessionId: string
): Promise<{ session_id: string; messages: ChatMessage[] }> {
  return request(`/api/chat/history/${sessionId}`);
}

function consumeSseStream(
  res: Response,
  sessionId: string | undefined,
  onToken: (token: string) => void,
  onError: (error: string) => void,
  onDone: (fullContent: string, sessionId: string) => void
) {
  return (async () => {
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Stream failed (${res.status}): ${err}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]" || data === "") continue;

        try {
          const event: AgentStreamEvent = JSON.parse(data);
          if (event.type === "token") {
            fullContent += event.content || "";
            onToken(event.content || "");
          } else if (event.type === "done") {
            onDone(fullContent, event.session_id || sessionId || "");
          } else if (event.type === "error") {
            onError(event.message?.trim() || "Backend stream ended with an unnamed error");
          }
        } catch (e) {
          onError(e instanceof Error ? `Invalid stream event: ${e.message}` : "Invalid stream event");
        }
      }
    }
  })();
}

// ─── SFDS ─────────────────────────────────────────────────────────────────────

export async function getSFDSCameras() {
  return request("/api/sfds/cameras");
}

export async function getSFDSStats() {
  return request("/api/sfds/stats");
}

export async function getSFDSHealth(): Promise<SFDSHealthData> {
  return request("/api/sfds/health");
}

// ─── Agent Streaming (SSE) ────────────────────────────────────────────────────

export interface AgentStreamEvent {
  type: "start" | "token" | "done" | "error";
  content?: string;
  message?: string;
  session_id?: string;
}

export function streamDirectChatMessage(
  message: string,
  sessionId: string | undefined,
  model: string | undefined,
  onToken: (token: string) => void,
  onError: (error: string) => void,
  onDone: (fullContent: string, sessionId: string) => void
): () => void {
  const controller = new AbortController();

  fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      context: { model },
    }),
    signal: controller.signal,
  })
    .then((res) => consumeSseStream(res, sessionId, onToken, onError, onDone))
    .catch((e) => {
      if (e.name !== "AbortError") {
        onError(e.message);
      }
    });

  return () => controller.abort();
}

export interface LMStudioModel {
  id: string;
  label: string;
}

export async function listAgentModels(): Promise<{
  models: LMStudioModel[];
  default_model: string;
  agent_models?: {
    vision_agent: string;
    chat_agent: string;
    report_agent: string;
  };
}> {
  return request("/api/agent/models");
}

export function streamAgentMessage(
  message: string,
  sessionId: string | undefined,
  imageB64: string | undefined,
  model: string | undefined,
  onToken: (token: string) => void,
  onError: (error: string) => void,
  onDone: (fullContent: string, sessionId: string) => void
): () => void {
  const controller = new AbortController();
  const body = JSON.stringify({
    message,
    session_id: sessionId,
    image_b64: imageB64,
    model,
  });

  fetch(`${API_BASE}/api/agent/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: controller.signal,
  })
    .then((res) => consumeSseStream(res, sessionId, onToken, onError, onDone))
    .catch((e) => {
      if (e.name !== "AbortError") {
        onError(e.message);
      }
    });

  return () => controller.abort();
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export async function getHealth() {
  return request<{
    status: string;
    model: string;
    lm_studio_url: string;
    sfds_url: string;
  }>("/health");
}
