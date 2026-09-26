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
  formatCompactCount,
  type ChannelKey,
} from "./chartConfig";
import type { MetricHistorySeries } from "./MetricsTrendLine";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

/** Stacked area of views by channel. Only renders when 2+ snapshots exist. */
export function MetricsViewsArea({
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
        map.set(reading.collectedAt, reading.views);
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
          const label = formatTick(items[0].axisValue);
          const lines = items
            .filter((item) => item.value != null)
            .map(
              (item) =>
                `<span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:${item.color};margin-right:6px"></span>${item.seriesName}: <b>${Number(item.value).toLocaleString("en-IN")}</b>`
            );
          return `${label}<br/>${lines.join("<br/>")}`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: "#a1a1aa" },
        icon: "roundRect",
        itemWidth: 10,
        itemHeight: 8,
      },
      grid: { left: 48, right: 16, top: 24, bottom: 48 },
      xAxis: {
        type: "category",
        boundaryGap: false,
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
          formatter: (value: number) => formatCompactCount(value),
        },
      },
      series: active.map((channel) => {
        const map = byChannel.get(channel)!;
        const color = channelColor(channel);
        return {
          name: channelChartConfig[channel].label,
          type: "line",
          stack: "views",
          smooth: true,
          showSymbol: timeline.length < 8,
          symbolSize: 6,
          lineStyle: { width: 2, color },
          itemStyle: { color },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: withAlpha(color, 0.45) },
              { offset: 1, color: withAlpha(color, 0.05) },
            ]),
          },
          data: timeline.map((stamp) =>
            map.has(stamp) ? map.get(stamp)! : 0
          ),
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

  if (!loading && !chartReady) return null;

  return (
    <div className="surface-card flex h-full flex-col p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          Views over time
        </p>
        <h3 className="mt-1 text-base font-medium text-zinc-100">
          Stacked reach by channel
        </h3>
      </div>
      {loading ? (
        <div className="mt-4 h-72 animate-pulse rounded-[12px] bg-[#141414]" />
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

function withAlpha(hex: string, alpha: number) {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
