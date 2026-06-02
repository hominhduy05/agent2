import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/dashboard/AuthProvider";
import MultiSlotCanvas from "@/components/MultiSlotCanvas";
import { CLASS_COLORS, CLASS_LABELS } from "@/lib/types";

interface SlotState {
  image: string | null;
  detections: import("@/lib/types").BoundingBox[];
  isDetecting: boolean;
  error: string | null;
}

function classColor(cls: string) {
  return CLASS_COLORS[cls] || "#ffffff";
}
function classLabel(cls: string) {
  return CLASS_LABELS[cls] || cls;
}

export default function HomePage() {
  const { user, isLoading, isHydrated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isHydrated && !isLoading && !user) {
      navigate("/login");
    }
  }, [isHydrated, isLoading, user, navigate]);

  const [slotStates, setSlotStates] = useState<SlotState[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [expandedDetections, setExpandedDetections] = useState<import("@/lib/types").BoundingBox[] | null>(null);

  if (!isHydrated || isLoading || !user) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "var(--bg)", color: "var(--text-muted)",
        fontFamily: "'Outfit', sans-serif", fontSize: "14px",
      }}>
        Dang tai...
      </div>
    );
  }

  const totalDetections = slotStates.reduce(
    (sum, s) => sum + s.detections.length, 0
  );
  const filledSlots = slotStates.filter(s => s.image).length;

  // Aggregate all detections across slots
  const allDetections = slotStates.flatMap(s => s.detections);
  const aggregatedCounts = allDetections.reduce(
    (acc, d) => {
      acc[d.class_name] = (acc[d.class_name] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const handleStatsUpdate = (slots: SlotState[]) => {
    setSlotStates(slots);
  };

  const openSlotDetail = (idx: number) => {
    setSelectedSlot(idx);
    setExpandedDetections(slotStates[idx]?.detections ?? null);
  };

  const totalFilled = slotStates.filter(s => s.image).length;

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700&family=Sora:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Be Vietnam Pro', sans-serif; }
        h1, h2, h3, h4 { font-family: 'Sora', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg-surface); }
        ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--accent); }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .glow-amber { box-shadow: 0 0 20px rgba(74, 222, 128, 0.15); }
      `}</style>

      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b"
        style={{
          background: "var(--bg-surface)",
          backdropFilter: "blur(12px)",
          borderColor: "var(--border)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-extrabold"
              style={{ background: "var(--accent)", color: "#0a120d", boxShadow: "0 0 16px rgba(74,222,128,0.4)" }}
            >
              D
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight" style={{ color: "var(--text)", fontFamily: "Sora, sans-serif" }}>
                Durian Detector
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Nhận diện độ chín sầu riêng bằng AI
              </p>
            </div>
          </div>

          {/* Header stats */}
          {totalFilled > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {(["mature", "immature", "defective"] as const).map(cls => {
                  const count = aggregatedCounts[cls] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={cls} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: `${classColor(cls)}15`, border: `1px solid ${classColor(cls)}30`, color: classColor(cls) }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: classColor(cls) }} />
                      {classLabel(cls)} {count}
                    </div>
                  );
                })}
              </div>
              <div className="h-4 w-px" style={{ background: "var(--border)" }} />
              <div className="text-right">
                <span className="text-lg font-extrabold" style={{ color: "var(--text)", fontFamily: "Sora, sans-serif" }}>{totalDetections}</span>
                <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>quả</span>
              </div>
            </div>
          )}

          {/* Backend status */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--success)", boxShadow: "0 0 6px var(--success)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Backend</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Section header */}
        <div className="animate-fade-in">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)", fontFamily: "Sora, sans-serif" }}>
            Phân tích đa khung hình
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
            Chụp hoặc tải lên tối đa 4 ảnh, nhận diện tất cả cùng lúc
          </p>
        </div>

        {/* 4-slot camera + upload grid */}
        <section className="animate-fade-in">
          <MultiSlotCanvas onStatsUpdate={handleStatsUpdate} />
        </section>

        {/* Per-slot detail panels — shown when any slot has detections */}
        {totalFilled > 0 && (
          <section className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)", fontFamily: "Sora, sans-serif" }}>
                Chi tiết từng khung
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                {filledSlots} khung
              </span>
            </div>

            <div className="space-y-3">
              {slotStates.map((slot, idx) => {
                if (!slot.image) return null;
                const slotDetections = slot.detections;
                const slotCounts = slotDetections.reduce(
                  (acc, d) => { acc[d.class_name] = (acc[d.class_name] || 0) + 1; return acc; },
                  {} as Record<string, number>
                );

                return (
                  <div
                    key={idx}
                    className="rounded-2xl overflow-hidden transition-all cursor-pointer hover:border-amber-200"
                    style={{
                      background: "var(--bg-surface)",
                      border: selectedSlot === idx ? "1px solid var(--border-strong)" : "1px solid var(--border)",
                    }}
                    onClick={() => openSlotDetail(idx)}
                  >
                    {/* Slot panel header */}
                    <div className="px-5 py-4 flex items-center gap-4">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "var(--accent-faint)", color: "var(--accent)", border: "1px solid var(--border)", fontFamily: "Sora, sans-serif" }}
                      >
                        {idx + 1}
                      </span>

                      {/* Slot thumbnail hint */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-8 h-8 rounded-lg overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                          <img
                            src={slot.image}
                            alt={`Khung ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      {/* Counts */}
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        {slotDetections.length === 0 && !slot.isDetecting && (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa nhận diện</span>
                        )}
                        {(["mature", "immature", "defective"] as const).map(cls => {
                          const count = slotCounts[cls] || 0;
                          if (!count) return null;
                          return (
                            <div key={cls} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${classColor(cls)}15`, border: `1px solid ${classColor(cls)}30`, color: classColor(cls) }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: classColor(cls) }} />
                              {classLabel(cls)} {count}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {slot.isDetecting && (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--amber)" }}>
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            Đang phân tích...
                          </div>
                        )}
                        {slot.error && (
                          <span className="text-xs" style={{ color: "var(--error)" }}>{slot.error}</span>
                        )}
                        <svg
                          width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                          style={{ color: "var(--text-muted)", transform: selectedSlot === idx ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded detection list */}
                    {selectedSlot === idx && (
                      <div className="border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
                        {slotDetections.length === 0 ? (
                          <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                            Không phát hiện quả sầu riêng nào trong khung này.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                              {slotDetections.length} phát hiện trong Khung {idx + 1}
                            </p>
                            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                              {slotDetections.map((det, i) => (
                                <li key={i} className="py-3 flex items-start gap-3">
                                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: classColor(det.class_name) }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-sm" style={{ color: classColor(det.class_name) }}>
                                        {classLabel(det.class_name)}
                                      </span>
                                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>#{i + 1}</span>
                                    </div>
                                    <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
                                      ({Math.round(det.x1)}, {Math.round(det.y1)}) → ({Math.round(det.x2)}, {Math.round(det.y2)})
                                    </p>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <span className="text-sm font-bold" style={{ color: classColor(det.class_name), fontFamily: "Sora, sans-serif" }}>
                                      {Math.round(det.confidence * 100)}%
                                    </span>
                                    <div className="w-16 h-1 rounded-full mt-1.5 overflow-hidden mx-auto" style={{ background: "var(--border)" }}>
                                      <div className="h-full rounded-full" style={{ width: `${Math.round(det.confidence * 100)}%`, backgroundColor: classColor(det.class_name) }} />
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t mt-16" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Durian Detector · YOLOv8 · FastAPI
          </p>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            2026
          </p>
        </div>
      </footer>
    </main>
  );
}
