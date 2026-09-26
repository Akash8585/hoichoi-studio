"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Save } from "lucide-react";
import { Button, EmptyState, Notice, PageHeader, Skeleton } from "@/components/ui/core";
import { useToast } from "@/components/ui/Toast";
import { PlatformPreview, type PreviewPackage } from "@/components/platform/PlatformPreview";
import { PreflightPanel, QualityPanel } from "@/components/platform/QualityPanel";
import { parseJsonArray } from "@/lib/utils";
import { PLATFORM_SPECS, type Channel } from "@/lib/platforms/specs";

type Pkg = PreviewPackage & {
  title?: string | null;
  hashtags: string;
  cta?: string | null;
  qualityChecks?: string | null;
  revision: number;
  reviewNotes?: string | null;
  brief: { title: string };
};

export default function ReviewPage() {
  const { show } = useToast();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(() => new Set());
  const [preflight, setPreflight] = useState<Record<string, string[]>>({});
  const [inlineError, setInlineError] = useState<Record<string, string>>({});

  function addBusy(id: string) {
    setBusyIds((current) => new Set(current).add(id));
  }

  function clearBusy(id: string) {
    setBusyIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/approvals");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Review queue failed to load");
      setPackages(payload.packages || []);
    } catch (error) {
      show((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  function update(id: string, field: keyof Pkg, value: string) {
    setPackages((current) =>
      current.map((pkg) => (pkg.id === id ? { ...pkg, [field]: value } : pkg))
    );
  }

  async function save(pkg: Pkg) {
    const response = await fetch(`/api/packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        copyBn: pkg.copyBn,
        copyEn: pkg.copyEn,
        title: pkg.title || undefined,
        hashtags: parseJsonArray(pkg.hashtags),
        cta: pkg.cta || undefined,
        reviewNotes: pkg.reviewNotes || "",
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Changes could not be saved");
  }

  async function saveEdits(pkg: Pkg) {
    if (busyIds.has(pkg.id)) return;
    addBusy(pkg.id);
    try {
      await save(pkg);
      show("Review edits saved", "success");
    } catch (error) {
      show((error as Error).message, "error");
    } finally {
      clearBusy(pkg.id);
    }
  }

  async function approve(pkg: Pkg) {
    if (busyIds.has(pkg.id)) return;
    addBusy(pkg.id);
    setInlineError((current) => ({ ...current, [pkg.id]: "" }));
    try {
      await save(pkg);
      const response = await fetch(`/api/packages/${pkg.id}/approve`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Preflight failed");
      setPreflight((current) => ({ ...current, [pkg.id]: payload.preflight?.checks || [] }));
      show(`${pkg.brief.title} · ${pkg.channel.replaceAll("_", " ")} approved`, "success");
      window.setTimeout(() => {
        setPackages((current) => current.filter((item) => item.id !== pkg.id));
      }, 900);
    } catch (error) {
      setInlineError((current) => ({ ...current, [pkg.id]: (error as Error).message }));
    } finally {
      clearBusy(pkg.id);
    }
  }

  async function discardAndRegenerate(pkg: Pkg) {
    if (busyIds.has(pkg.id)) return;
    if (!window.confirm("Discard this revision and generate a new one using your review notes?")) return;
    addBusy(pkg.id);
    setRegeneratingIds((current) => new Set(current).add(pkg.id));
    try {
      await save(pkg);
      const discarded = await fetch(`/api/packages/${pkg.id}/discard`, { method: "POST" });
      if (!discarded.ok) throw new Error("Could not discard this revision");
      const regenerated = await fetch(`/api/packages/${pkg.id}/regenerate`, { method: "POST" });
      const payload = await regenerated.json();
      if (!regenerated.ok) throw new Error(payload.error || "Regeneration failed");
      show("New revision queued. You can follow progress in the campaign workspace.", "success");
      setPackages((current) => {
        const siblingMap = new Map(
          (Array.isArray(payload.siblings) ? payload.siblings : []).map(
            (sibling: Pkg) => [sibling.id, sibling]
          )
        );
        return current
          .filter((item) => item.id !== pkg.id)
          .map((item) => {
            const sibling = siblingMap.get(item.id);
            return sibling ? { ...item, ...sibling } : item;
          });
      });
    } catch (error) {
      show((error as Error).message, "error");
    } finally {
      clearBusy(pkg.id);
      setRegeneratingIds((current) => {
        const next = new Set(current);
        next.delete(pkg.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Human approval gate"
        title="Review every word and frame before it can be published."
        description="Read the copy, check the image, then approve. Nothing can be scheduled until you say yes."
      />
      <Notice title="Approval only moves a package into the Publish queue.">
        After you approve, the package appears under Publish automatically. It is not scheduled or posted until a human chooses a date or clicks Publish now.
      </Notice>
      {loading ? (
        <div className="space-y-5"><Skeleton className="h-[520px]" /><Skeleton className="h-[520px]" /></div>
      ) : !packages.length ? (
        <EmptyState
          title="Everything is reviewed"
          description="New packages submitted from a campaign workspace will appear here."
          action={<Link href="/publisher"><Button>Open publish queue <ArrowRight className="size-4" /></Button></Link>}
        />
      ) : (
        <div className="space-y-7">
          {packages.map((pkg) => {
            const channel = pkg.channel as Channel;
            const spec = PLATFORM_SPECS[channel];
            const copyLimit =
              channel === "x" ? spec.maxText : channel === "instagram_reels" ? spec.maxCaption : spec.maxDesc;
            const pkgBusy = busyIds.has(pkg.id);
            const regenerating = regeneratingIds.has(pkg.id);
            return (
              <PlatformPreview
                key={pkg.id}
                pkg={pkg}
                imageLoading={regenerating}
                footer={
                  <div className="space-y-5">
                    <div className="rounded-[15px] bg-black/25 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{pkg.brief.title}</p>
                          <p className="text-xs text-zinc-500">Revision {pkg.revision}</p>
                        </div>
                        <span className="text-xs text-zinc-500">{spec.label}</span>
                      </div>
                      <ReviewField label="Bengali copy" count={pkg.copyBn?.length} limit={copyLimit}>
                        <textarea value={pkg.copyBn || ""} onChange={(event) => update(pkg.id, "copyBn", event.target.value)} rows={4} className="input font-bengali resize-none" disabled={pkgBusy} />
                      </ReviewField>
                      <ReviewField label="English copy" count={pkg.copyEn?.length} limit={copyLimit}>
                        <textarea value={pkg.copyEn || ""} onChange={(event) => update(pkg.id, "copyEn", event.target.value)} rows={4} className="input resize-none" disabled={pkgBusy} />
                      </ReviewField>
                      <ReviewField label="Review notes for regeneration">
                        <textarea value={pkg.reviewNotes || ""} onChange={(event) => update(pkg.id, "reviewNotes", event.target.value)} rows={3} placeholder="Explain exactly what should change…" className="input resize-none" disabled={pkgBusy} />
                      </ReviewField>
                    </div>
                    <QualityPanel value={pkg.qualityChecks} />
                    <PreflightPanel checks={preflight[pkg.id] || []} />
                    {inlineError[pkg.id] && <Notice tone="danger" title="Preflight blocked approval">{inlineError[pkg.id]}</Notice>}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" loading={pkgBusy && !regenerating} disabled={pkgBusy} onClick={() => saveEdits(pkg)}>
                        <Save className="size-4" /> Save edits
                      </Button>
                      <Button loading={pkgBusy && !regenerating} disabled={pkgBusy} onClick={() => approve(pkg)}>Approve package</Button>
                      <Button variant="danger" loading={regenerating} disabled={pkgBusy} onClick={() => discardAndRegenerate(pkg)}>
                        Discard & regenerate
                      </Button>
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReviewField({
  label,
  count,
  limit,
  children,
}: {
  label: string;
  count?: number;
  limit?: number;
  children: React.ReactNode;
}) {
  const exceeded = Boolean(limit && (count || 0) > limit);
  return (
    <label className="mb-4 block text-sm">
      <span className="mb-2 flex items-center justify-between text-zinc-300">
        {label}
        {limit && <span className={exceeded ? "text-red-300" : "text-zinc-600"}>{count || 0}/{limit}</span>}
      </span>
      {children}
    </label>
  );
}
