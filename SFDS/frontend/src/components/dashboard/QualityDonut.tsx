"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CLASS_COLORS } from "@/lib/types";

interface Props {
  mature: number;
  immature: number;
  defective: number;
  title?: string;
}

const DONUT_COLORS_LIGHT = {
  mature:    "#12b76a",
  immature:  "#f59e0b",
  defective: "#f04438",
};
const DONUT_COLORS_DARK = {
  mature:    "#4ade80",
  immature:  "#f59e0b",
  defective: "#f87171",
};

export default function QualityDonut({ mature, immature, defective, title }: Props) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setIsDark(document.documentElement.classList.contains("dark") || mq.matches);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const colors = isDark ? DONUT_COLORS_DARK : DONUT_COLORS_LIGHT;
  const donutColors = {
    mature:    colors.mature,
    immature:  colors.immature,
    defective: colors.defective,
  };

  const data = [
    { name: "Chín",      value: mature,   color: donutColors.mature },
    { name: "Chưa chín", value: immature, color: donutColors.immature },
    { name: "Hư hỏng",  value: defective, color: donutColors.defective },
  ].filter((d) => d.value > 0);

  const total = mature + immature + defective;

  const tooltipBg      = isDark ? "#131e16" : "#ffffff";
  const tooltipBorder  = isDark ? "rgba(74,222,128,0.16)" : "#e4e7ec";
  const tooltipText    = isDark ? "#dce8de" : "#101828";
  const legendColor    = isDark ? "#6b8b72" : "#667085";

  return (
    <div style={{
      borderRadius: 12,
      padding: "16px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
    }}>
      {title && (
        <h3 style={{
          color: "var(--text)",
          fontSize: "0.875rem",
          fontWeight: 600,
          fontFamily: "Sora, sans-serif",
          marginBottom: "16px",
        }}>
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={88}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: 10,
              fontFamily: "Outfit",
              fontSize: 12,
              boxShadow: "var(--shadow-md)",
              color: tooltipText,
            }}
            formatter={(v: number) => [
              `${v} (${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%)`,
              "",
            ]}
          />
          <Legend
            wrapperStyle={{ fontFamily: "Outfit", fontSize: 12, color: legendColor }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ textAlign: "center", marginTop: -8, marginBottom: 8 }}>
        <span style={{
          color: "var(--text)",
          fontSize: "1.5rem",
          fontWeight: 700,
          fontFamily: "Sora, sans-serif",
          letterSpacing: "-0.02em",
        }}>
          {total.toLocaleString()}
        </span>
        <span style={{
          display: "block",
          color: "var(--text-muted)",
          fontSize: "0.72rem",
          fontFamily: "Outfit, sans-serif",
          marginTop: 2,
        }}>
          tổng số
        </span>
      </div>
    </div>
  );
}
