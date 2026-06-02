"use client";

import React, { ReactNode } from "react";

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  color?: "amber" | "green" | "red" | "blue";
  progress?: number;
}

const iconColorMap: Record<NonNullable<KPICardProps["color"]>, string> = {
  amber: "var(--amber)",
  green: "var(--accent)",
  red:   "var(--error)",
  blue:  "var(--accent)",
};

const iconBgMap: Record<NonNullable<KPICardProps["color"]>, string> = {
  amber: "var(--amber-dim)",
  green: "var(--accent-dim)",
  red:   "var(--error-dim)",
  blue:  "var(--accent-dim)",
};

const progressColorMap: Record<NonNullable<KPICardProps["color"]>, string> = {
  amber: "var(--harvest-400)",
  green: "var(--accent)",
  red:   "var(--error)",
  blue:  "var(--accent)",
};

export default function KPICard({
  label,
  value,
  sub,
  icon,
  color = "green",
  progress,
}: KPICardProps) {
  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: iconBgMap[color], color: iconColorMap[color] }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p
            style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "Outfit, sans-serif", marginBottom: "4px" }}
          >
            {label}
          </p>
          <p
            style={{ color: "var(--text)", fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, fontFamily: "Sora, sans-serif" }}
          >
            {value}
          </p>
          {sub && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "4px", lineHeight: 1.4 }}>
              {sub}
            </p>
          )}
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: progressColorMap[color],
              }}
            />
          </div>
          <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 600, minWidth: "40px", textAlign: "right" }}>
            {progress.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}
