"use client";

import { useEffect, useRef } from "react";
import { RadarChart } from "echarts/charts";
import {
  LegendComponent,
  RadarComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import Link from "next/link";
import {
  CHANNEL_ORDER,
  channelChartConfig,
  channelColor,
  chartTooltip,
  type ChannelKey,
} from "./chartConfig";

echarts.use([
  RadarChart,
  RadarComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

type MetricRow = {
  channel: string;
  metrics: {
    views: number;
    engagementRate: number;
    shareRate: number;
    saveRate: number;
    ctr: number;
  } | null;
};

const AXES = [
  { key: "engagement", label: "Engagement" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
  { key: "ctr", label: "CTR" },
  { key: "reach", label: "Reach" },
] as const;

export function ChannelProfileRadar({
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

  useEffect(() => {
    if (!ref.current || !withMetrics.length) return;

    const maxViews = Math.max(
      ...withMetrics.map((row) => row.metrics!.views),
      1
    );

    const profiles = CHANNEL_ORDER.map((channel) => {
      const row = withMetrics.find((r) => r.channel === channel);
      if (!row?.metrics) return null;
      const m = row.metrics;
      const engagement = clamp(m.engagementRate);
      const shares = clamp(m.shareRate);
      const saves = clamp(m.saveRate);
      const ctrPct = clamp(m.ctr * 100);
      const reachPct = clamp((m.views / maxViews) * 100);
      return {
        channel,
        // Plot rates on a 0–100 radar; reach stays relative, not raw views.
        values: [engagement, shares, saves, ctrPct, reachPct],
        tooltipLines: [
          `Engagement: ${formatPct(m.engagementRate)}`,
          `Shares: ${formatPct(m.shareRate)}`,
          `Saves: ${formatPct(m.saveRate)}`,
          `CTR: ${formatPct(m.ctr * 100)}`,
          `Reach: ${m.views.toLocaleString("en-IN")} views (${formatPct(reachPct)} of campaign max)`,
        ],
      };
    }).filter(Boolean) as Array<{
      channel: ChannelKey;
      values: number[];
      tooltipLines: string[];
    }>;

    if (!profiles.length) return;

    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        ...chartTooltip,
        trigger: "item",
        formatter: (params: unknown) => {
          const item = params as { name: string; color: string };
          const profile = profiles.find(
            (p) => channelChartConfig[p.channel].label === item.name
          );
          if (!profile) return item.name;
          const lines = profile.tooltipLines
            .map(
              (line) =>
                `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px"></span>${line}`
            )
            .join("<br/>");
          return `${item.name}<br/>${lines}`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: "#a1a1aa" },
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        data: profiles.map((p) => channelChartConfig[p.channel].label),
      },
      radar: {
        center: ["50%", "48%"],
        radius: "58%",
        indicator: AXES.map((axis) => ({
          name: axis.label,
          max: 100,
        })),
        axisName: {
          color: "#a1a1aa",
          fontSize: 12,
        },
        splitArea: {
          areaStyle: {
            color: ["#0f0f0f", "#121212", "#0f0f0f", "#121212"],
          },
        },
        axisLine: { lineStyle: { color: "#262626" } },
        splitLine: { lineStyle: { color: "#262626" } },
      },
      series: [
        {
          type: "radar",
          symbol: "circle",
          symbolSize: 5,
          data: profiles.map((profile) => ({
            name: channelChartConfig[profile.channel].label,
            value: profile.values,
            lineStyle: {
              width: 2,
              color: channelColor(profile.channel),
            },
            itemStyle: { color: channelColor(profile.channel) },
            areaStyle: {
              color: channelColor(profile.channel),
              opacity: 0.18,
            },
          })),
        },
      ],
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  return (
    <div className="surface-card flex h-full flex-col p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          Channel profile
        </p>
        <h3 className="mt-1 text-base font-medium text-zinc-100">
          How each channel shapes the same brief
        </h3>
      </div>
      {loading ? (
        <div className="mt-4 h-72 animate-pulse rounded-[12px] bg-[#141414]" />
      ) : !withMetrics.length ? (
        <div className="mt-4 flex min-h-72 flex-col items-center justify-center rounded-[12px] bg-black/25 px-4 text-center">
          <p className="text-sm text-zinc-400">
            Radar shapes appear after this campaign has published metrics.
          </p>
          <Link
            href="/publisher"
            className="mt-3 text-sm text-[#0099ff] hover:underline"
          >
            Open Publish
          </Link>
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

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Number(value.toFixed(1))}%`;
}
