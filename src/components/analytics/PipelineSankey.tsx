"use client";

import { useEffect, useMemo, useRef } from "react";
import { SankeyChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { chartTooltip } from "./chartConfig";

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);

export type PipelineStages = {
  brief: number;
  generated: number;
  review: number;
  approved: number;
  discarded: number;
  scheduled: number;
  published: number;
  rejected: number;
  insights: number;
};

const NODE_COLORS: Record<string, string> = {
  Brief: "#e4e4e7",
  Generated: "#0099ff",
  Review: "#a78bfa",
  Approved: "#22c55e",
  Discarded: "#71717a",
  Scheduled: "#fbbf24",
  Published: "#f77737",
  Rejected: "#ef4444",
  Insights: "#38bdf8",
};

export function PipelineSankey({
  stages,
  loading,
  insightCaption,
}: {
  stages: PipelineStages | null;
  loading?: boolean;
  insightCaption?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const { nodes, links } = useMemo(() => buildSankey(stages), [stages]);

  useEffect(() => {
    if (!ref.current || !links.length) return;

    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        ...chartTooltip,
        trigger: "item",
        formatter: (params: unknown) => {
          const p = params as {
            dataType: string;
            name: string;
            data: { source?: string; target?: string; value?: number };
            value?: number;
          };
          if (p.dataType === "edge") {
            return `${p.data.source} to ${p.data.target}: <b>${p.data.value}</b>`;
          }
          return `${p.name}: <b>${p.value}</b>`;
        },
      },
      series: [
        {
          type: "sankey",
          emphasis: { focus: "adjacency" },
          nodeAlign: "justify",
          nodeGap: 14,
          nodeWidth: 16,
          layoutIterations: 32,
          data: nodes,
          links,
          label: {
            color: "#d4d4d8",
            fontSize: 12,
          },
          lineStyle: {
            color: "gradient",
            curveness: 0.5,
            opacity: 0.35,
          },
        },
      ],
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [nodes, links]);

  return (
    <div className="surface-card flex h-full flex-col p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          Content pipeline
        </p>
        <h3 className="mt-1 text-base font-medium text-zinc-100">
          From brief to published insights
        </h3>
      </div>
      {loading ? (
        <div className="mt-4 h-80 animate-pulse rounded-[12px] bg-[#141414]" />
      ) : !links.length ? (
        <div className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-[12px] bg-black/25 px-4 text-center">
          <p className="text-sm text-zinc-400">
            Pipeline flow appears once this campaign has packages or posts in
            progress.
          </p>
        </div>
      ) : (
        <>
          <div ref={ref} className="mt-2 h-80 w-full" />
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

function buildSankey(stages: PipelineStages | null) {
  if (!stages) return { nodes: [] as Array<{ name: string; itemStyle: { color: string } }>, links: [] as Array<{ source: string; target: string; value: number }> };

  const candidates: Array<{ source: string; target: string; value: number }> = [
    { source: "Brief", target: "Generated", value: stages.generated },
    { source: "Generated", target: "Review", value: stages.review },
    { source: "Review", target: "Approved", value: stages.approved },
    { source: "Review", target: "Discarded", value: stages.discarded },
    { source: "Approved", target: "Scheduled", value: stages.scheduled },
    { source: "Scheduled", target: "Published", value: stages.published },
    { source: "Scheduled", target: "Rejected", value: stages.rejected },
    { source: "Published", target: "Insights", value: stages.insights },
  ];

  // If nothing reached review yet but packages exist, show Brief → Generated only.
  // Also allow Brief → Generated when brief count exists but generated is 0? omit.
  if (stages.brief > 0 && stages.generated === 0) {
    // Still show a single node path if we only have a brief.
  }

  const links = candidates.filter((link) => link.value > 0);

  // Ensure Brief participates when we have packages but brief count was set.
  if (stages.brief > 0 && stages.generated > 0) {
    const hasBriefLink = links.some(
      (link) => link.source === "Brief" && link.target === "Generated"
    );
    if (!hasBriefLink) {
      links.unshift({
        source: "Brief",
        target: "Generated",
        value: Math.min(stages.brief, stages.generated) || stages.generated,
      });
    }
  }

  const used = new Set<string>();
  for (const link of links) {
    used.add(link.source);
    used.add(link.target);
  }

  const nodes = [...used].map((name) => ({
    name,
    itemStyle: { color: NODE_COLORS[name] || "#71717a" },
  }));

  return { nodes, links };
}
