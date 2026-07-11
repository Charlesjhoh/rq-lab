"use client";

import { useEffect, useState, ReactNode } from "react";

type Props = {
  value: number;       // 0 ~ 100 사이의 퍼센트 값
  size?: number;
  strokeWidth?: number;
  color?: string;      // 💡 동적 색상 매핑용 프로프스 추가
  children?: ReactNode;
};

export default function CircularGauge({
  value,
  size = 120,
  strokeWidth = 14,    // 💡 기본 선 두께를 10에서 14로 확장하여 두껍게 세팅
  color = "#2563EB",   // 기본값 파란색
  children,
}: Props) {
  const [progress, setProgress] = useState(0);
  const max = 100;

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setProgress(Math.max(0, Math.min(value, 100)));
    });
    return () => cancelAnimationFrame(id);
  }, [value]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / max) * circumference;

  return (
    <div
      style={{
        position: "relative",
        width: `${size}px`,
        height: `${size}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={size}
        height={size}
        style={{
          transform: "rotate(-90deg)",
          transformOrigin: "center",
          display: "block",
        }}
      >
        {/* Background 트랙 원 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F1F5F9" // 약간 더 밝고 깔끔한 회색 바탕 트랙으로 변경
          strokeWidth={strokeWidth}
        />

        {/* Progress 채워지는 원 (동적 color 반영) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color} // 💡 외부에서 지정된 점수대별 색상이 바인딩됩니다.
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.2s ease-out, stroke 0.5s ease", // 색상 변경 시에도 부드럽게 변환되도록 속성 추가
          }}
        />
      </svg>

      {/* 정중앙 고정 텍스트 박스 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}