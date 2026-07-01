'use client';

import { useCallback, useEffect, useState } from 'react';
import InteractiveFaceSlot, { DetBox, runDetect } from './InteractiveFaceSlot';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';

const FACES = ['Trước', 'Trái', 'Phải', 'Sau'] as const;

const FACE_MAP: Record<string, string> = {
  Trước: 'front',
  Trái: 'left',
  Phải: 'right',
  Sau: 'back',
};

type ExportGrade = 'A' | 'B' | 'C' | 'D';
type ActualCondition = 'Xanh' | 'Sượng' | 'Chín' | 'Sâu rầy' | 'Hư';
type Category = 'export_criteria' | 'condition';

interface FaceState {
  image: string | null;
  file: File | null;
  grade: ExportGrade | null;
  condition: ActualCondition | null;
  boxes: DetBox[];
  imgWidth: number;
  imgHeight: number;
  mode: 'upload' | 'camera';
  videoStream: MediaStream | null;
  deviceId: string | null;
  deviceLabel: string | null;
  saved: boolean;
}

function freshSlot(): FaceState {
  return {
    image: null,
    file: null,
    grade: null,
    condition: null,
    boxes: [],
    imgWidth: 0,
    imgHeight: 0,
    mode: 'upload',
    videoStream: null,
    deviceId: null,
    deviceLabel: null,
    saved: false,
  };
}

interface Toast {
  msg: string;
  type: 'success' | 'error';
}
interface MediaDevice {
  deviceId: string;
  label: string;
}

const EXPORT_LABELS: ExportGrade[] = ['A', 'B', 'C', 'D'];
const CONDITION_LABELS: ActualCondition[] = [
  'Xanh',
  'Sượng',
  'Chín',
  'Sâu rầy',
  'Hư',
];

const LABEL_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#15803d',
  C: '#eab308',
  D: '#ef4444',
  Xanh: '#22c55e',
  Sượng: '#15803d',
  Chín: '#eab308',
  'Sâu rầy': '#dc2626',
  Hư: '#b91c1c',
};

export default function DatasetPageClient() {
  const [slots, setSlots] = useState<Record<string, FaceState>>({
    Trước: freshSlot(),
    Trái: freshSlot(),
    Phải: freshSlot(),
    Sau: freshSlot(),
  });

  const [threshold, setThreshold] = useState(0.3);
  const [category, setCategory] = useState<Category>('export_criteria');
  const [detectingSlots, setDetectingSlots] = useState<Record<string, boolean>>(
    {}
  );
  const [savingFaces, setSavingFaces] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [stats, setStats] = useState<Record<string, Record<string, number>>>(
    {}
  );
  const [devices, setDevices] = useState<MediaDevice[]>([]);

  const labels =
    category === 'export_criteria' ? EXPORT_LABELS : CONDITION_LABELS;

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const updateSlot = (face: string, upd: Partial<FaceState>) =>
    setSlots((prev) => ({ ...prev, [face]: { ...prev[face], ...upd } }));

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/dataset/stats/`);
      if (res.ok) setStats(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      const devs = await navigator.mediaDevices.enumerateDevices();
      permissionStream.getTracks().forEach((track) => track.stop());
      setDevices(
        devs
          .filter((d) => d.kind === 'videoinput')
          .map((d, index) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${index + 1}`,
          }))
      );
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleDetect = useCallback(
    async (face: string, file: File, imgWidth: number, imgHeight: number) => {
      setDetectingSlots((prev) => ({ ...prev, [face]: true }));
      try {
        await runDetect(
          file,
          (boxes: DetBox[], w: number, h: number) =>
            updateSlot(face, { boxes, imgWidth: w, imgHeight: h }),
          (done: boolean) =>
            setDetectingSlots((prev) => ({ ...prev, [face]: !!done })),
          threshold
        );
      } finally {
        setDetectingSlots((prev) => ({ ...prev, [face]: false }));
      }
    },
    [threshold]
  );

  const handleSaveFace = async (face: string) => {
    const s = slots[face];
    if (!s.file) return;
    if (!s.grade || !s.condition) {
      showToast(
        'Cần chọn cả tiêu chí xuất khẩu và tình trạng thực tế!',
        'error'
      );
      return;
    }
    if (s.saved) return;
    if (savingFaces[face]) return;

    setSavingFaces((prev) => ({ ...prev, [face]: true }));
    try {
      const fd = new FormData();
      fd.append('file', s.file!);
      fd.append('face', FACE_MAP[face]);
      fd.append('grade', s.grade);
      fd.append('condition', s.condition);
      fd.append(
        'boxes',
        JSON.stringify(
          s.boxes.map((b) => ({
            x1: b.x1,
            y1: b.y1,
            x2: b.x2,
            y2: b.y2,
            polygon: b.polygon ?? null,
          }))
        )
      );
      fd.append('img_width', String(s.imgWidth));
      fd.append('img_height', String(s.imgHeight));
      const r = await fetch(`${API_URL}/api/dataset/save-face/`, {
        method: 'POST',
        body: fd,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `Lưu mặt ${face} thất bại`);
      }
      updateSlot(face, {
        file: null,
        boxes: [],
        grade: null,
        condition: null,
        saved: false,
      });
      showToast(`Đã lưu mặt ${face} (8 ảnh)!`, 'success');
      loadStats();
    } catch (e) {
      showToast(`Lỗi: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
    } finally {
      setSavingFaces((prev) => ({ ...prev, [face]: false }));
    }
  };

  const handleSaveAll = async () => {
    if (savingAll) return;
    const toSave = FACES.filter((f) => {
      const s = slots[f];
      return s.file && s.grade && s.condition && !s.saved;
    });
    if (toSave.length === 0) {
      showToast('Tất cả faces đã được lưu!', 'success');
      return;
    }
    setSavingAll(true);
    let savedCount = 0;
    try {
      for (const face of toSave) {
        const s = slots[face];
        setSavingFaces((prev) => ({ ...prev, [face]: true }));
        const fd = new FormData();
        fd.append('file', s.file!);
        fd.append('face', FACE_MAP[face]);
        fd.append('grade', s.grade!);
        fd.append('condition', s.condition!);
        fd.append(
          'boxes',
          JSON.stringify(
            s.boxes.map((b) => ({
              x1: b.x1,
              y1: b.y1,
              x2: b.x2,
              y2: b.y2,
              polygon: b.polygon ?? null,
            }))
          )
        );
        fd.append('img_width', String(s.imgWidth));
        fd.append('img_height', String(s.imgHeight));
        const r = await fetch(`${API_URL}/api/dataset/save-face/`, {
          method: 'POST',
          body: fd,
        });
        if (r.ok) {
          updateSlot(face, {
            file: null,
            boxes: [],
            grade: null,
            condition: null,
            saved: false,
          });
          savedCount++;
        }
        setSavingFaces((prev) => ({ ...prev, [face]: false }));
      }
      showToast(
        `Đã lưu ${savedCount}/${toSave.length} face (${savedCount * 8} ảnh)!`,
        'success'
      );
      loadStats();
      setSlots({
        Trước: freshSlot(),
        Trái: freshSlot(),
        Phải: freshSlot(),
        Sau: freshSlot(),
      });
    } catch (e) {
      showToast(`Lỗi: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
    } finally {
      setSavingAll(false);
    }
  };

  const handleBatchLabel = (label: string) => {
    const isGrade = category === 'export_criteria';
    let count = 0;
    FACES.forEach((f) => {
      if (slots[f].file && !slots[f].saved) {
        if (isGrade) updateSlot(f, { grade: label as ExportGrade });
        else updateSlot(f, { condition: label as ActualCondition });
        count++;
      }
    });
    if (count === 0) {
      showToast('Không có ảnh nào để gán nhãn!', 'error');
      return;
    }
    showToast(`Đã gán "${label}" cho ${count} face`, 'success');
  };

  const handleReset = () => {
    FACES.forEach((f) => {
      if (!slots[f].saved) {
        slots[f].videoStream?.getTracks().forEach((track) => track.stop());
        updateSlot(f, freshSlot());
      }
    });
  };

  const totalItems = Object.values(stats).reduce(
    (acc, cat) => acc + Object.values(cat).reduce((a, v) => a + v, 0),
    0
  );

  const canSaveCount = FACES.filter((f) => {
    const s = slots[f];
    return s.file && s.grade && s.condition && !s.saved;
  }).length;
  const savedCount = FACES.filter((f) => slots[f].saved).length;
  const labeledCount = FACES.filter((f) => {
    const s = slots[f];
    return !!s.file && !!s.grade && !!s.condition;
  }).length;
  const activeDeviceIds = Object.values(slots)
    .filter((s) => s.videoStream && s.deviceId)
    .map((s) => s.deviceId as string);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleIcon}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                fontFamily: 'Outfit, sans-serif',
                letterSpacing: '-0.01em',
              }}
            >
              Thu thập Dataset
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Upload ảnh · YOLO detect · Chọn nhãn · Lưu
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          {totalItems > 0 && (
            <div className={styles.meta}>
              <span className={styles.metaDot} />
              {totalItems} ảnh đã lưu
            </div>
          )}
          <div className={styles.categoryToggle}>
            {(['export_criteria', 'condition'] as const).map((cat) => (
              <button
                key={cat}
                className={`${styles.catBtn} ${category === cat ? styles.catBtnActive : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat === 'export_criteria'
                  ? 'Tiêu chí xuất khẩu'
                  : 'Tình trạng thực tế'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Threshold slider */}
      <div className={styles.thresholdBar}>
        <div className={styles.thresholdLabel}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Ngưỡng confidence
          <span className={styles.thresholdValue}>
            {Math.round(threshold * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="5"
          max="95"
          value={threshold * 100}
          onChange={(e) => setThreshold(Number(e.target.value) / 100)}
          className={styles.thresholdSlider}
        />
        <div className={styles.thresholdHint}>Cao → ít box, chính xác hơn</div>
      </div>

      {/* Batch labeling row */}
      <div className={styles.batchLabelRow}>
        <span className={styles.batchLabelRowLabel}>
          {category === 'export_criteria'
            ? 'Gán tiêu chí hàng loạt:'
            : 'Gán tình trạng hàng loạt:'}
        </span>
        <div className={styles.batchButtons}>
          {labels.map((l) => (
            <button
              key={l}
              className={`${styles.batchBtn}`}
              style={
                LABEL_COLORS[l]
                  ? {
                      borderColor: LABEL_COLORS[l] + '55',
                      color: LABEL_COLORS[l],
                    }
                  : {}
              }
              onClick={() => handleBatchLabel(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* 4-face grid */}
      <div className={styles.grid}>
        {FACES.map((face) => (
          <InteractiveFaceSlot
            key={face}
            face={face}
            state={slots[face]}
            threshold={threshold}
            category={category}
            devices={devices}
            activeDeviceIds={activeDeviceIds}
            onRefreshDevices={loadDevices}
            onState={(upd) => updateSlot(face, upd as Partial<FaceState>)}
            onDetect={(file, w, h) => handleDetect(face, file, w, h)}
            onSave={() => handleSaveFace(face)}
            isSaving={savingFaces[face] ?? false}
          />
        ))}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className={styles.itemCount}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Đã lưu
            <span className={styles.countBadge}>{savedCount}</span>
          </div>
          {labeledCount > savedCount && (
            <div className={styles.itemCount}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Đã nhãn
              <span
                className={styles.countBadge}
                style={{
                  background: 'rgba(167,139,250,0.1)',
                  borderColor: 'rgba(167,139,250,0.2)',
                  color: '#a78bfa',
                }}
              >
                {labeledCount - savedCount}
              </span>
            </div>
          )}
        </div>

        <div className={styles.footerActions}>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={handleReset}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.58" />
            </svg>
            Reset
          </button>

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSaveAll}
            disabled={savingAll || canSaveCount === 0}
          >
            {savingAll ? (
              <>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Đang lưu...
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                </svg>
                Lưu Dataset {canSaveCount > 0 ? `(${canSaveCount}×8 ảnh)` : ''}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.type === 'success' ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
