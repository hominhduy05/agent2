export type RipenessType = 'green' | 'ripe' | 'overripe' | 'defect';

export interface AnalyticsEvent {
  timestamp: number;
  cameraId: number;

  detections: number;
  avgConfidence: number;

  ripeness: RipenessType;

  weight?: number;
  blurScore?: number;
  qualityScore?: number;
}

export interface CameraAnalytics {
  events: AnalyticsEvent[];

  stats: {
    total: number;
    avgConfidence: number;
    avgWeight: number;

    ripenessCount: Record<RipenessType, number>;
  };
}

// =========================
// TRANSFORM ScadaResult → AnalyticsEvent
// =========================
export function toAnalyticsEvent(camId: number, res: any): AnalyticsEvent {
  const detections = res.detections?.length || 0;

  const avgConfidence =
    detections > 0
      ? res.detections.reduce(
          (a: number, d: any) => a + (d.confidence || 0),
          0
        ) / detections
      : 0;

  let ripeness: RipenessType = 'green';

  if (detections === 0) ripeness = 'defect';
  else if (avgConfidence > 0.85) ripeness = 'ripe';
  else if (avgConfidence < 0.5) ripeness = 'overripe';

  return {
    timestamp: res.timestamp || Date.now(),
    cameraId: camId,
    detections,
    avgConfidence,
    ripeness,
    blurScore: res.quality?.blurScore,
    qualityScore: avgConfidence,
  };
}

// =========================
// AGGREGATION ENGINE
// =========================
export function computeStats(events: AnalyticsEvent[]) {
  const total = events.length;

  const avgConfidence =
    events.reduce((a, b) => a + b.avgConfidence, 0) / (total || 1);

  const avgWeight =
    events.reduce((a, b) => a + (b.weight || 0), 0) / (total || 1);

  const ripenessCount: Record<RipenessType, number> = {
    green: 0,
    ripe: 0,
    overripe: 0,
    defect: 0,
  };

  for (const e of events) {
    ripenessCount[e.ripeness]++;
  }

  return {
    total,
    avgConfidence,
    avgWeight,
    ripenessCount,
  };
}


