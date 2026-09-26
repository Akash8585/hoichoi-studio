"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Trophy } from "lucide-react";
import { Button, EmptyState, MetricCard, Notice, PageHeader, Skeleton } from "@/components/ui/core";
import { EngagementComparisonChart } from "@/components/analytics/EngagementComparisonChart";
import { ChannelProfileRadar } from "@/components/analytics/ChannelProfileRadar";
import {
  PipelineSankey,
  type PipelineStages,
} from "@/components/analytics/PipelineSankey";
import {
  MetricsTrendLine,
  type MetricHistorySeries,
} from "@/components/analytics/MetricsTrendLine";
import { MetricsViewsArea } from "@/components/analytics/MetricsViewsArea";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { channelLabel, humanizeClaim } from "@/lib/insights/display";

type Brief = { id: string; title: string };
type Row = {
  postId: string;
  channel: string;
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    ctr: number;
    engagementRate: number;
    shareRate: number;
    saveRate: number;
    collectedAt: string;
  } | null;
};
type Report = {
  id: string;
  bodyMd: string;
  citedPostIds: string[];
  periodStart: string;
  periodEnd: string;
  postLabels?: Record<string, string>;
  claims: Array<{ claim: string; evidencePostIds: string[]; recommendation?: string }>;
};

export default function PerformancePage() {
  const router = useRouter();
  const { show } = useToast();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [briefId, setBriefId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [winner, setWinner] = useState<{ channel: string; postId: string; reason: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineStages | null>(null);
  const [historySeries, setHistorySeries] = useState<MetricHistorySeries[]>([]);
  const [hasTrend, setHasTrend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"image" | "video">("image");
  const [reportId, setReportId] = useState("");

  async function loadInitial() {
    setLoading(true);
    try {
      const [briefData, reportData] = await Promise.all([
        fetch("/api/briefs").then((response) => response.json()),
        fetch("/api/insights/reports").then((response) => response.json()),
      ]);
      const list = (briefData.briefs || []).map((brief: Brief) => ({ id: brief.id, title: brief.title }));
      setBriefs(list);
      setBriefId((current) => current || list[0]?.id || "");
      setReports(reportData.reports || []);
    } catch {
      show("Performance data could not be loaded.", "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void loadInitial(); }, []);

  useEffect(() => {
    if (!briefId) return;
    setComparisonLoading(true);
    fetch(`/api/briefs/${briefId}/comparison`)
      .then((response) => response.json())
      .then((payload) => {
        setRows(payload.comparison?.rows || []);
        setWinner(payload.comparison?.winner || null);
      })
      .catch(() => show("Campaign comparison failed to load.", "error"))
      .finally(() => setComparisonLoading(false));
  }, [briefId]);

  useEffect(() => {
    if (!briefId) return;
    setPipelineLoading(true);
    fetch(`/api/insights/pipeline?briefId=${encodeURIComponent(briefId)}`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.stages) setPipeline(payload.stages);
        else setPipeline(null);
      })
      .catch(() => show("Pipeline data failed to load.", "error"))
      .finally(() => setPipelineLoading(false));
  }, [briefId]);

  useEffect(() => {
    if (!briefId) return;
    setHistoryLoading(true);
    fetch(`/api/insights/metrics-history?briefId=${encodeURIComponent(briefId)}`)
      .then((response) => response.json())
      .then((payload) => {
        setHistorySeries(payload.series || []);
        setHasTrend(Boolean(payload.hasTrend));
      })
      .catch(() => {
        setHistorySeries([]);
        setHasTrend(false);
      })
      .finally(() => setHistoryLoading(false));
  }, [briefId]);

  async function generateReport() {
    setBusy(true);
    try {
      const response = await fetch("/api/insights/weekly-report", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Report generation failed");
      show("Weekly insight created.", "success");
      await loadInitial();
    } catch (error) {
      show((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function applyToNextBrief(reportId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/insights/reports/${reportId}/apply`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Brief creation failed");
      show("A new campaign brief was created from these insights.", "success");
      router.push(payload.redirectTo || `/studio?brief=${payload.brief.id}`);
    } catch (error) {
      show((error as Error).message, "error");
      setBusy(false);
    }
  }

  const summary = useMemo(() => {
    const metrics = rows.flatMap((row) => (row.metrics ? [row.metrics] : []));
    return {
      views: metrics.reduce((sum, metric) => sum + metric.views, 0),
      engagement: metrics.length
        ? metrics.reduce((sum, metric) => sum + metric.engagementRate, 0) / metrics.length
        : 0,
      channels: metrics.length,
    };
  }, [rows]);

  const comparisonCaption = useMemo(() => {
    if (!winner?.channel) return undefined;
    const winnerRow = rows.find((row) => row.channel === winner.channel);
    const rate = winnerRow?.metrics?.engagementRate;
    const name = channelLabel(winner.channel);
    if (rate == null) return `${name} leads this campaign on engagement.`;
    return `${name} leads this campaign at ${rate}% engagement.`;
  }, [winner, rows]);

  const radarCaption = useMemo(() => {
    const withMetrics = rows.filter((row) => row.metrics);
    if (withMetrics.length < 2) return undefined;
    return "Different shapes mean each channel is pulling a different mix of reach, saves, and shares.";
  }, [rows]);

  const selectedReport = reports.find((report) => report.id === (reportId || reports[0]?.id));
  const sankeyCaption = selectedReport?.claims?.[0]?.claim
    ? humanizeClaim(selectedReport.claims[0].claim)
    : undefined;

  const publishedCount = rows.filter((row) => row.metrics).length;

  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Performance"
        title="Turn measured outcomes into the next creative decision."
        description="Compare the same campaign across Instagram, YouTube, and X, then turn the strongest ideas into the next brief."
        actions={<Button loading={busy} onClick={generateReport}><FileText className="size-4" /> Generate weekly report</Button>}
      />
      <div className="flex w-fit rounded-full bg-[#141414] p-1">
        {([
          { id: "image", label: "Image analytics" },
          { id: "video", label: "Video analytics" },
        ] as const).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "min-h-10 rounded-full px-4 text-sm text-zinc-500",
              tab === item.id && "bg-[#1c1c1c] text-white"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "video" ? (
        <EmptyState
          title="Video analytics coming in the next release"
          description="Comparing video with still images starts when Video Studio ships. Image results already compare the same campaign across Instagram, YouTube, and X."
          action={<Link href="/studio/videos"><Button>Open Video Studio roadmap</Button></Link>}
        />
      ) : loading ? (
        <Skeleton className="h-80" />
      ) : (
        <>
          <Notice title="Simulated metrics for MVP.">
            These rates are generated after a demo publish so you can compare the same campaign. They are not pulled from Instagram, YouTube, or X.
          </Notice>
          <label className="block max-w-xl text-sm text-zinc-400">
            Campaign to compare
            <select value={briefId} onChange={(event) => setBriefId(event.target.value)} className="input mt-2">
              {briefs.map((brief) => <option key={brief.id} value={brief.id}>{brief.title}</option>)}
            </select>
          </label>

          <section className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Simulated views" value={summary.views.toLocaleString("en-IN")} detail="Mock adapter records" />
            <MetricCard label="Average engagement" value={`${summary.engagement.toFixed(1)}%`} detail="Normalized across channels" />
            <MetricCard label="Comparable channels" value={`${summary.channels}/3`} detail="Same source brief" />
          </section>

          {publishedCount < 3 && !comparisonLoading ? (
            <EmptyState
              title="Publish all three channels to compare"
              description="Compare this campaign after Instagram Reels, YouTube Shorts, and X are all published."
              action={<Link href="/publisher"><Button>Open Publish</Button></Link>}
            />
          ) : null}

          {winner && publishedCount >= 3 ? (
            <section className="surface-card overflow-hidden">
              <div className="gradient-spotlight-orange flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-white text-black"><Trophy className="size-5" /></span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-white/60">Winning channel</p>
                    <p className="mt-1 text-lg font-medium">{channelLabel(winner.channel)}</p>
                  </div>
                </div>
                <p className="max-w-xl text-sm text-white/75">{humanizeClaim(winner.reason)}</p>
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-2">
            <EngagementComparisonChart
              rows={rows}
              loading={comparisonLoading}
              insightCaption={comparisonCaption}
            />
            <ChannelProfileRadar
              rows={rows}
              loading={comparisonLoading}
              insightCaption={radarCaption}
            />
          </section>

          <PipelineSankey
            stages={pipeline}
            loading={pipelineLoading}
            insightCaption={sankeyCaption}
          />

          <section className="grid gap-4">
            <MetricsTrendLine
              series={historySeries}
              loading={historyLoading}
              hasTrend={hasTrend}
            />
            <MetricsViewsArea
              series={historySeries}
              loading={historyLoading}
              hasTrend={hasTrend}
            />
          </section>
        </>
      )}

      {tab === "image" && !loading && (
        <WeeklyInsights
          reports={reports}
          selectedId={reportId || reports[0]?.id || ""}
          onSelect={setReportId}
          busy={busy}
          onApply={applyToNextBrief}
        />
      )}
    </div>
  );
}

function formatPeriod(start: string, end: string) {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return `${new Date(start).toLocaleDateString("en-IN", options)} to ${new Date(end).toLocaleDateString("en-IN", options)}`;
}

function WeeklyInsights({
  reports,
  selectedId,
  onSelect,
  busy,
  onApply,
}: {
  reports: Report[];
  selectedId: string;
  onSelect: (id: string) => void;
  busy: boolean;
  onApply: (id: string) => void;
}) {
  const selected = reports.find((report) => report.id === selectedId) || reports[0];
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-4 text-[#0099ff]" />
        <h2 className="text-xl font-medium tracking-tight">Weekly insights</h2>
      </div>
      {!selected ? (
        <EmptyState title="No weekly insight yet" description="Publish your posts, then generate an insight you can turn into the next brief." />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="surface-card flex max-h-[540px] flex-col overflow-hidden">
            <p className="border-b border-[#262626] px-4 py-3 text-xs text-zinc-500">{reports.length} weeks</p>
            <div className="overflow-y-auto p-2">
              {reports.map((report) => {
                const active = report.id === selected.id;
                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => onSelect(report.id)}
                    className={cn(
                      "flex w-full flex-col items-start gap-1 rounded-[12px] px-3 py-3 text-left",
                      active ? "bg-white text-black" : "text-zinc-300 hover:bg-white/5"
                    )}
                  >
                    <span className="text-sm font-medium">{formatPeriod(report.periodStart, report.periodEnd)}</span>
                    <span className={cn("text-xs", active ? "text-black/60" : "text-zinc-500")}>
                      {report.claims?.length || 0} findings
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <article className="surface-card flex min-h-[540px] flex-col p-5">
            <div className="flex flex-col gap-4 border-b border-[#262626] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{formatPeriod(selected.periodStart, selected.periodEnd)}</p>
                <p className="mt-1 text-xs text-zinc-500">{selected.claims?.length || 0} findings from this week</p>
              </div>
              <Button loading={busy} onClick={() => onApply(selected.id)}>
                Use in next brief <ArrowRight className="size-4" />
              </Button>
            </div>
            <div className="mt-4 flex max-h-[430px] flex-col gap-3 overflow-y-auto pr-1">
              {(selected.claims || []).map((claim, index) => {
                const text = humanizeClaim(claim.claim);
                const next = claim.recommendation ? humanizeClaim(claim.recommendation) : "";
                const channels = [...new Set(claim.evidencePostIds.map((postId) => selected.postLabels?.[postId] || "Post"))];
                return (
                  <div key={index} className="rounded-[15px] bg-black/25 p-4">
                    <p className="text-sm leading-relaxed text-zinc-200">{text}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {channels.map((channel) => (
                        <span key={channel} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
                          {channel}
                        </span>
                      ))}
                    </div>
                    {next && <p className="mt-3 text-xs leading-relaxed text-zinc-500">Try next: {next}</p>}
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
