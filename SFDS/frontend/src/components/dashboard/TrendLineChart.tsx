"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { DailyBreakdown } from "@/lib/types";

interface Props {
  data: DailyBreakdown[];
  title?: string;
}

const CHART_COLORS = {
  total:     "#16a34a",
  mature:    "#12b76a",
  defective: "#f04438",
};
const CHART_COLORS_DARK = {
  total:     "#4ade80",
  mature:    "#6ee7a0",
  defective: "#f87171",
};

export default function TrendLineChart({ data, title }: Props) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setIsDark(document.documentElement.classList.contains("dark") || mq.matches);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const colors = isDark ? CHART_COLORS_DARK : CHART_COLORS;
  const reversed = [...data].reverse();

  const gridColor   = isDark ? "rgba(74,222,128,0.05)" : "rgba(0,0,0,0.04)";
  const textColor   = isDark ? "#6b8b72" : "#98a2b3";
  const tooltipBg   = isDark ? "#131e16" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(74,222,128,0.16)" : "#e4e7ec";
  const tooltipText  = isDark ? "#dce8de" : "#101828";

  return (
    <div>
      {title && (
        <h3 style={{ color: "var(--text)", fontSize: "0.875rem", fontWeight: 600, marginBottom: "16px", fontFamily: "Sora, sans-serif" }}>
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={reversed} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: textColor, fontSize: 11, fontFamily: "Outfit" }}
            tickFormatter={(v: string) => v.slice(5)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: textColor, fontSize: 11, fontFamily: "Outfit" }}
            axisLine={false}
            tickLine={false}
          />
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
            labelStyle={{ color: tooltipText, fontWeight: 600, marginBottom: 4 }}
          />
          <Legend
            wrapperStyle={{ fontFamily: "Outfit", fontSize: 12, paddingTop: 12, color: textColor }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke={colors.total}
            strokeWidth={2.5}
            dot={{ r: 4, fill: colors.total }}
            activeDot={{ r: 6 }}
            name="Tổng kiểm tra"
          />
          <Line
            type="monotone"
            dataKey="mature"
            stroke={colors.mature}
            strokeWidth={2}
            dot={{ r: 3, fill: colors.mature }}
            name="Chín"
          />
          <Line
            type="monotone"
            dataKey="defective"
            stroke={colors.defective}
            strokeWidth={2}
            dot={{ r: 3, fill: colors.defective }}
            name="Hư hỏng"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
