import { CheckCircle2, XCircle } from "lucide-react";

const QUALITY_LABELS: Record<string, string> = {
  hasThreeChannels: "All three channels are covered",
  nativeBengali: "Bengali reads as native",
  xWithinLimit: "The X post is short enough",
  youtubeTitleWithinLimit: "The YouTube title is short enough",
  uniqueCtas: "Each channel has its own call to action",
  uniqueVisualDirections: "Each channel has its own visual",
  lowCopySimilarity: "The channel copy is not repeated",
  requiredTermsPresent: "Your required terms are in the copy",
  forbiddenTermsAbsent: "Nothing from the avoid list appears",
  briefAdherence: "The copy stays on the brief",
};

export function parseQuality(value?: string | null) {
  try {
    return JSON.parse(value || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function qualityIssues(quality: Record<string, unknown>) {
  return Object.entries(quality)
    .filter(
      ([key, item]) =>
        item === false && !["passed", "requiresHumanReview"].includes(key)
    )
    .map(([key]) => QUALITY_LABELS[key] || "Something needs a closer look");
}

export function QualityPanel({ value }: { value?: string | null }) {
  const quality = parseQuality(value);
  const issues = qualityIssues(quality);
  const hasResult = typeof quality.passed === "boolean";
  if (!hasResult) return null;

  if (quality.passed && !issues.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-300">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        Ready for you to review
      </div>
    );
  }

  return (
    <div className="rounded-[15px] border border-amber-400/20 bg-amber-400/8 p-4">
      <p className="text-sm font-medium text-amber-100">Please check these before sending on</p>
      <ul className="mt-3 space-y-1.5 text-sm text-amber-100/80">
        {issues.map((issue) => (
          <li key={issue} className="flex items-start gap-2">
            <XCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {issue}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PreflightPanel({ checks }: { checks: string[] }) {
  if (!checks.length) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-emerald-300">
      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      This channel is ready to approve
    </div>
  );
}
