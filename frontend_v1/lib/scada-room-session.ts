/**
 * scada-room-session.ts
 *
 * Giải quyết vấn đề: 5 camera trong cùng 1 buồng quét cùng 1 quả sầu riêng
 * nhưng backend trả về 5 fruit_id khác nhau (do ánh sáng, góc nhìn, timing lệch).
 *
 * Giải pháp: RoomFruitMerger gom các detection từ nhiều camera trong cùng buồng
 * thành 1 unified_fruit_id duy nhất, dựa trên time-window + spatial proximity.
 *
 * Cách dùng:
 *   import { getRoomMerger } from './scada-room-session';
 *
 *   // Trong ScadaCameraManager, sau khi nhận result từ backend:
 *   const merger = getRoomMerger();
 *   const unified = merger.resolveDetections(cameraId, result.detections, result.timestamp);
 *   result.detections = unified; // đã map về cùng fruit_id
 */

import { BoundingBox } from '@/lib/types';

// ─── Config ────────────────────────────────────────────────────────────────

/** Thời gian tối đa (ms) để gom các detection từ các cam khác nhau thành 1 quả */
const MERGE_WINDOW_MS = 10000;

/** Thời gian giữ lại entry trong registry trước khi expire (ms) */
const ENTRY_TTL_MS = 20000;

/** Độ tương đồng bounding box tối thiểu để xem là cùng 1 quả (IoU-like score) */
const MIN_SPATIAL_SCORE = 0.0; // Tắt spatial check vì các cam có góc nhìn khác nhau
// → chỉ dùng time-window. Đặt > 0 nếu tất cả cam cùng góc (ví dụ: belt top-down).

/**
 * Map cameraId → roomId.
 * Mỗi buồng có 5 cam: buồng 1 = cam 0-4, buồng 2 = cam 5-9, ...
 * (index 0-based, khớp với ScadaCameraManager.cameras[index])
 */
export function getRoomIdByCameraIndex(cameraIndex: number): number {
  return Math.floor(cameraIndex / 5);
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface FruitEntry {
  unifiedFruitId: string;

  captureStart: number;
  captureEnd: number;

  seenByCameras: Set<number>;

  displayId: number;
}

// ─── RoomFruitMerger ────────────────────────────────────────────────────────

export class RoomFruitMerger {
  private roomId: number;

  /**
   * Danh sách các quả đang được track trong buồng này.
   * Key = masterFruitId
   */
  private entries = new Map<string, FruitEntry>();

  /**
   * Alias lookup: fruitId (từ bất kỳ cam nào) → masterFruitId
   */
//   private aliasMap = new Map<string, string>();

  private displayIdCounter = 0;

  constructor(roomId: number) {
    this.roomId = roomId;
  }

  /**
   * Xử lý detections từ 1 camera, trả về detections đã được chuẩn hóa
   * (fruit_id, display_id thống nhất toàn buồng).
   */
  resolveDetections(
    cameraIndex: number,
    detections: BoundingBox[],
    timestamp: number = Date.now()
  ): BoundingBox[] {
    this._cleanup(timestamp);

    return detections.map((det) =>
      this._resolveOne(cameraIndex, det, timestamp)
    );
  }

 private _resolveOne(
  cameraIndex: number,
  det: BoundingBox,
  timestamp: number
): BoundingBox {

  const candidate =
    this._findCandidateEntry(
      cameraIndex,
      timestamp
    );

  if (candidate) {

    candidate.captureEnd =
      Math.max(
        candidate.captureEnd,
        timestamp
      );

    candidate.seenByCameras.add(
      cameraIndex
    );

    return this._applyMaster(
      det,
      candidate
    );
  }

  const entry: FruitEntry = {
    unifiedFruitId:
      `room${this.roomId}-fruit-${++this.displayIdCounter}`,

    captureStart: timestamp,
    captureEnd: timestamp,

    seenByCameras:
      new Set([cameraIndex]),

    displayId:
      this.displayIdCounter,
  };

  this.entries.set(
    entry.unifiedFruitId,
    entry
  );

  return this._applyMaster(
    det,
    entry
  );
}

  /**
   * Tìm entry phù hợp để gom detection mới vào:
   * - Còn trong time-window
   * - Camera này chưa detect entry đó (tránh gom 2 quả khác nhau từ cùng 1 cam)
   * - Nếu có thông tin spatial, dùng thêm spatial score
   */
//   private _findCandidateEntry(
//     cameraIndex: number,
//     det: BoundingBox,
//     timestamp: number
//   ): FruitEntry | null {
//     let best: FruitEntry | null = null;
//     let bestAge = Infinity;

//     for (const entry of this.entries.values()) {
//       // Quá cũ
// if (
//   timestamp - entry.lastSeenAt >
//   MERGE_WINDOW_MS
// )
//   continue;

//       // Camera này đã detect entry này rồi → đây có thể là quả khác
//       if (entry.seenByCameras.has(cameraIndex)) continue;

//       // Nếu có spatial check (MIN_SPATIAL_SCORE > 0), dùng thêm
//       if (MIN_SPATIAL_SCORE > 0) {
//         // Không dùng IoU trực tiếp vì các cam có góc nhìn khác nhau.
//         // Chỉ dùng khi tất cả cam cùng góc (top-down belt).
//         // Giữ placeholder cho tương lai.
//       }

//       // Ưu tiên entry gần nhất về thời gian
// const age =
//   timestamp - entry.lastSeenAt;      if (age < bestAge) {
//         bestAge = age;
//         best = entry;
//       }
//     }

//     return best;
//   }

private _findCandidateEntry(
  cameraIndex: number,
  timestamp: number
): FruitEntry | null {

  let best: FruitEntry | null = null;
  let bestDistance = Infinity;

  for (const entry of this.entries.values()) {

    const distance =
      Math.abs(
        timestamp -
        entry.captureEnd
      );

    if (
      distance >
      MERGE_WINDOW_MS
    ) {
      continue;
    }

    if (
      entry.seenByCameras.has(
        cameraIndex
      )
    ) {
      continue;
    }

    if (
      distance <
      bestDistance
    ) {
      bestDistance =
        distance;

      best =
        entry;
    }
  }

  return best;
}

  /** Áp dụng thông tin master vào detection object */
//   private _applyMaster(det: BoundingBox, entry: FruitEntry): BoundingBox {
//     return {
//       ...det,
//       fruit_id: entry.masterFruitId,
//       display_id: entry.displayId ?? det.display_id,
//     };
//   }
private _applyMaster(
  det: BoundingBox,
  entry: FruitEntry
): BoundingBox {

  return {
    ...det,

    fruit_id:
      entry.unifiedFruitId,

    display_id:
      entry.displayId,
  };
}

  /** Xóa các entry đã expire */
//   private _cleanup(now: number) {
//     for (const [key, entry] of this.entries.entries()) {
//       if (now - entry.lastSeenAt > ENTRY_TTL_MS) {
//         // Xóa aliases
//         for (const alias of entry.aliases) {
//           this.aliasMap.delete(alias);
//         }
//         this.entries.delete(key);
//       }
//     }
//   }

private _cleanup(
  now: number
) {

  for (
    const [key, entry]
    of this.entries.entries()
  ) {

    if (
      now -
      entry.captureEnd >
      ENTRY_TTL_MS
    ) {
      this.entries.delete(
        key
      );
    }
  }
}
  /** Lấy thông tin debug */
//   getDebugInfo() {
//     return {
//       roomId: this.roomId,
//       activeFruits: this.entries.size,
//       entries: Array.from(this.entries.values()).map((e) => ({
//         masterFruitId: e.masterFruitId,
//         aliases: Array.from(e.aliases),
//         seenByCameras: Array.from(e.seenByCameras),
//         displayId: e.displayId,
//         age: Date.now() - e.firstSeenAt,
//       })),
//     };
//   }

getDebugInfo() {
  return {
    roomId: this.roomId,

    activeFruits:
      this.entries.size,

    entries:
      Array.from(
        this.entries.values()
      ).map((e) => ({
        unifiedFruitId:
          e.unifiedFruitId,

        displayId:
          e.displayId,

        seenByCameras:
          Array.from(
            e.seenByCameras
          ),

        captureStart:
          e.captureStart,

        captureEnd:
          e.captureEnd,
      })),
  };
}

  reset() {
    this.entries.clear();
    // this.aliasMap.clear();
    this.displayIdCounter = 0;
  }
}

// ─── Singleton registry (1 merger / buồng) ─────────────────────────────────

const mergerRegistry = new Map<number, RoomFruitMerger>();

export function getRoomMerger(roomId: number): RoomFruitMerger {
  if (!mergerRegistry.has(roomId)) {
    mergerRegistry.set(roomId, new RoomFruitMerger(roomId));
  }
  return mergerRegistry.get(roomId)!;
}

/** Tiện ích: lấy merger theo cameraIndex (tự tính roomId) */
export function getMergerForCamera(cameraIndex: number): RoomFruitMerger {
  return getRoomMerger(getRoomIdByCameraIndex(cameraIndex));
}