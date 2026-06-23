// Detection utility functions: IoU, NMS, and track-based deduplication.

export interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TrackedDetection extends BBox {
  confidence: number;
  class_name: string;
  class_id?: number;
  polygon?: number[][] | null;
  track_id?: number;
}

/**
 * Compute Intersection over Union between two normalized (0-1) bounding boxes.
 */
export function computeIoU(a: BBox, b: BBox): number {
  const xA = Math.max(a.x1, b.x1);
  const yA = Math.max(a.y1, b.y1);
  const xB = Math.min(a.x2, b.x2);
  const yB = Math.min(a.y2, b.y2);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const boxAArea = (a.x2 - a.x1) * (a.y2 - a.y1);
  const boxBArea = (b.x2 - b.x1) * (b.y2 - b.y1);

  const unionArea = boxAArea + boxBArea - interArea;
  return unionArea === 0 ? 0 : interArea / unionArea;
}

/**
 * Apply Non-Maximum Suppression within each class.
 * Returns boxes with IoU >= iouThresh suppressed (the lower-confidence one removed).
 */
export function applyNMS(
  boxes: TrackedDetection[],
  iouThresh = 0.4
): TrackedDetection[] {
  if (boxes.length === 0) return [];

  const classBuckets = new Map<string, TrackedDetection[]>();
  for (const box of boxes) {
    const bucket = classBuckets.get(box.class_name) ?? [];
    bucket.push(box);
    classBuckets.set(box.class_name, bucket);
  }

  const result: TrackedDetection[] = [];

  for (const [, group] of classBuckets) {
    const sorted = [...group].sort(
      (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)
    );

    const kept: BBox[] = [];
    for (const box of sorted) {
      const dominated = kept.some((k) => computeIoU(box, k) >= iouThresh);
      if (!dominated) {
        kept.push(box);
        result.push(box);
      }
    }
  }

  return result;
}

/**
 * Deduplicate new detections against already-counted track IDs.
 * Each new box is checked against previously counted boxes via IoU.
 * Only boxes with IoU < iouThresh against all counted boxes are considered "new".
 *
 * Returns:
 *  - unique: boxes that are genuinely new (not overlapping counted ones)
 *  - newCountedIds: updated set of track IDs that have been counted
 */
export function deduplicateByTrack(
  newBoxes: TrackedDetection[],
  countedSet: Set<number>,
  iouThresh = 0.35
): {
  unique: TrackedDetection[];
  newCountedIds: Set<number>;
} {
  const countedBoxes: Array<BBox & { track_id: number }> = [];

  for (const box of newBoxes) {
    if (box.track_id != null && countedSet.has(box.track_id)) {
      countedBoxes.push(box as BBox & { track_id: number });
    }
  }

  const unique: TrackedDetection[] = [];
  const updatedSet = new Set(countedSet);

  for (const box of newBoxes) {
    if (box.track_id != null && countedSet.has(box.track_id)) {
      continue;
    }

    const overlapped = countedBoxes.some((k) => computeIoU(box, k) >= iouThresh);
    if (!overlapped) {
      unique.push(box);
      if (box.track_id != null) {
        updatedSet.add(box.track_id);
        countedBoxes.push(box as BBox & { track_id: number });
      }
    }
  }

  return { unique, newCountedIds: updatedSet };
}
