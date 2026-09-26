"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink, Radio } from "lucide-react";
import { Button, EmptyState, MetricCard, Notice, PageHeader, Skeleton, StatusBadge } from "@/components/ui/core";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { formatIst, istDateTimeLocalToIso } from "@/lib/time";

type Post = {
  id: string;
  channel: string;
  status: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  externalMockId?: string | null;
  adapterResponse?: string | null;
  package: {
    id: string;
    briefId: string;
    title?: string | null;
    copyEn?: string | null;
    imageUrl?: string | null;
    rejectionReason?: string | null;
  };
  metrics: { views: number; likes: number; ctr: number }[];
};

type QueueItem = {
  id: string;
  channel: string;
  briefId: string;
  briefTitle: string;
  copyEn?: string | null;
  imageUrl?: string | null;
};

export default function PublishPage() {
  const { show } = useToast();
  const [tab, setTab] = useState<"queue" | "live">("queue");
  const [posts, setPosts] = useState<Post[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [scheduleAt, setScheduleAt] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [postPayload, briefPayload] = await Promise.all([
        fetch("/api/publisher").then((response) => response.json()),
        fetch("/api/briefs").then((response) => response.json()),
      ]);
      setPosts(postPayload.posts || []);
      const approved: QueueItem[] = [];
      const alreadyQueued = new Set(
        (postPayload.posts || [])
          .filter((post: Post) =>
            ["scheduled", "publishing", "published"].includes(post.status)
          )
          .map((post: Post) => post.package.id)
      );
      for (const brief of briefPayload.briefs || []) {
        for (const pkg of brief.packages || []) {
          if (pkg.status === "approved" && !alreadyQueued.has(pkg.id)) {
            approved.push({
              id: pkg.id,
              channel: pkg.channel,
              briefId: brief.id,
              briefTitle: brief.title,
              copyEn: pkg.copyEn,
              imageUrl: pkg.imageUrl,
            });
          }
        }
      }
      setQueue(approved);
    } catch {
      show("The publishing workspace could not be loaded.", "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const upcoming = posts
      .filter((post) => post.status === "scheduled" && post.scheduledAt)
      .map((post) => new Date(post.scheduledAt as string).getTime())
      .filter((time) => Number.isFinite(time));
    if (!upcoming.length) return;
    const nextDue = Math.min(...upcoming);
    const wait = Math.max(800, nextDue - Date.now() + 400);
    const exact = window.setTimeout(() => void load(), wait);
    const poll = window.setInterval(() => void load(), 15_000);
    return () => {
      window.clearTimeout(exact);
      window.clearInterval(poll);
    };
  }, [posts]);

  async function schedule(item: QueueItem, now = false) {
    const time = now
      ? new Date().toISOString()
      : scheduleAt[item.id] && istDateTimeLocalToIso(scheduleAt[item.id]);
    if (!time) return show("Choose a date and time.", "error");
    setBusy(item.id);
    try {
      const endpoint = now ? "publish-now" : "schedule";
      const response = await fetch(`/api/packages/${item.id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: now ? undefined : JSON.stringify({ scheduledAt: time }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Publishing failed");
      show(now ? "Post published." : `Scheduled for ${formatIst(time)}. It will go out at that time.`, "success");
      await load();
    } catch (error) {
      show((error as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  const live = posts.filter((post) => ["published", "scheduled", "rejected"].includes(post.status));
  const totalViews = live.reduce((sum, post) => sum + (post.metrics[0]?.views || 0), 0);

  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Distribution"
        title="Schedule confidently. Publish only compliant assets."
        description="Approved posts wait here. Choose a time or publish now. This workspace records a demo post. It does not go live on Instagram, YouTube, or X."
      />
      <Notice title="Approval only adds a post to this list.">
        Nothing is scheduled or posted until you pick a time or click Publish now.
      </Notice>
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Ready to schedule" value={queue.length} />
        <MetricCard label="Live or scheduled" value={live.length} detail="Mock adapter records" />
        <MetricCard label="Unified views" value={totalViews.toLocaleString("en-IN")} detail="Simulated metrics" />
      </section>

      <div className="flex w-fit rounded-full bg-[#141414] p-1">
        {(["queue", "live"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={cn(
              "min-h-10 rounded-full px-4 text-sm capitalize text-zinc-500",
              tab === item && "bg-[#1c1c1c] text-white"
            )}
          >
            {item === "queue" ? `Queue · ${queue.length}` : `Live posts · ${live.length}`}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : tab === "queue" ? (
        !queue.length ? (
          <EmptyState
            title="No approved packages yet"
            description="Approve a package in Review and it will appear here. It will not be scheduled until you choose a time or publish now."
            action={<Link href="/approvals"><Button>Open Review</Button></Link>}
          />
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <article key={item.id} className="surface-card grid gap-4 p-4 md:grid-cols-[72px_1fr_auto] md:items-center">
                <div className="size-[72px] overflow-hidden rounded-[10px] bg-[#1c1c1c]">
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="size-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status="approved" />
                    <span className="text-xs text-zinc-500">{item.channel.replaceAll("_", " ")}</span>
                  </div>
                  <Link href={`/briefs/${item.briefId}`} className="mt-2 block truncate font-medium hover:text-[#0099ff]">
                    {item.briefTitle}
                  </Link>
                  <p className="mt-1 truncate text-sm text-zinc-500">{item.copyEn}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[210px_auto_auto]">
                  <label className="text-xs text-zinc-500">
                    Publish time (IST)
                    <input type="datetime-local" value={scheduleAt[item.id] || ""} onChange={(event) => setScheduleAt((current) => ({ ...current, [item.id]: event.target.value }))} className="input mt-1 !min-h-10" />
                  </label>
                  <Button variant="secondary" loading={busy === item.id} onClick={() => schedule(item)}>
                    <CalendarClock className="size-4" /> Schedule
                  </Button>
                  <Button loading={busy === item.id} onClick={() => schedule(item, true)}>
                    <Radio className="size-4" /> Publish now
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : !live.length ? (
        <EmptyState title="Nothing recorded yet" description="Publish an approved package through the mock adapter to begin collecting simulated metrics." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {live.map((post) => (
            <article key={post.id} id={`post-${post.id}`} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <StatusBadge status={post.status} />
                  <p className="mt-3 font-medium">{post.channel.replaceAll("_", " ")}</p>
                </div>
                <Link href={`/briefs/${post.package.briefId}`} className="text-xs text-[#0099ff]">
                  Campaign <ExternalLink className="inline size-3" />
                </Link>
              </div>
              <p className="mt-3 text-sm text-zinc-400">{post.package.copyEn}</p>
              <p className="mt-3 text-xs text-zinc-600">
                {post.publishedAt
                  ? `Posted ${formatIst(post.publishedAt)}`
                  : post.scheduledAt
                    ? new Date(post.scheduledAt).getTime() <= Date.now()
                      ? "Time reached. Posting now"
                      : `Goes out ${formatIst(post.scheduledAt)}`
                    : ""}
              </p>
              {post.status === "published" && (
                <p className="mt-1 text-xs text-zinc-500">Saved as a demo post for this workspace</p>
              )}
              {post.package.rejectionReason && (
                <div className="mt-4 rounded-[10px] bg-red-400/8 p-3 text-sm text-red-200">
                  {post.package.rejectionReason} · <Link href="/approvals" className="underline">Return to Review</Link>
                </div>
              )}
              {post.metrics[0] && (
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[#262626] pt-4">
                  <SmallMetric label="Simulated views" value={post.metrics[0].views.toLocaleString("en-IN")} />
                  <SmallMetric label="Simulated likes" value={post.metrics[0].likes.toLocaleString("en-IN")} />
                  <SmallMetric label="Simulated CTR" value={`${(post.metrics[0].ctr * 100).toFixed(1)}%`} />
                </div>
              )}
              {post.status === "published" && (
                <p className="mt-4 text-xs text-emerald-300">Passed this channel’s length and image checks</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-zinc-600">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
}

