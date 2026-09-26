"use client";

import { useEffect, useRef } from "react";
import { BarChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { channelLabel } from "@/lib/insights/display";

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

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

const axis = {
  axisLine: { lineStyle: { color: "#262626" } },
  axisTick: { show: false },
  axisLabel: { color: "#999999", fontSize: 12 },
  splitLine: { lineStyle: { color: "#1a1a1a" } },
};

export function PerformanceChart({ rows }: { rows: MetricRow[] }) {
  const viewsRef = useRef<HTMLDivElement>(null);
  const ratesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewsRef.current || !ratesRef.current) return;
    const labels = rows.map((row) => channelLabel(row.channel));
    const views = echarts.init(viewsRef.current);
    const rates = echarts.init(ratesRef.current);

    views.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#141414",
        borderColor: "#262626",
        textStyle: { color: "#ffffff" },
      },
      grid: { left: 48, right: 16, top: 24, bottom: 28 },
      xAxis: { type: "category", data: labels, ...axis },
      yAxis: { type: "value", ...axis },
      series: [
        {
          name: "Views",
          type: "bar",
          data: rows.map((row) => row.metrics?.views || 0),
          barMaxWidth: 42,
          itemStyle: { color: "#ffffff", borderRadius: [8, 8, 0, 0] },
        },
      ],
    });

    rates.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#141414",
        borderColor: "#262626",
        textStyle: { color: "#ffffff" },
        valueFormatter: (value: number) => `${Number(value).toFixed(1)}%`,
      },
      legend: {
        bottom: 0,
        textStyle: { color: "#999999" },
        icon: "circle",
      },
      grid: { left: 40, right: 16, top: 24, bottom: 48 },
      xAxis: { type: "category", data: labels, ...axis },
      yAxis: { type: "value", ...axis, axisLabel: { ...axis.axisLabel, formatter: "{value}%" } },
      series: [
        { name: "Engagement", type: "bar", data: rows.map((row) => row.metrics?.engagementRate || 0), itemStyle: { color: "#0099ff", borderRadius: [6, 6, 0, 0] } },
        { name: "Share", type: "bar", data: rows.map((row) => row.metrics?.shareRate || 0), itemStyle: { color: "#ff7a3d", borderRadius: [6, 6, 0, 0] } },
        { name: "Save", type: "bar", data: rows.map((row) => row.metrics?.saveRate || 0), itemStyle: { color: "#a78bfa", borderRadius: [6, 6, 0, 0] } },
        { name: "CTR", type: "bar", data: rows.map((row) => (row.metrics?.ctr || 0) * 100), itemStyle: { color: "#22c55e", borderRadius: [6, 6, 0, 0] } },
      ],
    });

    const resize = () => {
      views.resize();
      rates.resize();
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      views.dispose();
      rates.dispose();
    };
  }, [rows]);

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-2">
      <div>
        <p className="text-sm font-medium">Views</p>
        <div ref={viewsRef} className="mt-2 h-72 w-full" />
      </div>
      <div>
        <p className="text-sm font-medium">Rates</p>
        <div ref={ratesRef} className="mt-2 h-72 w-full" />
      </div>
    </div>
  );
}
