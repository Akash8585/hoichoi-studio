"use client";

import { useEffect, useMemo, useRef } from "react";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import {
  CHANNEL_ORDER,
  channelChartConfig,
  channelColor,
  chartAxis,
  chartTooltip,
  type ChannelKey,
} from "./chartConfig";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

export type MetricHistorySeries = {
  channel: string;
  readings: Array<{
    collectedAt: string;
    views: number;
    likes: number;
    engagementRate: number;
  }>;
};

/** Engagement rate over time. Skips fake trends when only one reading exists. */
export function MetricsTrendLine({
  series,
  loading,
  hasTrend,
  insightCaption,
}: {
  series: MetricHistorySeries[];
  loading?: boolean;
  hasTrend?: boolean;
  insightCaption?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const chartReady = Boolean(hasTrend && series.some((row) => row.readings.length > 1));

  const timeline = useMemo(() => {
    if (!chartReady) return [] as string[];
    const stamps = new Set<string>();
    for (const row of series) {
      for (const reading of row.readings) stamps.add(reading.collectedAt);
    }
    return [...stamps].sort();
  }, [chartReady, series]);

  useEffect(() => {
    if (!ref.current || !chartReady || !timeline.length) return;

    const byChannel = new Map<ChannelKey, Map<string, number>>();
    for (const row of series) {
      const channel = row.channel as ChannelKey;
      if (!CHANNEL_ORDER.includes(channel)) continue;
      const map = new Map<string, number>();
      for (const reading of row.readings) {
        map.set(reading.collectedAt, reading.engagementRate);
      }
      byChannel.set(channel, map);
    }

    const active = CHANNEL_ORDER.filter((ch) => byChannel.has(ch));
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        ...chartTooltip,
        trigger: "axis",
        formatter: (params: unknown) => {
          const items = params as Array<{
            axisValue: string;
            seriesName: string;
            color: string;
            value: number | null;
          }>;
          if (!items.length) return "";
          const stamp = items[0].axisValue;
          const label = formatTick(stamp);
          const lines = items
            .filter((item) => item.value != null)
            .map(
              (item) =>
                `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px"></span>${item.seriesName}: <b>${Number(item.value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%</b>`
            );
          return `${label}<br/>${lines.join("<br/>")}`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: "#a1a1aa" },
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
      },
      grid: { left: 48, right: 16, top: 24, bottom: 48 },
      xAxis: {
        type: "category",
        data: timeline,
        ...chartAxis,
        axisLabel: {
          ...chartAxis.axisLabel,
          formatter: (value: string) => formatTick(value),
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        ...chartAxis,
        axisLabel: {
          ...chartAxis.axisLabel,
          formatter: (value: number) => `${value}%`,
        },
      },
      series: active.map((channel) => {
        const map = byChannel.get(channel)!;
        return {
          name: channelChartConfig[channel].label,
          type: "line",
          smooth: true,
          showSymbol: timeline.length < 8,
          symbolSize: 7,
          lineStyle: { width: 2, color: channelColor(channel) },
          itemStyle: { color: channelColor(channel) },
          data: timeline.map((stamp) =>
            map.has(stamp) ? map.get(stamp)! : null
          ),
          connectNulls: false,
        };
      }),
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [chartReady, series, timeline]);

  return (
    <div className="surface-card flex h-full flex-col p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          Engagement over time
        </p>
        <h3 className="mt-1 text-base font-medium text-zinc-100">
          Readings across refresh ticks
        </h3>
      </div>
      {loading ? (
        <div className="mt-4 h-72 animate-pulse rounded-[12px] bg-[#141414]" />
      ) : !chartReady ? (
        <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-[12px] bg-black/25 px-4 text-center">
          <p className="text-sm text-zinc-400">
            Trends appear after more than one reading
          </p>
        </div>
      ) : (
        <>
          <div ref={ref} className="mt-2 h-72 w-full" />
          {insightCaption ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              {insightCaption}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function formatTick(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
