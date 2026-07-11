// src/components/ui/ScoreCard.tsx

"use client";

import CountUp from "react-countup";
import {
  CircularProgressbar,
  buildStyles,
} from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

type ScoreCardProps = {
  title: string;
  value: number;
  max: number;
  unit?: string;
  variant?: "default" | "ar";
};

export default function ScoreCard({
  title,
  value,
  max,
  unit = "",
  variant = "default",
}: ScoreCardProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const badge =
    variant === "ar"
      ? value >= 4
        ? "Excellent"
        : value >= 2.5
        ? "Good"
        : "Developing"
      : value >= max * 0.85
      ? "Excellent"
      : value >= max * 0.65
      ? "Good"
      : "Developing";

  const badgeStyle =
    badge === "Excellent"
      ? "bg-emerald-100 text-emerald-700"
      : badge === "Good"
      ? "bg-blue-100 text-blue-700"
      : "bg-orange-100 text-orange-700";

  return (
    <div
      className="
        rounded-3xl
        border border-slate-200
        bg-white
        p-6
        shadow-sm
        transition-all
        duration-300
        hover:scale-[1.02]
        hover:shadow-xl
      "
    >
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>

      <div className="mt-6 flex items-center gap-6">
        {/* Progress */}
        <div className="relative h-[118px] w-[118px] shrink-0">
          <CircularProgressbar
            value={percentage}
            strokeWidth={10}
            styles={buildStyles({
              pathColor: "#2563eb",
              trailColor: "#e5e7eb",
              strokeLinecap: "round",
              pathTransitionDuration: 1.4,
            })}
          />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-900 leading-none">
                <CountUp
                  end={value}
                  decimals={variant === "ar" ? 1 : 0}
                  duration={1.4}
                />
              </div>

              {unit && (
                <div className="mt-1 text-xs font-medium text-slate-500">
                  {unit}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Value */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="text-4xl font-bold tracking-tight text-slate-900">
            <CountUp
              end={value}
              decimals={variant === "ar" ? 1 : 0}
              duration={1.4}
            />
            {unit && (
              <span className="ml-2 text-xl font-semibold text-slate-500">
                {unit}
              </span>
            )}
          </div>

          <div
            className={`mt-3 inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ${badgeStyle}`}
          >
            {badge}
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-500">
        Max {max}
        {unit && ` ${unit}`}
      </div>
    </div>
  );
}