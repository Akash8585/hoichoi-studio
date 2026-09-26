"use client";

import { useEffect, useMemo, useRef } from "react";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import Link from "next/link";
import {
  CHANNEL_ORDER,
  channelChartConfig,
  channelColor,
  chartAxis,
  chartTooltip,
  formatCompactCount,
  type ChannelKey,
} from "./chartConfig";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

type MetricRow = {
  channel: string;
  metrics: {
    views: number;
    likes: number;
    engagementRate: number;
  } | null;
};

const COUNT_METRICS = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
] as const;

type CountMetricKey = (typeof COUNT_METRICS)[number]["key"];

/** Grouped column chart: Views and Likes by channel, plus engagement rate rows. */
export function EngagementComparisonChart({
  rows,
  loading,
  insightCaption,
}: {
  rows: MetricRow[];
  loading?: boolean;
  insightCaption?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const withMetrics = rows.filter((row) => row.metrics);

  const activeChannels = useMemo(
    () => CHANNEL_ORDER.filter((ch) => withMetrics.some((row) => row.channel === ch)),
    [withMetrics]
  );

  const leader = useMemo(() => {
    let best: { channel: ChannelKey; views: number } | null = null;
    for (const channel of activeChannels) {
      const metrics = withMetrics.find((row) => row.channel === channel)?.metrics;
      if (!metrics) continue;
      if (!best || metrics.views > best.views) {
        best = { channel, views: metrics.views };
      }
    }
    return best;
  }, [activeChannels, withMetrics]);

  useEffect(() => {
    if (!ref.current || !withMetrics.length) return;

    const byChannel = new Map(
      withMetrics.map((row) => [row.channel as ChannelKey, row.metrics!])
    );

    const channels = CHANNEL_ORDER.filter((ch) => byChannel.has(ch));
    let maxValue = 0;
    for (const channel of channels) {
      const metrics = byChannel.get(channel)!;
      for (const metric of COUNT_METRICS) {
        maxValue = Math.max(maxValue, metrics[metric.key as CountMetricKey]);
      }
    }
    const yMax = niceCountMax(maxValue);

    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        ...chartTooltip,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const items = params as Array<{
            axisValue: string;
            seriesName: string;
            color: string;
            value: number;
          }>;
          if (!items.length) return "";
          const lines = items.map((item) => {
            const fill =
              typeof item.color === "string"
                ? item.color
                : channelColor(
                    channels.find(
                      (ch) => channelChartConfig[ch].label === item.seriesName
                    ) || "x"
                  );
            return `<span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:${fill};margin-right:6px"></span>${item.seriesName}: <b>${Number(item.value).toLocaleString("en-IN")}</b>`;
          });
          return `${items[0].axisValue}<br/>${lines.join("<br/>")}`;
        },
      },
      grid: { left: 48, right: 16, top: 20, bottom: 32, containLabel: false },
      xAxis: {
        type: "category",
        data: COUNT_METRICS.map((m) => m.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...chartAxis.axisLabel },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: yMax,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          ...chartAxis.axisLabel,
          formatter: (value: number) => formatCompactCount(value),
        },
        splitLine: chartAxis.splitLine,
      },
      series: channels.map((channel, index) => {
        const metrics = byChannel.get(channel)!;
        const config = channelChartConfig[channel];
        const base = channelColor(channel);
        return {
          name: config.label,
          type: "bar",
          barWidth: 22,
          barGap: "12%",
          barCategoryGap: "40%",
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: base,
          },
          emphasis: {
            itemStyle: {
              color: base,
            },
          },
          data: COUNT_METRICS.map(
            (metric) => metrics[metric.key as CountMetricKey]
          ),
          z: index + 1,
        };
      }),
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const engagementRows = CHANNEL_ORDER.filter((ch) =>
    withMetrics.some((row) => row.channel === ch)
  ).map((channel) => {
    const row = withMetrics.find((r) => r.channel === channel)!;
    return {
      channel,
      label: channelChartConfig[channel].label,
      color: channelColor(channel),
      rate: row.metrics!.engagementRate,
    };
  });

  const engagementMax = Math.max(
    ...engagementRows.map((row) => row.rate),
    1
  );
  const engagementAxisMax = nicePercentMax(engagementMax);

  return (
    <div className="surface-card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Engagement across channels
          </p>
          {leader ? (
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
                {formatCompactCount(leader.views)}
              </span>
              <span className="text-sm text-zinc-500">
                views on {channelChartConfig[leader.channel].label}
              </span>
            </div>
          ) : (
            <h3 className="mt-1 text-base font-medium text-zinc-100">
              Same campaign, side by side
            </h3>
          )}
        </div>
        {activeChannels.length > 0 ? (
          <div className="flex shrink-0 flex-col items-end gap-1.5 pt-1">
            {activeChannels.map((channel) => (
              <span
                key={channel}
                className="flex items-center gap-2 text-[11px] text-zinc-500 sm:text-xs"
              >
                <span
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: channelColor(channel) }}
                />
                {channelChartConfig[channel].label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {loading ? (
        <div className="mt-4 h-72 animate-pulse rounded-[12px] bg-[#141414]" />
      ) : !withMetrics.length ? (
        <EmptyPublish />
      ) : (
        <>
          <div
            ref={ref}
            className="mt-3 w-full shrink-0"
            style={{ height: 240, minHeight: 220 }}
          />
          <div className="mt-3 rounded-[12px] bg-black/25 px-3 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Engagement rate
            </p>
            <ul className="mt-2 space-y-2">
              {engagementRows.map((row) => (
                <li key={row.channel} className="flex items-center gap-3">
                  <span
                    className="size-2 shrink-0 rounded-[3px]"
                    style={{ background: row.color }}
                    aria-hidden
                  />
                  <span className="w-36 shrink-0 truncate text-sm text-zinc-300">
                    {row.label}
                  </span>
                  <div className="h-1.5 min-w-0 flex-1 rounded-full bg-[#1a1a1a]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (row.rate / engagementAxisMax) * 100)}%`,
                        background: row.color,
                      }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm tabular-nums text-zinc-200">
                    {Number(row.rate).toLocaleString("en-IN", {
                      maximumFractionDigits: 1,
                    })}
                    %
                  </span>
                </li>
              ))}
            </ul>
          </div>
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

/** Round up count axis max with headroom so columns do not touch the top. */
function niceCountMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 10;
  const padded = value * 1.15;
  const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
  const normalized = padded / magnitude;
  let nice: number;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

/** Round up to a clean percent axis max (e.g. 6.2 to 10, 0.8 to 1). */
function nicePercentMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 10;
  if (value <= 1) return 1;
  if (value <= 5) return 5;
  if (value <= 10) return 10;
  if (value <= 25) return 25;
  if (value <= 50) return 50;
  return 100;
}

function EmptyPublish() {
  return (
    <div className="mt-4 flex min-h-72 flex-col items-center justify-center rounded-[12px] bg-black/25 px-4 text-center">
      <p className="text-sm text-zinc-400">
        No published posts yet for this campaign. Publish to Instagram Reels,
        YouTube Shorts, and X to compare engagement.
      </p>
      <Link
        href="/publisher"
        className="mt-3 text-sm text-[#0099ff] hover:underline"
      >
        Open Publish
      </Link>
    </div>
  );
}
