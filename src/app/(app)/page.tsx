"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { motion } from "motion/react";
import { Button, EmptyState, MetricCard, PageHeader, Skeleton, StatusBadge } from "@/components/ui/core";
import { useToast } from "@/components/ui/Toast";
import { PipelineStepper, workflowLabel, workflowStep } from "@/components/workflow/PipelineStepper";
import { channelLabel } from "@/lib/insights/display";

type Brief = {
  id: string;
  title: string;
  language: string;
  objective?: string | null;
  updatedAt: string;
  packages: Array<{
    status: string;
    channel: string;
    imageStatus: string;
    videoStatus: string;
    posts?: Array<{ status: string; metrics?: Array<{ id: string }> }>;
  }>;
};

export default function CampaignsPage() {
  const { show } = useToast();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [published, setPublished] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/briefs").then(async (response) => {
        if (!response.ok) throw new Error("Campaigns could not be loaded");
        return response.json();
      }),
      fetch("/api/publisher").then((response) => response.json()),
    ])
      .then(([briefData, postData]) => {
        setBriefs(briefData.briefs || []);
        setPublished(
          (postData.posts || []).filter((post: { status: string }) => post.status === "published").length
        );
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const packages = briefs.flatMap((brief) => brief.packages);
    return {
      review: packages.filter((pkg) => pkg.status === "pending_approval").length,
      approved: packages.filter((pkg) => pkg.status === "approved").length,
      attention: packages.filter((pkg) =>
        ["failed", "placeholder"].includes(pkg.imageStatus)
      ).length,
    };
  }, [briefs]);

  async function deleteCampaign(brief: Brief) {
    if (
      !window.confirm(
        "Delete this campaign? This removes its images and posts."
      )
    ) {
      return;
    }
    setDeletingId(brief.id);
    try {
      const response = await fetch(`/api/briefs/${brief.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not delete campaign");
      }
      setBriefs((current) => current.filter((item) => item.id !== brief.id));
      show("Campaign deleted", "success");
    } catch (reason) {
      show((reason as Error).message, "error");
    } finally {
      setDeletingId("");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Campaigns move from one brief to measurable performance."
        description="Create native Bengali and English assets, keep humans in control, publish safely, and feed evidence back into the next campaign."
        actions={
          <Link href="/studio">
            <Button>New campaign <Plus className="size-4" /></Button>
          </Link>
        }
      />

      {error && (
        <div className="rounded-[15px] border border-red-400/20 bg-red-400/8 p-4 text-sm text-red-200">{error}</div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/approvals"><MetricCard label="Needs review" value={stats.review} detail="Human approval required" accent={stats.review > 0} /></Link>
        <Link href="/publisher"><MetricCard label="Approved queue" value={stats.approved} detail="Ready to schedule" /></Link>
        <Link href="/publisher"><MetricCard label="Live posts" value={published} detail="Across all channels" /></Link>
        <MetricCard label="Needs attention" value={stats.attention} detail="Failed or incomplete assets" />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-medium tracking-[-0.03em]">Active campaigns</h2>
          <span className="text-xs text-zinc-500">{briefs.length} total</span>
        </div>
        {!briefs.length ? (
          <EmptyState
            title="Create your first campaign"
            description="Start with one content brief and the studio will build a different asset for each channel."
            action={<Link href="/studio"><Button>Create campaign</Button></Link>}
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {briefs.map((brief, index) => (
              <motion.div
                key={brief.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="surface-card p-5 transition hover:-translate-y-0.5 hover:bg-[#171717]"
              >
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/briefs/${brief.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={workflowLabel(workflowStep(brief.packages)).toLowerCase()} />
                      <span className="text-xs text-zinc-500">{brief.language.toUpperCase()}</span>
                    </div>
                    <h3 className="mt-4 text-xl font-medium tracking-[-0.025em]">{brief.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{brief.objective || "Campaign objective not specified"}</p>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <ArrowRight className="size-4 text-zinc-600" />
                    <Button
                      variant="danger"
                      className="min-h-9 px-3 text-xs"
                      loading={deletingId === brief.id}
                      disabled={Boolean(deletingId)}
                      onClick={() => void deleteCampaign(brief)}
                    >
                      Delete campaign
                    </Button>
                  </div>
                </div>
                <Link href={`/briefs/${brief.id}`} className="mt-6 block">
                  <PipelineStepper current={workflowStep(brief.packages)} />
                </Link>
                <div className="mt-5 flex flex-wrap gap-2">
                  {brief.packages.map((pkg) => (
                    <span key={pkg.channel} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-zinc-400">
                      {channelLabel(pkg.channel)}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
