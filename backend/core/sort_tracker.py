"""
SORT Tracker — Kalman Filter + Hungarian Assignment + IOU Matching
Used to track fruit detections across frames and prevent duplicate counting.
Backend: d:/NEWAI/system/backend/sort_tracker.py
"""

import numpy as np
from typing import List, Tuple

# ---------------------------------------------------------------------------
# IOU (Intersection over Union)
# ---------------------------------------------------------------------------

def iou(bbox1: np.ndarray, bbox2: np.ndarray) -> float:
    """Compute IOU between two [x1,y1,x2,y2] boxes."""
    x1 = max(bbox1[0], bbox2[0])
    y1 = max(bbox1[1], bbox2[1])
    x2 = min(bbox1[2], bbox2[2])
    y2 = min(bbox1[3], bbox2[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
    area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1])
    union = area1 + area2 - inter
    return float(inter / max(union, 1e-6))


# ---------------------------------------------------------------------------
# Kalman Filter (constant velocity, 2D bounding box)
# ---------------------------------------------------------------------------

class KalmanBoxTracker:
    """Kalman filter for tracking bounding boxes. Tracks: [cx, cy, w, h, vx, vy, vw, vh]."""
    _count = 0

    def __init__(self, bbox: List[float]):
        x1, y1, x2, y2 = bbox
        w = x2 - x1
        h = y2 - y1
        cx = x1 + w / 2
        cy = y1 + h / 2

        # State: [cx, cy, w, h, vx, vy, vw, vh]
        self.kf = _KalmanFilter(cx, cy, w, h)

        self.time_since_update = 0
        self.id = KalmanBoxTracker._count + 1
        KalmanBoxTracker._count += 1

        self.hits = 0
        self.hit_streak = 0
        self.age = 1

    def update(self, bbox: List[float]) -> None:
        x1, y1, x2, y2 = bbox
        cx = x1 + (x2 - x1) / 2
        cy = y1 + (y2 - y1) / 2
        w = x2 - x1
        h = y2 - y1
        self.kf.update(cx, cy, w, h)
        self.time_since_update = 0
        self.hits += 1
        self.hit_streak += 1
        self.age += 1

    def predict(self) -> np.ndarray:
        self.kf.predict()
        self.time_since_update += 1
        self.age += 1
        self.hit_streak = 0
        return self.get_state()

    def get_state(self) -> np.ndarray:
        cx, cy, w, h = self.kf.x[0], self.kf.x[1], self.kf.x[2], self.kf.x[3]
        return np.array([cx - w/2, cy - h/2, cx + w/2, cy + h/2])


class _KalmanFilter:
    """8-state constant-velocity Kalman filter for 2D boxes."""

    def __init__(self, cx: float, cy: float, w: float, h: float):
        n = 8
        m = 4

        # State transition matrix
        F = np.eye(n, n)
        F[0, 4] = 1.0   # x += vx
        F[1, 5] = 1.0   # y += vy
        F[2, 6] = 1.0   # w += vw
        F[3, 7] = 1.0   # h += vh
        self.F = F

        # Measurement matrix
        H = np.zeros((m, n))
        H[0, 0] = 1.0
        H[1, 1] = 1.0
        H[2, 2] = 1.0
        H[3, 3] = 1.0
        self.H = H

        # Covariances
        self.R = np.eye(m)                    # measurement noise
        self.Q = np.diag([1., 1., 1., 1., 0.01, 0.01, 0.01, 0.01])  # process noise

        # Initial state
        self.x = np.zeros((n, 1))
        self.x[0, 0] = cx
        self.x[1, 0] = cy
        self.x[2, 0] = w
        self.x[3, 0] = h

        # Initial covariance
        self.P = np.diag([10., 10., 10., 10., 10., 10., 10., 10.])

    def predict(self) -> None:
        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + self.Q

    def update(self, cx: float, cy: float, w: float, h: float) -> None:
        z = np.array([[cx], [cy], [w], [h]])
        y = z - self.H @ self.x
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        self.P = (np.eye(8) - K @ self.H) @ self.P


# ---------------------------------------------------------------------------
# Hungarian Algorithm (linear_sum_assignment compatible, O(n³))
# ---------------------------------------------------------------------------

def linear_assignment(cost_matrix: np.ndarray) -> List[Tuple[int, int]]:
    """
    Solve the linear assignment problem using scipy-style API.
    Uses scipy if available, otherwise falls back to pure numpy Hungarian.
    """
    try:
        from scipy.optimize import linear_sum_assignment
        row_idx, col_idx = linear_sum_assignment(cost_matrix)
        return list(zip(row_idx, col_idx))
    except ImportError:
        return _hungarian_numpy(cost_matrix)


def _hungarian_numpy(cost_matrix: np.ndarray) -> List[Tuple[int, int]]:
    """
    Pure-numpy implementation of the Hungarian (Kuhn-Munkres) algorithm.
    Operates on a square cost matrix.
    """
    n = cost_matrix.shape[0]

    u = np.zeros(n + 1)
    v = np.zeros(n + 1)
    p = np.zeros(n + 1, dtype=int)
    way = np.zeros(n + 1, dtype=int)

    for i in range(1, n + 1):
        p[0] = i
        j0 = 0
        minv = np.full(n + 1, 1e9)
        used = np.zeros(n + 1, dtype=bool)

        while True:
            used[j0] = True
            i0 = p[j0]
            delta = 1e9
            j1 = 0
            for j in range(1, n + 1):
                if not used[j]:
                    cur = cost_matrix[i0 - 1, j - 1] - u[i0] - v[j]
                    if cur < minv[j]:
                        minv[j] = cur
                        way[j] = j0
                    if minv[j] < delta:
                        delta = minv[j]
                        j1 = j
            for j in range(n + 1):
                if used[j]:
                    u[p[j]] += delta
                    v[j] -= delta
                else:
                    minv[j] -= delta
            j0 = j1
            if cost_matrix[p[j0] - 1, j0 - 1] == 1e9:
                j0 = 0
                break

        # Augmenting path
        while True:
            j1 = way[j0]
            p[j0] = p[j1]
            j0 = j1
            if j0 == 0:
                break

    # Extract assignment
    assignment = []
    for j in range(1, n + 1):
        i = p[j]
        if i != 0 and cost_matrix[i - 1, j - 1] < 1e8:
            assignment.append((i - 1, j - 1))

    return assignment


# ---------------------------------------------------------------------------
# SORT Tracker
# ---------------------------------------------------------------------------

class SortTracker:
    """
    SORT tracker for deduplicating fruit detections across frames.
    Each fruit gets a stable track_id that persists across frames.

    Args:
        max_age:      Maximum frames a track can go unmatched before removal
        min_hits:     Minimum detections before a track is "confirmed"
        iou_threshold: IOU below which a match is rejected
    """
    count = 0

    def __init__(self, max_age: int = 15, min_hits: int = 3, iou_threshold: float = 0.3):
        self.max_age = max_age
        self.min_hits = min_hits
        self.iou_threshold = iou_threshold
        self.tracks: List[KalmanBoxTracker] = []
        self._frame_count = 0

    def reset(self) -> None:
        self.tracks = []
        self._frame_count = 0
        # Keep the ID counter alive across fruit departures. The slot reset is
        # only meant to clear active tracks; resetting IDs would make the next
        # fruit appear as the same object to the UI/crop-once logic.

    def update(self, detections: List[dict]) -> List[dict]:
        """
        Update SORT with new detections from a single frame.

        Args:
            detections: List of dicts with keys: x1,y1,x2,y2,confidence,class_name

        Returns:
            List of dicts with keys: x1,y1,x2,y2,confidence,class_name,track_id
            Only confirmed tracks (>= min_hits) are returned.
        """
        self._frame_count += 1

        # Predict all existing tracks
        pred_boxes = [t.predict() for t in self.tracks]

        n_det = len(detections)
        n_trk = len(self.tracks)

        # Build IOU cost matrix
        if n_det > 0 and n_trk > 0:
            iou_matrix = np.zeros((n_det, n_trk))
            for i, det in enumerate(detections):
                det_box = np.array([det["x1"], det["y1"], det["x2"], det["y2"]])
                for j, trk_box in enumerate(pred_boxes):
                    iou_matrix[i, j] = iou(det_box, trk_box)

            # Cost = 1 - IOU (lower is better)
            cost_matrix = 1.0 - iou_matrix
            matches, u_det, u_trk = [], [], []
            assigned_det = set()
            assigned_trk = set()

            for det_idx, trk_idx in linear_assignment(cost_matrix):
                if det_idx < n_det and trk_idx < n_trk:
                    iou_val = iou_matrix[det_idx, trk_idx]
                    if iou_val >= self.iou_threshold:
                        matches.append((det_idx, trk_idx))
                        assigned_det.add(det_idx)
                        assigned_trk.add(trk_idx)

            u_det = [i for i in range(n_det) if i not in assigned_det]
            u_trk = [j for j in range(n_trk) if j not in assigned_trk]
        else:
            matches, u_det, u_trk = [], list(range(n_det)), list(range(n_trk))

        matched_by_track: dict[int, dict] = {}

        # Update matched tracks
        for det_idx, trk_idx in matches:
            det = detections[det_idx]
            det_box = [det["x1"], det["y1"], det["x2"], det["y2"]]
            track = self.tracks[trk_idx]
            track.update(det_box)
            matched_by_track[id(track)] = det

        # Create new tracks for unmatched detections
        for i in u_det:
            det = detections[i]
            det_box = [det["x1"], det["y1"], det["x2"], det["y2"]]
            track = KalmanBoxTracker(det_box)
            self.tracks.append(track)
            matched_by_track[id(track)] = det

        # Remove dead tracks
        surviving = [t for t in self.tracks if t.time_since_update <= self.max_age]
        self.tracks = surviving

        # Return confirmed tracks with IDs
        result = []
        det_boxes_np = [np.array([d["x1"], d["y1"], d["x2"], d["y2"]]) for d in detections]

        for t in self.tracks:
            if t.age >= self.min_hits and t.time_since_update == 0:
                state = t.get_state()
                matched_det = matched_by_track.get(id(t))
                if matched_det is None:
                    if not detections:
                        continue
                    best_iou = -1
                    for j, det in enumerate(detections):
                        iou_val = iou(state, det_boxes_np[j])
                        if iou_val > best_iou:
                            best_iou = iou_val
                            matched_det = det

                result.append({
                    "x1": float(state[0]),
                    "y1": float(state[1]),
                    "x2": float(state[2]),
                    "y2": float(state[3]),
                    "confidence": float(matched_det["confidence"]) if matched_det else 0.0,
                    "class_id": matched_det.get("class_id") if matched_det else None,
                    "class_name": str(matched_det["class_name"]) if matched_det else "unknown",
                    "polygon": matched_det.get("polygon") if matched_det else None,
                    "track_id": t.id,
                })

        return result


# ---------------------------------------------------------------------------
# Tracker Manager (one tracker per slot)
# ---------------------------------------------------------------------------

class TrackerManager:
    """Manages one SortTracker per slot so each camera/upload slot has its own track space."""

    def __init__(self, num_slots: int = 4, **kwargs):
        self.trackers: List[SortTracker] = [
            SortTracker(**kwargs) for _ in range(num_slots)
        ]

    def reset_slot(self, slot_idx: int) -> None:
        if 0 <= slot_idx < len(self.trackers):
            self.trackers[slot_idx].reset()

    def reset_all(self) -> None:
        for t in self.trackers:
            t.reset()

    def update(self, slot_idx: int, detections: List[dict]) -> List[dict]:
        if 0 <= slot_idx < len(self.trackers):
            return self.trackers[slot_idx].update(detections)
        return []
