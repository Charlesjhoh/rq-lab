"use client";

import CountUp from "react-countup";
import CircularGauge from "./CircularGauge";

type PremiumScoreCardProps = {
  title: string;
  value: number;
  max: number;
  unit?: string;
  variant?: "default" | "ar";
};

export default function PremiumScoreCard({
  title,
  value,
  max,
  unit = "",
  variant = "default",
}: PremiumScoreCardProps) {
  const percentage = Math.min((value / max) * 100, 100);

  // 💡 값의 비율(percentage)에 따라 동적으로 색상 지정
  let gaugeColor = "#2563EB"; // 기본 파란색
  if (percentage < 30) {
    gaugeColor = "#EF4444"; // 30% 미만: 빨간색 (Red)
  } else if (percentage < 55) {
    gaugeColor = "#F97316"; // 55% 미만: 주황색 (Orange)
  } else if (percentage < 75) {
    gaugeColor = "#FACC15"; // 75% 미만: 노란색 (Yellow)
  } else if (percentage < 90) {
    gaugeColor = "#22C55E"; // 90% 미만: 초록색 (Green)
  } else {
    gaugeColor = "#3B82F6"; // 90% 이상: 파란색 (Blue)
  }

  const badge =
    variant === "ar"
      ? value >= 4
        ? "Excellent"
        : value >= 2.5
        ? "Good"
        : "Developing"
      : percentage >= 85
      ? "Excellent"
      : percentage >= 65
      ? "Good"
      : "Developing";

  const badgeStyle =
    badge === "Excellent"
      ? "bg-emerald-100 text-emerald-700"
      : badge === "Good"
      ? "bg-amber-100 text-amber-700"
      : "bg-rose-100 text-rose-700";

  return (
    <div
      className="group transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg"
      style={{
        width: "100%",
        backgroundColor: "#ffffff",
        border: "1px solid #E2E8F0",
        borderRadius: "22px",
        padding: "22px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "280px",
        textAlign: "center",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.04)",
      }}
    >
      {/* 타이틀 */}
      <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "bold", color: "#475569" }}>
        {title}
      </h3>

      {/* 게이지 구역 (동적 색상 gaugeColor 전달) */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", flexGrow: 1 }}>
        <CircularGauge value={percentage} size={144} strokeWidth={16} color={gaugeColor}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "30px", fontWeight: "900", color: "#0F172A", lineHeight: 1 }}>
              <CountUp end={value} decimals={variant === "ar" ? 1 : 0} duration={1.2} />
            </span>
            {unit && (
              <span style={{ fontSize: "11px", fontWeight: "bold", color: "#94A3B8", marginTop: "5px" }}>
                {unit}
              </span>
            )}
          </div>
        </CircularGauge>
      </div>

      {/* 하단 뱃지 가이드 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: "100%", marginTop: "12px" }}>
        <div className={`rounded-full px-3 py-1 text-[11px] font-bold ${badgeStyle}`}>
          {badge}
        </div>
        <div style={{ fontSize: "10px", color: "#94A3B8" }}>
          Max {max} {unit}
        </div>
      </div>
    </div>
  );
}
