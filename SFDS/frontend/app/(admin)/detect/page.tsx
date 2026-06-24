"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getScadaPiFeeds, ScadaPiFeed } from "@/lib/api";
import { CLASS_COLORS, CLASS_LABELS } from "@/lib/types";
import styles from "../scada/page.module.css";

type DetectSlot = {
  slotIndex: number;
  feed: ScadaPiFeed | null;
};

type DetectionItem = NonNullable<ScadaPiFeed["detections"]>[number];

type FeedHistoryFrame = {
  key: string;
  timestamp: string;
  imageDataUrl?: string;
  detections: DetectionItem[];
  imageWidth?: number;
  imageHeight?: number;
  ageSeconds?: number;
};

function makeSlots(feeds: ScadaPiFeed[], capacity: number): DetectSlot[] {
  const normalizedCapacity = Math.max(5, capacity || 5);
  const slots: DetectSlot[] = Array.from({ length: normalizedCapacity }, (_, index) => ({
    slotIndex: index,
    feed: null,
  }));

  feeds.forEach((feed) => {
    const index = Math.max(0, Math.min(normalizedCapacity - 1, feed.slot_index ?? 0));
    slots[index] = { slotIndex: index, feed };
  });
  return slots;
}

function feedTitle(slot: DetectSlot) {
  if (!slot.feed) return `Detect ${slot.slotIndex + 1}`;
  const pi = slot.feed.pi_id || "pi4";
  const cam = slot.feed.source_camera_id ?? slot.slotIndex;
  return `${pi} / Camera ${cam}`;
}

function feedFrameKey(feed: ScadaPiFeed) {
  return [
    feed.channel_id || "feed",
    feed.timestamp || "no-time",
    feed.image_width || 0,
    feed.image_height || 0,
    feed.detection_count ?? feed.detections?.length ?? 0,
  ].join(":");
}

function formatFrameTime(timestamp?: string) {
  if (!timestamp) return "-";
  const time = new Date(timestamp);
  if (Number.isNaN(time.getTime())) return "-";
  return time.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function FeedImage({ feed }: { feed: ScadaPiFeed }) {
  const detections = feed.detections || [];
  const width = feed.image_width || 1;
  const height = feed.image_height || 1;

  return (
    <>
      {feed.image_data_url && (
        <img
          src={feed.image_data_url}
          alt="Raspberry Pi crop"
          className={styles.cameraVideo}
          style={{ objectFit: "contain" }}
        />
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className={styles.cameraCanvas}
      >
        {detections.map((det, index) => {
          const color = CLASS_COLORS[det.class_name] || "#ffffff";
          const label = `${CLASS_LABELS[det.class_name] || det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
          const labelY = Math.max(18, det.y1 - 6);
          return (
            <g key={index}>
              <rect
                x={det.x1}
                y={det.y1}
                width={Math.max(1, det.x2 - det.x1)}
                height={Math.max(1, det.y2 - det.y1)}
                fill="none"
                stroke={color}
                strokeWidth={Math.max(2, width / 320)}
                rx={4}
              />
              <rect
                x={det.x1}
                y={labelY - 16}
                width={Math.max(72, label.length * 7)}
                height={18}
                fill={color}
                rx={4}
              />
              <text
                x={det.x1 + 5}
                y={labelY - 3}
                fill="#fff"
                fontSize={12}
                fontWeight={700}
                fontFamily="Arial, sans-serif"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

function FeedTile({
  slot,
  selected,
  onSelect,
}: {
  slot: DetectSlot;
  selected: boolean;
  onSelect: () => void;
}) {
  const feed = slot.feed;
  const isOnline = Boolean(feed?.online && feed.image_data_url);
  const detections = feed?.detections || [];
  const badgeKey = isOnline ? "active" : feed ? "error" : "off";
  const badgeLabel = isOnline ? `${detections.length} detect` : feed ? "mat tin hieu" : "cho feed";

  return (
    <div
      className={`${styles.cameraTile} ${selected ? styles.selected : ""}`}
      onClick={onSelect}
      style={{ cursor: "pointer" }}
    >
      {feed?.image_data_url ? (
        <FeedImage feed={feed} />
      ) : (
        <div className={styles.cameraOverlay}>
          <svg className={styles.cameraOverlayIcon} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span className={styles.cameraOverlayText}>Dang cho Raspberry Pi slot {slot.slotIndex + 1}</span>
        </div>
      )}

      <div className={styles.tileTop}>
        <span className={styles.tileLabel}>{feedTitle(slot)}</span>
        <span className={`${styles.tileBadge} ${styles[badgeKey]}`}>{badgeLabel}</span>
      </div>

      <div className={styles.tileBottom}>
        <div className={styles.tileDets}>
          {detections.slice(0, 4).map((det, index) => (
            <span
              key={index}
              className={styles.tileDet}
              style={{ background: `${CLASS_COLORS[det.class_name] || "#ffffff"}cc` }}
            >
              {(det.confidence * 100).toFixed(0)}%
            </span>
          ))}
        </div>
        <span className={styles.detCount}>Slot {slot.slotIndex + 1}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} style={{ color }}>{value}</span>
    </div>
  );
}

function DetailPanel({
  slot,
  history,
}: {
  slot: DetectSlot | null;
  history: FeedHistoryFrame[];
}) {
  const feed = slot?.feed || null;
  const detections = feed?.detections || [];
  const isOnline = Boolean(feed?.online && feed.image_data_url);
  const displayDetections = history.flatMap((item) => item.detections || []);
  const latestFrames = history.slice(0, 3);
  const mature = displayDetections.filter((det) => det.class_name === "mature").length;
  const immature = displayDetections.filter((det) => det.class_name === "immature").length;
  const defective = displayDetections.filter((det) => det.class_name === "defective").length;
  const total = displayDetections.length;
  const avgConf = displayDetections.length
    ? (displayDetections.reduce((sum, det) => sum + det.confidence, 0) / displayDetections.length) * 100
    : 0;

  return (
    <div className={styles.panelInner}>
      <div className={styles.camHeader}>
        <div className={styles.camIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
        <div>
          <p className={styles.camName}>{slot ? feedTitle(slot) : "Detect feed"}</p>
          <p className={styles.camDevice}>
            {isOnline ? "Dang nhan crop tu Raspberry Pi" : "Chua co camera gui ve"}
          </p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard label="Tong" value={total} color="var(--text)" />
        <StatCard label="Chin" value={mature} color="#12b76a" />
        <StatCard label="Chua chin" value={immature} color="#f59e0b" />
        <div className={`${styles.statCard} ${styles.wide}`}>
          <div>
            <span className={styles.statLabel}>Hu hong</span>
            <span className={styles.statValue} style={{ color: "#ef4444" }}>{defective}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Do tin cay</span>
          <span className={styles.statValue} style={{ color: "var(--accent)", fontSize: 20 }}>
            {avgConf ? `${avgConf.toFixed(1)}%` : "0.0%"}
          </span>
        </div>
      </div>

      <div className={styles.statusItem}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="20" height="20" rx="2" />
          <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
        </svg>
        {history.length} frame da xu ly
        {feed?.age_seconds !== undefined ? ` | cap nhat ${feed.age_seconds.toFixed(1)}s truoc` : ""}
      </div>

      <div className={styles.historyList}>
        <div className={styles.historyHeader}>
          <span className={styles.historyTitle}>Top 3 anh gan nhat</span>
          <span className={styles.historyCount}>{latestFrames.length}/3</span>
        </div>
        <div
          style={{
            minHeight: 150,
            display: "grid",
            gridTemplateColumns: latestFrames.length > 1 ? "repeat(3, 1fr)" : "1fr",
            gap: 8,
            padding: latestFrames.length ? 8 : 0,
            alignItems: "stretch",
          }}
        >
          {latestFrames.length ? (
            latestFrames.map((frame, index) => (
              <div
                key={frame.key}
                style={{
                  position: "relative",
                  minHeight: 132,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: index === 0 ? "1px solid rgba(34,197,94,0.55)" : "1px solid var(--border-soft)",
                  background: "rgba(0,0,0,0.25)",
                }}
              >
                {frame.imageDataUrl ? (
                  <img
                    src={frame.imageDataUrl}
                    alt={`Recent detect ${index + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  />
                ) : null}
                <span
                  style={{
                    position: "absolute",
                    left: 6,
                    bottom: 6,
                    padding: "2px 6px",
                    borderRadius: 6,
                    background: "rgba(0,0,0,0.62)",
                    color: index === 0 ? "#86efac" : "var(--text-faint)",
                    fontSize: 10,
                    fontFamily: "var(--font-outfit)",
                    fontWeight: 700,
                  }}
                >
                  {formatFrameTime(frame.timestamp)}
                </span>
              </div>
            ))
          ) : (
            <div className={styles.emptyDesc} style={{ alignSelf: "center", justifySelf: "center" }}>
              Chua co anh gan nhat
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div className={styles.sectionLabel}>Chi tiet phat hien ({total})</div>
        <div className={styles.detList}>
          {!isOnline && (
            <div className={styles.emptyDesc}>
              Camera chua bat. Chon mot camera de xem ket qua.
            </div>
          )}
          {isOnline && total === 0 && (
            <div className={styles.emptyDesc}>PC backend chua detect duoc doi tuong trong anh crop nay.</div>
          )}
          {displayDetections.map((det, index) => {
            const color = CLASS_COLORS[det.class_name] || "var(--text-muted)";
            return (
              <div key={index} className={styles.detItem}>
                <div className={styles.detDot} style={{ background: color }} />
                <div className={styles.detInfo}>
                  <div className={styles.detName}>{CLASS_LABELS[det.class_name] || det.class_name}</div>
                  <div className={styles.detMeta}>
                    frame {Math.floor(index / Math.max(detections.length, 1)) + 1} | x1:{det.x1.toFixed(0)} y1:{det.y1.toFixed(0)} x2:{det.x2.toFixed(0)} y2:{det.y2.toFixed(0)}
                  </div>
                </div>
                <div className={styles.detConf} style={{ color }}>{(det.confidence * 100).toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DetectPage() {
  const [feeds, setFeeds] = useState<ScadaPiFeed[]>([]);
  const [capacity, setCapacity] = useState(5);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [lastError, setLastError] = useState("");
  const [feedHistory, setFeedHistory] = useState<Record<number, FeedHistoryFrame[]>>({});

  useEffect(() => {
    let stopped = false;

    async function pollFeeds() {
      try {
        const payload = await getScadaPiFeeds();
        if (!stopped) {
          setFeeds(payload.feeds || []);
          setCapacity(payload.capacity || 5);
          setLastError("");
          setFeedHistory((prev) => {
            const next = { ...prev };
            (payload.feeds || []).forEach((feed) => {
              if (!feed.online || !feed.image_data_url) return;
              const index = Math.max(0, feed.slot_index ?? 0);
              const key = feedFrameKey(feed);
              const current = next[index] || [];
              if (current[0]?.key === key) return;
              next[index] = [
                {
                  key,
                  timestamp: feed.timestamp || new Date().toISOString(),
                  imageDataUrl: feed.image_data_url,
                  detections: feed.detections || [],
                  imageWidth: feed.image_width,
                  imageHeight: feed.image_height,
                  ageSeconds: feed.age_seconds,
                },
                ...current,
              ].slice(0, 30);
            });
            return next;
          });
        }
      } catch (err) {
        if (!stopped) {
          setLastError(err instanceof Error ? err.message : "Khong the ket noi backend");
        }
      }
    }

    pollFeeds();
    const timer = window.setInterval(pollFeeds, 500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  const slots = useMemo(() => makeSlots(feeds, capacity), [feeds, capacity]);
  const selected = slots[selectedSlot] || slots[0] || null;
  const onlineCount = slots.filter((slot) => slot.feed?.online).length;
  const selectedHistory = feedHistory[selectedSlot] || [];

  return (
    <div className={styles.wrapper}>
      <div className={styles.cameraPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h1 className={styles.panelTitle}>Detect - Raspberry Pi feeds</h1>
            <p className={styles.panelSubtitle}>
              {onlineCount}/{slots.length} feed dang online | Ho tro 2 Pi va 5 camera
              {lastError ? ` | ${lastError}` : ""}
            </p>
          </div>
          <div className={styles.statusRow}>
            <div className={`${styles.statusDot} ${onlineCount > 0 ? styles.active : styles.warning}`} />
            <span className={styles.statusLabel}>{onlineCount > 0 ? `${onlineCount} active` : "Cho Pi gui anh"}</span>
          </div>
        </div>

        <div className={styles.gridContainer}>
          {slots.map((slot) => (
            <FeedTile
              key={slot.slotIndex}
              slot={slot}
              selected={selectedSlot === slot.slotIndex}
              onSelect={() => setSelectedSlot(slot.slotIndex)}
            />
          ))}
        </div>

        <div className={styles.statusBar}>
          <div className={styles.statusItem}>
            <div className={styles.statusBarDot} style={{ background: onlineCount > 0 ? "#12b76a" : "var(--text-faint)" }} />
            {onlineCount}/{slots.length} feeds
          </div>
          <div className={styles.statusItem}>Backend: /api/scada/pi-feeds/</div>
          <div className={styles.statusItem} style={{ marginLeft: "auto" }}>
            Layout linh hoat cho 2 Pi / 5 camera
          </div>
        </div>
      </div>

      <div className={styles.detectPanel}>
        <DetailPanel slot={selected} history={selectedHistory} />
      </div>
    </div>
  );
}
