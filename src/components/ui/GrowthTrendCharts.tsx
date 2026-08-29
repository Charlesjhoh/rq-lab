"use client";

import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DotItemDotProps, TooltipContentProps } from "recharts";
import { TrendingUp, Timer, Target, Brain, Mic } from "lucide-react";

type ReadingResultPoint = {
  created_at: string;
  wpm: number;
  accuracy: number;
  comprehension: number;
  final_ar: number;
  // 2026-08-28 이전 기록은 컬럼 자체가 없었어서 과거 데이터는 전부 null — 항상 존재를
  // 가정하면 안 되고, 차트마다 null을 걸러낸 뒤 그려야 한다.
  pronunciation_accuracy: number | null;
};

type MetricKey = "wpm" | "accuracy" | "comprehension" | "final_ar" | "pronunciation_accuracy";

type MetricConfig = {
  key: MetricKey;
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  domain?: [number, number];
  // 값 자체(%, 소수점 등)를 포함해 완전한 문자열로 반환 — 툴팁/증감 표시에서 그대로 사용
  format: (v: number) => string;
  // Y축 눈금은 단위 없이 짧게 — DB 원본값이 소수점을 포함할 수 있어 반올림해서 보여준다
  tickFormat: (v: number) => string;
};

// 기존 프리미엄 리포트의 Reading DNA 게이지, THEMES 색상과 동일한 팔레트를 그대로 사용해
// 새 색을 도입하지 않고 앱 전체의 시각적 일관성을 유지한다.
const METRICS: MetricConfig[] = [
  { key: "wpm", label: "속도", color: "#f59e0b", icon: Timer, format: (v) => `${Math.round(v)} WPM`, tickFormat: (v) => `${Math.round(v)}` },
  { key: "accuracy", label: "읽기 정확도", color: "#10b981", icon: Target, domain: [0, 100], format: (v) => `${Math.round(v)}%`, tickFormat: (v) => `${Math.round(v)}` },
  { key: "comprehension", label: "이해도", color: "#3b82f6", icon: Brain, domain: [0, 100], format: (v) => `${Math.round(v)}%`, tickFormat: (v) => `${Math.round(v)}` },
  { key: "final_ar", label: "AR 레벨", color: "#6366f1", icon: TrendingUp, format: (v) => `AR ${v.toFixed(1)}`, tickFormat: (v) => v.toFixed(1) },
  { key: "pronunciation_accuracy", label: "발음 정확도", color: "#ec4899", icon: Mic, domain: [0, 100], format: (v) => `${Math.round(v)}%`, tickFormat: (v) => `${Math.round(v)}` },
];

const RANGE_OPTIONS: { key: string; label: string; months: number | null }[] = [
  { key: "3m", label: "최근 3개월", months: 3 },
  { key: "6m", label: "최근 6개월", months: 6 },
  { key: "1y", label: "최근 1년", months: 12 },
  { key: "all", label: "전체", months: null },
];

function formatTick(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function CustomTooltip({
  active,
  payload,
  metric,
}: TooltipContentProps & { metric: MetricConfig }) {
  const point = payload?.[0]?.payload as ReadingResultPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-[11px] font-medium text-slate-400">
        {new Date(point.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
      </p>
      <p className="mt-0.5 text-sm font-bold text-slate-800">{metric.format(Number(point[metric.key]))}</p>
    </div>
  );
}

// 점이 많아지면 선 위에 점이 빽빽하게 겹쳐 지저분해 보이므로, 데이터가 많을 땐
// 가장 최근 값 하나만 강조해서 찍고 나머지는 선으로만 흐름을 보여준다.
function makeDotRenderer(color: string, total: number) {
  function renderDot(props: DotItemDotProps) {
    const { cx, cy, index } = props;
    const isLast = index === total - 1;
    const showAll = total <= 10;
    if (!showAll && !isLast) {
      return <circle key={`dot-${index}`} cx={cx} cy={cy} r={0} fill="none" />;
    }
    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={isLast ? 4 : 3}
        fill={color}
        stroke="none"
      />
    );
  }
  return renderDot;
}

function SingleMetricChart({ metric, data }: { metric: MetricConfig; data: ReadingResultPoint[] }) {
  const Icon = metric.icon;
  const latest = data[data.length - 1];
  const first = data[0];
  const delta = Number(latest[metric.key]) - Number(first[metric.key]);
  const improved = delta > 0;
  const unchanged = Math.abs(delta) < 0.05;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Icon className="h-3.5 w-3.5" style={{ color: metric.color }} aria-hidden={true} />
          {metric.label}
        </div>
        {!unchanged && (
          <span
            className={`text-[11px] font-bold tabular-nums ${
              improved ? "text-emerald-600" : "text-rose-500"
            }`}
          >
            {improved ? "▲" : "▼"} {metric.format(Math.abs(delta))}
          </span>
        )}
      </div>

      <div className="mt-2 h-[110px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="created_at"
              tickFormatter={formatTick}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={metric.domain ?? ["auto", "auto"]}
              tickFormatter={metric.tickFormat}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              content={(props) => <CustomTooltip {...props} metric={metric} />}
              cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
            />
            <Line
              type="monotone"
              dataKey={metric.key}
              stroke={metric.color}
              strokeWidth={2}
              dot={makeDotRenderer(metric.color, data.length)}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function GrowthTrendCharts({ results }: { results: ReadingResultPoint[] }) {
  const [rangeKey, setRangeKey] = useState("3m");

  // reading_results는 최신순(desc)으로 넘어오므로, 그래프는 시간순(과거→최근)으로 뒤집어서 그린다.
  const filtered = useMemo(() => {
    const opt = RANGE_OPTIONS.find((o) => o.key === rangeKey);
    if (!opt || opt.months == null) return results;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - opt.months);
    return results.filter((r) => new Date(r.created_at) >= cutoff);
  }, [results, rangeKey]);

  const chronological = useMemo(() => [...filtered].reverse(), [filtered]);

  const rangeSelector = results.length >= 2 && (
    <div className="flex flex-wrap gap-1.5">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => setRangeKey(opt.key)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            rangeKey === opt.key
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  // 전체 응시 이력 자체가 2회 미만 — 기간을 아무리 늘려도 의미 있는 추이가 안 나온다.
  if (results.length < 2) {
    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5 sm:px-10">
          <TrendingUp className="h-5 w-5 text-indigo-500" aria-hidden={true} />
          <h3 className="text-base font-semibold text-slate-900">성장 추이</h3>
        </div>
        <div className="px-6 py-8 text-center sm:px-10">
          <p className="text-sm text-slate-500">
            테스트를 2회 이상 보면 속도·정확도·이해도·AR 레벨이 어떻게 변해왔는지 그래프로 보여드려요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-500" aria-hidden={true} />
          <h3 className="text-base font-semibold text-slate-900">성장 추이</h3>
        </div>
        {rangeSelector}
      </div>

      {chronological.length < 2 ? (
        <div className="px-6 py-8 text-center sm:px-10">
          <p className="text-sm text-slate-500">
            선택한 기간에는 기록이 충분하지 않아요. 더 긴 기간을 선택해보세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 px-6 py-6 sm:grid-cols-2 sm:px-10">
          {METRICS.map((metric) => {
            // pronunciation_accuracy는 컬럼 추가(2026-08-28) 이전 기록엔 값이 없어 null일 수
            // 있다 — 지표마다 유효한 값만 따로 걸러서, 이 지표만 아직 추이를 보여줄 만큼 안
            // 쌓였어도 다른 지표들은 정상적으로 그려지게 한다.
            const points = chronological.filter((d) => d[metric.key] != null);
            if (points.length < 2) {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.key}
                  className="flex min-h-[178px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center"
                >
                  <Icon className="h-4 w-4 text-slate-300" aria-hidden={true} />
                  <p className="mt-2 text-xs font-semibold text-slate-500">{metric.label}</p>
                  <p className="mt-1 text-[11px] text-slate-400">데이터가 더 쌓이면 표시돼요</p>
                </div>
              );
            }
            return <SingleMetricChart key={metric.key} metric={metric} data={points} />;
          })}
        </div>
      )}
    </div>
  );
}
