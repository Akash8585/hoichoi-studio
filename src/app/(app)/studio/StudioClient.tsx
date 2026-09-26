"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button, Notice, PageHeader, Skeleton } from "@/components/ui/core";
import { useToast } from "@/components/ui/Toast";
import { PlatformPreview, type PreviewPackage } from "@/components/platform/PlatformPreview";
import { QualityPanel, parseQuality } from "@/components/platform/QualityPanel";
import { PipelineStepper, workflowStep } from "@/components/workflow/PipelineStepper";

type Pkg = PreviewPackage & {
  textProvider?: string | null;
  textModel?: string | null;
  imageModel?: string | null;
  generationStrategy?: string | null;
  qualityChecks?: string | null;
  revision?: number;
  posts?: Array<{ status: string }>;
};

type Brief = {
  id: string;
  title: string;
  body: string;
  language: string;
  brandVoice?: string | null;
  objective?: string | null;
  audience?: string | null;
  mustInclude: string;
  mustAvoid: string;
  reviewLanguagePriority: string;
  sourceReportId?: string | null;
  packages: Pkg[];
};

const stages = [
  "Channel strategy",
  "Native Bengali",
  "Native English",
  "Channel visuals",
];

export default function StudioClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { show } = useToast();
  const briefId = params.get("brief");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(Boolean(briefId));
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    objective: "",
    audience: "",
    brandVoice: "Premium Bengali OTT, cinematic, emotionally precise",
    mustInclude: "",
    mustAvoid: "Spoilers",
    reviewLanguagePriority: "bn",
  });

  async function loadBrief(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/briefs/${id}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load campaign");
      setBrief(payload.brief);
    } catch (error) {
      show((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (briefId) void loadBrief(briefId);
  }, [briefId]);

  async function generate(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/briefs/${id}/generate`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Generation failed");
      setBrief(payload.brief);
      const uniqueWarnings = [
        ...new Set(
          (payload.warnings || []).map(
            (warning: { message: string }) => warning.message
          )
        ),
      ] as string[];
      if (uniqueWarnings.length) {
        show(
          uniqueWarnings.length === 1
            ? uniqueWarnings[0]
            : "Please review the channel cards before sending anything on.",
          "warning"
        );
      }
      show("Native copy and three distinct channel images are ready for review.", "success");
    } catch (error) {
      show((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          language: "both",
          mustInclude: form.mustInclude.split(",").map((item) => item.trim()).filter(Boolean),
          mustAvoid: form.mustAvoid.split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("Please complete all required brief fields.");
      router.replace(`/studio?brief=${payload.brief.id}`);
      await generate(payload.brief.id);
    } catch (error) {
      show((error as Error).message, "error");
      setBusy(false);
    }
  }

  async function packageAction(pkg: Pkg, action: "submit" | "regenerate") {
    setBusy(true);
    try {
      const response = await fetch(`/api/packages/${pkg.id}/${action}`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Action failed");
      show(
        action === "submit"
          ? `${pkg.channel.replaceAll("_", " ")} sent to Review`
          : "A new revision is processing",
        "success"
      );
      if (brief) await loadBrief(brief.id);
    } catch (error) {
      show((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const packages = useMemo(() => brief?.packages || [], [brief]);

  if (!briefId) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Image studio"
          title="Turn one brief into three native channel stories."
          description="Give the studio the audience, objective, tone and guardrails. Bengali and English are generated independently, with a distinct visual composition for Instagram Reels, YouTube Shorts and X."
        />
        <form onSubmit={createCampaign} className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="surface-card p-6 md:p-8">
            <p className="mb-6 text-sm font-medium">Campaign brief</p>
            <div className="space-y-5">
              <Field label="Title or campaign name" required>
                <input id="campaign-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="কাদম্বিনী নতুন পর্ব" className="input" />
              </Field>
              <Field label="What should the campaign communicate?" required>
                <textarea id="campaign-brief" required rows={7} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Describe the story, key moment, emotional promise and anything the audience should understand…" className="input resize-none" />
              </Field>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Campaign objective">
                  <input id="objective" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Drive episode starts" className="input" />
                </Field>
                <Field label="Target audience">
                  <input id="audience" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Bengali viewers, 25 to 40" className="input" />
                </Field>
              </div>
            </div>
          </section>
          <aside className="space-y-6">
            <section className="gradient-spotlight rounded-[30px] p-6 md:p-8">
              <Sparkles className="size-5" />
              <h2 className="mt-8 text-3xl font-medium tracking-[-0.04em]">Creative guardrails</h2>
              <div className="mt-6 space-y-4">
                <Field label="Brand voice">
                  <input value={form.brandVoice} onChange={(e) => setForm({ ...form, brandVoice: e.target.value })} className="input bg-black/25!" />
                </Field>
                <Field label="Must include (comma separated)">
                  <input value={form.mustInclude} onChange={(e) => setForm({ ...form, mustInclude: e.target.value })} placeholder="monsoon Kolkata, lead character" className="input bg-black/25!" />
                </Field>
                <Field label="Must avoid (comma separated)">
                  <input value={form.mustAvoid} onChange={(e) => setForm({ ...form, mustAvoid: e.target.value })} className="input bg-black/25!" />
                </Field>
                <Field label="Review Bengali or English first?">
                  <select value={form.reviewLanguagePriority} onChange={(e) => setForm({ ...form, reviewLanguagePriority: e.target.value })} className="input bg-black/25!">
                    <option value="bn">Bengali first</option>
                    <option value="en">English first</option>
                  </select>
                </Field>
              </div>
            </section>
            <Button loading={busy} className="w-full">
              Generate campaign <ArrowRight className="size-4" />
            </Button>
          </aside>
        </form>
      </div>
    );
  }

  if (loading && !brief) {
    return <div className="space-y-5"><Skeleton className="h-24" /><Skeleton className="h-130" /></div>;
  }
  if (!brief) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={brief.sourceReportId ? "Created from performance insights" : "Image studio"}
        title={brief.title}
        description={brief.objective || brief.body}
        actions={
          packages.length === 0 ? (
            <Button loading={busy} onClick={() => generate(brief.id)}>
              Generate assets <Sparkles className="size-4" />
            </Button>
          ) : undefined
        }
      />
      <section className="surface-card p-5">
        <PipelineStepper current={workflowStep(packages)} />
      </section>
      {brief.sourceReportId && (
        <Notice title="This brief inherits tactics from a weekly report.">
          Review the inherited objective, then generate a new set of channel assets.
        </Notice>
      )}
      {busy && (
        <section className="surface-card p-5">
          <p className="text-sm font-medium">Building your campaign</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {stages.map((stage, index) => (
              <div key={stage} className="rounded-[10px] bg-white/5 p-3 text-xs text-zinc-400">
                <span className="mb-2 grid size-5 place-items-center rounded-full bg-white text-[10px] text-black">{index + 1}</span>
                {stage}
              </div>
            ))}
          </div>
        </section>
      )}
      {!packages.length && !busy && (
        <Notice tone="info" title="No assets yet">Generate the first revision from this brief.</Notice>
      )}
      <section className="space-y-6">
        {packages.map((pkg) => {
          const quality = parseQuality(pkg.qualityChecks);
          const ready =
            pkg.imageStatus === "ready" &&
            pkg.imageProvider !== "svg_fallback" &&
            quality.passed === true &&
            quality.requiresHumanReview !== true;
          return (
            <PlatformPreview
              key={pkg.id}
              pkg={pkg}
              footer={
                <div className="space-y-4">
                  <QualityPanel value={pkg.qualityChecks} />
                  {!ready && (
                    <p className="text-xs text-amber-200">
                      Finish the image and copy notes above before sending this to review.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={!ready || busy} onClick={() => packageAction(pkg, "submit")}>
                      Submit for review
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => packageAction(pkg, "regenerate")}>
                      Regenerate
                    </Button>
                  </div>
                </div>
              }
            />
          );
        })}
      </section>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm text-zinc-300">
      <span className="mb-2 block">{label}{required && <span className="text-[#ff7a3d]"> *</span>}</span>
      {children}
    </label>
  );
}

