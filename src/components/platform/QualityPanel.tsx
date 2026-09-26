import { CheckCircle2, XCircle } from "lucide-react";
import {
  HUMAN_QUALITY_KEYS,
  humanQualityPassed,
  type HumanQualityKey,
} from "@/lib/ai/quality";

/** Checks a human can act on. Internal generation heuristics stay server-side only. */
const HUMAN_QUALITY_LABELS: Record<HumanQualityKey, string> = {
  xWithinLimit: "The X post is short enough",
  youtubeTitleWithinLimit: "The YouTube title is short enough",
  requiredTermsPresent: "Your required terms are in the copy",
  forbiddenTermsAbsent: "Nothing from the avoid list appears",
};

export function parseQuality(value?: string | null) {
  try {
    return JSON.parse(value || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function qualityIssues(quality: Record<string, unknown>) {
  const issues = HUMAN_QUALITY_KEYS.filter((key) => quality[key] === false).map(
    (key) => HUMAN_QUALITY_LABELS[key]
  );
  if (quality.requiresHumanReview === true) {
    issues.push("This backup copy still needs a human read");
  }
  return issues;
}

export function QualityPanel({ value }: { value?: string | null }) {
  const quality = parseQuality(value);
  const issues = qualityIssues(quality);
  const hasResult =
    typeof quality.passed === "boolean" ||
    quality.requiresHumanReview === true ||
    HUMAN_QUALITY_KEYS.some((key) => key in quality);
  if (!hasResult) return null;

  if (!issues.length) {
    // Internal-only failures (e.g. lowCopySimilarity) must not hide Ready.
    if (!humanQualityPassed(quality)) return null;
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
